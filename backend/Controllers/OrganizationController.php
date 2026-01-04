<?php

namespace App\Controllers;

use App\Services\DB;
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
                'name', 'payroll_number_prefix', 'kra_pin', 'nssf_number', 'nhif_number',
                'legal_type', 'registration_number', 'physical_address', 'location',
                'postal_address', 'primary_phone', 'secondary_phone', 'official_email',
                'logo_url', 'currency', 'payroll_schedule', 'payroll_lock_date',
                'default_payday', 'bank_account_name', 'bank_account_number',
                'bank_branch', 'swift_code', 'is_active', 'domain'
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
}