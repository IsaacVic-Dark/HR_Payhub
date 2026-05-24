<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\JWTService;

/**
 * SubscriptionController
 *
 * Handles M-Pesa STK push flow for paid subscription plans.
 *
 * ── Payment flow (polling, not WebSocket — PHP cannot hold open connections) ──
 *
 *  1. Frontend POSTs /subscription/initiate-payment
 *     → sends STK push to the customer's phone
 *     → inserts payment_transactions row (status = 'initiated')
 *
 *  2. Frontend polls GET /subscription/payment-status?checkout_request_id=xxx
 *     every 3 seconds.
 *
 *  3. Daraja calls POST /subscription/mpesa-callback (public, no auth)
 *     → if ResultCode = 0:
 *         marks transaction 'completed'
 *         activates the subscription
 *         generates a JWT and stores it in pending_tokens
 *
 *  4. Polling endpoint detects status = 'completed', returns the JWT,
 *     frontend stores it and redirects to /dashboard.
 *
 * ── DB method reference (DB.php has no queryOne / execute / beginTransaction) ─
 *
 *   SELECT one row : $rows = DB::raw($sql, $bindings); $row = (array) $rows[0];
 *   SELECT many    : $rows = DB::raw($sql, $bindings);
 *   INSERT         : DB::table('t')->insert([...]); $id = DB::lastInsertId();
 *   UPDATE/DELETE  : DB::raw($sql, $bindings);          ← returns true
 *   Transaction    : DB::transaction(function() { ... }); ← auto rollback
 */
