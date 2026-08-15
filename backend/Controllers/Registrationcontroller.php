<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\JWTService;
use App\Services\ValidationService;

class RegistrationController
{
    // -------------------------------------------------------------------------
    // POST /register
    // -------------------------------------------------------------------------
    public function register(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        // ── 1. Validate required fields ───────────────────────────────────────
        $errors = [];

        $email       = trim($body['email']       ?? '');
        $username    = trim($body['username']     ?? '');
        $password    = $body['password']          ?? '';
        $phone       = trim($body['phone']        ?? '');
        $countryId   = isset($body['country_id']) ? (int) $body['country_id'] : 0;
        $countyId    = isset($body['county_id'])  ? (int) $body['county_id']  : 0;
        $companyName = trim($body['company_name'] ?? '');

        // Email
        if (empty($email)) {
            $errors['email'] = 'Email is required.';
        } elseif (!ValidationService::validateEmail($email)) {
            $errors['email'] = 'Please enter a valid email address.';
        }

        // Username
        if (empty($username)) {
            $errors['username'] = 'Username is required.';
        } elseif (strlen($username) < 3 || strlen($username) > 50) {
            $errors['username'] = 'Username must be between 3 and 50 characters.';
        }

        // Password
        if (empty($password)) {
            $errors['password'] = 'Password is required.';
        } else {
            $pwResult = ValidationService::validatePassword($password);
            if ($pwResult !== true) {
                $errors['password'] = $pwResult;
            }
        }

        // Phone
        if (empty($phone)) {
            $errors['phone'] = 'Phone number is required.';
        }

        // Country
        $countryRow = null;
        if (empty($countryId)) {
            $errors['country_id'] = 'Country is required.';
        } else {
            $countryRows = DB::raw(
                'SELECT id FROM countries WHERE id = ? AND is_active = 1',
                [$countryId]
            );
            if (empty($countryRows)) {
                $errors['country_id'] = 'Selected country is invalid.';
            } else {
                $countryRow = (array) $countryRows[0];
            }
        }

        // County (only checked if country itself was valid)
        $countyRow = null;
        if (empty($countyId)) {
            $errors['county_id'] = 'County is required.';
        } elseif ($countryRow) {
            $countyRows = DB::raw(
                'SELECT id FROM counties WHERE id = ? AND country_id = ? AND is_active = 1',
                [$countyId, $countryId]
            );
            if (empty($countyRows)) {
                $errors['county_id'] = 'Selected county does not belong to the selected country.';
            } else {
                $countyRow = (array) $countyRows[0];
            }
        }

        // Company name
        $orgResult = ValidationService::validateOrganizationData(['organization_name' => $companyName]);
        if ($orgResult !== true) {
            $errors['company_name'] = $orgResult[0];
        }

        if (!empty($errors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'errors' => $errors]);
            return;
        }

        // ── 2. Resolve plan ───────────────────────────────────────────────────
        $allowedPlans  = ['starter', 'professional', 'enterprise'];
        $allowedCycles = ['monthly', 'annual'];

        $planBase = (isset($body['plan']) && in_array($body['plan'], $allowedPlans, true))
            ? $body['plan']
            : 'starter';
        $cycle    = (isset($body['billing_cycle']) && in_array($body['billing_cycle'], $allowedCycles, true))
            ? $body['billing_cycle']
            : 'monthly';
        $planCode = isset($body['plan_code'])
            ? trim($body['plan_code'])
            : $planBase . '_' . $cycle;

        // ── 3. Look up plan via DB::raw() ─────────────────────────────────────
        // FIX: DB has no queryOne() — use DB::raw() which returns an array of
        //      stdClass objects, then take the first element.
        $planRows = DB::raw(
            'SELECT * FROM subscription_plans WHERE code = ? AND is_active = 1',
            [$planCode]
        );
        $plan = !empty($planRows) ? (array) $planRows[0] : null;

