<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\PayrunProcessingService;

class PayrunController
{
    /**
     * Get all payruns with pagination and filters
     */
    public function index($org_id = null)
    {
        try {
            // Validate organization ID
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: [
                        'org_id' => 'Organization ID is required and must be a valid number'
                    ]
                );
            }

            // Verify organization exists
            $orgCheck = DB::table('organizations')
                ->where(['id' => $org_id])
                ->get();

            if (empty($orgCheck)) {
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

            // Get pagination parameters with validation
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            // Optional filters
            $status = $_GET['status'] ?? null;
            $payFrequency = $_GET['pay_frequency'] ?? null;
            $includeDeleted = isset($_GET['include_deleted']) && $_GET['include_deleted'] === 'true';

            // Build WHERE conditions array
            $whereConditions = ["organization_id" => $org_id];

            // Apply deleted filter - by default hide deleted
            if (!$includeDeleted) {
                $whereConditions["deleted_at"] = null;
            }

            // Apply optional filters
            if ($status) {
                $whereConditions["status"] = $status;
            }

            if ($payFrequency) {
                $whereConditions["pay_frequency"] = $payFrequency;
            }

            // Count total records using DB::table
            $countQuery = DB::table('payruns')->where($whereConditions);
            $total = count($countQuery->get());

            // Get statistics using raw query
            $statsConditions = [];
            $statsParams = [];

            $statsConditions[] = "organization_id = :org_id";
            $statsParams[':org_id'] = $org_id;

            if (!$includeDeleted) {
                $statsConditions[] = "deleted_at IS NULL";
            }

            if ($status) {
                $statsConditions[] = "status = :filter_status";
                $statsParams[':filter_status'] = $status;
            }

            if ($payFrequency) {
                $statsConditions[] = "pay_frequency = :filter_pay_frequency";
                $statsParams[':filter_pay_frequency'] = $payFrequency;
            }

            $statsWhere = "WHERE " . implode(" AND ", $statsConditions);

            $statsQuery = "
                SELECT 
                    COUNT(*) as total_payruns,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_payruns,
                    SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_payruns,
                    SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) as finalized_payruns,
                    COALESCE(SUM(total_gross_pay), 0) as total_gross,
                    COALESCE(SUM(total_net_pay), 0) as total_net,
                    COALESCE(SUM(employee_count), 0) as total_employees
                FROM payruns
                $statsWhere
            ";

            $statsResult = DB::raw($statsQuery, $statsParams);
            $stats = is_array($statsResult) && !empty($statsResult) ? $statsResult[0] : null;

            // Fetch paginated data with user details using raw query
            $queryConditions = [];
            $queryParams = [];

            $queryConditions[] = "payruns.organization_id = :org_id";
            $queryParams[':org_id'] = $org_id;

            if (!$includeDeleted) {
                $queryConditions[] = "payruns.deleted_at IS NULL";
            }

            if ($status) {
                $queryConditions[] = "payruns.status = :filter_status";
                $queryParams[':filter_status'] = $status;
            }

            if ($payFrequency) {
                $queryConditions[] = "payruns.pay_frequency = :filter_pay_frequency";
                $queryParams[':filter_pay_frequency'] = $payFrequency;
            }

            $queryWhere = "WHERE " . implode(" AND ", $queryConditions);