class SubscriptionController
{
    // =========================================================================
    // POST /subscription/initiate-payment
    // No auth middleware — guarded internally by org + subscription ID check
    // =========================================================================
    public function initiatePayment(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $orgId          = (int)   ($body['organization_id'] ?? 0);
        $subscriptionId = (int)   ($body['subscription_id'] ?? 0);
        $phone          = trim($body['phone']               ?? '');
        $amount         = (float) ($body['amount']          ?? 0);

        if (!$orgId || !$subscriptionId || !$phone || $amount <= 0) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Missing required fields: organization_id, subscription_id, phone, amount.',
            ]);
            return;
        }

        // Verify subscription belongs to this org and is still pending_payment
        // FIX: DB::queryOne() does not exist — use DB::raw() and take first result
        $subRows = DB::raw(
            'SELECT os.*, sp.name AS plan_name
             FROM organization_subscriptions os
             JOIN subscription_plans sp ON sp.id = os.plan_id
             WHERE os.id = ? AND os.organization_id = ? AND os.status = ?',
            [$subscriptionId, $orgId, 'pending_payment']
        );
        $sub = !empty($subRows) ? (array) $subRows[0] : null;

        if (!$sub) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Subscription not found or not in pending_payment state.',
            ]);
            return;
        }

        require_once __DIR__ . '/../helpers/mpesa.php';

        try {
            $token       = mpesa_get_token();
            $callbackUrl = $_ENV['MPESA_CALLBACK_URL'] ?? getenv('MPESA_CALLBACK_URL');
            $accountRef  = 'PayHub-' . $orgId;
            $description = 'PayHub ' . $sub['plan_name'];

            $stkResponse = mpesa_stk_push($token, $phone, $amount, $accountRef, $description, $callbackUrl);

            if (empty($stkResponse['CheckoutRequestID'])) {
                throw new \RuntimeException('STK push failed: ' . json_encode($stkResponse));
            }

            $checkoutRequestId = $stkResponse['CheckoutRequestID'];

            // FIX: DB::insert() is an instance method, not static, and returns void.
            //      Use DB::table('...')->insert([...]) for plain value inserts.
            //      Raw SQL expressions (NOW() etc.) require DB::raw().
            DB::table('payment_transactions')->insert([
                'organization_id'    => $orgId,
                'subscription_id'    => $subscriptionId,
                'provider'           => 'mpesa',
                'transaction_type'   => 'subscription',
                'provider_request_id'=> $checkoutRequestId,
                'amount'             => $amount,
                'currency'           => 'KES',
                'status'             => 'initiated',
                'mpesa_phone'        => $phone,
                'raw_request'        => json_encode($stkResponse),
            ]);

            // FIX: DB::execute() does not exist — use DB::raw() for UPDATE statements
            DB::raw(
                'UPDATE organization_subscriptions
                 SET checkout_request_id = ?, mpesa_phone = ?
                 WHERE id = ?',
                [$checkoutRequestId, $phone, $subscriptionId]
            );

            http_response_code(200);
            echo json_encode([
                'success'             => true,
                'checkout_request_id' => $checkoutRequestId,
                'message'             => 'STK push sent. Please enter your M-Pesa PIN on your phone.',
            ]);
        } catch (\Throwable $e) {
            error_log('SubscriptionController::initiatePayment error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to initiate payment. Please try again.']);
        }
    }

    // =========================================================================
    // POST /subscription/mpesa-callback
    //
    // Public route — called by Safaricom Daraja.
    // Must ALWAYS return HTTP 200 with { ResultCode: 0 } or Daraja will retry.
    // =========================================================================
    public function mpesaCallback(): void
    {
        http_response_code(200);
        header('Content-Type: application/json');

        $raw     = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        $resultCode        = $payload['Body']['stkCallback']['ResultCode']        ?? null;
        $checkoutRequestId = $payload['Body']['stkCallback']['CheckoutRequestID'] ?? null;
        $resultDesc        = $payload['Body']['stkCallback']['ResultDesc']        ?? '';

        if (!$checkoutRequestId) {
            echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
            return;
        }

        // Idempotency — if already processed, acknowledge and exit
        // FIX: DB::queryOne() does not exist — use DB::raw()
        $txRows      = DB::raw(
            'SELECT * FROM payment_transactions WHERE provider_request_id = ?',
            [$checkoutRequestId]
        );
        $transaction = !empty($txRows) ? (array) $txRows[0] : null;

        if (!$transaction || $transaction['status'] === 'completed') {
            echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
            return;
        }

        if ((int) $resultCode === 0) {
            // ── Payment successful ────────────────────────────────────────────
            $items         = $payload['Body']['stkCallback']['CallbackMetadata']['Item'] ?? [];
            $receiptNumber = null;

            foreach ($items as $item) {
                if ($item['Name'] === 'MpesaReceiptNumber') {
                    $receiptNumber = $item['Value'];
                    break;
                }
            }

            // FIX: DB::beginTransaction() / DB::commit() / DB::rollback() do not
            //      exist as standalone static methods. Use DB::transaction(callable)
            //      which handles begin / commit / rollback automatically.
            try {
                DB::transaction(function () use ($checkoutRequestId, $receiptNumber, $raw, $resultCode, $resultDesc) {

                    // Mark transaction complete
                    DB::raw(
                        'UPDATE payment_transactions
                         SET status             = ?,
                             provider_reference  = ?,
                             raw_callback        = ?,
                             completed_at        = NOW()
                         WHERE provider_request_id = ?',
                        ['completed', $receiptNumber, $raw, $checkoutRequestId]
                    );

                    // Activate the subscription — 30-day billing period starts now
                    DB::raw(
                        'UPDATE organization_subscriptions
                         SET status                  = ?,
                             current_period_starts_at = NOW(),
                             current_period_ends_at   = DATE_ADD(NOW(), INTERVAL 30 DAY),
                             mpesa_receipt_number      = ?
                         WHERE checkout_request_id = ?',
                        ['active', $receiptNumber, $checkoutRequestId]
                    );

                    // Look up the organisation to find the admin user
                    $subRows = DB::raw(
                        'SELECT organization_id FROM organization_subscriptions
                         WHERE checkout_request_id = ?',
                        [$checkoutRequestId]
                    );
                    $sub = !empty($subRows) ? (array) $subRows[0] : null;

                    if ($sub) {
                        $userRows = DB::raw(
                            'SELECT u.id, u.organization_id, u.user_type
                             FROM users u
                             INNER JOIN organizations o ON o.primary_administrator_id = u.id
                             WHERE u.organization_id = ?',
                            [$sub['organization_id']]
                        );
                        $user = !empty($userRows) ? (array) $userRows[0] : null;

                        if ($user) {
                            $tokenData = JWTService::generateToken([
                                'user_id'             => (int) $user['id'],
                                'organization_id'     => (int) $user['organization_id'],
                                'user_type'           => $user['user_type'],
                                'setup_completed'     => 0,
                                'subscription_status' => 'active',
                            ]);

                            // Store token for the polling endpoint to retrieve.
                            // ON DUPLICATE KEY UPDATE handles Daraja double-firing.
                            DB::raw(
                                'INSERT INTO pending_tokens (checkout_request_id, token, expires_at)
                                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
                                 ON DUPLICATE KEY UPDATE
                                     token      = VALUES(token),
                                     expires_at = VALUES(expires_at)',
                                [$checkoutRequestId, $tokenData['access_token']]
                            );
                        }
                    }
                });
            } catch (\Throwable $e) {
                // DB::transaction() already rolled back — log and continue.
                // We still return 200 to Daraja; our DB error is not their problem.
                error_log('mpesaCallback success-path DB error: ' . $e->getMessage());
            }
        } else {
            // ── Payment failed / cancelled by user ────────────────────────────
            try {
                DB::raw(
                    'UPDATE payment_transactions
                     SET status           = ?,
                         mpesa_result_code = ?,
                         mpesa_result_desc = ?,
                         raw_callback      = ?
                     WHERE provider_request_id = ?',
                    ['failed', (string) $resultCode, $resultDesc, $raw, $checkoutRequestId]
                );
            } catch (\Throwable $e) {
                error_log('mpesaCallback failure-path DB error: ' . $e->getMessage());
            }
        }

        echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
    }

    // =========================================================================
    // GET /subscription/payment-status?checkout_request_id=xxx
    //
    // Polling endpoint — frontend calls every 3 seconds while waiting.
    //
    // Response shape:
    //   { success: true, status: 'initiated'|'pending'|'completed'|'failed' }
    //   When 'completed', also includes: { token: '<access_token>' }
    // =========================================================================
    public function paymentStatus(): void
    {
        $checkoutRequestId = trim($_GET['checkout_request_id'] ?? '');

        if (!$checkoutRequestId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'checkout_request_id is required.']);
            return;
        }

        // FIX: DB::queryOne() does not exist — use DB::raw()
        $txRows      = DB::raw(
            'SELECT status FROM payment_transactions WHERE provider_request_id = ?',
            [$checkoutRequestId]
        );
        $transaction = !empty($txRows) ? (array) $txRows[0] : null;

        if (!$transaction) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Transaction not found.']);
            return;
        }

        $response = [
            'success' => true,
            'status'  => $transaction['status'],
        ];

        if ($transaction['status'] === 'completed') {
            $pendingRows = DB::raw(
                'SELECT token FROM pending_tokens
                 WHERE checkout_request_id = ? AND expires_at > NOW()',
                [$checkoutRequestId]
            );
            $pending = !empty($pendingRows) ? (array) $pendingRows[0] : null;

            if ($pending) {
                $response['token'] = $pending['token'];

                // One-time use — delete so it cannot be replayed
                DB::raw(
                    'DELETE FROM pending_tokens WHERE checkout_request_id = ?',
                    [$checkoutRequestId]
                );
            }
        }

        http_response_code(200);
        echo json_encode($response);
    }
}