<?php

namespace App\Controllers;
require_once __DIR__ . '/ReimbursementResponseWrapper.php';
use App\Services\DB;
use App\Services\PayrunProcessingService;
use App\Middleware\AuthMiddleware;

/**
 * ReimbursementController
 *
 * Implements the reimbursement workflow described in the Reimbursement Module
 * Specification: submission -> automated validation (math + policy + duplicate
 * detection) -> manager -> HR -> finance approval (stages skipped when not
 * required by organization_configs) -> payment (payroll / mpesa / bank /
 * cash / check) -> post-payment bookkeeping, plus disputes and reversal.
 *
 * Design notes / deliberate simplifications (see chat write-up for the full
 * reasoning):
 *  - "Exception" state from the spec (item total != amount_requested) is
 *    represented as policy_validated=0 + policy_validation_errors rather than
 *    a new `status` enum value, to avoid widening that enum's contract.
 *  - "Request clarification" does not change `status`; it sets
 *    clarification_requested/clarification_notes so the claim stays visible
 *    in its current bucket while the employee responds.
 *  - Per-stage approved amounts and free-form workflow trail entries (dispute
 *    resolutions, clarification history) are kept in `reimbursements.metadata`
 *    (JSON) so we don't need further schema churn as the workflow evolves.
 */
class ReimbursementController
{
    // -------------------------------------------------------------------
    // Roles allowed to act as each approval stage, and as "override" roles
    // that can act at any stage (mirrors PayrunAuthorizationMiddleware's
    // admin/payroll_manager treatment).
    // -------------------------------------------------------------------
    private const OVERRIDE_ROLES = ['admin', 'payroll_manager'];
    private const MANAGER_STAGE_ROLES = ['department_manager', 'admin', 'hr_manager', 'payroll_manager'];
    private const HR_STAGE_ROLES = ['hr_manager', 'admin', 'payroll_manager'];
    private const FINANCE_STAGE_ROLES = ['finance_manager', 'admin', 'payroll_manager'];

    // =====================================================================
    // Listing / detail
    // =====================================================================

