<?php

namespace App\Controllers;

use App\Services\DB;

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
            
            // Check if result is array and has data
            if (!is_array($result) || empty($result)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun not found",
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
                    message: "Payrun not found",
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
                'payrun_name', 'pay_period_start', 'pay_period_end', 'pay_frequency',
                'status', 'total_gross_pay', 'total_deductions', 'total_net_pay', 'employee_count'
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
                    message: "Payrun not found",
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

    /**
     * Create audit log entry
     */
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
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            error_log("Failed to create audit log: " . $e->getMessage());
            // Don't fail the main operation if audit log fails
        }
    }
}