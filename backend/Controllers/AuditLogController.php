<?php

namespace App\Controllers;

use App\Services\DB;

class AuditLogController
{
    /**
     * Get all audit logs with pagination and filters
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
            $entityType = $_GET['entity_type'] ?? null;
            $entityId = $_GET['entity_id'] ?? null;
            $action = $_GET['action'] ?? null;
            $userId = $_GET['user_id'] ?? null;

            // Build WHERE clause
            $whereConditions = [];
            $countParams = [];
            $queryParams = [];

            // Add organization filter - REQUIRED
            $whereConditions[] = "audit_logs.organization_id = :org_id";
            $countParams[':org_id'] = $org_id;
            $queryParams[':org_id'] = $org_id;

            // Apply optional filters
            if ($entityType) {
                $whereConditions[] = "audit_logs.entity_type = :filter_entity_type";
                $countParams[':filter_entity_type'] = $entityType;
                $queryParams[':filter_entity_type'] = $entityType;
            }

            if ($entityId) {
                $whereConditions[] = "audit_logs.entity_id = :filter_entity_id";
                $countParams[':filter_entity_id'] = $entityId;
                $queryParams[':filter_entity_id'] = $entityId;
            }

            if ($action) {
                $whereConditions[] = "audit_logs.action = :filter_action";
                $countParams[':filter_action'] = $action;
                $queryParams[':filter_action'] = $action;
            }

            if ($userId) {
                $whereConditions[] = "audit_logs.user_id = :filter_user_id";
                $countParams[':filter_user_id'] = $userId;
                $queryParams[':filter_user_id'] = $userId;
            }

            $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";

            // Count total records
            $countQuery = "
                SELECT COUNT(*) as total
                FROM audit_logs
                $whereClause
            ";

            $countResult = DB::raw($countQuery, $countParams);
            $total = $countResult[0]->total ?? 0;

            // Fetch paginated data with user details
            $query = "
                SELECT 
                    audit_logs.*,
                    users.first_name as user_first_name,
                    users.surname as user_surname,
                    users.email as user_email,
                    CONCAT(users.first_name, ' ', users.surname) as user_full_name
                FROM audit_logs
                LEFT JOIN users ON audit_logs.user_id = users.id
                $whereClause
                ORDER BY audit_logs.created_at DESC
                LIMIT :pagination_limit OFFSET :pagination_offset
            ";

            $queryParams[':pagination_limit'] = $perPage;
            $queryParams[':pagination_offset'] = $offset;

            $auditLogs = DB::raw($query, $queryParams);

            // Parse JSON details if present
            foreach ($auditLogs as $log) {
                if ($log->details) {
                    $log->details = json_decode($log->details, true);
                }
            }

            // Calculate pagination metadata
            $totalPages = ceil($total / $perPage);

            return responseJson(
                success: true,
                data: $auditLogs,
                message: "Fetched Audit Logs Successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => (int) $total,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_prev' => $page > 1
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Audit log index error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch audit logs",
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
     * Get a single audit log by ID
     */
    public function show($org_id, $id)
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

            if (!$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing audit log ID",
                    code: 404,
                    errors: ['id' => 'Audit log ID is required and must be a valid number']
                );
            }

            $query = "
                SELECT 
                    audit_logs.*,
                    users.first_name as user_first_name,
                    users.surname as user_surname,
                    users.email as user_email,
                    CONCAT(users.first_name, ' ', users.surname) as user_full_name
                FROM audit_logs
                LEFT JOIN users ON audit_logs.user_id = users.id
                WHERE audit_logs.id = :id AND audit_logs.organization_id = :org_id
            ";

            $auditLog = DB::raw($query, [':id' => $id, ':org_id' => $org_id]);

            if (empty($auditLog)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Audit log not found",
                    code: 404
                );
            }

            // Parse JSON details if present
            if ($auditLog[0]->details) {
                $auditLog[0]->details = json_decode($auditLog[0]->details, true);
            }

            return responseJson(
                success: true,
                data: $auditLog[0],
                message: "Audit log fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch audit log: " . $e->getMessage(),
                code: 500
            );
        }
    }
}