    public function index($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(success: false, message: "Invalid or missing organization ID", code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']);
            }

            $user = AuthMiddleware::getCurrentUser();
            $employee = AuthMiddleware::getCurrentEmployee();
            if (!$user) {
                return responseJson(success: false, message: "Authentication required", code: 401);
            }

            $where = ["reimbursements.organization_id = :org_id"];
            $params = [':org_id' => $org_id];

            // Role-based scoping (mirrors NotificationController's pattern)
            switch ($user['user_type']) {
                case 'admin':
                case 'hr_manager':
                case 'payroll_manager':
                case 'payroll_officer':
                case 'finance_manager':
                case 'accountant':
                    // Full visibility within the organization
                    break;

                case 'department_manager':
                    $where[] = "employees.reports_to = :manager_id";
                    $params[':manager_id'] = $employee['id'];
                    break;

                case 'employee':
                    $where[] = "reimbursements.employee_id = :employee_id";
                    $params[':employee_id'] = $employee['id'];
                    break;

                default:
                    return responseJson(success: false, message: 'Unauthorized access', code: 403);
            }

            // Optional filters
            if (!empty($_GET['status'])) {
                $where[] = "reimbursements.status = :status";
                $params[':status'] = $_GET['status'];
            }
            if (!empty($_GET['employee_id']) && is_numeric($_GET['employee_id'])) {
                $where[] = "reimbursements.employee_id = :filter_employee_id";
                $params[':filter_employee_id'] = $_GET['employee_id'];
            }
            if (!empty($_GET['reimbursement_type'])) {
                $where[] = "reimbursements.reimbursement_type = :reimbursement_type";
                $params[':reimbursement_type'] = $_GET['reimbursement_type'];
            }
            if (!empty($_GET['payout_method'])) {
                $where[] = "reimbursements.payout_method = :payout_method";
                $params[':payout_method'] = $_GET['payout_method'];
            }
            if (!empty($_GET['is_disputed'])) {
                $where[] = "reimbursements.is_disputed = 1";
            }
            if (!empty($_GET['from_date'])) {
                $where[] = "reimbursements.request_date >= :from_date";
                $params[':from_date'] = $_GET['from_date'];
            }
            if (!empty($_GET['to_date'])) {
                $where[] = "reimbursements.request_date <= :to_date";
                $params[':to_date'] = $_GET['to_date'];
            }

            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 15;
            $offset = ($page - 1) * $perPage;

            $whereClause = implode(' AND ', $where);

            $countQuery = "
                SELECT COUNT(*) as total
                FROM reimbursements
                INNER JOIN employees ON reimbursements.employee_id = employees.id
                WHERE $whereClause
            ";
            $countResult = DB::raw($countQuery, $params);
            $total = $countResult[0]->total ?? 0;

            $query = "
                SELECT
                    reimbursements.*,
                    employees.employee_number,
                    employees.firstname AS employee_first_name,
                    employees.surname   AS employee_surname,
                    CONCAT(employees.firstname, ' ', employees.surname) AS employee_full_name,
                    approver_employee.firstname AS approver_first_name,
                    approver_employee.surname   AS approver_surname
                FROM reimbursements
                INNER JOIN employees ON reimbursements.employee_id = employees.id
                LEFT JOIN employees approver_employee ON reimbursements.approver_id = approver_employee.user_id
                WHERE $whereClause
                ORDER BY reimbursements.created_at DESC
                LIMIT :pagination_limit OFFSET :pagination_offset
            ";
            $params[':pagination_limit'] = $perPage;
            $params[':pagination_offset'] = $offset;

            $reimbursements = DB::raw($query, $params);

            foreach ($reimbursements as $r) {
                if ($r->metadata) $r->metadata = json_decode($r->metadata, true);
                if ($r->policy_validation_errors) $r->policy_validation_errors = json_decode($r->policy_validation_errors, true);
            }

            $totalPages = ceil($total / $perPage);

            return responseJson(
                success: true,
                data: [
                    'reimbursements' => $reimbursements,
                ],
                message: "Fetched Reimbursements Successfully",
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => (int) $total,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_prev' => $page > 1,
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Reimbursement index error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch reimbursements", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function show($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) {
                return $reimbursement->response;
            }

            $items = DB::raw(
                "SELECT * FROM reimbursementitems WHERE reimbursement_id = :id ORDER BY expense_date ASC",
                [':id' => $id]
            );

            $auditLogs = DB::raw(
                "SELECT audit_logs.*, employees.firstname, employees.surname
                 FROM audit_logs
                 LEFT JOIN employees ON audit_logs.user_id = employees.user_id
                 WHERE audit_logs.organization_id = :org_id
                   AND audit_logs.entity_type = 'reimbursements'
                   AND audit_logs.entity_id = :id
                 ORDER BY audit_logs.created_at ASC",
                [':org_id' => $org_id, ':id' => $id]
            );

            foreach ($auditLogs as $log) {
                if ($log->details) $log->details = json_decode($log->details, true);
            }

            if ($reimbursement->metadata) $reimbursement->metadata = json_decode($reimbursement->metadata, true);
            if ($reimbursement->policy_validation_errors) $reimbursement->policy_validation_errors = json_decode($reimbursement->policy_validation_errors, true);

            return responseJson(
                success: true,
                data: [
                    'reimbursement' => $reimbursement,
                    'items' => $items,
                    'audit_trail' => $auditLogs,
                ],
                message: "Reimbursement fetched successfully"
            );
        } catch (\Exception $e) {
            error_log("Reimbursement show error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch reimbursement", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // =====================================================================
    // Submission
    // =====================================================================

    public function store($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(success: false, message: "Invalid or missing organization ID", code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']);
            }

            $user = AuthMiddleware::getCurrentUser();
            $currentEmployee = AuthMiddleware::getCurrentEmployee();
            if (!$user) {
                return responseJson(success: false, message: "Authentication required", code: 401);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            // Employees submit for themselves; admin/hr/payroll roles may submit on behalf of another employee.
            $employeeId = $data['employee_id'] ?? null;
            if ($user['user_type'] === 'employee') {
                $employeeId = $currentEmployee['id'];
            } elseif (!$employeeId) {
                return responseJson(success: false, message: "Field 'employee_id' is required", code: 400);
            }

            $employeeCheck = DB::raw(
                "SELECT * FROM employees WHERE id = :id AND organization_id = :org_id",
                [':id' => $employeeId, ':org_id' => $org_id]
            );
            if (empty($employeeCheck)) {
                return responseJson(success: false, message: "Employee not found in this organization", code: 404);
            }

            $items = $data['items'] ?? [];
            if (empty($items) || !is_array($items)) {
                return responseJson(success: false, message: "At least one reimbursement item is required", code: 400);
            }

            // ---- Stage 2: required fields per item -------------------------------
            foreach ($items as $i => $item) {
                if (!isset($item['amount']) || !is_numeric($item['amount']) || $item['amount'] <= 0) {
                    return responseJson(success: false, message: "Item #" . ($i + 1) . " is missing a valid amount", code: 400);
                }
                if (empty($item['expense_date'])) {
                    return responseJson(success: false, message: "Item #" . ($i + 1) . " is missing an expense date", code: 400);
                }
                if (empty($item['expense_category'])) {
                    return responseJson(success: false, message: "Item #" . ($i + 1) . " is missing an expense category", code: 400);
                }
            }

            $itemsTotal = array_sum(array_map(fn($it) => (float) $it['amount'], $items));
            $amountRequested = isset($data['amount_requested']) ? (float) $data['amount_requested'] : $itemsTotal;

            $reimbursementType = $data['reimbursement_type'] ?? 'expense';
            $payoutMethod = $data['payout_method'] ?? 'payroll';
            $currency = $data['currency'] ?? 'KES';
            $originalCurrency = $data['original_currency'] ?? $currency;
            $currencyRate = isset($data['currency_rate']) ? (float) $data['currency_rate'] : 1.0;
            $requestDate = $data['request_date'] ?? date('Y-m-d');
            $expenseDate = $data['expense_date'] ?? min(array_column($items, 'expense_date'));
            $description = $data['description'] ?? null;

            $configs = $this->getReimbursementConfigs($org_id);

            // ---- Stage 3: mathematical validation ---------------------------------
            $policyErrors = [];
            $mathMismatch = round($itemsTotal, 2) !== round($amountRequested, 2);
            if ($mathMismatch) {
                $policyErrors[] = sprintf(
                    "Item total (%.2f) does not match the requested amount (%.2f)",
                    $itemsTotal,
                    $amountRequested
                );
            }

            // ---- Stage 4: policy validation ----------------------------------------
            $hardFail = false;
            $limitsConfig = $configs['expense_limits'] ?? null;
            if ($limitsConfig) {
                $categories = $limitsConfig['settings']['categories'] ?? [];
                $catKey = strtolower($reimbursementType);
                if (!empty($categories) && !isset($categories[$catKey])) {
                    $policyErrors[] = "Category '$reimbursementType' is not covered by the reimbursement policy";
                } elseif (isset($categories[$catKey])) {
                    $catLimits = $categories[$catKey];
                    if (!empty($catLimits['maximum_per_claim']) && $amountRequested > $catLimits['maximum_per_claim']) {
                        $policyErrors[] = "Amount exceeds the {$reimbursementType} category limit of " . $catLimits['maximum_per_claim'];
                        $hardFail = true;
                    }
                    if (!empty($catLimits['monthly_employee_limit'])) {
                        $monthTotal = DB::raw(
                            "SELECT COALESCE(SUM(amount_requested),0) as total FROM reimbursements
                             WHERE employee_id = :employee_id AND reimbursement_type = :type
                               AND status NOT IN ('rejected','cancelled')
                               AND MONTH(request_date) = MONTH(:request_date_month) AND YEAR(request_date) = YEAR(:request_date_year)",
                            [':employee_id' => $employeeId, ':type' => $reimbursementType, ':request_date_month' => $requestDate, ':request_date_year' => $requestDate]
                        );
                        $usedThisMonth = (float) ($monthTotal[0]->total ?? 0);
                        if (($usedThisMonth + $amountRequested) > $catLimits['monthly_employee_limit']) {
                            $policyErrors[] = "This claim would exceed the employee's monthly limit for {$reimbursementType} (" . $catLimits['monthly_employee_limit'] . ")";
                            $hardFail = true;
                        }
                    }
                }
            }

            $receiptConfig = $configs['receipt_policy'] ?? null;
            $receiptRequiredAbove = $receiptConfig['settings']['receipt_required_above'] ?? 0;
            // if (($receiptConfig['settings']['receipt_required'] ?? false) && $amountRequested > $receiptRequiredAbove) {
            //     foreach ($items as $item) {
            //         if (empty($item['receipt_path'])) {
            //             $policyErrors[] = "Receipt is required for this amount";
            //             $hardFail = true;
            //             break;
            //         }
            //     }
            // }

            $paymentConfig = $configs['payment_policy'] ?? null;
            $allowedMethods = $paymentConfig['settings']['allowed_methods'] ?? null;
            if ($allowedMethods && !in_array($payoutMethod, $allowedMethods)) {
                $policyErrors[] = "Payment method '$payoutMethod' is not permitted by policy";
                $hardFail = true;
            }

            // ---- Stage 5: duplicate detection (warning only, does not block) -----
            $duplicateWarnings = [];
            foreach ($items as $item) {
                if (!empty($item['receipt_number']) && !empty($item['vendor_name'])) {
                    $dupCheck = DB::raw(
                        "SELECT reimbursementitems.id, reimbursements.reimbursement_number
                         FROM reimbursementitems
                         INNER JOIN reimbursements ON reimbursementitems.reimbursement_id = reimbursements.id
                         WHERE reimbursements.organization_id = :org_id
                           AND reimbursements.employee_id = :employee_id
                           AND reimbursementitems.vendor_name = :vendor_name
                           AND reimbursementitems.receipt_number = :receipt_number
                           AND reimbursementitems.amount = :amount",
                        [
                            ':org_id' => $org_id,
                            ':employee_id' => $employeeId,
                            ':vendor_name' => $item['vendor_name'],
                            ':receipt_number' => $item['receipt_number'],
                            ':amount' => $item['amount'],
                        ]
                    );
                    if (!empty($dupCheck)) {
                        $duplicateWarnings[] = "Possible duplicate receipt: {$item['vendor_name']} #{$item['receipt_number']} (matches {$dupCheck[0]->reimbursement_number})";
                    }
                }
            }
            $policyErrors = array_merge($policyErrors, $duplicateWarnings);

            $policyValidated = empty($policyErrors) ? 1 : 0;
            // A hard failure (limits/receipt/payment-method) rejects outright.
            // A soft failure (math mismatch, duplicate warning) keeps the claim
            // pending with policy_validated=0 so a human can reconcile it —
            // this is the "exception state" from the spec.
            $status = $hardFail ? 'rejected' : 'pending';

            $reimbursementNumber = $this->generateReimbursementNumber($org_id);

            $result = DB::transaction(function () use (
                $org_id, $employeeId, $reimbursementType, $payoutMethod, $amountRequested, $currency,
                $originalCurrency, $currencyRate, $requestDate, $expenseDate, $description, $items,
                $policyValidated, $policyErrors, $status, $reimbursementNumber, $user, $hardFail
            ) {
                DB::table('reimbursements')->insert([
                    'organization_id' => $org_id,
                    'employee_id' => $employeeId,
                    'reimbursement_number' => $reimbursementNumber,
                    'reimbursement_type' => $reimbursementType,
                    'payout_method' => $payoutMethod,
                    'amount_requested' => $amountRequested,
                    'amount_approved' => 0,
                    'amount_paid' => 0,
                    'currency' => $currency,
                    'original_currency' => $originalCurrency,
                    'currency_rate' => $currencyRate,
                    'request_date' => $requestDate,
                    'expense_date' => $expenseDate,
                    'status' => $status,
                    'description' => $description,
                    'rejection_reason' => $hardFail ? implode('; ', $policyErrors) : null,
                    'policy_validated' => $policyValidated,
                    'policy_validation_errors' => !empty($policyErrors) ? json_encode($policyErrors) : null,
                    'receipt_count' => count($items),
                    'receipts_validated' => $policyValidated,
                    'created_by' => $user['id'],
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
                $reimbursementId = (int) DB::lastInsertId();

                foreach ($items as $item) {
                    DB::table('reimbursementitems')->insert([
                        'reimbursement_id' => $reimbursementId,
                        'expense_category' => $item['expense_category'],
                        'expense_item' => $item['expense_item'] ?? null,
                        'receipt_number' => $item['receipt_number'] ?? null,
                        'amount' => $item['amount'],
                        'tax_amount' => $item['tax_amount'] ?? 0,
                        'currency' => $item['currency'] ?? $currency,
                        'expense_date' => $item['expense_date'],
                        'vendor_name' => $item['vendor_name'] ?? null,
                        'notes' => $item['notes'] ?? null,
                        'receipt_path' => $item['receipt_path'] ?? null,
                        'file_hash' => $item['file_hash'] ?? null,
                        'created_at' => date('Y-m-d H:i:s'),
                    ]);
                }

                $this->createAuditLog($org_id, $user['id'], 'reimbursements', $reimbursementId, 'submit', [
                    'amount_requested' => $amountRequested,
                    'reimbursement_type' => $reimbursementType,
                    'payout_method' => $payoutMethod,
                ]);

                $this->createAuditLog(
                    $org_id, $user['id'], 'reimbursements', $reimbursementId,
                    $status === 'rejected' ? 'policy_failed' : 'policy_validated',
                    ['errors' => $policyErrors]
                );

                return $reimbursementId;
            });

            $reimbursementId = $result;

            if ($status === 'rejected') {
                $this->notifyEmployee($org_id, $employeeId, 'reimbursement',
                    'Reimbursement rejected',
                    "Your reimbursement request $reimbursementNumber was rejected: " . implode('; ', $policyErrors),
                    ['reimbursement_id' => $reimbursementId]
                );
            } else {
                $this->notifyManagerOf($org_id, $employeeId,
                    'New reimbursement request',
                    "A reimbursement request ($reimbursementNumber, " . number_format($amountRequested, 2) . " $currency) is awaiting your approval.",
                    ['reimbursement_id' => $reimbursementId]
                );
            }

            return responseJson(
                success: true,
                data: ['id' => $reimbursementId, 'reimbursement_number' => $reimbursementNumber, 'status' => $status],
                message: $status === 'rejected' ? "Reimbursement submitted but failed policy validation" : "Reimbursement submitted successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Reimbursement store error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to submit reimbursement", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // =====================================================================
    // Edit / cancel (pre-approval only)
    // =====================================================================

    public function update($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if (!in_array($reimbursement->status, ['draft', 'pending'])) {
                return responseJson(success: false, message: "Only draft or pending claims can be edited", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $allowed = ['reimbursement_type', 'payout_method', 'description', 'expense_date', 'currency', 'original_currency', 'currency_rate'];
            $updateData = [];
            foreach ($allowed as $field) {
                if (isset($data[$field])) $updateData[$field] = $data[$field];
            }

            if (!empty($updateData)) {
                $updateData['updated_by'] = $user['id'];
                DB::table('reimbursements')->update($updateData, 'id', $id);
            }

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'update', $updateData);

            return responseJson(success: true, message: "Reimbursement updated successfully");
        } catch (\Exception $e) {
            error_log("Reimbursement update error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to update reimbursement", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function cancel($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if (in_array($reimbursement->status, ['paid', 'partpaid', 'reversed', 'cancelled'])) {
                return responseJson(success: false, message: "A {$reimbursement->status} claim cannot be cancelled", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            DB::table('reimbursements')->update([
                'status' => 'cancelled',
                'updated_by' => $user['id'],
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'cancelled', ['reason' => $data['reason'] ?? null]);
            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement', 'Reimbursement cancelled',
                "Reimbursement {$reimbursement->reimbursement_number} was cancelled.", ['reimbursement_id' => $id]);

            return responseJson(success: true, data: null, message: "Reimbursement cancelled successfully");
        } catch (\Exception $e) {
            error_log("Reimbursement cancel error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to cancel reimbursement", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // =====================================================================
    // Approval workflow (manager -> HR -> finance, auto-skipping stages the
    // configured workflow doesn't require for this amount)
    // =====================================================================

    public function approve($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            $user = AuthMiddleware::getCurrentUser();
            $employee = AuthMiddleware::getCurrentEmployee();
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $stage = $this->currentStage($reimbursement);
            if (!$stage) {
                return responseJson(success: false, message: "This claim is not awaiting approval (status: {$reimbursement->status})", code: 409);
            }

            $roleMap = [
                'manager' => self::MANAGER_STAGE_ROLES,
                'hr' => self::HR_STAGE_ROLES,
                'finance' => self::FINANCE_STAGE_ROLES,
            ];
            if (!in_array($user['user_type'], $roleMap[$stage])) {
                return responseJson(success: false, message: "You are not authorized to approve at the $stage stage", code: 403);
            }
            // A department_manager may only act at the manager stage for their
            // own direct reports — admin/hr_manager/payroll_manager can override.
            if ($stage === 'manager' && $user['user_type'] === 'department_manager'
                && (int) $employee['id'] !== (int) $reimbursement->reports_to_manager_id) {
                return responseJson(success: false, message: "You can only approve claims for your direct reports", code: 403);
            }

            $priorApproved = (float) ($reimbursement->amount_approved ?: $reimbursement->amount_requested);
            $approvedAmount = isset($data['approved_amount']) ? (float) $data['approved_amount'] : $priorApproved;
            $isPartial = round($approvedAmount, 2) < round($reimbursement->amount_requested, 2);
            $comments = $data['comments'] ?? null;

            $stageColumn = $stage . '_approved_amount';
            $updateData = [
                $stageColumn => $approvedAmount,
                'amount_approved' => $approvedAmount,
                'approver_id' => $user['id'],
                'updated_by' => $user['id'],
            ];

            // Determine whether the next stage is required, given the (possibly
            // reduced) approved amount and the org's configured workflow.
            $configs = $this->getReimbursementConfigs($org_id);
            $workflow = $configs['approval_workflow']['settings']['workflow'] ?? [];
            $nextStage = $this->nextRequiredStage($stage, $approvedAmount, $workflow);

            if ($nextStage) {
                $updateData['status'] = $stage . 'approved'; // managerapproved | hrapproved
                $auditAction = $stage . '_approved';
            } else {
                // Fully approved — ready for payment.
                $updateData['status'] = 'scheduled';
                $updateData['amount_approved'] = $approvedAmount;
                $updateData['approved_at'] = date('Y-m-d H:i:s');
                $updateData['scheduled_payment_date'] = $reimbursement->payout_method === 'payroll' ? null : date('Y-m-d');
                $auditAction = $stage . '_approved';
            }

            if ($isPartial) {
                $updateData['partial_approval_amount'] = $approvedAmount;
            }

            DB::table('reimbursements')->update($updateData, 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, $auditAction, [
                'stage' => $stage, 'approved_amount' => $approvedAmount, 'comments' => $comments, 'partial' => $isPartial,
            ]);

            if ($isPartial) {
                $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'partially_approved', [
                    'requested' => $reimbursement->amount_requested, 'approved' => $approvedAmount,
                ]);
            }

            $message = $nextStage
                ? "Approved at $stage stage; forwarded for $nextStage approval"
                : "Reimbursement fully approved and scheduled for payment";

            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement',
                $nextStage ? 'Reimbursement approval in progress' : 'Reimbursement approved',
                "{$reimbursement->reimbursement_number}: $message", ['reimbursement_id' => $id]
            );

            return responseJson(success: true, data: ['status' => $updateData['status'], 'next_stage' => $nextStage], message: $message);
        } catch (\Exception $e) {
            error_log("Reimbursement approve error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to approve reimbursement", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function reject($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            $stage = $this->currentStage($reimbursement);
            if (!$stage) {
                return responseJson(success: false, message: "This claim is not awaiting approval (status: {$reimbursement->status})", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            $employee = AuthMiddleware::getCurrentEmployee();
            $roleMap = ['manager' => self::MANAGER_STAGE_ROLES, 'hr' => self::HR_STAGE_ROLES, 'finance' => self::FINANCE_STAGE_ROLES];
            if (!in_array($user['user_type'], $roleMap[$stage])) {
                return responseJson(success: false, message: "You are not authorized to reject at the $stage stage", code: 403);
            }
            if ($stage === 'manager' && $user['user_type'] === 'department_manager'
                && (int) $employee['id'] !== (int) $reimbursement->reports_to_manager_id) {
                return responseJson(success: false, message: "You can only reject claims for your direct reports", code: 403);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $reason = $data['reason'] ?? 'Rejected';

            DB::table('reimbursements')->update([
                'status' => 'rejected',
                'rejection_reason' => $reason,
                'approver_id' => $user['id'],
                'updated_by' => $user['id'],
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'rejected', ['stage' => $stage, 'reason' => $reason]);

            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement', 'Reimbursement rejected',
                "{$reimbursement->reimbursement_number} was rejected at the $stage stage: $reason", ['reimbursement_id' => $id]);

            return responseJson(success: true, data: null, message: "Reimbursement rejected");
        } catch (\Exception $e) {
            error_log("Reimbursement reject error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to reject reimbursement", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function requestClarification($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            $user = AuthMiddleware::getCurrentUser();
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $notes = $data['notes'] ?? '';

            DB::table('reimbursements')->update([
                'clarification_requested' => 1,
                'clarification_notes' => $notes,
                'updated_by' => $user['id'],
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'update', ['clarification_requested' => true, 'notes' => $notes]);
            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement', 'Clarification requested',
                "{$reimbursement->reimbursement_number}: $notes", ['reimbursement_id' => $id]);

            return responseJson(success: true, data: null, message: "Clarification requested");
        } catch (\Exception $e) {
            error_log("Reimbursement clarification error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to request clarification", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // =====================================================================
    // Employee dispute + HR resolution
    // =====================================================================

    public function dispute($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if (!in_array($reimbursement->status, ['rejected']) && !$reimbursement->partial_approval_amount) {
                return responseJson(success: false, message: "Only a rejected or partially-approved claim can be disputed", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            $employee = AuthMiddleware::getCurrentEmployee();
            if ($user['user_type'] === 'employee' && (int) $employee['id'] !== (int) $reimbursement->employee_id) {
                return responseJson(success: false, message: "You can only dispute your own claim", code: 403);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $reason = $data['reason'] ?? '';
            if (!$reason) {
                return responseJson(success: false, message: "A dispute reason is required", code: 400);
            }

            DB::table('reimbursements')->update([
                'is_disputed' => 1,
                'disputed_reason' => $reason,
                'disputed_at' => date('Y-m-d H:i:s'),
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'disputed', ['reason' => $reason]);
            $this->notifyRole($org_id, ['hr_manager', 'admin'], 'reimbursement', 'Reimbursement disputed',
                "{$reimbursement->reimbursement_number} was disputed: $reason", ['reimbursement_id' => $id]);

            return responseJson(success: true, data: null, message: "Dispute recorded");
        } catch (\Exception $e) {
            error_log("Reimbursement dispute error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to record dispute", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function resolveDispute($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if (!$reimbursement->is_disputed) {
                return responseJson(success: false, message: "This claim is not disputed", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            if (!in_array($user['user_type'], ['hr_manager', 'admin'])) {
                return responseJson(success: false, message: "Only HR or an admin can resolve a dispute", code: 403);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $decision = $data['decision'] ?? null; // confirm | increase | reject
            if (!in_array($decision, ['confirm', 'increase', 'reject'])) {
                return responseJson(success: false, message: "decision must be one of: confirm, increase, reject", code: 400);
            }

            $updateData = ['updated_by' => $user['id']];
            if ($decision === 'increase') {
                $newAmount = (float) ($data['new_amount'] ?? $reimbursement->amount_requested);
                $updateData['amount_approved'] = $newAmount;
                $updateData['status'] = 'scheduled';
                $updateData['approved_at'] = date('Y-m-d H:i:s');
            } elseif ($decision === 'confirm') {
                $updateData['status'] = $reimbursement->status === 'rejected' ? 'rejected' : 'scheduled';
            } else { // reject
                $updateData['status'] = 'rejected';
                $updateData['rejection_reason'] = $data['comments'] ?? 'Dispute rejected';
            }

            $existingMeta = $reimbursement->metadata ? json_decode($reimbursement->metadata, true) : [];
            $existingMeta['dispute_resolution'] = [
                'decision' => $decision,
                'comments' => $data['comments'] ?? null,
                'resolved_by' => $user['id'],
                'resolved_at' => date('Y-m-d H:i:s'),
            ];
            $updateData['metadata'] = json_encode($existingMeta);

            DB::table('reimbursements')->update($updateData, 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'update', ['dispute_decision' => $decision]);
            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement', 'Dispute resolved',
                "{$reimbursement->reimbursement_number}: dispute resolved ($decision)", ['reimbursement_id' => $id]);

            return responseJson(success: true, data: null, message: "Dispute resolved");
        } catch (\Exception $e) {
            error_log("Reimbursement resolveDispute error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to resolve dispute", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // =====================================================================
    // Payment processing
    // =====================================================================

    /** Initiate a direct payment (mpesa / banktransfer / wallet) */
    public function processPayment($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if ($reimbursement->status !== 'scheduled') {
                return responseJson(success: false, message: "Only a scheduled claim can be paid (status: {$reimbursement->status})", code: 409);
            }
            if ($reimbursement->payout_method === 'payroll') {
                return responseJson(success: false, message: "Use the payroll attachment endpoint for payroll-method claims", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            if (!in_array($user['user_type'], ['finance_manager', 'accountant', 'admin', 'payroll_manager'])) {
                return responseJson(success: false, message: "You are not authorized to process payments", code: 403);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $providerMap = ['mpesa' => 'mpesa', 'banktransfer' => 'bank_transfer', 'wallet' => 'manual', 'cash' => 'manual', 'check' => 'manual'];
            $provider = $providerMap[$reimbursement->payout_method] ?? 'manual';

            $employee = DB::raw("SELECT id, phone FROM employees WHERE id = :id", [':id' => $reimbursement->employee_id]);

            $insertData = [
                'organization_id' => $org_id,
                'employee_id' => $reimbursement->employee_id,
                'reimbursement_id' => $id,
                'provider' => $provider,
                'transaction_type' => 'reimbursement',
                'amount' => $reimbursement->amount_approved,
                'currency' => $reimbursement->currency,
                'status' => 'initiated',
                'initiated_by_user_id' => $user['id'],
                'initiated_at' => date('Y-m-d H:i:s'),
            ];
            if ($reimbursement->payout_method === 'mpesa') {
                $insertData['mpesa_phone'] = $data['phone'] ?? ($employee[0]->phone ?? null);
            }
            if (!empty($data['reference'])) {
                $insertData['provider_reference'] = $data['reference'];
            }

            DB::table('payment_transactions')->insert($insertData);
            $paymentTxnId = (int) DB::lastInsertId();

            DB::table('reimbursements')->update([
                'payment_transaction_id' => $paymentTxnId,
                'updated_by' => $user['id'],
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'payment_initiated', [
                'payment_transaction_id' => $paymentTxnId, 'method' => $reimbursement->payout_method,
            ]);

            return responseJson(success: true, data: ['payment_transaction_id' => $paymentTxnId], message: "Payment initiated");
        } catch (\Exception $e) {
            error_log("Reimbursement processPayment error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to initiate payment", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    /**
     * Confirm a payment — this stands in for a real provider callback (M-Pesa
     * Daraja / bank webhook) and also covers cash/check, which are confirmed
     * manually by Finance per the spec. Wire your real Daraja/bank callback
     * handler to call this same logic after verifying the provider payload.
     */
    public function confirmPayment($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if (!in_array($reimbursement->status, ['scheduled', 'partpaid'])) {
                return responseJson(success: false, message: "This claim is not awaiting payment confirmation", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            if (!in_array($user['user_type'], ['finance_manager', 'accountant', 'admin', 'payroll_manager'])) {
                return responseJson(success: false, message: "You are not authorized to confirm payments", code: 403);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $amountPaid = isset($data['amount_paid']) ? (float) $data['amount_paid'] : (float) $reimbursement->amount_approved;
            $paymentReference = $data['payment_reference'] ?? null;

            if (in_array($reimbursement->payout_method, ['cash', 'check']) && !$paymentReference) {
                return responseJson(success: false, message: "payment_reference is required for cash/check payments", code: 400);
            }

            if ($reimbursement->payment_transaction_id) {
                DB::table('payment_transactions')->update([
                    'status' => 'completed',
                    'provider_reference' => $paymentReference,
                    'completed_at' => date('Y-m-d H:i:s'),
                ], 'id', $reimbursement->payment_transaction_id);
            }

            $status = round($amountPaid, 2) >= round((float) $reimbursement->amount_approved, 2) ? 'paid' : 'partpaid';

            DB::table('reimbursements')->update([
                'amount_paid' => $amountPaid,
                'paid_at' => date('Y-m-d H:i:s'),
                'payment_reference' => $paymentReference,
                'status' => $status,
                'updated_by' => $user['id'],
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'paid', [
                'amount_paid' => $amountPaid, 'payment_reference' => $paymentReference,
            ]);

            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement', 'Reimbursement paid',
                "{$reimbursement->reimbursement_number}: " . number_format($amountPaid, 2) . " {$reimbursement->currency} has been paid.",
                ['reimbursement_id' => $id]);

            return responseJson(success: true, data: ['status' => $status], message: "Payment confirmed");
        } catch (\Exception $e) {
            error_log("Reimbursement confirmPayment error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to confirm payment", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function failPayment($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            $user = AuthMiddleware::getCurrentUser();
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $reason = $data['reason'] ?? 'Payment failed';

            if ($reimbursement->payment_transaction_id) {
                DB::table('payment_transactions')->update([
                    'status' => 'failed',
                    'failure_reason' => $reason,
                ], 'id', $reimbursement->payment_transaction_id);
            }

            DB::table('reimbursements')->update([
                'status' => 'failed',
                'updated_by' => $user['id'],
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'payment_failed', ['reason' => $reason]);
            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement', 'Reimbursement payment failed',
                "{$reimbursement->reimbursement_number}: payment failed ($reason). Please update your payment details.",
                ['reimbursement_id' => $id]);

            return responseJson(success: true, data: null, message: "Payment marked as failed");
        } catch (\Exception $e) {
            error_log("Reimbursement failPayment error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to record payment failure", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function reverse($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if (!in_array($reimbursement->status, ['paid', 'partpaid'])) {
                return responseJson(success: false, message: "Only a paid claim can be reversed", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            if (!in_array($user['user_type'], ['finance_manager', 'admin'])) {
                return responseJson(success: false, message: "Only Finance or an admin can reverse a payment", code: 403);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $reason = $data['reason'] ?? 'Reversed';

            DB::table('reimbursements')->update([
                'status' => 'reversed',
                'updated_by' => $user['id'],
            ], 'id', $id);

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'reversed', ['reason' => $reason]);
            $this->notifyRole($org_id, ['hr_manager', 'finance_manager', 'admin'], 'reimbursement', 'Reimbursement reversed',
                "{$reimbursement->reimbursement_number} was reversed: $reason", ['reimbursement_id' => $id]);
            $this->notifyEmployee($org_id, $reimbursement->employee_id, 'reimbursement', 'Reimbursement reversed',
                "{$reimbursement->reimbursement_number} has been reversed. Please contact HR/Finance for details.",
                ['reimbursement_id' => $id]);

            return responseJson(success: true, data: null, message: "Reimbursement reversed");
        } catch (\Exception $e) {
            error_log("Reimbursement reverse error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to reverse reimbursement", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // =====================================================================
    // Payroll attachment (payout_method = 'payroll')
    // =====================================================================

    public function attachToPayrun($org_id, $id)
    {
        try {
            $reimbursement = $this->findOrFail($org_id, $id);
            if ($reimbursement instanceof \App\Controllers\ReimbursementResponseWrapper) return $reimbursement->response;

            if ($reimbursement->payout_method !== 'payroll') {
                return responseJson(success: false, message: "This claim is not a payroll-method reimbursement", code: 409);
            }
            if ($reimbursement->status !== 'scheduled') {
                return responseJson(success: false, message: "Only a scheduled claim can be attached to a payrun (status: {$reimbursement->status})", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $payrunId = $data['payrun_id'] ?? null;
            if ($payrunId) {
                $payrun = DB::raw("SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id", [':id' => $payrunId, ':org_id' => $org_id]);
            } else {
                $payrun = DB::raw(
                    "SELECT * FROM payruns WHERE organization_id = :org_id AND status IN ('draft','reviewed') AND deleted_at IS NULL
                     ORDER BY pay_period_start ASC LIMIT 1",
                    [':org_id' => $org_id]
                );
            }

            if (empty($payrun)) {
                return responseJson(success: false, message: "No open (draft/reviewed) payrun found. Create a next-period or off-cycle payrun first.", code: 409);
            }
            $payrun = $payrun[0];
            if ($payrun->status === 'finalized') {
                return responseJson(success: false, message: "That payrun is already finalized. Choose the next payrun or an off-cycle run instead.", code: 409);
            }

            $amount = (float) $reimbursement->amount_approved;
            $isTaxable = (bool) $reimbursement->is_taxable;
            $employeeId = (int) $reimbursement->employee_id;

            // Net pay is the total amount payable to the employee including
            // reimbursements, so gross/net for this employee must be recomputed
            // once the claim is attached — not just have two columns bumped on
            // payrun_details. Point the reimbursement at the payrun first (inside
            // a transaction so a processing failure rolls the attachment back
            // too), then let PayrunProcessingService — which is also the source
            // of truth for how a full payrun run computes reimbursements —
            // recompute this one employee's row and the payrun's header totals.
            // This keeps a single place that turns reimbursements into gross/net,
            // whether it runs via the bulk process() or this single-employee path.
            try {
                $result = DB::transaction(function () use ($org_id, $id, $payrun, $employeeId, $user) {
                    DB::table('reimbursements')->update([
                        'payrun_id' => $payrun->id,
                        'payslip_inclusion' => 'current',
                        'scheduled_payment_date' => $payrun->pay_period_end,
                        'updated_by' => $user['id'],
                    ], 'id', $id);

                    return (new PayrunProcessingService())
                        ->processSingleEmployee($org_id, $payrun->id, $employeeId, $user['id']);
                });
            } catch (\RuntimeException $e) {
                // e.g. employee not found/active, or payrun finalized mid-request —
                // surface as a 409 rather than a generic 500, and nothing was committed.
                return responseJson(success: false, message: $e->getMessage(), code: 409);
            }

            $this->createAuditLog($org_id, $user['id'], 'reimbursements', $id, 'scheduled', [
                'payrun_id' => $payrun->id, 'amount' => $amount, 'taxable' => $isTaxable,
            ]);

            return responseJson(
                success: true,
                data: ['payrun_id' => $payrun->id, 'net_pay' => $result['net_pay'], 'gross_pay' => $result['gross_pay']],
                message: "Reimbursement attached to payrun {$payrun->payrun_name}"
            );
        } catch (\Exception $e) {
            error_log("Reimbursement attachToPayrun error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to attach reimbursement to payrun", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    /**
     * Mark all payroll-method reimbursements attached to a payrun as paid.
     * Call this from PayrunController::finalizePayrun() once salary payment
     * is confirmed (see the snippet in the chat write-up), or invoke it
     * directly for now.
     */
    public function markPayrollReimbursementsPaid($org_id, $payrun_id)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();
            if (!in_array($user['user_type'], ['admin', 'payroll_manager', 'finance_manager'])) {
                return responseJson(success: false, message: "You are not authorized to confirm payroll payments", code: 403);
            }

            $rows = DB::raw(
                "SELECT * FROM reimbursements WHERE organization_id = :org_id AND payrun_id = :payrun_id AND payout_method = 'payroll' AND status = 'scheduled'",
                [':org_id' => $org_id, ':payrun_id' => $payrun_id]
            );

            foreach ($rows as $r) {
                DB::table('reimbursements')->update([
                    'amount_paid' => $r->amount_approved,
                    'paid_at' => date('Y-m-d H:i:s'),
                    'status' => 'paid',
                    'updated_by' => $user['id'],
                ], 'id', $r->id);

                $this->createAuditLog($org_id, $user['id'], 'reimbursements', $r->id, 'paid', ['via' => 'payrun_finalize', 'payrun_id' => $payrun_id]);
                $this->notifyEmployee($org_id, $r->employee_id, 'reimbursement', 'Reimbursement paid',
                    "{$r->reimbursement_number} was paid with your salary.", ['reimbursement_id' => $r->id]);
            }

            return responseJson(success: true, data: ['count' => count($rows)], message: count($rows) . " reimbursement(s) marked paid");
        } catch (\Exception $e) {
            error_log("markPayrollReimbursementsPaid error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to mark payroll reimbursements paid", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // =====================================================================
    // Internal helpers
    // =====================================================================

    private function findOrFail($org_id, $id)
    {
        if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
            return new ReimbursementResponseWrapper(responseJson(success: false, message: "Invalid organization or reimbursement ID", code: 400));
        }
        $rows = DB::raw(
            "SELECT reimbursements.*, employees.reports_to AS reports_to_manager_id
             FROM reimbursements
             INNER JOIN employees ON reimbursements.employee_id = employees.id
             WHERE reimbursements.id = :id AND reimbursements.organization_id = :org_id",
            [':id' => $id, ':org_id' => $org_id]
        );
        if (empty($rows)) {
            return new ReimbursementResponseWrapper(responseJson(success: false, message: "Reimbursement not found", code: 404));
        }
        return $rows[0];
    }

    /** Determine which approval stage a claim is currently awaiting, or null if none. */
    private function currentStage($reimbursement): ?string
    {
        return match ($reimbursement->status) {
            'pending' => 'manager',
            'managerapproved' => 'hr',
            'hrapproved' => 'finance',
            default => null,
        };
    }

    /** Given the stage just completed and the approved amount, find the next required stage (or null). */
    private function nextRequiredStage(string $completedStage, float $approvedAmount, array $workflow): ?string
    {
        $order = ['manager', 'hr', 'finance'];
        $completedIndex = array_search($completedStage, $order);
        $byStage = [];
        foreach ($workflow as $w) {
            $byStage[$w['stage']] = $w;
        }
        for ($i = $completedIndex + 1; $i < count($order); $i++) {
            $stage = $order[$i];
            $cfg = $byStage[$stage] ?? null;
            if (!$cfg) continue; // no config entry => not required
            $required = $cfg['required'] ?? false;
            $threshold = $cfg['threshold'] ?? 0;
            if ($required && $approvedAmount >= $threshold) {
                return $stage;
            }
        }
        return null;
    }

    /** Read & normalize the org's reimbursement-related organization_configs rows. */
    private function getReimbursementConfigs($org_id): array
    {
        $rows = DB::raw(
            "SELECT * FROM organization_configs WHERE organization_id = :org_id AND config_type = 'reimbursement' AND is_active = 1 AND status = 'approved'",
            [':org_id' => $org_id]
        );

        $map = [];
        foreach ($rows as $row) {
            $settings = $row->settings ? json_decode($row->settings, true) : [];
            $entry = ['id' => $row->id, 'name' => $row->name, 'settings' => $settings, 'finance_threshold' => $row->finance_threshold];
            $name = strtolower($row->name);
            if (str_contains($name, 'approval workflow')) $map['approval_workflow'] = $entry;
            elseif (str_contains($name, 'receipt policy')) $map['receipt_policy'] = $entry;
            elseif (str_contains($name, 'expense limits')) $map['expense_limits'] = $entry;
            elseif (str_contains($name, 'payment policy')) $map['payment_policy'] = $entry;
            elseif (str_contains($name, 'currency policy')) $map['currency_policy'] = $entry;
        }
        return $map;
    }

    private function generateReimbursementNumber($org_id): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $candidate = 'RB-' . $org_id . '-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
            $exists = DB::raw(
                "SELECT id FROM reimbursements WHERE organization_id = :org_id AND reimbursement_number = :num",
                [':org_id' => $org_id, ':num' => $candidate]
            );
            if (empty($exists)) return $candidate;
        }
        return 'RB-' . $org_id . '-' . time();
    }

    private function createAuditLog($orgId, $userId, $entityType, $entityId, $action, $details = null)
    {
        try {
            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id' => $userId,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'action' => $action,
                'details' => $details ? json_encode($details) : null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Failed to create audit log: " . $e->getMessage());
        }
    }

    private function notifyEmployee($orgId, $employeeId, $type, $title, $message, $metadata = null)
    {
        try {
            DB::table('notifications')->insert([
                'employee_id' => $employeeId,
                'organization_id' => $orgId,
                'title' => $title,
                'message' => $message,
                'type' => $type,
                'metadata' => $metadata ? json_encode($metadata) : null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Failed to create notification: " . $e->getMessage());
        }
    }

    /** Notify the employee's direct manager (reports_to); falls back to HR/admin if none set. */
    private function notifyManagerOf($orgId, $employeeId, $title, $message, $metadata = null)
    {
        $employee = DB::raw("SELECT reports_to FROM employees WHERE id = :id", [':id' => $employeeId]);
        $reportsTo = $employee[0]->reports_to ?? null;
        if ($reportsTo) {
            $this->notifyEmployee($orgId, $reportsTo, 'reimbursement', $title, $message, $metadata);
        } else {
            $this->notifyRole($orgId, ['hr_manager', 'admin'], 'reimbursement', $title, $message, $metadata);
        }
    }

    /** Notify every employee whose linked user account has one of the given roles. */
    private function notifyRole($orgId, array $userTypes, $type, $title, $message, $metadata = null)
    {
        $named = [':org_id' => $orgId];
        $namedPlaceholders = [];
        foreach ($userTypes as $i => $type_) {
            $key = ":role_$i";
            $named[$key] = $type_;
            $namedPlaceholders[] = $key;
        }
        $namedSql = "SELECT employees.id FROM employees
                     INNER JOIN users ON employees.user_id = users.id
                     WHERE employees.organization_id = :org_id AND users.user_type IN (" . implode(',', $namedPlaceholders) . ")";
        $recipients = DB::raw($namedSql, $named);
        foreach ($recipients as $r) {
            $this->notifyEmployee($orgId, $r->id, $type, $title, $message, $metadata);
        }
    }
}