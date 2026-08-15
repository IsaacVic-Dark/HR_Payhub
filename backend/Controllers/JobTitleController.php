<?php

namespace App\Controllers;

use App\Services\DB;

class JobTitleController
{
    // =========================================================================
    // GET /organizations/{org_id}/job-titles
    // Optional filters: department_id, search, with_minimal
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

            // Minimal mode — returns only id, title (+ grade) for pickers/dropdowns
            // (e.g. the employee drawer's job title select once a department is chosen).
            $withMinimal = isset($_GET['with_minimal']) && $_GET['with_minimal'] == '1';

            // Optional filters
            $departmentId = isset($_GET['department_id']) ? (int) $_GET['department_id'] : null;
            $search       = $_GET['search'] ?? null;

            // Build conditions
            $conditions = ["jt.organization_id = :org_id"];
            $params = [':org_id' => $org_id];

            if ($departmentId !== null) {
                $conditions[] = "jt.department_id = :department_id";
                $params[':department_id'] = $departmentId;
            }

            if ($search) {
                $conditions[] = "jt.title LIKE :search";
                $params[':search'] = "%$search%";
            }

            $where = "WHERE " . implode(" AND ", $conditions);

            if ($withMinimal) {
                $jobTitles = DB::raw(
                    "SELECT jt.id, jt.title, jt.grade, jt.department_id
                     FROM job_titles jt $where
                     ORDER BY jt.title ASC",
                    $params
                );

                if (!is_array($jobTitles)) {
                    $jobTitles = [];
                }

                return responseJson(
                    success: true,
                    data: $jobTitles,
                    message: "Job titles fetched successfully",
                    code: 200,
                    metadata: ['total' => count($jobTitles)]
                );
            }

            // Pagination
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            $countResult = DB::raw(
                "SELECT COUNT(*) as total FROM job_titles jt $where",
                $params
            );
            $total = (int) ($countResult[0]->total ?? 0);

            $queryParams = array_merge($params, [
                ':limit' => (int) $perPage,
                ':offset' => (int) $offset,
            ]);

            $query = "
                SELECT
                    jt.*,
                    d.name AS department_name,
                    (
                        SELECT COUNT(*)
                        FROM employees emp
                        WHERE emp.job_title_id = jt.id
                        AND emp.organization_id = jt.organization_id
                        AND emp.status NOT IN ('resigned', 'terminated', 'retired', 'deceased')
                    ) AS employee_count
                FROM job_titles jt
                LEFT JOIN departments d ON jt.department_id = d.id
                $where
                ORDER BY jt.title ASC
                LIMIT :limit OFFSET :offset
            ";

            $jobTitles = DB::raw($query, $queryParams);

            if (!is_array($jobTitles)) {
                $jobTitles = [];
            }

            $totalPages = $total > 0 ? ceil($total / $perPage) : 0;

