<?php

namespace App\Controllers;

use App\Services\DB;

class OrganizationConfigController
{
    /**
     * Get all organization configurations
     */
    public function index($org_id)
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

            // Optional filters
            $configType = $_GET['config_type'] ?? null;
            $isActive = isset($_GET['is_active']) ? $_GET['is_active'] : null;
            $search = $_GET['search'] ?? null;

            // Build WHERE conditions
            $whereConditions = ["organization_id = :org_id"];
            $params = [':org_id' => $org_id];

            // Apply filters
            if ($configType) {
                $whereConditions[] = "config_type = :config_type";
                $params[':config_type'] = $configType;
            }

            if ($isActive !== null) {
                $whereConditions[] = "is_active = :is_active";
                $params[':is_active'] = (int)$isActive;
            }

            if ($search) {
                $whereConditions[] = "name LIKE :search";
                $params[':search'] = '%' . $search . '%';
            }

            $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";

            // Get all configurations
            $query = "SELECT * FROM organization_configs $whereClause ORDER BY config_type, name ASC";
            $configs = DB::raw($query, $params);

            // Get statistics
            $statsQuery = "
                SELECT 
                    COUNT(*) as total_configs,
                    SUM(CASE WHEN config_type = 'tax' THEN 1 ELSE 0 END) as tax_configs,
                    SUM(CASE WHEN config_type = 'deduction' THEN 1 ELSE 0 END) as deduction_configs,
                    SUM(CASE WHEN config_type = 'loan' THEN 1 ELSE 0 END) as loan_configs,
                    SUM(CASE WHEN config_type = 'benefit' THEN 1 ELSE 0 END) as benefit_configs,
                    SUM(CASE WHEN config_type = 'per_diem' THEN 1 ELSE 0 END) as per_diem_configs,
                    SUM(CASE WHEN config_type = 'advance' THEN 1 ELSE 0 END) as advance_configs,
                    SUM(CASE WHEN config_type = 'refund' THEN 1 ELSE 0 END) as refund_configs,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_configs
                FROM organization_configs
                $whereClause
            ";

            $statsResult = DB::raw($statsQuery, $params);
            $stats = $statsResult[0] ?? null;

            return responseJson(
                success: true,
                data: $configs,
                message: "Organization configurations fetched successfully",
                code: 200,
                metadata: [
                    'statistics' => [
                        'total' => (int) ($stats->total_configs ?? 0),
                        'by_type' => [
                            'tax' => (int) ($stats->tax_configs ?? 0),
                            'deduction' => (int) ($stats->deduction_configs ?? 0),
                            'loan' => (int) ($stats->loan_configs ?? 0),
                            'benefit' => (int) ($stats->benefit_configs ?? 0),
                            'per_diem' => (int) ($stats->per_diem_configs ?? 0),
                            'advance' => (int) ($stats->advance_configs ?? 0),
                            'refund' => (int) ($stats->refund_configs ?? 0)
                        ],
                        'active_configs' => (int) ($stats->active_configs ?? 0),
                        'inactive_configs' => (int) ($stats->total_configs ?? 0) - (int) ($stats->active_configs ?? 0)
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Organization config index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch organization configurations",
                code: 500,
                errors: [
                    'exception' => $e->getMessage()
                ]
            );
        }
    }

    /**
     * Get a single configuration by ID
     */
    public function show($org_id, $id)
    {
        try {
            // Validate IDs
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing ID",
                    code: 400,
                    errors: [
                        'id' => 'Organization ID and Config ID are required and must be valid numbers'
                    ]
                );
            }

            $query = "
                SELECT * 
                FROM organization_configs 
                WHERE id = :id AND organization_id = :org_id
            ";

            $config = DB::raw($query, [
                ':id' => $id,
                ':org_id' => $org_id
            ]);

