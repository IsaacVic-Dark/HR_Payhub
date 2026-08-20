<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\JWTService;
use App\Middleware\AuthMiddleware;

class OrganizationController
{
    /**
     * Get organization details for logged-in user
     */
    public function showDetails($org_id = null)
    {
        try {
            // Validate organization ID
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 400,
                    errors: [
                        'org_id' => 'Organization ID is required and must be a valid number'
                    ]
                );
            }

            // Get authenticated user
            $user = AuthMiddleware::getCurrentUser();

            if (!$user) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication required",
                    code: 401
                );
            }

            // Verify user belongs to the organization
            if ($user['organization_id'] != $org_id) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Access denied to this organization",
                    code: 403
                );
            }

            // Check if organization exists
            $organization = DB::table('organizations')
                ->where(['id' => $org_id])
                ->get();

            if (empty($organization)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404,
                    errors: [
                        'org_id' => "No organization found with ID: $org_id"
                    ]
                );
            }

            $orgData = $organization[0];

            // Get additional statistics (optional)
            $stats = $this->getOrganizationStatistics($org_id);

            return responseJson(
                success: true,
                data: $orgData,
                message: "Organization details fetched successfully",
                code: 200,
                metadata: [
                    'statistics' => $stats,
                    'user_role' => $user['user_type'],
                    'can_edit' => in_array($user['user_type'], ['admin', 'hr_manager', 'finance_manager'])
                ]
            );
        } catch (\Exception $e) {
            error_log("Organization details error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch organization details",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'type' => get_class($e),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ]
            );
        }
    }

    /**
     * Get organization statistics
     */
    private function getOrganizationStatistics($org_id)
    {
        try {
            // Get employee count
            $employeeQuery = "SELECT COUNT(*) as total_employees FROM employees WHERE organization_id = :org_id AND status = 'active'";
            $employeeResult = DB::raw($employeeQuery, [':org_id' => $org_id]);
            $totalEmployees = $employeeResult[0]->total_employees ?? 0;

            // Get leave requests count (pending)
            $leaveQuery = "SELECT COUNT(*) as pending_leaves FROM leaves 
                          INNER JOIN employees ON leaves.employee_id = employees.id 
                          WHERE employees.organization_id = :org_id AND leaves.status = 'pending'";
            $leaveResult = DB::raw($leaveQuery, [':org_id' => $org_id]);
            $pendingLeaves = $leaveResult[0]->pending_leaves ?? 0;

            // Get payrolls count (this month)
            $currentMonth = date('n');
            $currentYear = date('Y');

            $payrollQuery = "SELECT COUNT(*) as current_month_payrolls FROM payrolls 
                            WHERE organization_id = :org_id 
                            AND pay_period_month = :month 
                            AND pay_period_year = :year";
            $payrollResult = DB::raw($payrollQuery, [
                ':org_id' => $org_id,
                ':month' => $currentMonth,
                ':year' => $currentYear
            ]);
            $currentMonthPayrolls = $payrollResult[0]->current_month_payrolls ?? 0;

            return [
                'total_employees' => (int)$totalEmployees,
                'pending_leaves' => (int)$pendingLeaves,
                'current_month_payrolls' => (int)$currentMonthPayrolls
            ];
        } catch (\Exception $e) {
            error_log("Organization statistics error: " . $e->getMessage());
            return [];
        }
    }

        /**
     * Attach the currently active/trialing subscription plan to each organization row.
     * Batched into a single query keyed by organization_id — avoids N+1 queries.
     * If an org somehow has more than one active/trialing row, the most recently
     * created one wins.
     */
    private function attachSubscriptions(array $organizations): void
    {
        if (empty($organizations)) {
            return;
        }

        $orgIds = array_map(fn($org) => (int)$org->id, $organizations);
        $placeholders = implode(',', array_fill(0, count($orgIds), '?'));

        $sql = "SELECT
                    os.organization_id,
                    os.status,
                    os.current_period_ends_at,
                    os.trial_ends_at,
                    os.created_at AS subscription_created_at,
                    sp.code,
                    sp.name,
                    sp.billing_cycle
                FROM organization_subscriptions os
                INNER JOIN subscription_plans sp ON sp.id = os.plan_id
                WHERE os.organization_id IN ({$placeholders})
                  AND os.status IN ('active', 'trialing')
                ORDER BY os.created_at DESC";

        $rows = DB::raw($sql, $orgIds);

        // Keep only the most recent row per organization_id (first hit, since ordered DESC)
        $subscriptionsByOrgId = [];
        foreach ($rows as $row) {
            $orgId = (int)$row->organization_id;
            if (!isset($subscriptionsByOrgId[$orgId])) {
                $subscriptionsByOrgId[$orgId] = [
                    'code' => $row->code,
                    'name' => $row->name,
                    'billing_cycle' => $row->billing_cycle,
                    'status' => $row->status,
                    'current_period_ends_at' => $row->current_period_ends_at,
                    'trial_ends_at' => $row->trial_ends_at,
                ];
            }
        }

        foreach ($organizations as $org) {
            $org->subscription = $subscriptionsByOrgId[(int)$org->id] ?? null;
        }
    }

    // Keep existing methods but refactor them to use responseJson pattern
    public function index()
    {
        try {
            // Get query params from request
            $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
            $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 10;
            $name = isset($_GET['name']) ? trim($_GET['name']) : null;
            $location = isset($_GET['location']) ? trim($_GET['location']) : null;
            $status = isset($_GET['status']) ? trim($_GET['status']) : null;

            $offset = ($page - 1) * $limit;

            // Build WHERE clause and bindings
            $whereClauses = [];
            $bindings = [];

            $whereClauses[] = "`account_type` = 'tenant'";

            if ($name) {
                $whereClauses[] = "`name` LIKE :name";
                $bindings[':name'] = "%{$name}%";
            }

            if ($location) {
                $whereClauses[] = "(`location` LIKE :location)";
                $bindings[':location'] = "%{$location}%";
            }

            if ($status !== null) {
                if ($status === '1' || strtolower($status) === 'active') {
                    $whereClauses[] = "`is_active` = 1";
                } elseif ($status === '0' || strtolower($status) === 'inactive') {
                    $whereClauses[] = "`is_active` = 0";
                }
            }

            $whereClause = '';
            if (!empty($whereClauses)) {
                $whereClause = "WHERE " . implode(" AND ", $whereClauses);
            }

            // Get total count
            $countSql = "SELECT COUNT(*) as count FROM organizations {$whereClause}";
            $totalResult = DB::raw($countSql, $bindings);
            $total = isset($totalResult[0]) ? (int) $totalResult[0]->count : 0;

            // Build main query
            $sql = "SELECT * FROM organizations {$whereClause} ORDER BY `created_at` DESC LIMIT {$limit} OFFSET {$offset}";

            // Fetch paginated data
            $organizations = DB::raw($sql, $bindings);

            // Attach each org's currently active/trialing subscription plan (batched, no N+1)
            $this->attachSubscriptions($organizations);

            // Calculate pagination metadata
            $totalPages = ceil($total / $limit);

            return responseJson(
                success: true,
                data: $organizations,
                message: "Organizations fetched successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $limit,
                        'total' => $total,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_prev' => $page > 1
                    ],
                    'filters_applied' => [
                        'name' => $name,
                        'location' => $location,
                        'status' => $status
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Organization index error: " . $e->getMessage());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch organizations",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'type' => get_class($e)
                ]
            );
        }
    }

    public function show($id)
    {
        try {
            $org = DB::table('organizations')
                ->where(['id' => $id])
                ->get();

            if (empty($org)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404,
                    errors: [
                        'org_id' => "Organization with ID {$id} does not exist"
                    ]
                );
            }

            return responseJson(
                success: true,
                data: $org[0],
                message: "Organization fetched successfully",
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Organization show error: " . $e->getMessage());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch organization",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'type' => get_class($e)
                ]
            );
        }
    }

    public function store()
    {
        try {
            $data = getInputData();

            // Validate required fields
            $required = ['name', 'location'];
            $validationErrors = [];

            foreach ($required as $field) {
                if (empty($data[$field])) {
                    $validationErrors[$field] = "Field '$field' is required";
                }
            }

            if (!empty($validationErrors)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Validation failed",
                    code: 400,
                    errors: $validationErrors
                );
            }

            // Handle file upload for logo
            $logoUrl = handleFileUpload('logo');

            // Prepare insert data
            $insertData = [
                'name' => $data['name'],
                'location' => $data['location'],
                'payroll_number_prefix' => $data['payroll_number_prefix'] ?? 'EMP',
                'kra_pin' => $data['kra_pin'] ?? null,
                'nssf_number' => $data['nssf_number'] ?? null,
                'nhif_number' => $data['nhif_number'] ?? null,
                'legal_type' => $data['legal_type'] ?? null,
                'registration_number' => $data['registration_number'] ?? null,
                'physical_address' => $data['physical_address'] ?? null,
                'postal_address' => $data['postal_address'] ?? null,
                'primary_phone' => $data['primary_phone'] ?? null,
                'secondary_phone' => $data['secondary_phone'] ?? null,
                'official_email' => $data['official_email'] ?? null,
                'logo_url' => $logoUrl ?: ($data['logo_url'] ?? null),
                'currency' => strtoupper($data['currency'] ?? 'KES'),
                'payroll_schedule' => $data['payroll_schedule'] ?? 'Monthly',
                'payroll_lock_date' => $data['payroll_lock_date'] ?? null,
                'default_payday' => $data['default_payday'] ?? null,
                'bank_account_name' => $data['bank_account_name'] ?? null,
                'bank_account_number' => $data['bank_account_number'] ?? null,
                'bank_branch' => $data['bank_branch'] ?? null,
                'swift_code' => $data['swift_code'] ?? null,
                'is_active' => 1
            ];

            // Insert into db
            DB::table('organizations')->insert($insertData);
            $orgId = DB::lastInsertId();

            // Fetch the created organization
            $createdOrg = DB::table('organizations')
                ->where(['id' => $orgId])
                ->get();

            return responseJson(
                success: true,
                data: $createdOrg[0],
                message: "Organization created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Organization store error: " . $e->getMessage());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to create organization",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'type' => get_class($e)
                ]
            );
        }
    }

    public function update($id)
    {
        try {
            // Check if organization exists
            $existingOrg = DB::table('organizations')
                ->where(['id' => $id])
                ->get();

            if (empty($existingOrg)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404,
                    errors: [
                        'org_id' => "Organization with ID {$id} does not exist"
                    ]
                );
            }

            $data = getInputData();

            // Handle file upload for logo
            $logoUrl = handleFileUpload('logo');

            // Prepare update data
            $updateData = [];

            // List of allowed fields to update
            $allowedFields = [
                'name',
                'payroll_number_prefix',
                'kra_pin',
                'nssf_number',
                'nhif_number',
                'legal_type',
                'registration_number',
                'physical_address',
                'location',
                'postal_address',
                'primary_phone',
                'secondary_phone',
                'official_email',
                'logo_url',
                'currency',
                'payroll_schedule',
                'payroll_lock_date',
                'default_payday',
                'bank_account_name',
                'bank_account_number',
                'bank_branch',
                'swift_code',
                'is_active',
                'domain'
            ];

            foreach ($allowedFields as $field) {
                if (isset($data[$field]) && $data[$field] !== null) {
                    $updateData[$field] = $data[$field];
                }
            }

            if ($logoUrl) {
                $updateData['logo_url'] = $logoUrl;
            }

            // Convert currency to uppercase if provided
            if (isset($updateData['currency'])) {
                $updateData['currency'] = strtoupper($updateData['currency']);
            }

            if (empty($updateData)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No data provided for update",
                    code: 400,
                    errors: [
                        'update_data' => 'At least one field must be provided for update'
                    ]
                );
            }

            // Update organization
            DB::table('organizations')->update($updateData, 'id', $id);

            // Fetch updated organization
            $updatedOrg = DB::table('organizations')
                ->where(['id' => $id])
                ->get();

            return responseJson(
                success: true,
                data: $updatedOrg[0],
                message: "Organization updated successfully",
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Organization update error: " . $e->getMessage());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to update organization",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'type' => get_class($e)
                ]
            );
        }
    }

    public function destroy($id)
    {
        try {
            // Check if organization exists
            $existingOrg = DB::table('organizations')
                ->where(['id' => $id])
                ->get();

            if (empty($existingOrg)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404,
                    errors: [
                        'org_id' => "Organization with ID {$id} does not exist"
                    ]
                );
            }

            // Check if organization has employees
            $employeeCheck = DB::table('employees')
                ->where(['organization_id' => $id])
                ->get();

            if (!empty($employeeCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot delete organization with active employees",
                    code: 400,
                    errors: [
                        'organization' => 'Please remove all employees before deleting the organization'
                    ]
                );
            }

            // Delete organization
            DB::table('organizations')->delete('id', $id);

            return responseJson(
                success: true,
                data: null,
                message: "Organization deleted successfully",
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Organization delete error: " . $e->getMessage());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete organization",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'type' => get_class($e)
                ]
            );
        }
    }

    // =========================================================================
    // POST /api/v1/organization/complete-setup
    // Auth: admin only (enforced by AuthMiddleware in routes.php)
    // =========================================================================
    public function completeSetup(): void
    {
        // Use AuthMiddleware::getCurrentUser() — populated by middleware::handle()
        // Fall back to $GLOBALS['auth_user'] for safety after adding it to middleware
        $authUser = AuthMiddleware::getCurrentUser() ?? ($GLOBALS['auth_user'] ?? null);

        if (!$authUser) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
            return;
        }

        $orgId  = (int) ($authUser['organization_id'] ?? 0);
        $userId = (int) ($authUser['id'] ?? 0);

        if (!$orgId || !$userId) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
            return;
        }

        // ── Idempotency guard ─────────────────────────────────────────────────
        $results = DB::raw(
            'SELECT setup_completed FROM organizations WHERE id = :id AND primary_administrator_id = :uid',
            ['id' => $orgId, 'uid' => $userId]
        );
        $org = !empty($results) ? (array) $results[0] : null;

        if (!$org) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Organization not found or access denied.']);
            return;
        }

        if ((int) $org['setup_completed'] === 1) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Setup has already been completed.']);
            return;
        }

        // ── Parse + validate body ─────────────────────────────────────────────
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $errors = [];

        // Required fields
        $requiredFields = [
            'kra_pin'            => 'KRA PIN',
            'legal_type'         => 'Legal type',
            'physical_address'   => 'Physical address',
            'location'           => 'Location',
            'county_id'          => 'County',
            'payroll_schedule'   => 'Payroll schedule',
            'default_payday'     => 'Default payday',
            'bank_account_name'  => 'Bank account name',
            'bank_account_number' => 'Bank account number',
        ];

        foreach ($requiredFields as $field => $label) {
            if (empty($body[$field]) && $body[$field] !== 0) {
                $errors[$field] = $label . ' is required.';
            }
        }

        $allowedLegalTypes = ['LTD', 'PLC', 'Sole_Proprietor', 'Partnership', 'NGO', 'Government', 'School', 'Other'];
        if (!empty($body['legal_type']) && !in_array($body['legal_type'], $allowedLegalTypes, true)) {
            $errors['legal_type'] = 'Invalid legal type.';
        }

        $allowedSchedules = ['Monthly', 'Bi-Monthly', 'Weekly'];
        if (!empty($body['payroll_schedule']) && !in_array($body['payroll_schedule'], $allowedSchedules, true)) {
            $errors['payroll_schedule'] = 'Payroll schedule must be Monthly, Bi-Monthly, or Weekly.';
        }

        $defaultPayday = (int) ($body['default_payday'] ?? 0);
        if ($defaultPayday < 1 || $defaultPayday > 31) {
            $errors['default_payday'] = 'Default payday must be between 1 and 31.';
        }

        if (!empty($errors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'errors' => $errors]);
            return;
        }

        // ── Map body to clean values ──────────────────────────────────────────
        $kraPin             = trim($body['kra_pin']);
        $legalType          = $body['legal_type'];
        $registrationNumber = trim($body['registration_number'] ?? '');
        $physicalAddress    = trim($body['physical_address']);
        $location           = trim($body['location']);
        $postalAddress      = trim($body['postal_address']      ?? '');
        $countyId           = (int) $body['county_id'];
        $payrollSchedule    = $body['payroll_schedule'];
        $currency           = trim($body['currency']            ?? 'KES');
        $bankId             = !empty($body['bank_id']) ? (int) $body['bank_id'] : null;
        $bankAccountName    = trim($body['bank_account_name']);
        $bankAccountNumber  = trim($body['bank_account_number']);
        $bankBranch         = trim($body['bank_branch']         ?? '');
        $swiftCode          = trim($body['swift_code']          ?? '');
        // Admin employee fields
        $adminFirstname   = trim($body['admin_firstname']   ?? '');
        $adminSurname     = trim($body['admin_surname']     ?? '');
        $adminEmail       = trim($body['admin_email']       ?? '');
        $adminHireDate    = trim($body['admin_hire_date']   ?? '');
        $adminStartDate   = trim($body['admin_start_date']  ?? '');
        $adminBaseSalary  = (float) ($body['admin_base_salary'] ?? 0);

        if (empty($adminFirstname))  $errors['admin_firstname']  = 'First name is required.';
        if (empty($adminSurname))    $errors['admin_surname']    = 'Surname is required.';
        if (empty($adminEmail))      $errors['admin_email']      = 'Personal email is required.';
        if (empty($adminHireDate))   $errors['admin_hire_date']  = 'Hire date is required.';
        if (empty($adminStartDate))  $errors['admin_start_date'] = 'Start date is required.';
        if ($adminBaseSalary < 0)    $errors['admin_base_salary'] = 'Base salary must be 0 or more.';

        // ── Persist ───────────────────────────────────────────────────────────
        try {
            DB::raw(
                'UPDATE organizations
                    SET
                        kra_pin              = :kra_pin,
                        legal_type           = :legal_type,
                        registration_number  = :registration_number,
                        physical_address     = :physical_address,
                        location             = :location,
                        postal_address       = :postal_address,
                        county_id            = :county_id,
                        payroll_schedule     = :payroll_schedule,
                        default_payday       = :default_payday,
                        currency             = :currency,
                        bank_id              = :bank_id,
                        bank_account_name    = :bank_account_name,
                        bank_account_number  = :bank_account_number,
                        bank_branch          = :bank_branch,
                        swift_code           = :swift_code,
                        setup_completed      = 1,
                        setup_completed_at   = NOW()
                    WHERE id = :org_id AND primary_administrator_id = :user_id',
                [
                    'kra_pin'             => $kraPin,
                    'legal_type'          => $legalType,
                    'registration_number' => $registrationNumber ?: null,
                    'physical_address'    => $physicalAddress,
                    'location'            => $location,
                    'postal_address'      => $postalAddress      ?: null,
                    'county_id'           => $countyId,
                    'payroll_schedule'    => $payrollSchedule,
                    'default_payday'      => $defaultPayday,
                    'currency'            => $currency           ?: 'KES',
                    'bank_id'             => $bankId,
                    'bank_account_name'   => $bankAccountName,
                    'bank_account_number' => $bankAccountNumber,
                    'bank_branch'         => $bankBranch         ?: null,
                    'swift_code'          => $swiftCode          ?: null,
                    'org_id'              => $orgId,
                    'user_id'             => $userId,
                ]
            );

            // ── Insert admin employee record ──────────────────────────────────────────
            $employeeNumber = 'EMP-' . str_pad($userId, 4, '0', STR_PAD_LEFT);

            DB::table('employees')->insert([
                'organization_id' => $orgId,
                'user_id'         => $userId,
                'has_user'        => 1,
                'employee_number' => $employeeNumber,
                'firstname'       => $adminFirstname,
                'surname'         => $adminSurname,
                'personalemail'   => $adminEmail,
                'hire_date'       => $adminHireDate,
                'start_date'      => $adminStartDate,
                'base_salary'     => $adminBaseSalary,
                'status'          => 'active',
            ]);

            $newPayload = [
                'user_id'             => $userId,
                'email'               => $authUser['email'],
                'user_type'           => $authUser['user_type'],
                'organization_id'     => $orgId,
                'setup_completed'     => 1,
                'subscription_status' => $authUser['subscription_status'] ?? 'trialing',
            ];

            $tokens      = JWTService::generateToken($newPayload);   // returns array
            $isProduction = ($_ENV['APP_ENV'] ?? 'development') === 'production';

            setcookie('access_token', $tokens['access_token'], [
                'expires'  => time() + 3600,
                'path'     => '/',
                'domain'   => '',
                'secure'   => $isProduction,
                'httponly' => false,
                'samesite' => 'Lax',
            ]);

            http_response_code(200);
            echo json_encode(['success' => true, 'setup_completed' => 1]);
        } catch (\Throwable $e) {
            error_log('OrganizationController::completeSetup error: ' . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'OrganizationController::completeSetup error: ' . $e->getMessage()]);
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to complete setup. Please try again.']);
        }
    }
}