            return responseJson(
                success: true,
                data: $jobTitles,
                message: "Job titles fetched successfully",
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
            error_log("JobTitleController::index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch job titles",
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
    // GET /organizations/{org_id}/job-titles/{id}
    // =========================================================================

    public function show($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or job title ID",
                    code: 404
                );
            }

            $query = "
                SELECT jt.*, d.name AS department_name
                FROM job_titles jt
                LEFT JOIN departments d ON jt.department_id = d.id
                WHERE jt.id = :id AND jt.organization_id = :org_id
                LIMIT 1
            ";

            $result = DB::raw($query, [':id' => $id, ':org_id' => $org_id]);

            if (!is_array($result) || empty($result)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Job title not found",
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $result[0],
                message: "Job title fetched successfully"
            );
        } catch (\Exception $e) {
            error_log("JobTitleController::show error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch job title: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // POST /organizations/{org_id}/job-titles
    // Body: { title, department_id, grade? }
    // department_id is REQUIRED — every job title must belong to a department
    // (this also backs the employee drawer's inline "+ Add job title" quick-add).
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

            if (empty($data['title'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Field 'title' is required",
                    code: 400,
                    errors: ['title' => 'Job title is required']
                );
            }

            if (empty($data['department_id'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Field 'department_id' is required",
                    code: 400,
                    errors: ['department_id' => 'A job title must belong to a department']
                );
            }

            // Confirm department exists, belongs to this org, and is active
            $dept = DB::raw(
                "SELECT id FROM departments WHERE id = :dept_id AND organization_id = :org_id AND is_active = 1 LIMIT 1",
                [':dept_id' => $data['department_id'], ':org_id' => $org_id]
            );
            if (empty($dept)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Department not found or does not belong to this organization",
                    code: 404,
                    errors: ['department_id' => 'Invalid department_id']
                );
            }

            // Unique title per organization (matches unique_title_per_company)
            $duplicate = DB::raw(
                "SELECT id FROM job_titles WHERE organization_id = :org_id AND title = :title LIMIT 1",
                [':org_id' => $org_id, ':title' => trim($data['title'])]
            );

            if (!empty($duplicate)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "A job title with this name already exists in the organization",
                    code: 409,
                    errors: ['title' => 'Job title must be unique within the organization']
                );
            }

            $insertData = [
                'organization_id' => $org_id,
                'department_id'   => (int) $data['department_id'],
                'title'           => trim($data['title']),
                'grade'           => !empty($data['grade']) ? trim($data['grade']) : null,
                'created_at'      => date('Y-m-d H:i:s'),
            ];

            DB::table('job_titles')->insert($insertData);
            $jobTitleId = DB::lastInsertId();

            $this->createAuditLog($org_id, $currentUser['id'], 'job_titles', $jobTitleId, 'create', $insertData);

            return responseJson(
                success: true,
                data: [
                    'id'            => (int) $jobTitleId,
                    'title'         => $insertData['title'],
                    'grade'         => $insertData['grade'],
                    'department_id' => $insertData['department_id'],
                ],
                message: "Job title created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("JobTitleController::store error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create job title: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // PUT /organizations/{org_id}/job-titles/{id}
    // =========================================================================

    public function update($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or job title ID",
                    code: 404
                );
            }

            $existing = DB::raw(
                "SELECT * FROM job_titles WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $org_id]
            );

            if (!is_array($existing) || empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Job title not found",
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

            // Check duplicate title if title is being changed
            if (!empty($data['title']) && $data['title'] !== $existing[0]->title) {
                $duplicate = DB::raw(
                    "SELECT id FROM job_titles
                     WHERE organization_id = :org_id AND title = :title AND id != :id LIMIT 1",
                    [':org_id' => $org_id, ':title' => trim($data['title']), ':id' => $id]
                );

                if (!empty($duplicate)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "A job title with this name already exists in the organization",
                        code: 409,
                        errors: ['title' => 'Job title must be unique within the organization']
                    );
                }
            }

            // Validate department_id if provided — a job title must always belong to a department
            if (array_key_exists('department_id', $data)) {
                if (empty($data['department_id'])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "department_id cannot be cleared",
                        code: 400,
                        errors: ['department_id' => 'A job title must belong to a department']
                    );
                }

                $dept = DB::raw(
                    "SELECT id FROM departments WHERE id = :dept_id AND organization_id = :org_id AND is_active = 1 LIMIT 1",
                    [':dept_id' => $data['department_id'], ':org_id' => $org_id]
                );
                if (empty($dept)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Department not found or does not belong to this organization",
                        code: 404,
                        errors: ['department_id' => 'Invalid department_id']
                    );
                }
            }

            $allowedFields = ['title', 'department_id', 'grade'];
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

            DB::table('job_titles')->update($updateData, 'id', $id);

            $this->createAuditLog($org_id, $currentUser['id'], 'job_titles', $id, 'update', $updateData);

            return responseJson(
                success: true,
                data: ['id' => (int) $id],
                message: "Job title updated successfully"
            );
        } catch (\Exception $e) {
            error_log("JobTitleController::update error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update job title: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // DELETE /organizations/{org_id}/job-titles/{id}
    // job_titles has no is_active column, so this is a HARD delete — blocked if
    // any employees currently reference this job title (matches the department
    // "cannot deactivate with active employees" guard, but here it's permanent).
    // =========================================================================

    public function destroy($org_id, $id)
    {
        try {
            if (!$org_id || !is_numeric($org_id) || !$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid organization or job title ID",
                    code: 404
                );
            }

            $existing = DB::raw(
                "SELECT * FROM job_titles WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $org_id]
            );

            if (!is_array($existing) || empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Job title not found",
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

            $activeEmployees = DB::raw(
                "SELECT COUNT(*) as total FROM employees
                 WHERE job_title_id = :jt_id AND organization_id = :org_id
                 AND status NOT IN ('resigned', 'terminated', 'retired', 'deceased')",
                [':jt_id' => $id, ':org_id' => $org_id]
            );

            $employeeCount = (int) ($activeEmployees[0]->total ?? 0);
            if ($employeeCount > 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot delete a job title that is still assigned to $employeeCount active employee(s). Reassign them first.",
                    code: 409
                );
            }

            DB::raw(
                "DELETE FROM job_titles WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );

            $this->createAuditLog($org_id, $currentUser['id'], 'job_titles', $id, 'delete', null);

            return responseJson(
                success: true,
                data: ['id' => (int) $id],
                message: "Job title deleted successfully"
            );
        } catch (\Exception $e) {
            error_log("JobTitleController::destroy error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete job title: " . $e->getMessage(),
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