            if (empty($config)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Configuration not found",
                    code: 404
                );
            }

            // Get audit trail for this config
            $auditQuery = "
                SELECT 
                    al.*,
                    u.first_name,
                    u.surname,
                    u.email
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.organization_id = :org_id
                AND al.entity_type = 'organization_config'
                AND al.entity_id = :config_id
                ORDER BY al.created_at DESC
                LIMIT 10
            ";

            $auditTrail = DB::raw($auditQuery, [
                ':org_id' => $org_id,
                ':config_id' => $id
            ]);

            return responseJson(
                success: true,
                data: $config[0],
                message: "Configuration fetched successfully",
                code: 200,
                metadata: [
                    'audit_trail' => $auditTrail
                ]
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch configuration: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Create a new configuration
     */
    public function store($org_id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            $required = ['config_type', 'name'];
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

            // Validate organization exists
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

            // Check for duplicate config (organization_id, config_type, name)
            $duplicateCheck = DB::table('organization_configs')
                ->where([
                    'organization_id' => $org_id,
                    'config_type' => $data['config_type'],
                    'name' => $data['name']
                ])
                ->get();

            if (!empty($duplicateCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "A configuration with this type and name already exists",
                    code: 409
                );
            }

            // Prepare insert data
            $insertData = [
                'organization_id' => $org_id,
                'config_type' => $data['config_type'],
                'name' => $data['name'],
                'percentage' => $data['percentage'] ?? null,
                'fixed_amount' => $data['fixed_amount'] ?? null,
                'is_active' => isset($data['is_active']) ? (int)$data['is_active'] : 1,
                'status' => 'pending' // New field for approval workflow
            ];

            // Validate percentage and fixed_amount are not both set
            if ($insertData['percentage'] !== null && $insertData['fixed_amount'] !== null) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot set both percentage and fixed amount",
                    code: 400
                );
            }

            DB::table('organization_configs')->insert($insertData);
            $configId = DB::lastInsertId();

            // Create audit log
            $this->createAuditLog($org_id, $configId, 'create', $insertData);

            return responseJson(
                success: true,
                data: ['id' => $configId],
                message: "Configuration created successfully (pending approval)",
                code: 201
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create configuration: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Update an existing configuration
     */
    public function update($org_id, $id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Check if configuration exists
            $existingConfig = DB::table('organization_configs')
                ->where(['id' => $id, 'organization_id' => $org_id])
                ->get();

            if (empty($existingConfig)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Configuration not found",
                    code: 404
                );
            }

            $config = $existingConfig[0];

            // Store original values for audit
            $originalData = (array)$config;

            $updateData = [];

            // Build update data
            $allowedFields = ['config_type', 'name', 'percentage', 'fixed_amount', 'is_active'];
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

            // Validate percentage and fixed_amount are not both set
            $newPercentage = $updateData['percentage'] ?? $config->percentage;
            $newFixedAmount = $updateData['fixed_amount'] ?? $config->fixed_amount;
            
            if ($newPercentage !== null && $newFixedAmount !== null) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot set both percentage and fixed amount",
                    code: 400
                );
            }

            // Check for duplicate name if name is being updated
            if (isset($updateData['name']) || isset($updateData['config_type'])) {
                $newName = $updateData['name'] ?? $config->name;
                $newType = $updateData['config_type'] ?? $config->config_type;
                
                $duplicateCheckQuery  = "
                    SELECT * FROM organization_configs 
                    WHERE organization_id = :org_id 
                    AND config_type = :config_type 
                    AND name = :name 
                    AND id != :id
                ";

                $duplicateCheck = DB::raw($duplicateCheckQuery, [
                    ':org_id' => $org_id,
                    ':config_type' => $newType,
                    ':name' => $newName,
                    ':id' => $id
                ]);

                if (!empty($duplicateCheck)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "A configuration with this type and name already exists",
                        code: 409
                    );
                }
            }

            // Add status for approval workflow
            $updateData['status'] = 'pending';

            DB::table('organization_configs')->update($updateData, 'id', $id);

            // Create audit log
            $this->createAuditLog($org_id, $id, 'update', $updateData, $originalData);

            return responseJson(
                success: true,
                data: null,
                message: "Configuration updated successfully (pending approval)"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update configuration: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Delete a configuration
     */
    public function destroy($org_id, $id)
    {
        try {
            // Check if configuration exists
            $existingConfig = DB::table('organization_configs')
                ->where(['id' => $id, 'organization_id' => $org_id])
                ->get();

            if (empty($existingConfig)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Configuration not found",
                    code: 404
                );
            }

            $config = $existingConfig[0];

            // Check if configuration is in use
            $inUse = $this->checkConfigInUse($id, $config->config_type);
            if ($inUse) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot delete configuration that is in use",
                    code: 400
                );
            }

            // Store for audit before deletion
            $configData = (array)$config;

            // Soft delete by setting status to 'deleted_pending'
            DB::table('organization_configs')->update(
                ['status' => 'deleted_pending', 'is_active' => 0],
                'id',
                $id
            );

            // Create audit log
            $this->createAuditLog($org_id, $id, 'delete', null, $configData);

            return responseJson(
                success: true,
                data: null,
                message: "Configuration deletion requested (pending approval)"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete configuration: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Approve a configuration change
     */
    public function approve($org_id, $id)
    {
        try {
            // Get authenticated user
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Authentication required',
                    code: 401
                );
            }

            // Check if configuration exists
            $config = DB::table('organization_configs')
                ->where(['id' => $id, 'organization_id' => $org_id])
                ->get();

            if (empty($config)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Configuration not found",
                    code: 404
                );
            }

            $config = $config[0];

            // Check if configuration is pending approval
            if (!in_array($config->status, ['pending', 'deleted_pending'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Configuration is not pending approval",
                    code: 400
                );
            }

            // Determine action based on status
            if ($config->status === 'deleted_pending') {
                // Actually delete the configuration
                DB::table('organization_configs')->delete('id', $id);
                $action = 'delete_approved';
            } else {
                // Approve the pending changes
                DB::table('organization_configs')->update(
                    ['status' => 'approved', 'approved_by' => $currentUser['id'], 'approved_at' => date('Y-m-d H:i:s')],
                    'id',
                    $id
                );
                $action = 'approve';
            }

            // Create audit log for approval
            $this->createAuditLog($org_id, $id, $action, ['approved_by' => $currentUser['id']]);

            return responseJson(
                success: true,
                data: null,
                message: "Configuration approved successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to approve configuration: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Reject a configuration change
     */
    public function reject($org_id, $id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = $data['rejection_reason'] ?? null;

            // Get authenticated user
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Authentication required',
                    code: 401
                );
            }

            // Check if configuration exists
            $config = DB::table('organization_configs')
                ->where(['id' => $id, 'organization_id' => $org_id])
                ->get();

            if (empty($config)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Configuration not found",
                    code: 404
                );
            }

            $config = $config[0];

            // Check if configuration is pending approval
            if (!in_array($config->status, ['pending', 'deleted_pending'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Configuration is not pending approval",
                    code: 400
                );
            }

            // Store current data for restoration
            $currentData = (array)$config;

            // For deletion rejection, restore to previous state
            if ($config->status === 'deleted_pending') {
                // Restore to active state
                DB::table('organization_configs')->update(
                    [
                        'status' => 'approved',
                        'is_active' => 1,
                        'rejected_by' => $currentUser['id'],
                        'rejected_at' => date('Y-m-d H:i:s'),
                        'rejection_reason' => $rejectionReason
                    ],
                    'id',
                    $id
                );
                $action = 'delete_rejected';
            } else {
                // For update/create rejection, revert changes if possible
                // For now, just mark as rejected
                DB::table('organization_configs')->update(
                    [
                        'status' => 'rejected',
                        'rejected_by' => $currentUser['id'],
                        'rejected_at' => date('Y-m-d H:i:s'),
                        'rejection_reason' => $rejectionReason
                    ],
                    'id',
                    $id
                );
                $action = 'reject';
            }

            // Create audit log for rejection
            $this->createAuditLog($org_id, $id, $action, [
                'rejected_by' => $currentUser['id'],
                'rejection_reason' => $rejectionReason
            ]);

            return responseJson(
                success: true,
                data: null,
                message: "Configuration rejected successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to reject configuration: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Get pending configurations for approval
     */
    public function getPendingApprovals($org_id)
    {
        try {
            $query = "
                SELECT 
                    oc.*,
                    u.first_name as created_by_first_name,
                    u.surname as created_by_surname
                FROM organization_configs oc
                LEFT JOIN users u ON oc.created_by = u.id
                WHERE oc.organization_id = :org_id
                AND oc.status IN ('pending', 'deleted_pending')
                ORDER BY oc.updated_at DESC
            ";

            $pendingConfigs = DB::raw($query, [':org_id' => $org_id]);

            return responseJson(
                success: true,
                data: $pendingConfigs,
                message: "Pending configurations fetched successfully",
                metadata: [
                    'count' => count($pendingConfigs)
                ]
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch pending configurations: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Check if a configuration is in use
     */
    private function checkConfigInUse($configId, $configType)
    {
        $tables = [
            'tax' => ['payrun_deductions'],
            'deduction' => ['payrun_deductions'],
            'loan' => ['loans'],
            'benefit' => ['benefits'],
            'per_diem' => ['per_diems'],
            'advance' => ['advances'],
            'refund' => ['refunds']
        ];

        if (!isset($tables[$configType])) {
            return false;
        }

        foreach ($tables[$configType] as $table) {
            $checkQuery = "SELECT COUNT(*) as count FROM $table WHERE config_id = :config_id";
            $result = DB::raw($checkQuery, [':config_id' => $configId]);
            
            if (($result[0]->count ?? 0) > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Create audit log entry
     */
    private function createAuditLog($orgId, $entityId, $action, $newData = null, $oldData = null)
    {
        try {
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            
            $details = [
                'action' => $action,
                'timestamp' => date('Y-m-d H:i:s'),
                'user_id' => $currentUser['id'] ?? null,
                'new_data' => $newData,
                'old_data' => $oldData
            ];

            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id' => $currentUser['id'] ?? null,
                'entity_type' => 'organization_config',
                'entity_id' => $entityId,
                'action' => $action,
                'details' => json_encode($details),
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            error_log("Audit log creation error: " . $e->getMessage());
        }
    }
}