            $query = "
                SELECT 
                    payruns.*,
                    creator.first_name as creator_first_name,
                    creator.surname as creator_surname,
                    creator.email as creator_email,
                    reviewer.first_name as reviewer_first_name,
                    reviewer.surname as reviewer_surname,
                    reviewer.email as reviewer_email,
                    finalizer.first_name as finalizer_first_name,
                    finalizer.surname as finalizer_surname,
                    finalizer.email as finalizer_email,
                    deleter.first_name as deleter_first_name,
                    deleter.surname as deleter_surname,
                    deleter.email as deleter_email,
                    CONCAT(creator.first_name, ' ', creator.surname) as creator_full_name,
                    CONCAT(COALESCE(reviewer.first_name, ''), ' ', COALESCE(reviewer.surname, '')) as reviewer_full_name,
                    CONCAT(COALESCE(finalizer.first_name, ''), ' ', COALESCE(finalizer.surname, '')) as finalizer_full_name,
                    CONCAT(COALESCE(deleter.first_name, ''), ' ', COALESCE(deleter.surname, '')) as deleter_full_name
                FROM payruns
                LEFT JOIN users creator ON payruns.created_by = creator.id
                LEFT JOIN users reviewer ON payruns.reviewed_by = reviewer.id
                LEFT JOIN users finalizer ON payruns.finalized_by = finalizer.id
                LEFT JOIN users deleter ON payruns.deleted_by = deleter.id
                $queryWhere
                ORDER BY payruns.pay_period_end DESC, payruns.created_at DESC
                LIMIT :pagination_limit OFFSET :pagination_offset
            ";

            $queryParams[':pagination_limit'] = (int) $perPage;
            $queryParams[':pagination_offset'] = (int) $offset;

            // Execute raw query and get results
            $payruns = DB::raw($query, $queryParams);

            // Ensure $payruns is an array
            if (!is_array($payruns)) {
                error_log("DB::raw returned non-array value: " . gettype($payruns));
                $payruns = [];
            }

            // Calculate pagination metadata
            $totalPages = $total > 0 ? ceil($total / $perPage) : 0;