        if (!$plan) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Subscription plan not found or inactive.']);
            return;
        }

        // ── 4. Check email uniqueness ─────────────────────────────────────────
        // FIX: same as above — DB::raw() instead of DB::queryOne()
        $existingRows = DB::raw('SELECT id FROM users WHERE email = ?', [$email]);
        if (!empty($existingRows)) {
            http_response_code(409);
            echo json_encode(['success' => false, 'errors' => ['email' => 'This email is already registered.']]);
            return;
        }

        // ── 5. DB transaction ─────────────────────────────────────────────────
        // FIX: DB has no beginTransaction() / commit() / rollback() as standalone
        //      static methods. Use DB::transaction(callable) which handles all
        //      three internally. Pass $orgId, $userId, $subId by reference so
        //      they are available outside the closure for the response below.
        $orgId    = null;
        $userId   = null;
        $subId    = null;
        $isStarter = ($planBase === 'starter');

        try {
            DB::transaction(function () use (
                $companyName,
                $countryId,
                $countyId,
                $phone,
                $email,
                $username,
                $password,
                $plan,
                $planCode,
                $isStarter,
                &$orgId,
                &$userId,
                &$subId
            ) {
                // 5a. INSERT organization — primary_administrator_id left NULL
                //     until we have the user ID from the next insert.
                //
                // FIX: DB::insert() is an *instance* method, not static.
                //      Call it via DB::table('tablename')->insert([...]).
                //      It returns void, so get the new ID with DB::lastInsertId().
                DB::table('organizations')->insert([
                    'name'           => $companyName,
                    'country_id'     => $countryId,
                    'county_id'      => $countyId,
                    'primary_phone'  => $phone,
                    'official_email' => $email,
                ]);
                $orgId = (int) DB::lastInsertId();

                // 5b. INSERT admin user
                $passwordHash = password_hash($password, PASSWORD_BCRYPT);
                DB::table('users')->insert([
                    'organization_id' => $orgId,
                    'username'        => $username,
                    'email'           => $email,
                    'password_hash'   => $passwordHash,
                    'user_type'       => 'admin',
                ]);
                $userId = (int) DB::lastInsertId();

                // 5c. UPDATE org — set primary_administrator_id now that we
                //     have the user ID.
                DB::table('organizations')->update(
                    ['primary_administrator_id' => $userId],
                    'id',
                    $orgId
                );

                // 5d. INSERT subscription
                // FIX: DB::table()->insert() cannot use MySQL functions like
                //      NOW() or DATE_ADD() as plain values. Use DB::raw() for
                //      any INSERT that needs SQL expressions.
                $status    = $isStarter ? 'trialing' : 'pending_payment';
                $trialDays = (int) ($plan['trial_days'] ?? 0);

                if ($isStarter) {
                    DB::raw(
                        'INSERT INTO organization_subscriptions
                             (organization_id, plan_id, status, starts_at, trial_ends_at, mpesa_phone)
                         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?)',
                        [$orgId, $plan['id'], $status, $trialDays, $phone]
                    );
                } else {
                    DB::raw(
                        'INSERT INTO organization_subscriptions
                             (organization_id, plan_id, status, starts_at, mpesa_phone)
                         VALUES (?, ?, ?, NOW(), ?)',
                        [$orgId, $plan['id'], $status, $phone]
                    );
                }
                $subId = (int) DB::lastInsertId();
            });

            // ── 6. Build response ─────────────────────────────────────────────
            if ($isStarter) {
                // Starter — issue JWT immediately, trial is active right away.
                $tokenData = JWTService::generateToken([
                    'user_id'             => $userId,
                    'organization_id'     => $orgId,
                    'user_type'           => 'admin',
                    'setup_completed'     => 0,
                    'subscription_status' => 'trialing',
                ]);

                $this->setTokenCookies($tokenData);

                http_response_code(201);
                echo json_encode([
                    'success'             => true,
                    'token'               => $tokenData['access_token'],
                    'setup_completed'     => 0,
                    'subscription_status' => 'trialing',
                ]);
            } else {
                // Paid plan — NO JWT until M-Pesa payment confirmed.
                http_response_code(201);
                echo json_encode([
                    'success'          => true,
                    'requires_payment' => true,
                    'organization_id'  => $orgId,
                    'subscription_id'  => $subId,
                    'phone'            => $phone,
                    'amount'           => (float) $plan['base_price'],
                    'plan_name'        => $plan['name'],
                ]);
            }
        } catch (\Throwable $e) {
            // DB::transaction() rolls back automatically on exception.
            error_log('RegistrationController::register error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
        }
    }

    // ── Sets access_token and refresh_token as httpOnly cookies ──────────────
    private function setTokenCookies(array $tokenData): void
    {
        $isProduction = ($_ENV['APP_ENV'] ?? 'development') === 'production';
        $secure = $isProduction;

        // access_token — httponly FALSE so JS can read it for JWT decoding
        setcookie('access_token', $tokenData['access_token'], [
            'expires'  => time() + 3600,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $secure,
            'httponly' => false,   // ← must match AuthController::login()
            'samesite' => 'Lax',
        ]);

        // refresh_token — httponly TRUE (never needs JS access)
        setcookie('refresh_token', $tokenData['refresh_token'], [
            'expires'  => time() + 604800,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}