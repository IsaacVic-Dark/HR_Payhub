<?php

namespace App\Controllers;

use App\Services\DB;

class DepartmentController
{
    // =========================================================================
    // GET /organizations/{org_id}/departments
    // =========================================================================

    public function index($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
                );
            }

            $orgCheck = DB::table('organizations')->where(['id' => $org_id])->get();
            if (empty($orgCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404
                );
            }

            // Pagination
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            // Optional filters
            $isActive = isset($_GET['is_active']) ? (int) $_GET['is_active'] : null;
            $search = $_GET['search'] ?? null;

            // Build conditions
            $conditions = ["d.organization_id = :org_id"];
            $params = [':org_id' => $org_id];

            if ($isActive !== null) {
                $conditions[] = "d.is_active = :is_active";
                $params[':is_active'] = $isActive;
            }

            if ($search) {
                $conditions[] = "(d.name LIKE :search OR d.code LIKE :search)";
                $params[':search'] = "%$search%";
            }

            $where = "WHERE " . implode(" AND ", $conditions);

            // Count total
            $countResult = DB::raw(
                "SELECT COUNT(*) as total FROM departments d $where",
                $params
            );
            $total = (int) ($countResult[0]->total ?? 0);

            // Paginated query — join head employee details
            $queryParams = array_merge($params, [
                ':limit' => (int) $perPage,
                ':offset' => (int) $offset,
            ]);

            $query = "
                SELECT
                    d.*,
                    CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, '')) AS head_full_name,
                    u.first_name      AS head_first_name,
                    u.surname         AS head_surname,
                    u.email           AS head_email,
                    e.employee_number AS head_employee_number,
                    (
                        SELECT COUNT(*)
                        FROM employees emp
                        WHERE emp.department_id = d.id
                        AND emp.organization_id = d.organization_id
                        AND emp.status NOT IN ('resigned', 'terminated', 'retired', 'deceased')
                    ) AS employee_count
                FROM departments d
                LEFT JOIN employees e ON d.head_employee_id = e.id
                LEFT JOIN users u ON e.user_id = u.id
                $where
                ORDER BY d.name ASC
                LIMIT :limit OFFSET :offset
            ";

            $departments = DB::raw($query, $queryParams);

            if (!is_array($departments)) {
                $departments = [];
            }

            $totalPages = $total > 0 ? ceil($total / $perPage) : 0;

            return responseJson(
                success: true,
                data: $departments,
                message: "Departments fetched successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => $total,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_prev' => $page > 1,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("DepartmentController::index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch departments",
                code: 500,
                errors: [
                    'exception' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]
            );
        }
    }

    // =========================================================================
    // GET /organizations/{org_id}/departments/{id}
    // =========================================================================

    public function show($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
                );
            }

            if (!$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid or missing department ID",
                    code: 404,
                    errors: ['id' => 'Department ID is required and must be a valid number']
                );
            }

            // department_manager can only view their own department
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if ($currentUser && $currentUser['user_type'] === 'department_manager') {
                $managed = DB::raw(
                    "SELECT id FROM departments
                     WHERE id = :id AND organization_id = :org_id AND head_employee_id = (
                         SELECT id FROM employees WHERE user_id = :user_id AND organization_id = :org_id2 LIMIT 1
                     ) LIMIT 1",
                    [
                        ':id' => $id,
                        ':org_id' => $org_id,
                        ':user_id' => $currentUser['id'],
                        ':org_id2' => $org_id,
                    ]
                );

                if (empty($managed)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "You do not have permission to view this department",
                        code: 403
                    );
                }
            }

            $query = "
                SELECT
                    d.*,
                    CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, '')) AS head_full_name,
                    u.first_name      AS head_first_name,
                    u.surname         AS head_surname,
                    u.email           AS head_email,
                    e.employee_number AS head_employee_number,
                    (
                        SELECT COUNT(*)
                        FROM employees emp
                    WHERE emp.department_id = d.id
                    AND emp.organization_id = d.organization_id
                    AND emp.status NOT IN ('resigned', 'terminated', 'retired', 'deceased')
                    ) AS employee_count
                FROM departments d
                LEFT JOIN employees e ON d.head_employee_id = e.id
                LEFT JOIN users u ON e.user_id = u.id
                WHERE d.id = :id AND d.organization_id = :org_id
                LIMIT 1
            ";

            $result = DB::raw($query, [':id' => $id, ':org_id' => $org_id]);

            if (!is_array($result) || empty($result)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Department not found",
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $result[0],
                message: "Department fetched successfully"
            );
        } catch (\Exception $e) {
            error_log("DepartmentController::show error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch department: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // POST /organizations/{org_id}/departments
    // =========================================================================

    public function store($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
                );
            }

            $orgCheck = DB::table('organizations')->where(['id' => $org_id])->get();
            if (empty($orgCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication required",
                    code: 401
                );
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            if (empty($data['name'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Field 'name' is required",
                    code: 400,
                    errors: ['name' => 'Department name is required']
                );
            }

            // Check for duplicate name within the same organisation
            $duplicate = DB::raw(
                "SELECT id FROM departments WHERE organization_id = :org_id AND name = :name LIMIT 1",
                [':org_id' => $org_id, ':name' => trim($data['name'])]
            );

            if (!empty($duplicate)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "A department with this name already exists in the organization",
                    code: 409,
                    errors: ['name' => 'Department name must be unique within the organization']
                );
            }

            // Validate head_employee_id if provided
            if (!empty($data['head_employee_id'])) {
                $empCheck = DB::raw(
                    "SELECT id FROM employees
                     WHERE id = :id AND organization_id = :org_id AND deleted_at IS NULL LIMIT 1",
                    [':id' => $data['head_employee_id'], ':org_id' => $org_id]
                );

                if (empty($empCheck)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Head employee not found in this organization",
                        code: 404,
                        errors: ['head_employee_id' => 'Employee not found']
                    );
                }
            }

            $insertData = [
                'organization_id' => $org_id,
                'name' => trim($data['name']),
                'code' => !empty($data['code']) ? strtoupper(trim($data['code'])) : null,
                'head_employee_id' => !empty($data['head_employee_id']) ? (int) $data['head_employee_id'] : null,
                'description' => $data['description'] ?? null,
                'is_active' => isset($data['is_active']) ? (int) $data['is_active'] : 1,
                'created_at' => date('Y-m-d H:i:s'),
            ];

            DB::table('departments')->insert($insertData);
            $departmentId = DB::lastInsertId();

            $this->createAuditLog($org_id, $currentUser['id'], 'departments', $departmentId, 'create', $insertData);

            return responseJson(
                success: true,
                data: ['id' => $departmentId],
                message: "Department created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("DepartmentController::store error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create department: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // PUT /organizations/{org_id}/departments/{id}
    // =========================================================================

    public function update($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or department ID",
                    code: 404
                );
            }

            $existing = DB::raw(
                "SELECT * FROM departments WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $org_id]
            );

            if (!is_array($existing) || empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Department not found",
                    code: 404
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication required",
                    code: 401
                );
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Check duplicate name if name is being changed
            if (!empty($data['name']) && $data['name'] !== $existing[0]->name) {
                $duplicate = DB::raw(
                    "SELECT id FROM departments
                     WHERE organization_id = :org_id AND name = :name AND id != :id LIMIT 1",
                    [':org_id' => $org_id, ':name' => trim($data['name']), ':id' => $id]
                );

                if (!empty($duplicate)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "A department with this name already exists in the organization",
                        code: 409,
                        errors: ['name' => 'Department name must be unique within the organization']
                    );
                }
            }

            // Validate head_employee_id if provided
            if (!empty($data['head_employee_id'])) {
                $empCheck = DB::raw(
                    "SELECT id FROM employees
                     WHERE id = :id AND organization_id = :org_id AND deleted_at IS NULL LIMIT 1",
                    [':id' => $data['head_employee_id'], ':org_id' => $org_id]
                );

                if (empty($empCheck)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Head employee not found in this organization",
                        code: 404,
                        errors: ['head_employee_id' => 'Employee not found']
                    );
                }
            }

            $allowedFields = ['name', 'code', 'head_employee_id', 'description', 'is_active'];
            $updateData = [];

            foreach ($allowedFields as $field) {
                if (array_key_exists($field, $data)) {
                    $updateData[$field] = $data[$field];
                }
            }

            if (empty($updateData)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No valid fields provided for update",
                    code: 400
                );
            }

            DB::table('departments')->update($updateData, 'id', $id);

            $this->createAuditLog($org_id, $currentUser['id'], 'departments', $id, 'update', $updateData);

            return responseJson(
                success: true,
                data: ['id' => (int) $id],
                message: "Department updated successfully"
            );
        } catch (\Exception $e) {
            error_log("DepartmentController::update error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update department: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // DELETE /organizations/{org_id}/departments/{id}
    // Soft-deletes by setting is_active = 0
    // =========================================================================

    public function destroy($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or department ID",
                    code: 404
                );
            }

            $existing = DB::raw(
                "SELECT * FROM departments WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $org_id]
            );

            if (!is_array($existing) || empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Department not found",
                    code: 404
                );
            }

            if ((int) $existing[0]->is_active === 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Department is already deactivated",
                    code: 400
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication required",
                    code: 401
                );
            }

            // Check if any active employees belong to this department
            $activeEmployees = DB::raw(
            "SELECT COUNT(*) as total FROM employees
            WHERE department_id = :dept_id AND organization_id = :org_id
            AND status NOT IN ('resigned', 'terminated', 'retired', 'deceased')",
            [':dept_id' => $id, ':org_id' => $org_id]
            );

            $employeeCount = (int) ($activeEmployees[0]->total ?? 0);
            if ($employeeCount > 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot deactivate a department that still has $employeeCount active employee(s). Reassign them first.",
                    code: 409
                );
            }

            // Soft delete — set is_active = 0
            DB::table('departments')->update(['is_active' => 0], 'id', $id);

            $this->createAuditLog($org_id, $currentUser['id'], 'departments', $id, 'deactivate', [
                'previous_is_active' => 1,
                'new_is_active' => 0,
            ]);

            return responseJson(
                success: true,
                data: ['id' => (int) $id],
                message: "Department deactivated successfully"
            );
        } catch (\Exception $e) {
            error_log("DepartmentController::destroy error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to deactivate department: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // POST /organizations/{org_id}/departments/{id}/assign-head
    // Body: { "head_employee_id": 123 }
    // =========================================================================

    public function assignHead($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or department ID",
                    code: 404
                );
            }

            $existing = DB::raw(
                "SELECT * FROM departments WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $org_id]
            );

            if (!is_array($existing) || empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Department not found",
                    code: 404
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication required",
                    code: 401
                );
            }

            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['head_employee_id'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Field 'head_employee_id' is required",
                    code: 400,
                    errors: ['head_employee_id' => 'Head employee ID is required']
                );
            }

            $empCheck = DB::raw(
                "SELECT e.id, u.first_name, u.surname
     FROM employees e
     LEFT JOIN users u ON e.user_id = u.id
     WHERE e.id = :id AND e.organization_id = :org_id LIMIT 1",
                [':id' => $data['head_employee_id'], ':org_id' => $org_id]
            );

            if (empty($empCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee not found in this organization",
                    code: 404,
                    errors: ['head_employee_id' => 'Employee not found']
                );
            }

            $previousHeadId = $existing[0]->head_employee_id;

            DB::table('departments')->update(
                ['head_employee_id' => (int) $data['head_employee_id']],
                'id',
                $id
            );

            $this->createAuditLog($org_id, $currentUser['id'], 'departments', $id, 'assign_head', [
                'previous_head_employee_id' => $previousHeadId,
                'new_head_employee_id' => (int) $data['head_employee_id'],
            ]);

            return responseJson(
                success: true,
                data: [
                    'department_id' => (int) $id,
                    'head_employee_id' => (int) $data['head_employee_id'],
                    'head_full_name' => $empCheck[0]->first_name . ' ' . $empCheck[0]->surname,
                ],
                message: "Department head assigned successfully"
            );
        } catch (\Exception $e) {
            error_log("DepartmentController::assignHead error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to assign department head: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // GET /organizations/{org_id}/departments/{id}/employees
    // =========================================================================

    public function employees($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or department ID",
                    code: 404
                );
            }

            $department = DB::raw(
                "SELECT * FROM departments WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $org_id]
            );

            if (!is_array($department) || empty($department)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Department not found",
                    code: 404
                );
            }

            // department_manager can only view their own department's employees
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if ($currentUser && $currentUser['user_type'] === 'department_manager') {
                $managed = DB::raw(
                    "SELECT id FROM departments
                     WHERE id = :id AND organization_id = :org_id AND head_employee_id = (
                         SELECT id FROM employees WHERE user_id = :user_id AND organization_id = :org_id2 LIMIT 1
                     ) LIMIT 1",
                    [
                        ':id' => $id,
                        ':org_id' => $org_id,
                        ':user_id' => $currentUser['id'],
                        ':org_id2' => $org_id,
                    ]
                );

                if (empty($managed)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "You do not have permission to view employees in this department",
                        code: 403
                    );
                }
            }

            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            $countResult = DB::raw(
            "SELECT COUNT(*) as total FROM employees
            WHERE department_id = :dept_id AND organization_id = :org_id
            AND status NOT IN ('resigned', 'terminated', 'retired', 'deceased')",
            [':dept_id' => $id, ':org_id' => $org_id]
            );
            $total = (int) ($countResult[0]->total ?? 0);

            $employees = DB::raw(
            "SELECT e.id, u.first_name, u.surname, u.email, e.employee_number, e.job_title,
                    e.department_id, e.status, e.employment_type, e.created_at
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            WHERE e.department_id = :dept_id AND e.organization_id = :org_id
            AND e.status NOT IN ('resigned', 'terminated', 'retired', 'deceased')
            ORDER BY u.first_name ASC, u.surname ASC
            LIMIT :limit OFFSET :offset",
            [':dept_id' => $id, ':org_id' => $org_id, ':limit' => (int) $perPage, ':offset' => (int) $offset]
            );

            if (!is_array($employees)) {
                $employees = [];
            }

            $totalPages = $total > 0 ? ceil($total / $perPage) : 0;

            return responseJson(
                success: true,
                data: $employees,
                message: "Department employees fetched successfully",
                code: 200,
                metadata: [
                    'department' => [
                        'id' => (int) $department[0]->id,
                        'name' => $department[0]->name,
                    ],
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => $total,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_prev' => $page > 1,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("DepartmentController::employees error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch department employees: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // Audit log helper
    // =========================================================================

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
}