            return responseJson(
                success: true,
                data: $payruns, // This should now be an array
                message: "Fetched Payruns Successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => (int) $total,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_prev' => $page > 1
                    ],
                    'statistics' => [
                        'total_payruns' => (int) ($stats->total_payruns ?? 0),
                        'draft' => (int) ($stats->draft_payruns ?? 0),
                        'reviewed' => (int) ($stats->reviewed_payruns ?? 0),
                        'finalized' => (int) ($stats->finalized_payruns ?? 0),
                        'total_gross_pay' => (float) ($stats->total_gross ?? 0),
                        'total_net_pay' => (float) ($stats->total_net ?? 0),
                        'total_employees' => (int) ($stats->total_employees ?? 0)
                    ],
                    'debug' => [
                        'query_type' => gettype($payruns),
                        'result_count' => is_array($payruns) ? count($payruns) : 0,
                        'filters_applied' => [
                            'status' => $status,
                            'pay_frequency' => $payFrequency,
                            'include_deleted' => $includeDeleted
                        ]
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Payrun index error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch payruns",
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
     * Get a single payrun by ID
     */
    public function show($org_id, $payrun_id)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
                );
            }

            if (!$payrun_id || !is_numeric($payrun_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing payrun ID",
                    code: 404,
                    errors: ['payrun_id' => 'Payrun ID is required and must be a valid number']
                );
            }

            $query = "
                SELECT 
                    payruns.*,
                    creator.first_name as creator_first_name,
                    creator.surname as creator_surname,
                    creator.email as creator_email,
                    reviewer.first_name as reviewer_first_name,
                    reviewer.surname as reviewer_surname,
                    reviewer.email as reviewer_email,
                    finalizer.first_name as finalizer_first_name,
                    finalizer.surname as finalizer_surname,
                    finalizer.email as finalizer_email,
                    deleter.first_name as deleter_first_name,
                    deleter.surname as deleter_surname,
                    deleter.email as deleter_email,
                    CONCAT(creator.first_name, ' ', creator.surname) as creator_full_name,
                    CONCAT(COALESCE(reviewer.first_name, ''), ' ', COALESCE(reviewer.surname, '')) as reviewer_full_name,
                    CONCAT(COALESCE(finalizer.first_name, ''), ' ', COALESCE(finalizer.surname, '')) as finalizer_full_name,
                    CONCAT(COALESCE(deleter.first_name, ''), ' ', COALESCE(deleter.surname, '')) as deleter_full_name
                FROM payruns
                LEFT JOIN users creator ON payruns.created_by = creator.id
                LEFT JOIN users reviewer ON payruns.reviewed_by = reviewer.id
                LEFT JOIN users finalizer ON payruns.finalized_by = finalizer.id
                LEFT JOIN users deleter ON payruns.deleted_by = deleter.id
                WHERE payruns.id = :payrun_id AND payruns.organization_id = :org_id
            ";

            $result = DB::raw($query, [':payrun_id' => $payrun_id, ':org_id' => $org_id]);

            // var_dump($result);

            // Check if result is array and has data
            if (!is_array($result) || empty($result)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun not found show",
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $result[0],
                message: "Payrun fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch payrun: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Create a new payrun
     */
    public function store($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
                );
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            $required = ['payrun_name', 'pay_period_start', 'pay_period_end'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Field '$field' is required",
                        code: 400
                    );
                }
            }

            // Validate dates
            if (strtotime($data['pay_period_start']) > strtotime($data['pay_period_end'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Pay period start date must be before end date",
                    code: 400
                );
            }

            // Verify organization exists
            $orgCheck = DB::table('organizations')
                ->where(['id' => $org_id])
                ->get();

            if (empty($orgCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404
                );
            }

            // Get current user
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication required",
                    code: 401
                );
            }

            // Prepare insert data
            $insertData = [
                'organization_id' => $org_id,
                'payrun_name' => $data['payrun_name'],
                'pay_period_start' => $data['pay_period_start'],
                'pay_period_end' => $data['pay_period_end'],
                'pay_frequency' => $data['pay_frequency'] ?? 'monthly',
                'status' => $data['status'] ?? 'draft',
                'total_gross_pay' => $data['total_gross_pay'] ?? 0.00,
                'total_deductions' => $data['total_deductions'] ?? 0.00,
                'total_net_pay' => $data['total_net_pay'] ?? 0.00,
                'employee_count' => $data['employee_count'] ?? 0,
                'created_by' => $currentUser['id']
            ];

            $result = DB::table('payruns')->insert($insertData);

            // Get the last insert ID
            $payrunId = DB::lastInsertId();

            // Log audit entry
            $this->createAuditLog(
                $org_id,
                $currentUser['id'],
                'payruns',
                $payrunId,
                'create',
                $insertData
            );

            return responseJson(
                success: true,
                data: ['id' => $payrunId],
                message: "Payrun created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Create payrun error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create payrun: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Update a payrun
     */
    public function update($org_id, $payrun_id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$payrun_id || !is_numeric($payrun_id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or payrun ID",
                    code: 404
                );
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Check if payrun exists
            $existingPayrun = DB::raw(
                "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id",
                [':id' => $payrun_id, ':org_id' => $org_id]
            );

            if (!is_array($existingPayrun) || empty($existingPayrun)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun not found update",
                    code: 404
                );
            }

            $payrun = $existingPayrun[0];

            // Check if payrun is finalized
            if ($payrun->status === 'finalized') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot update finalized payruns",
                    code: 400
                );
            }

            // Validate dates if both are being updated
            if (isset($data['pay_period_start']) && isset($data['pay_period_end'])) {
                if (strtotime($data['pay_period_start']) > strtotime($data['pay_period_end'])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Pay period start date must be before end date",
                        code: 400
                    );
                }
            }

            $updateData = [];

            // Build update data
            $allowedFields = [
                'payrun_name',
                'pay_period_start',
                'pay_period_end',
                'pay_frequency',
                'status',
                'total_gross_pay',
                'total_deductions',
                'total_net_pay',
                'employee_count'
            ];

            foreach ($allowedFields as $field) {
                if (isset($data[$field])) {
                    $updateData[$field] = $data[$field];
                }
            }

            if (empty($updateData)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No fields to update",
                    code: 400
                );
            }

            // Get current user for audit log
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            // Update the payrun
            DB::table('payruns')->update($updateData, 'id', $payrun_id);

            // Log audit entry
            if ($currentUser) {
                $this->createAuditLog(
                    $org_id,
                    $currentUser['id'],
                    'payruns',
                    $payrun_id,
                    'update',
                    [
                        'old_data' => $payrun,
                        'new_data' => $updateData
                    ]
                );
            }

            return responseJson(
                success: true,
                data: null,
                message: "Payrun updated successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update payrun: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Soft delete a payrun (cannot delete reviewed/finalized payruns)
     */
    public function destroy($org_id, $payrun_id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$payrun_id || !is_numeric($payrun_id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or payrun ID",
                    code: 404
                );
            }

            // Check if payrun exists
            $existingPayrun = DB::raw(
                "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id",
                [':id' => $payrun_id, ':org_id' => $org_id]
            );

            if (!is_array($existingPayrun) || empty($existingPayrun)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun not found destroy",
                    code: 404
                );
            }

            $payrun = $existingPayrun[0];

            // Cannot delete reviewed or finalized payruns
            if (in_array($payrun->status, ['reviewed', 'finalized'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot delete reviewed or finalized payruns. Please create a reversal entry instead.",
                    code: 400
                );
            }

            // Get current user
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication required",
                    code: 401
                );
            }

            // Soft delete
            DB::table('payruns')->update(
                [
                    'deleted_at' => date('Y-m-d H:i:s'),
                    'deleted_by' => $currentUser['id']
                ],
                'id',
                $payrun_id
            );

            // Create audit log
            $this->createAuditLog($org_id, $currentUser['id'], 'payruns', $payrun_id, 'delete', [
                'soft_delete' => true,
                'payrun_data' => $payrun,
                'deleted_at' => date('Y-m-d H:i:s'),
                'deleted_by' => $currentUser['id']
            ]);

            return responseJson(
                success: true,
                data: null,
                message: "Payrun deleted successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete payrun: " . $e->getMessage(),
                code: 500
            );
        }
    }

    public function processPayrun($org_id, $payrun_id)
    {
        try {
            // ---- Validate inputs ----
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organisation ID",
                    code: 400,
                    errors: ['org_id' => 'Must be a valid number']
                );
            }

            if (!$payrun_id || !is_numeric($payrun_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing payrun ID",
                    code: 400,
                    errors: ['payrun_id' => 'Must be a valid number']
                );
            }

            // ---- Auth ----
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    message: "Authentication required",
                    code: 401
                );
            }

            // Only payroll managers, payroll officers, and admins may process
            $allowedRoles = ['admin', 'super_admin', 'payroll_manager', 'payroll_officer'];
            if (!in_array($currentUser['user_type'], $allowedRoles)) {
                return responseJson(
                    success: false,
                    message: "You do not have permission to process payruns",
                    code: 403
                );
            }

            // ---- Verify payrun exists and belongs to the org ----
            $payrun = DB::raw(
                "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id AND deleted_at IS NULL",
                [':id' => $payrun_id, ':org_id' => $org_id]
            );

            if (empty($payrun)) {
                return responseJson(
                    success: false,
                    message: "Payrun not found processPayrun",
                    code: 404
                );
            }

            if ($payrun[0]->status === 'finalized') {
                return responseJson(
                    success: false,
                    message: "This payrun has already been finalised and cannot be reprocessed",
                    code: 400
                );
            }

            // ---- Verify organisation has tax configs set up ----
            $taxConfigCheck = DB::raw(
                "SELECT COUNT(*) as cnt FROM organization_configs
                  WHERE organization_id = :org_id
                    AND config_type = 'tax'
                    AND is_active = 1
                    AND status = 'approved'",
                [':org_id' => $org_id]
            );

            if (empty($taxConfigCheck) || (int) $taxConfigCheck[0]->cnt === 0) {
                return responseJson(
                    success: false,
                    message: "No approved tax configuration found for this organisation. " .
                        "Please set up NSSF Rate, SHIF Rate, Housing Levy Rate, and " .
                        "Personal Relief in organisation configs before processing a payrun.",
                    code: 422,
                    errors: ['tax_config' => 'Missing or unapproved tax configuration']
                );
            }

            // ---- Run the processing engine ----
            $service = new PayrunProcessingService();
            $summary = $service->process((int) $org_id, (int) $payrun_id, (int) $currentUser['id']);

            // ---- Build response ----
            $hasErrors = !empty($summary['errors']);

            return responseJson(
                success: true,
                data: [
                    'payrun_id'        => (int) $payrun_id,
                    'employee_count'   => $summary['employee_count'],
                    'total_gross_pay'  => round($summary['total_gross'], 2),
                    'total_deductions' => round($summary['total_deductions'], 2),
                    'total_net_pay'    => round($summary['total_net'], 2),
                    'status'           => 'reviewed',
                    'errors'           => $summary['errors'],
                ],
                message: $hasErrors
                    ? "Payrun processed with " . count($summary['errors']) . " employee error(s). Please review."
                    : "Payrun processed successfully. {$summary['employee_count']} employee(s) calculated.",
                code: $hasErrors ? 207 : 200   // 207 Multi-Status when some employees failed
            );
        } catch (\RuntimeException $e) {
            // Known business-logic errors (finalized, no employees, etc.)
            return responseJson(
                success: false,
                message: $e->getMessage(),
                code: 422
            );
        } catch (\Exception $e) {
            error_log("PayrunController::processPayrun error: " . $e->getMessage());
            error_log($e->getTraceAsString());

            return responseJson(
                success: false,
                message: "An unexpected error occurred while processing the payrun",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'file'      => $e->getFile(),
                    'line'      => $e->getLine(),
                ]
            );
        }
    }

    // ----------------------------------------------------------------
    // REVIEW  — draft → reviewed
    // Allowed: admin, payroll_manager, hr_manager, payroll_officer
    // ----------------------------------------------------------------
    public function reviewPayrun($org_id, $payrun_id)
    {
        try {
            // ---- Input validation ----
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organisation ID",
                    code: 400,
                    errors: ['org_id' => 'Must be a valid number']
                );
            }

            if (!$payrun_id || !is_numeric($payrun_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing payrun ID",
                    code: 400,
                    errors: ['payrun_id' => 'Must be a valid number']
                );
            }

            // ---- Auth ----
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    message: "Authentication required",
                    code: 401
                );
            }

            $allowedRoles = ['admin', 'payroll_manager', 'hr_manager', 'payroll_officer'];
            if (!in_array($currentUser['user_type'], $allowedRoles)) {
                return responseJson(
                    success: false,
                    message: "You do not have permission to review payruns",
                    code: 403
                );
            }

            // ---- Fetch payrun ----
            $payrunRows = DB::raw(
                "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id AND deleted_at IS NULL",
                [':id' => $payrun_id, ':org_id' => $org_id]
            );

            // return responseJson(
            //     success: false,
            //     data: $payrunRows,
            //     message: "debug",
            //     code: 404
            // );

            if (!is_array($payrunRows) || empty($payrunRows)) {
                return responseJson(
                    success: false,
                    message: "Payrun not found review",
                    code: 404
                );
            }

            $payrun = $payrunRows[0];

            // ---- Status guard ----
            if ($payrun->status !== 'draft') {
                $msg = $payrun->status === 'reviewed'
                    ? "This payrun has already been reviewed"
                    : "Only draft payruns can be reviewed (current status: {$payrun->status})";
                return responseJson(
                    success: false,
                    message: $msg,
                    code: 400
                );
            }

            // ---- Must have been processed (employee_count > 0) ----
            if ((int) $payrun->employee_count === 0) {
                return responseJson(
                    success: false,
                    message: "Payrun has no processed employees. Please run processPayrun first.",
                    code: 422
                );
            }

            $now = date('Y-m-d H:i:s');

            // ---- Update ----
            DB::table('payruns')->update(
                [
                    'status'      => 'reviewed',
                    'reviewed_by' => $currentUser['id'],
                    'reviewed_at' => $now,
                ],
                'id',
                $payrun_id
            );

            // ---- Audit ----
            $this->createAuditLog($org_id, $currentUser['id'], 'payruns', $payrun_id, 'review', [
                'previous_status' => 'draft',
                'new_status'      => 'reviewed',
                'reviewed_at'     => $now,
            ]);

            return responseJson(
                success: true,
                data: [
                    'payrun_id'   => (int) $payrun_id,
                    'status'      => 'reviewed',
                    'reviewed_by' => $currentUser['id'],
                    'reviewed_at' => $now,
                ],
                message: "Payrun marked as reviewed successfully"
            );
        } catch (\Exception $e) {
            error_log("PayrunController::reviewPayrun error: " . $e->getMessage());
            error_log($e->getTraceAsString());
            return responseJson(
                success: false,
                message: "An unexpected error occurred while reviewing the payrun",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'file'      => $e->getFile(),
                    'line'      => $e->getLine(),
                ]
            );
        }
    }

    // ----------------------------------------------------------------
    // FINALIZE  — reviewed → finalized
    // Allowed: admin, payroll_manager, finance_manager
    // Side-effect: auto-creates next month's draft payrun
    // ----------------------------------------------------------------
    public function finalizePayrun($org_id, $payrun_id)
    {
        try {
            // ---- Input validation ----
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organisation ID",
                    code: 400,
                    errors: ['org_id' => 'Must be a valid number']
                );
            }

            if (!$payrun_id || !is_numeric($payrun_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing payrun ID",
                    code: 400,
                    errors: ['payrun_id' => 'Must be a valid number']
                );
            }

            // ---- Auth ----
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    message: "Authentication required",
                    code: 401
                );
            }

            $allowedRoles = ['admin', 'payroll_manager', 'finance_manager'];
            if (!in_array($currentUser['user_type'], $allowedRoles)) {
                return responseJson(
                    success: false,
                    message: "You do not have permission to finalize payruns",
                    code: 403
                );
            }

            // ---- Fetch payrun ----
            $payrunRows = DB::raw(
                "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id AND deleted_at IS NULL",
                [':id' => $payrun_id, ':org_id' => $org_id]
            );

            if (!is_array($payrunRows) || empty($payrunRows)) {
                return responseJson(
                    success: false,
                    message: "Payrun not found finalizePayrun",
                    code: 404
                );
            }

            $payrun = $payrunRows[0];

            // ---- Status guard ----
            if ($payrun->status !== 'reviewed') {
                $msg = $payrun->status === 'finalized'
                    ? "This payrun has already been finalized"
                    : "Only reviewed payruns can be finalized (current status: {$payrun->status})";
                return responseJson(
                    success: false,
                    message: $msg,
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            // ---- Wrap everything in a transaction ----
            $nextPayrunId = DB::transaction(function () use ($payrun, $payrun_id, $org_id, $currentUser, $now) {

                // 1. Finalize current payrun
                DB::table('payruns')->update(
                    [
                        'status'       => 'finalized',
                        'finalized_by' => $currentUser['id'],
                        'finalized_at' => $now,
                    ],
                    'id',
                    $payrun_id
                );

                // 2. Calculate next pay period (same day, one month forward)
                $nextStart = date('Y-m-d', strtotime($payrun->pay_period_start . ' +1 month'));
                $nextEnd   = date('Y-m-d', strtotime($payrun->pay_period_end   . ' +1 month'));

                // 3. Build a human-readable name  e.g. "June 2025 Payrun"
                $nextPayrunName = date('F Y', strtotime($nextStart)) . ' Payrun';

                // 4. Check no draft already exists for that period (idempotency guard)
                $existing = DB::raw(
                    "SELECT id FROM payruns
                     WHERE organization_id = :org_id
                       AND pay_period_start = :start
                       AND pay_period_end   = :end
                       AND deleted_at IS NULL
                     LIMIT 1",
                    [
                        ':org_id' => $org_id,
                        ':start'  => $nextStart,
                        ':end'    => $nextEnd,
                    ]
                );

                if (!empty($existing)) {
                    // Already exists — skip creation, return its ID
                    return (int) $existing[0]->id;
                }

                // 5. Insert next payrun (draft, totals zeroed)
                DB::table('payruns')->insert([
                    'organization_id' => $org_id,
                    'payrun_name'     => $nextPayrunName,
                    'pay_period_start' => $nextStart,
                    'pay_period_end'  => $nextEnd,
                    'pay_frequency'   => $payrun->pay_frequency,
                    'status'          => 'draft',
                    'total_gross_pay' => 0.00,
                    'total_deductions' => 0.00,
                    'total_net_pay'   => 0.00,
                    'employee_count'  => 0,
                    'created_by'      => $currentUser['id'],
                    'created_at'      => $now,
                ]);

                $nextPayrunId = DB::lastInsertId();

                // 6. Copy employees from the finalized payrun,
                //    carrying forward basic_salary only — resetting variable pay.
                $employees = DB::raw(
                    "SELECT employee_id, basic_salary
                     FROM payrun_details
                     WHERE payrun_id = :payrun_id",
                    [':payrun_id' => $payrun_id]
                );

                foreach ($employees as $emp) {
                    DB::table('payrun_details')->insert([
                        'payrun_id'        => $nextPayrunId,
                        'employee_id'      => $emp->employee_id,
                        'basic_salary'     => $emp->basic_salary,
                        // Variable pay — reset to zero
                        'overtime_amount'  => 0.00,
                        'bonus_amount'     => 0.00,
                        'commission_amount' => 0.00,
                        // Calculated figures — zeroed until next processPayrun
                        'gross_pay'        => 0.00,
                        'total_deductions' => 0.00,
                        'net_pay'          => 0.00,
                    ]);
                }

                // Update employee_count on the new payrun
                DB::table('payruns')->update(
                    ['employee_count' => count($employees)],
                    'id',
                    $nextPayrunId
                );

                return (int) $nextPayrunId;
            });

            // ---- Audit: finalize ----
            $this->createAuditLog($org_id, $currentUser['id'], 'payruns', $payrun_id, 'finalize', [
                'previous_status'  => 'reviewed',
                'new_status'       => 'finalized',
                'finalized_at'     => $now,
                'next_payrun_id'   => $nextPayrunId,
            ]);

            // ---- Audit: auto-created next payrun ----
            $this->createAuditLog($org_id, $currentUser['id'], 'payruns', $nextPayrunId, 'auto_create', [
                'source'           => 'finalization_of_payrun_' . $payrun_id,
                'carried_forward'  => 'basic_salary, employee_list',
                'reset_fields'     => 'overtime_amount, bonus_amount, commission_amount, gross_pay, total_deductions, net_pay',
            ]);

            return responseJson(
                success: true,
                data: [
                    'payrun_id'      => (int) $payrun_id,
                    'status'         => 'finalized',
                    'finalized_by'   => $currentUser['id'],
                    'finalized_at'   => $now,
                    'next_payrun'    => [
                        'id'               => $nextPayrunId,
                        'status'           => 'draft',
                        'message'          => 'Next payrun has been automatically created as a draft',
                    ],
                ],
                message: "Payrun finalized successfully. Next month's draft payrun has been created."
            );
        } catch (\Exception $e) {
            error_log("PayrunController::finalizePayrun error: " . $e->getMessage());
            error_log($e->getTraceAsString());
            return responseJson(
                success: false,
                message: "An unexpected error occurred while finalizing the payrun",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'file'      => $e->getFile(),
                    'line'      => $e->getLine(),
                ]
            );
        }
    }

    // =========================================================================
    // Audit log helper (keep in sync with original PayrunController)
    // =========================================================================

    private function createAuditLog($orgId, $userId, $entityType, $entityId, $action, $details = null)
    {
        try {
            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id'         => $userId,
                'entity_type'     => $entityType,
                'entity_id'       => $entityId,
                'action'          => $action,
                'details'         => $details ? json_encode($details) : null,
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Failed to create audit log: " . $e->getMessage());
        }
    }
}
