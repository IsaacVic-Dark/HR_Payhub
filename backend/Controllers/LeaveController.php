<?php

namespace App\Controllers;

use App\Services\DB;

class LeaveController
{
    /**
     * Get all leaves with pagination and auto-expire old leaves
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

            // Apply role-based filters with error handling
            try {
                $filters = $this->applyRoleBasedFilters($org_id);
            } catch (\Exception $e) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication error",
                    code: 401,
                    errors: [
                        'authentication' => $e->getMessage()
                    ]
                );
            }

            // Auto-expire leaves that have passed their end date
            $this->autoExpireLeaves();

            // Get pagination parameters with validation
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            // Optional filters with validation
            $status = $_GET['status'] ?? null;
            $approverId = $_GET['approver_id'] ?? null;
            $relieverId = $_GET['reliever_id'] ?? null;
            $leaveType = $_GET['leave_type'] ?? null;
            $month = $_GET['month'] ?? null;
            $year = $_GET['year'] ?? null;
            $name = $_GET['name'] ?? null;

            // Validate filter inputs
            $validationErrors = [];

            // Validate status
            if ($status && !in_array($status, ['pending', 'approved', 'rejected', 'expired'])) {
                $validationErrors['status'] = "Invalid status. Must be one of: pending, approved, rejected, expired";
            }

            // Validate leave type
            if ($leaveType && !in_array($leaveType, ['sick', 'casual', 'annual', 'maternity', 'paternity', 'other'])) {
                $validationErrors['leave_type'] = "Invalid leave type. Must be one of: sick, casual, annual, maternity, paternity, other";
            }

            // Validate month
            if ($month) {
                $targetMonth = (int) $month;
                if ($targetMonth < 1 || $targetMonth > 12) {
                    $validationErrors['month'] = "Invalid month. Must be between 1 and 12";
                }
            }

            // Validate year
            if ($year) {
                $targetYear = (int) $year;
                if ($targetYear < 1900 || $targetYear > 2100) {
                    $validationErrors['year'] = "Invalid year. Must be between 1900 and 2100";
                }
            }

            // Validate approver_id
            if ($approverId && !is_numeric($approverId)) {
                $validationErrors['approver_id'] = "Approver ID must be a valid number";
            }

            // Validate reliever_id
            if ($relieverId && !is_numeric($relieverId)) {
                $validationErrors['reliever_id'] = "Reliever ID must be a valid number";
            }

            // If there are validation errors, return them
            if (!empty($validationErrors)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Validation failed for one or more filters",
                    code: 400,
                    errors: $validationErrors
                );
            }

            // Build WHERE clause
            $whereConditions = [];
            $countParams = [];
            $queryParams = [];
            $statsParams = [];

            // Add organization filter - REQUIRED
            $whereConditions[] = "emp_users.organization_id = :org_id";
            $countParams[':org_id'] = $org_id;
            $queryParams[':org_id'] = $org_id;
            $statsParams[':org_id'] = $org_id;

            // Apply role-based filters
            if (isset($filters['employee_id'])) {
                $whereConditions[] = "leaves.employee_id = :role_employee_id";
                $countParams[':role_employee_id'] = $filters['employee_id'];
                $queryParams[':role_employee_id'] = $filters['employee_id'];
                $statsParams[':role_employee_id'] = $filters['employee_id'];
            }

            if (isset($filters['team_employees']) && !empty($filters['team_employees'])) {
                $placeholders = implode(',', array_map(function ($i) {
                    return ":team_emp_$i";
                }, array_keys($filters['team_employees'])));
                $whereConditions[] = "leaves.employee_id IN ($placeholders)";

                foreach ($filters['team_employees'] as $idx => $empId) {
                    $countParams[":team_emp_$idx"] = $empId;
                    $queryParams[":team_emp_$idx"] = $empId;
                    $statsParams[":team_emp_$idx"] = $empId;
                }
            }

            // Apply optional filters
            if ($status) {
                $whereConditions[] = "leaves.status = :filter_status";
                $countParams[':filter_status'] = $status;
                $queryParams[':filter_status'] = $status;
                $statsParams[':filter_status'] = $status;
            }

            if ($approverId) {
                $whereConditions[] = "leaves.approver_id = :filter_approver_id";
                $countParams[':filter_approver_id'] = $approverId;
                $queryParams[':filter_approver_id'] = $approverId;
                $statsParams[':filter_approver_id'] = $approverId;
            }

            if ($relieverId) {
                $whereConditions[] = "leaves.reliever_id = :filter_reliever_id";
                $countParams[':filter_reliever_id'] = $relieverId;
                $queryParams[':filter_reliever_id'] = $relieverId;
                $statsParams[':filter_reliever_id'] = $relieverId;
            }

            if ($leaveType) {
                $whereConditions[] = "leaves.leave_type = :filter_leave_type";
                $countParams[':filter_leave_type'] = $leaveType;
                $queryParams[':filter_leave_type'] = $leaveType;
                $statsParams[':filter_leave_type'] = $leaveType;
            }

            // Month filter
            if ($month) {
                $targetMonth = (int) $month;
                $whereConditions[] = "MONTH(leaves.start_date) = :filter_month";
                $countParams[':filter_month'] = $targetMonth;
                $queryParams[':filter_month'] = $targetMonth;
                $statsParams[':filter_month'] = $targetMonth;
            }

            // Year filter
            if ($year) {
                $targetYear = (int) $year;
                $whereConditions[] = "YEAR(leaves.start_date) = :filter_year";
                $countParams[':filter_year'] = $targetYear;
                $queryParams[':filter_year'] = $targetYear;
                $statsParams[':filter_year'] = $targetYear;
            }

            // Name filter
            if ($name) {
                $whereConditions[] = "CONCAT(emp_users.first_name, ' ', COALESCE(emp_users.middle_name, ''), ' ', emp_users.surname) LIKE :filter_name";
                $countParams[':filter_name'] = '%' . $name . '%';
                $queryParams[':filter_name'] = '%' . $name . '%';
                $statsParams[':filter_name'] = '%' . $name . '%';
            }

            $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";

            // Count total records
            $countQuery = "
            SELECT COUNT(*) as total
            FROM leaves
            INNER JOIN employees ON leaves.employee_id = employees.id
            INNER JOIN users emp_users ON employees.user_id = emp_users.id
            $whereClause
        ";

            $countResult = DB::raw($countQuery, $countParams);
            $total = $countResult[0]->total ?? 0;

            // Check if any leaves exist
            if ($total === 0) {
                // Build filter message for better context
                $appliedFilters = [];
                if ($org_id) $appliedFilters['organization_id'] = $org_id;
                if ($status) $appliedFilters['status'] = $status;
                if ($approverId) $appliedFilters['approver_id'] = $approverId;
                if ($relieverId) $appliedFilters['reliever_id'] = $relieverId;
                if ($leaveType) $appliedFilters['leave_type'] = $leaveType;
                if ($month) $appliedFilters['month'] = $month;
                if ($year) $appliedFilters['year'] = $year;
                if ($name) $appliedFilters['name'] = $name;

                return responseJson(
                    success: false,
                    data: null,
                    message: "No leaves found matching the specified criteria",
                    code: 404,
                    metadata: [
                        'applied_filters' => $appliedFilters
                    ],
                    errors: [
                        'query' => 'No leave records match your search criteria'
                    ]
                );
            }

            // Get statistics for leave types
            $statsQuery = "
            SELECT 
                COUNT(*) as total_leaves,
                SUM(CASE WHEN leave_type = 'sick' THEN 1 ELSE 0 END) as sick_leaves,
                SUM(CASE WHEN leave_type = 'casual' THEN 1 ELSE 0 END) as casual_leaves,
                SUM(CASE WHEN leave_type = 'annual' THEN 1 ELSE 0 END) as annual_leaves,
                SUM(CASE WHEN leave_type = 'maternity' THEN 1 ELSE 0 END) as maternity_leaves,
                SUM(CASE WHEN leave_type = 'paternity' THEN 1 ELSE 0 END) as paternity_leaves,
                SUM(CASE WHEN leave_type = 'other' THEN 1 ELSE 0 END) as other_leaves
            FROM leaves
            INNER JOIN employees ON leaves.employee_id = employees.id
            INNER JOIN users emp_users ON employees.user_id = emp_users.id
            $whereClause
        ";

            $statsResult = DB::raw($statsQuery, $statsParams);
            $stats = $statsResult[0] ?? null;

            // Fetch paginated data with approver and reliever info
            $query = "
            SELECT 
                leaves.id AS leave_id,
                leaves.employee_id,
                leaves.approver_id,
                leaves.reliever_id,
                leaves.leave_type,
                leaves.start_date,
                leaves.end_date,
                leaves.status,
                leaves.reason,
                leaves.created_at,
                leaves.updated_at,

                -- Employee details
                emp_users.email AS employee_email,
                emp_users.first_name AS employee_first_name,
                emp_users.middle_name AS employee_middle_name,
                emp_users.surname AS employee_surname,
                emp_users.organization_id AS organization_id,
                CONCAT(
                    emp_users.first_name,
                    ' ',
                    COALESCE(emp_users.middle_name, ''),
                    ' ',
                    emp_users.surname
                ) AS employee_full_name,

                -- Approver details
                approver_users.email AS approver_email,
                approver_users.first_name AS approver_first_name,
                approver_users.middle_name AS approver_middle_name,
                approver_users.surname AS approver_surname,
                CONCAT(
                    approver_users.first_name,
                    ' ',
                    COALESCE(approver_users.middle_name, ''),
                    ' ',
                    approver_users.surname
                ) AS approver_full_name,

                -- Reliever details
                reliever_users.email AS reliever_email,
                reliever_users.first_name AS reliever_first_name,
                reliever_users.middle_name AS reliever_middle_name,
                reliever_users.surname AS reliever_surname,
                CONCAT(
                    reliever_users.first_name,
                    ' ',
                    COALESCE(reliever_users.middle_name, ''),
                    ' ',
                    reliever_users.surname
                ) AS reliever_full_name

            FROM leaves
            INNER JOIN employees ON leaves.employee_id = employees.id
            INNER JOIN users emp_users ON employees.user_id = emp_users.id

            LEFT JOIN employees approver_emp ON leaves.approver_id = approver_emp.id
            LEFT JOIN users approver_users ON approver_emp.user_id = approver_users.id

            LEFT JOIN employees reliever_emp ON leaves.reliever_id = reliever_emp.id
            LEFT JOIN users reliever_users ON reliever_emp.user_id = reliever_users.id

            $whereClause
            ORDER BY leaves.created_at DESC
            LIMIT :pagination_limit OFFSET :pagination_offset
        ";

            $queryParams[':pagination_limit'] = $perPage;
            $queryParams[':pagination_offset'] = $offset;

            $leaves = DB::raw($query, $queryParams);

            // Calculate pagination metadata
            $totalPages = ceil($total / $perPage);

            return responseJson(
                success: true,
                data: $leaves,
                message: "Fetched Leaves Successfully",
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
                        'total_leaves' => (int) ($stats->total_leaves ?? 0),
                        'sick' => (int) ($stats->sick_leaves ?? 0),
                        'casual' => (int) ($stats->casual_leaves ?? 0),
                        'annual' => (int) ($stats->annual_leaves ?? 0),
                        'maternity' => (int) ($stats->maternity_leaves ?? 0),
                        'paternity' => (int) ($stats->paternity_leaves ?? 0),
                        'other' => (int) ($stats->other_leaves ?? 0)
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Leave index error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch leaves",
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
     * Get a single leave by ID
     */
    public function show($id)
    {
        try {
            $query = "
    SELECT 
        leaves.id AS leave_id,
        leaves.employee_id,
        leaves.approver_id,
        leaves.reliever_id,
        leaves.leave_type,
        leaves.start_date,
        leaves.end_date,
        leaves.status,
        leaves.reason,
        leaves.created_at,
        leaves.updated_at,

        -- Employee details
        emp_users.email AS employee_email,
        emp_users.first_name AS employee_first_name,
        emp_users.middle_name AS employee_middle_name,
        emp_users.surname AS employee_surname,
        CONCAT(
            emp_users.first_name,
            ' ',
            COALESCE(emp_users.middle_name, ''),
            ' ',
            emp_users.surname
        ) AS employee_full_name,

        -- Approver details
        approver_users.email AS approver_email,
        approver_users.first_name AS approver_first_name,
        approver_users.middle_name AS approver_middle_name,
        approver_users.surname AS approver_surname,
        CONCAT(
            approver_users.first_name,
            ' ',
            COALESCE(approver_users.middle_name, ''),
            ' ',
            approver_users.surname
        ) AS approver_full_name,

        -- Reliever details
        reliever_users.email AS reliever_email,
        reliever_users.first_name AS reliever_first_name,
        reliever_users.middle_name AS reliever_middle_name,
        reliever_users.surname AS reliever_surname,
        CONCAT(
            reliever_users.first_name,
            ' ',
            COALESCE(reliever_users.middle_name, ''),
            ' ',
            reliever_users.surname
        ) AS reliever_full_name

    FROM leaves
    INNER JOIN employees ON leaves.employee_id = employees.id
    INNER JOIN users emp_users ON employees.user_id = emp_users.id

    LEFT JOIN employees approver_emp ON leaves.approver_id = approver_emp.id
    LEFT JOIN users approver_users ON approver_emp.user_id = approver_users.id

    LEFT JOIN employees reliever_emp ON leaves.reliever_id = reliever_emp.id
    LEFT JOIN users reliever_users ON reliever_emp.user_id = reliever_users.id

    WHERE leaves.id = :id
";


            $leave = DB::raw($query, [':id' => $id]);

            if (empty($leave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $leave[0],
                message: "Leave fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Create a new leave application
     */
    public function store()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            $required = ['employee_id', 'leave_type', 'start_date', 'end_date'];
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
            if (strtotime($data['start_date']) > strtotime($data['end_date'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Start date must be before end date",
                    code: 400
                );
            }

            // Check if employee exists
            $employeeCheck = DB::table('employees')
                ->where(['id' => $data['employee_id']])
                ->get();

            if (empty($employeeCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee {$data['employee_id']} not found",
                    code: 404
                );
            }

            // Check if approver exists (if provided)
            if (!empty($data['approver_id'])) {
                $approverCheck = DB::table('employees')
                    ->where(['id' => $data['approver_id']])
                    ->get();

                if (empty($approverCheck)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Approver not found",
                        code: 404
                    );
                }
            }

            // Check if reliever exists (if provided)
            if (!empty($data['reliever_id'])) {
                $relieverCheck = DB::table('employees')
                    ->where(['id' => $data['reliever_id']])
                    ->get();

                if (empty($relieverCheck)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Reliever not found",
                        code: 404
                    );
                }
            }

            // Check for overlapping leaves
            $overlapCheck = $this->checkOverlappingLeaves(
                $data['employee_id'],
                $data['start_date'],
                $data['end_date']
            );

            if (!$overlapCheck['valid']) {
                return responseJson(
                    success: false,
                    data: $overlapCheck['conflict'],
                    message: $overlapCheck['message'],
                    code: 409
                );
            }

            // Prepare insert data
            $insertData = [
                'employee_id' => $data['employee_id'],
                'leave_type' => $data['leave_type'],
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'status' => 'pending',
                'reason' => $data['reason'] ?? null,
                'approver_id' => $data['approver_id'] ?? null,
                'reliever_id' => $data['reliever_id'] ?? null
            ];

            DB::table('leaves')->insert($insertData);
            $leaveId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $leaveId],
                message: "Leave application created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Update a leave application
     */
    public function update($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Check if leave exists
            $existingLeave = DB::table('leaves')
                ->where(['id' => $id])
                ->get();

            if (empty($existingLeave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    code: 404
                );
            }

            $leave = $existingLeave[0];

            // Don't allow updating approved/rejected leaves
            if (in_array($leave->status, ['approved', 'rejected'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot update a leave that has been approved or rejected",
                    code: 400
                );
            }

            $updateData = [];

            // Build update data
            if (isset($data['leave_type'])) {
                $updateData['leave_type'] = $data['leave_type'];
            }

            if (isset($data['start_date'])) {
                $updateData['start_date'] = $data['start_date'];
            }

            if (isset($data['end_date'])) {
                $updateData['end_date'] = $data['end_date'];
            }

            if (isset($data['reason'])) {
                $updateData['reason'] = $data['reason'];
            }

            if (isset($data['approver_id'])) {
                // Validate approver exists
                if ($data['approver_id'] !== null) {
                    $approverCheck = DB::table('employees')
                        ->where(['id' => $data['approver_id']])
                        ->get();

                    if (empty($approverCheck)) {
                        return responseJson(
                            success: false,
                            data: null,
                            message: "Approver not found",
                            code: 404
                        );
                    }
                }
                $updateData['approver_id'] = $data['approver_id'];
            }

            if (isset($data['reliever_id'])) {
                // Validate reliever exists
                if ($data['reliever_id'] !== null) {
                    $relieverCheck = DB::table('employees')
                        ->where(['id' => $data['reliever_id']])
                        ->get();

                    if (empty($relieverCheck)) {
                        return responseJson(
                            success: false,
                            data: null,
                            message: "Reliever not found",
                            code: 404
                        );
                    }
                }
                $updateData['reliever_id'] = $data['reliever_id'];
            }

            if (empty($updateData)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No fields to update",
                    code: 400
                );
            }

            // Validate dates if both are being updated or one is being updated
            $startDate = $updateData['start_date'] ?? $leave->start_date;
            $endDate = $updateData['end_date'] ?? $leave->end_date;

            if (strtotime($startDate) > strtotime($endDate)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Start date must be before end date",
                    code: 400
                );
            }

            // Check for overlapping leaves if dates are being updated
            if (isset($updateData['start_date']) || isset($updateData['end_date'])) {
                $overlapCheck = $this->checkOverlappingLeaves(
                    $leave->employee_id,
                    $startDate,
                    $endDate,
                    $id // Exclude current leave from check
                );

                if (!$overlapCheck['valid']) {
                    return responseJson(
                        success: false,
                        data: $overlapCheck['conflict'],
                        message: $overlapCheck['message'],
                        code: 409
                    );
                }
            }

            DB::table('leaves')->update($updateData, 'id', $id);

            return responseJson(
                success: true,
                data: null,
                message: "Leave updated successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Delete a leave application
     */
    public function destroy($id)
    {
        try {
            // Check if leave exists
            $existingLeave = DB::table('leaves')
                ->where(['id' => $id])
                ->get();

            if (empty($existingLeave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    code: 404
                );
            }

            $leave = $existingLeave[0];

            // Only allow deleting pending leaves
            if ($leave->status !== 'pending') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only pending leaves can be deleted",
                    code: 400
                );
            }

            DB::table('leaves')->delete('id', $id);

            return responseJson(
                success: true,
                data: null,
                message: "Leave deleted successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Approve a leave application
     * Uses authenticated user as approver automatically
     */
    public function approve($org_id, $leave_id)
    {
        try {
            // Get authenticated user and employee
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Authentication required',
                    code: 401
                );
            }

            // Verify the leave exists and belongs to the organization
            $leave = $this->getLeaveWithValidation($leave_id, $org_id);
            if (!$leave['success']) {
                return $leave; // Return error response
            }

            $leaveData = $leave['data'];

            // Check if leave is already processed
            if (in_array($leaveData->status, ['approved', 'rejected', 'expired'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave has already been {$leaveData->status}",
                    code: 400
                );
            }

            // Verify user has permission to approve this specific leave
            $canApprove = $this->canUserApproveLeave($currentEmployee['id'], $leaveData, $currentUser['user_type']);
            if (!$canApprove['allowed']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: $canApprove['reason'],
                    code: 403
                );
            }

            // Update leave status with current user as approver
            DB::table('leaves')->update(
                [
                    'status' => 'approved',
                    'approver_id' => $currentEmployee['id'],
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                'id',
                $leave_id
            );

            // Optional: Create notification for employee
            $this->notifyEmployee($leaveData->employee_id, $leave_id, 'approved');

            return responseJson(
                success: true,
                data: [
                    'leave_id' => $leave_id,
                    'status' => 'approved',
                    'approver_id' => $currentEmployee['id'],
                    'approver_name' => $currentUser['first_name'] . ' ' . $currentUser['surname']
                ],
                message: "Leave approved successfully"
            );
        } catch (\Exception $e) {
            error_log("Leave approval error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to approve leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Reject a leave application
     * Uses authenticated user as approver automatically
     */
    public function reject($org_id, $leave_id)
    {
        try {
            // Get request body for rejection reason
            $data = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = $data['rejection_reason'] ?? null;

            // Get authenticated user and employee
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Authentication required',
                    code: 401
                );
            }

            // Verify the leave exists and belongs to the organization
            $leave = $this->getLeaveWithValidation($leave_id, $org_id);
            if (!$leave['success']) {
                return $leave;
            }

            $leaveData = $leave['data'];

            // Check if leave is already processed
            if (in_array($leaveData->status, ['approved', 'rejected', 'expired'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave has already been {$leaveData->status}",
                    code: 400
                );
            }

            // Verify user has permission to reject this specific leave
            $canApprove = $this->canUserApproveLeave($currentEmployee['id'], $leaveData, $currentUser['user_type']);
            if (!$canApprove['allowed']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: $canApprove['reason'],
                    code: 403
                );
            }

            // Prepare update data
            $updateData = [
                'status' => 'rejected',
                'approver_id' => $currentEmployee['id'],
                'updated_at' => date('Y-m-d H:i:s')
            ];

            // Add rejection reason if provided
            if ($rejectionReason) {
                $updateData['rejection_reason'] = $rejectionReason;
            }

            // Update leave status
            DB::table('leaves')->update($updateData, 'id', $leave_id);

            // Optional: Create notification for employee
            $this->notifyEmployee($leaveData->employee_id, $leave_id, 'rejected', $rejectionReason);

            return responseJson(
                success: true,
                data: [
                    'leave_id' => $leave_id,
                    'status' => 'rejected',
                    'approver_id' => $currentEmployee['id'],
                    'approver_name' => $currentUser['first_name'] . ' ' . $currentUser['surname']
                ],
                message: "Leave rejected successfully"
            );
        } catch (\Exception $e) {
            error_log("Leave rejection error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to reject leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Validate leave exists and belongs to organization
     */
    private function getLeaveWithValidation($leave_id, $org_id)
    {
        $query = "
            SELECT 
                leaves.*,
                emp_users.organization_id
            FROM leaves
            INNER JOIN employees ON leaves.employee_id = employees.id
            INNER JOIN users emp_users ON employees.user_id = emp_users.id
            WHERE leaves.id = :leave_id
        ";

        $result = DB::raw($query, [':leave_id' => $leave_id]);

        if (empty($result)) {
            return [
                'success' => false,
                'data' => responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    code: 404
                )
            ];
        }

        $leave = $result[0];

        // Verify leave belongs to the organization
        if ($leave->organization_id != $org_id) {
            return [
                'success' => false,
                'data' => responseJson(
                    success: false,
                    data: null,
                    message: "Leave does not belong to this organization",
                    code: 403
                )
            ];
        }

        return [
            'success' => true,
            'data' => $leave
        ];
    }

    /**
     * Check if user can approve/reject a specific leave
     */
    private function canUserApproveLeave($currentEmployeeId, $leaveData, $userType)
    {
        // Admins can approve any leave in their organization
        if ($userType === 'admin') {
            return ['allowed' => true, 'reason' => ''];
        }

        // HR roles can approve any leave
        if (in_array($userType, ['hr_manager', 'hr_officer'])) {
            return ['allowed' => true, 'reason' => ''];
        }

        // Department managers can only approve leaves from their team
        if ($userType === 'department_manager') {
            $isTeamMember = $this->isEmployeeInTeam($leaveData->employee_id, $currentEmployeeId);

            if (!$isTeamMember) {
                return [
                    'allowed' => false,
                    'reason' => 'You can only approve leaves from your team members'
                ];
            }

            return ['allowed' => true, 'reason' => ''];
        }

        // Prevent employees from approving their own leave
        if ($leaveData->employee_id == $currentEmployeeId) {
            return [
                'allowed' => false,
                'reason' => 'You cannot approve your own leave'
            ];
        }

        return [
            'allowed' => false,
            'reason' => 'You do not have permission to approve leaves'
        ];
    }

    /**
     * Check if an employee belongs to a manager's team
     */
    private function isEmployeeInTeam($employeeId, $managerId)
    {
        $query = "
            SELECT COUNT(*) as count
            FROM employees
            WHERE id = :employee_id 
            AND reports_to = :manager_id
            AND status = 'active'
        ";

        $result = DB::raw($query, [
            ':employee_id' => $employeeId,
            ':manager_id' => $managerId
        ]);

        return ($result[0]->count ?? 0) > 0;
    }

    /**
     * Create notification for employee (optional - implement based on your notification system)
     */
    private function notifyEmployee($employeeId, $leaveId, $status, $reason = null)
    {
        // Implement your notification logic here
        // This could send email, push notification, or create in-app notification
        try {
            $message = $status === 'approved'
                ? "Your leave request has been approved"
                : "Your leave request has been rejected" . ($reason ? ": $reason" : "");

            // Example: Create notification record
            DB::table('notifications')->insert([
                'employee_id' => $employeeId,
                'type' => 'leave_' . $status,
                'message' => $message,
                'reference_id' => $leaveId,
                'reference_type' => 'leave',
                'is_read' => 0,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            error_log("Notification error: " . $e->getMessage());
            // Don't fail the approval/rejection if notification fails
        }
    }

    /**
     * Assign or update reliever for a leave
     */
    public function assignReliever($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['reliever_id'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Reliever ID is required",
                    code: 400
                );
            }

            // Check if leave exists
            $existingLeave = DB::table('leaves')
                ->where(['id' => $id])
                ->get();

            if (empty($existingLeave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    code: 404
                );
            }

            // Check if reliever exists
            $relieverCheck = DB::table('employees')
                ->where(['id' => $data['reliever_id']])
                ->get();

            if (empty($relieverCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Reliever not found",
                    code: 404
                );
            }

            DB::table('leaves')->update(
                ['reliever_id' => $data['reliever_id']],
                'id',
                $id
            );

            return responseJson(
                success: true,
                data: null,
                message: "Reliever assigned successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to assign reliever: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Helper method to update leave status
     */
    private function updateLeaveStatus($id, $status, $rejectionReason = null, $approverId = null)
    {
        try {
            // Check if leave exists
            $existingLeave = DB::table('leaves')
                ->where(['id' => $id])
                ->get();

            if (empty($existingLeave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    code: 404
                );
            }

            $leave = $existingLeave[0];

            // Check if leave is already processed
            if (in_array($leave->status, ['approved', 'rejected'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave has already been " . $leave->status,
                    code: 400
                );
            }

            // Validate approver if provided
            if ($approverId !== null) {
                $approverCheck = DB::table('employees')
                    ->where(['id' => $approverId])
                    ->get();

                if (empty($approverCheck)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Approver not found",
                        code: 404
                    );
                }
            }

            $updateData = ['status' => $status];

            if ($approverId !== null) {
                $updateData['approver_id'] = $approverId;
            }

            // Add rejection reason if provided and status is rejected
            if ($rejectionReason && $status === 'rejected') {
                $updateData['reason'] = $rejectionReason;
            }

            DB::table('leaves')->update($updateData, 'id', $id);

            return responseJson(
                success: true,
                data: null,
                message: "Leave " . $status . " successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update leave status: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Auto-expire leaves that have passed their end date
     */
    private function autoExpireLeaves()
    {
        $query = "
            UPDATE leaves 
            SET status = 'expired', updated_at = NOW()
            WHERE end_date < CURDATE() 
            AND status IN ('pending', 'approved')
        ";

        try {
            DB::raw($query);
        } catch (\Exception $e) {
            error_log("Failed to auto-expire leaves: " . $e->getMessage());
        }
    }

    /**
     * Get leave statistics
     */
    public function statistics($employeeId = null)
    {
        try {
            $requestEmployeeId = $_GET['employee_id'] ?? $employeeId;

            $whereClause = $requestEmployeeId ? "WHERE employee_id = :employee_id" : "";
            $params = $requestEmployeeId ? [':employee_id' => $requestEmployeeId] : [];

            $query = "
                SELECT 
                    COUNT(*) as total_leaves,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_leaves,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_leaves,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_leaves,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_leaves
                FROM leaves
                $whereClause
            ";

            $stats = DB::raw($query, $params);

            return responseJson(
                success: true,
                data: $stats[0] ?? [],
                message: "Leave statistics fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch leave statistics: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Get leaves where current employee is the approver
     */
    public function getPendingApprovals($approverId)
    {
        try {
            $query = "
                SELECT 
                    leaves.id AS leave_id,
                    leaves.employee_id,
                    leaves.leave_type,
                    leaves.start_date,
                    leaves.end_date,
                    leaves.status,
                    leaves.reason,
                    leaves.created_at,

                    -- Employee details
                    users.email AS employee_email,
                    CONCAT(
                        users.first_name,
                        ' ',
                        COALESCE(users.middle_name, ''),
                        ' ',
                        users.surname
                    ) AS employee_full_name

                FROM leaves
                INNER JOIN employees ON leaves.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id

                WHERE leaves.approver_id = :approver_id
                AND leaves.status = 'pending'
                ORDER BY leaves.created_at DESC
            ";

            $leaves = DB::raw($query, [':approver_id' => $approverId]);

            return responseJson(
                success: true,
                data: $leaves,
                message: "Pending approvals fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch pending approvals: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Get leaves where current employee is the reliever
     */
    public function getRelievingDuties($relieverId)
    {
        try {
            $query = "
    SELECT 
        leaves.id AS leave_id,
        leaves.employee_id,
        leaves.leave_type,
        leaves.start_date,
        leaves.end_date,
        leaves.status,
        leaves.reason,

        -- Employee details
        users.email AS employee_email,
        CONCAT(
            users.first_name,
            ' ',
            COALESCE(users.middle_name, ''),
            ' ',
            users.surname
        ) AS employee_full_name

    FROM leaves
    INNER JOIN employees ON leaves.employee_id = employees.id
    INNER JOIN users ON employees.user_id = users.id

    WHERE leaves.reliever_id = :reliever_id
      AND leaves.status = 'approved'
    ORDER BY leaves.start_date ASC
";


            $leaves = DB::raw($query, [':reliever_id' => $relieverId]);

            return responseJson(
                success: true,
                data: $leaves,
                message: "Relieving duties fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch relieving duties: " . $e->getMessage(),
                code: 500
            );
        }
    }

    private function applyRoleBasedFilters($org_id)
    {
        $user = \App\Middleware\AuthMiddleware::getCurrentUser();
        $employee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

        if (!$user || !$employee) {
            throw new \Exception('User not authenticated');
        }

        $filters = [];

        switch ($user['user_type']) {
            case 'admin':
                // Admins see all leaves in organization
                $filters['organization'] = $org_id;
                break;

            case 'manager':
                // Managers see their team's leaves
                $filters['organization'] = $org_id;
                $filters['team_employees'] = $this->getTeamEmployeeIds($employee['id']);
                break;

            case 'employee':
                // Employees only see their own leaves
                $filters['organization'] = $org_id;
                $filters['employee_id'] = $employee['id'];
                break;

            default:
                throw new \Exception('Unknown user role');
        }

        return $filters;
    }
    private function getTeamEmployeeIds($managerId)
    {
        try {
            $query = "
                SELECT id 
                FROM employees 
                WHERE reports_to = :manager_id 
                AND status = 'active'
            ";

            $result = DB::raw($query, [':manager_id' => $managerId]);
            return array_column($result, 'id');
        } catch (\Exception $e) {
            error_log('Team employee fetch error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get employee's own leaves with filters and statistics
     */
    public function myLeaves($org_id, $id)
    {
        try {
            // Validate organization ID
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
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
                    errors: ['org_id' => "No organization found with ID: $org_id"]
                );
            }

            // Verify employee exists and belongs to organization
            $employeeCheck = DB::raw("
    SELECT 
        e.*, 
        u.organization_id,
        u.first_name,
        u.middle_name,
        u.surname,
        u.email
    FROM employees e
    INNER JOIN users u ON e.user_id = u.id
    WHERE e.id = :employee_id AND u.organization_id = :org_id
", [':employee_id' => $id, ':org_id' => $org_id]);

            if (empty($employeeCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee not found or does not belong to this organization",
                    code: 404,
                    errors: ['employee_id' => "Employee $id not found in organization $org_id"]
                );
            }

            // Check authorization - employee can only view their own leaves
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            $canAccessAll = in_array($currentUser['user_type'], ['admin', 'hr_manager', 'hr_officer', 'department_manager']);

            if (!$canAccessAll && $currentEmployee['id'] != $id) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "You can only view your own leaves",
                    code: 403,
                    errors: ['authorization' => 'Insufficient permissions to view other employees leaves']
                );
            }

            // Auto-expire leaves that have passed their end date
            $this->autoExpireLeaves();

            // Get pagination parameters with validation
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            // Optional filters with validation
            $status = $_GET['status'] ?? null;
            $leaveType = $_GET['leave_type'] ?? null;
            $month = $_GET['month'] ?? null;
            $year = $_GET['year'] ?? null;
            $dateFrom = $_GET['date_from'] ?? null;
            $dateTo = $_GET['date_to'] ?? null;

            // Validate filter inputs
            $validationErrors = [];

            // Validate status
            if ($status && !in_array($status, ['pending', 'approved', 'rejected', 'expired'])) {
                $validationErrors['status'] = "Invalid status. Must be one of: pending, approved, rejected, expired";
            }

            // Validate leave type
            if ($leaveType && !in_array($leaveType, ['sick', 'casual', 'annual', 'maternity', 'paternity', 'other'])) {
                $validationErrors['leave_type'] = "Invalid leave type. Must be one of: sick, casual, annual, maternity, paternity, other";
            }

            // Validate month
            if ($month) {
                $targetMonth = (int) $month;
                if ($targetMonth < 1 || $targetMonth > 12) {
                    $validationErrors['month'] = "Invalid month. Must be between 1 and 12";
                }
            }

            // Validate year
            if ($year) {
                $targetYear = (int) $year;
                if ($targetYear < 1900 || $targetYear > 2100) {
                    $validationErrors['year'] = "Invalid year. Must be between 1900 and 2100";
                }
            }

            // Validate date range
            if ($dateFrom && !strtotime($dateFrom)) {
                $validationErrors['date_from'] = "Invalid date format. Use YYYY-MM-DD";
            }

            if ($dateTo && !strtotime($dateTo)) {
                $validationErrors['date_to'] = "Invalid date format. Use YYYY-MM-DD";
            }

            if ($dateFrom && $dateTo && strtotime($dateFrom) > strtotime($dateTo)) {
                $validationErrors['date_range'] = "Start date must be before end date";
            }

            // If there are validation errors, return them
            if (!empty($validationErrors)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Validation failed for one or more filters",
                    code: 400,
                    errors: $validationErrors
                );
            }

            // Build WHERE clause
            $whereConditions = ["leaves.employee_id = :employee_id"];
            $countParams = [':employee_id' => $id];
            $queryParams = [':employee_id' => $id];
            $statsParams = [':employee_id' => $id];

            // Apply optional filters
            if ($status) {
                $whereConditions[] = "leaves.status = :filter_status";
                $countParams[':filter_status'] = $status;
                $queryParams[':filter_status'] = $status;
                $statsParams[':filter_status'] = $status;
            }

            if ($leaveType) {
                $whereConditions[] = "leaves.leave_type = :filter_leave_type";
                $countParams[':filter_leave_type'] = $leaveType;
                $queryParams[':filter_leave_type'] = $leaveType;
                $statsParams[':filter_leave_type'] = $leaveType;
            }

            // Month filter
            if ($month) {
                $targetMonth = (int) $month;
                $whereConditions[] = "MONTH(leaves.start_date) = :filter_month";
                $countParams[':filter_month'] = $targetMonth;
                $queryParams[':filter_month'] = $targetMonth;
                $statsParams[':filter_month'] = $targetMonth;
            }

            // Year filter
            if ($year) {
                $targetYear = (int) $year;
                $whereConditions[] = "YEAR(leaves.start_date) = :filter_year";
                $countParams[':filter_year'] = $targetYear;
                $queryParams[':filter_year'] = $targetYear;
                $statsParams[':filter_year'] = $targetYear;
            }

            // Date range filter
            if ($dateFrom) {
                $whereConditions[] = "leaves.start_date >= :date_from";
                $countParams[':date_from'] = $dateFrom;
                $queryParams[':date_from'] = $dateFrom;
                $statsParams[':date_from'] = $dateFrom;
            }

            if ($dateTo) {
                $whereConditions[] = "leaves.end_date <= :date_to";
                $countParams[':date_to'] = $dateTo;
                $queryParams[':date_to'] = $dateTo;
                $statsParams[':date_to'] = $dateTo;
            }

            $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";

            // Count total records
            $countQuery = "
            SELECT COUNT(*) as total
            FROM leaves
            $whereClause
        ";

            $countResult = DB::raw($countQuery, $countParams);
            $total = $countResult[0]->total ?? 0;

            // Check if any leaves exist
            if ($total === 0) {
                // Build filter message for better context
                $appliedFilters = [
                    'employee_id' => $id,
                    'organization_id' => $org_id
                ];
                if ($status) $appliedFilters['status'] = $status;
                if ($leaveType) $appliedFilters['leave_type'] = $leaveType;
                if ($month) $appliedFilters['month'] = $month;
                if ($year) $appliedFilters['year'] = $year;
                if ($dateFrom) $appliedFilters['date_from'] = $dateFrom;
                if ($dateTo) $appliedFilters['date_to'] = $dateTo;

                return responseJson(
                    success: true,
                    data: [],
                    message: "No leaves found matching the specified criteria",
                    code: 200,
                    metadata: [
                        'pagination' => [
                            'current_page' => $page,
                            'per_page' => $perPage,
                            'total' => 0,
                            'total_pages' => 0,
                            'has_next' => false,
                            'has_prev' => false
                        ],
                        'statistics' => [
                            'total_leaves' => 0,
                            'pending' => 0,
                            'approved' => 0,
                            'rejected' => 0,
                            'expired' => 0,
                            'current_year_leaves' => 0,
                            'average_duration_days' => 0,
                            'most_common_type' => null,
                            'leave_utilization_rate' => 0
                        ],
                        'applied_filters' => $appliedFilters
                    ]
                );
            }

            $statsQuery = "
    SELECT 
        COUNT(*) as total_leaves,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_leaves,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_leaves,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_leaves,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_leaves,
        SUM(CASE WHEN YEAR(start_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as current_year_leaves,
        AVG(DATEDIFF(end_date, start_date) + 1) as average_duration_days,
        SUM(CASE WHEN leave_type = 'sick' THEN 1 ELSE 0 END) as sick_leaves,
        SUM(CASE WHEN leave_type = 'casual' THEN 1 ELSE 0 END) as casual_leaves,
        SUM(CASE WHEN leave_type = 'annual' THEN 1 ELSE 0 END) as annual_leaves,
        SUM(CASE WHEN leave_type = 'maternity' THEN 1 ELSE 0 END) as maternity_leaves,
        SUM(CASE WHEN leave_type = 'paternity' THEN 1 ELSE 0 END) as paternity_leaves,
        SUM(CASE WHEN leave_type = 'other' THEN 1 ELSE 0 END) as other_leaves
    FROM leaves
    $whereClause
";

            $statsResult = DB::raw($statsQuery, $statsParams);
            $stats = $statsResult[0] ?? null;

            // Get most common leave type (separate query to avoid parameter conflicts)
            $mostCommonQuery = "
    SELECT leave_type, COUNT(*) as count
    FROM leaves
    WHERE employee_id = :employee_id
    GROUP BY leave_type 
    ORDER BY count DESC 
    LIMIT 1
";

            $mostCommonResult = DB::raw($mostCommonQuery, [':employee_id' => $id]);
            $mostCommonType = $mostCommonResult[0]->leave_type ?? null;

            // Fetch paginated data with approver and reliever info
            $query = "
            SELECT 
                leaves.id AS leave_id,
                leaves.employee_id,
                leaves.approver_id,
                leaves.reliever_id,
                leaves.leave_type,
                leaves.start_date,
                leaves.end_date,
                leaves.status,
                leaves.reason,
                leaves.created_at,
                leaves.updated_at,
                DATEDIFF(leaves.end_date, leaves.start_date) + 1 as duration_days,

                -- Employee details
                emp_users.email AS employee_email,
                emp_users.first_name AS employee_first_name,
                emp_users.middle_name AS employee_middle_name,
                emp_users.surname AS employee_surname,
                CONCAT(
                    emp_users.first_name,
                    ' ',
                    COALESCE(emp_users.middle_name, ''),
                    ' ',
                    emp_users.surname
                ) AS employee_full_name,

                -- Approver details
                approver_users.email AS approver_email,
                approver_users.first_name AS approver_first_name,
                approver_users.middle_name AS approver_middle_name,
                approver_users.surname AS approver_surname,
                CONCAT(
                    approver_users.first_name,
                    ' ',
                    COALESCE(approver_users.middle_name, ''),
                    ' ',
                    approver_users.surname
                ) AS approver_full_name,

                -- Reliever details
                reliever_users.email AS reliever_email,
                reliever_users.first_name AS reliever_first_name,
                reliever_users.middle_name AS reliever_middle_name,
                reliever_users.surname AS reliever_surname,
                CONCAT(
                    reliever_users.first_name,
                    ' ',
                    COALESCE(reliever_users.middle_name, ''),
                    ' ',
                    reliever_users.surname
                ) AS reliever_full_name

            FROM leaves
            INNER JOIN employees ON leaves.employee_id = employees.id
            INNER JOIN users emp_users ON employees.user_id = emp_users.id

            LEFT JOIN employees approver_emp ON leaves.approver_id = approver_emp.id
            LEFT JOIN users approver_users ON approver_emp.user_id = approver_users.id

            LEFT JOIN employees reliever_emp ON leaves.reliever_id = reliever_emp.id
            LEFT JOIN users reliever_users ON reliever_emp.user_id = reliever_users.id

            $whereClause
            ORDER BY leaves.created_at DESC
            LIMIT :pagination_limit OFFSET :pagination_offset
        ";

            $queryParams[':pagination_limit'] = $perPage;
            $queryParams[':pagination_offset'] = $offset;

            $leaves = DB::raw($query, $queryParams);

            // Calculate pagination metadata
            $totalPages = ceil($total / $perPage);

            return responseJson(
                success: true,
                data: $leaves,
                message: "Fetched employee leaves successfully",
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
                        'total_leaves' => (int) ($stats->total_leaves ?? 0),
                        'pending' => (int) ($stats->pending_leaves ?? 0),
                        'approved' => (int) ($stats->approved_leaves ?? 0),
                        'rejected' => (int) ($stats->rejected_leaves ?? 0),
                        'expired' => (int) ($stats->expired_leaves ?? 0),
                        'current_year_leaves' => (int) ($stats->current_year_leaves ?? 0),
                        'average_duration_days' => round($stats->average_duration_days ?? 0, 1),
                        'most_common_type' => $mostCommonType,
                        'leave_utilization_rate' => '0%', // Simplified for now
                        'by_type' => [
                            'sick' => (int) ($stats->sick_leaves ?? 0),
                            'casual' => (int) ($stats->casual_leaves ?? 0),
                            'annual' => (int) ($stats->annual_leaves ?? 0),
                            'maternity' => (int) ($stats->maternity_leaves ?? 0),
                            'paternity' => (int) ($stats->paternity_leaves ?? 0),
                            'other' => (int) ($stats->other_leaves ?? 0)
                        ]
                    ],
                    'employee_info' => [
                        'employee_id' => (int) $id,
                        'employee_name' => ($employeeCheck[0]->first_name ?? '') . ' ' . ($employeeCheck[0]->surname ?? ''),
                        'employee_email' => $employeeCheck[0]->email ?? 'Not specified',
                        'job_title' => $employeeCheck[0]->job_title ?? 'Not specified',
                        'department' => $employeeCheck[0]->department ?? 'Not specified',
                        'employment_type' => $employeeCheck[0]->employment_type ?? 'Not specified',
                        'status' => $employeeCheck[0]->status ?? 'Not specified'
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("My leaves error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch employee leaves",
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
     * Apply for a new leave (employee self-service)
     */
    public function applyLeave($org_id, $id)
    {
        try {
            // Verify employee exists and belongs to the organization
            $employeeCheck = DB::table('employees')
                ->where(['id' => $id, 'organization_id' => $org_id])
                ->get();

            if (empty($employeeCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Employee not found in this organization',
                    code: 404
                );
            }

            $employee = $employeeCheck[0];

            // Get employee's user details for notification
            $userCheck = DB::table('users')
                ->where(['id' => $employee->user_id])
                ->get();

            $user = $userCheck[0] ?? null;

            $data = json_decode(file_get_contents('php://input'), true);

            // If employee_id is provided, validate it matches the authenticated user
            if (isset($data['employee_id'])) {
                if ($data['employee_id'] != $id) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You can only apply for leave for yourself',
                        code: 403
                    );
                }
            }

            // Validate required fields
            $required = ['leave_type', 'start_date', 'end_date'];
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

            // Validate leave type
            $validLeaveTypes = ['sick', 'casual', 'annual', 'maternity', 'paternity', 'other'];
            if (!in_array($data['leave_type'], $validLeaveTypes)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid leave type. Must be one of: " . implode(', ', $validLeaveTypes),
                    code: 400
                );
            }

            // Validate dates
            $startDate = strtotime($data['start_date']);
            $endDate = strtotime($data['end_date']);
            $today = strtotime(date('Y-m-d'));

            if (!$startDate || !$endDate) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid date format. Use YYYY-MM-DD",
                    code: 400
                );
            }

            if ($startDate > $endDate) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Start date must be before or equal to end date",
                    code: 400
                );
            }

            if ($startDate < $today) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot apply for leave with past dates",
                    code: 400
                );
            }

            // Check for overlapping leaves
            $overlapCheck = $this->checkOverlappingLeaves(
                $id,
                $data['start_date'],
                $data['end_date']
            );

            if (!$overlapCheck['valid']) {
                return responseJson(
                    success: false,
                    data: $overlapCheck['conflict'],
                    message: $overlapCheck['message'],
                    code: 409
                );
            }

            // Get approver (reports_to manager)
            $approverId = null;
            if (!empty($employee->reports_to)) {
                $approverId = $employee->reports_to;
            }

            // Validate reliever if provided
            if (!empty($data['reliever_id'])) {
                $relieverCheck = DB::table('employees')
                    ->where(['id' => $data['reliever_id'], 'organization_id' => $org_id])
                    ->get();

                if (empty($relieverCheck)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Reliever not found or not in your organization",
                        code: 404
                    );
                }

                // Prevent self-relieving
                if ($data['reliever_id'] == $id) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "You cannot assign yourself as your own reliever",
                        code: 400
                    );
                }
            }

            // Prepare insert data
            $insertData = [
                'employee_id' => $id,
                'leave_type' => $data['leave_type'],
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'status' => 'pending',
                'reason' => $data['reason'] ?? null,
                'approver_id' => $approverId,
                'reliever_id' => $data['reliever_id'] ?? null
            ];

            DB::table('leaves')->insert($insertData);
            $leaveId = DB::lastInsertId();

            // Create notification for approver if exists
            if ($approverId) {
                if ($user) {
                    $this->createLeaveNotification(
                        $approverId,
                        $org_id,
                        $leaveId,
                        'pending',
                        $user->first_name . ' ' . $user->surname
                    );
                }
            }

            // Calculate duration
            $duration = (strtotime($data['end_date']) - strtotime($data['start_date'])) / 86400 + 1;

            return responseJson(
                success: true,
                data: [
                    'leave_id' => $leaveId,
                    'employee_id' => $id,
                    'leave_type' => $data['leave_type'],
                    'start_date' => $data['start_date'],
                    'end_date' => $data['end_date'],
                    'duration_days' => (int)$duration,
                    'status' => 'pending',
                    'approver_id' => $approverId,
                    'reliever_id' => $data['reliever_id'] ?? null
                ],
                message: "Leave application submitted successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Apply leave error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to apply for leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Check for overlapping leaves for an employee
     */
    private function checkOverlappingLeaves($employeeId, $startDate, $endDate, $excludeLeaveId = null)
    {
        try {
            $query = "
            SELECT 
                id,
                leave_type,
                start_date,
                end_date,
                status
            FROM leaves
            WHERE employee_id = :employee_id
            AND status IN ('pending', 'approved')
            AND (
                (start_date BETWEEN :start_date AND :end_date)
                OR (end_date BETWEEN :start_date AND :end_date)
                OR (start_date <= :start_date AND end_date >= :end_date)
            )
        ";

            $params = [
                ':employee_id' => $employeeId,
                ':start_date' => $startDate,
                ':end_date' => $endDate
            ];

            if ($excludeLeaveId) {
                $query .= " AND id != :exclude_id";
                $params[':exclude_id'] = $excludeLeaveId;
            }

            $conflicts = DB::raw($query, $params);

            if (!empty($conflicts)) {
                $conflict = $conflicts[0];
                return [
                    'valid' => false,
                    'message' => "You have an overlapping {$conflict->status} leave from {$conflict->start_date} to {$conflict->end_date}",
                    'conflict' => [
                        'leave_id' => $conflict->id,
                        'leave_type' => $conflict->leave_type,
                        'start_date' => $conflict->start_date,
                        'end_date' => $conflict->end_date,
                        'status' => $conflict->status
                    ]
                ];
            }

            return ['valid' => true];
        } catch (\Exception $e) {
            error_log("Overlap check error: " . $e->getMessage());
            return [
                'valid' => false,
                'message' => "Failed to validate leave dates"
            ];
        }
    }

    /**
     * Create notification for leave action
     */
    private function createLeaveNotification($employeeId, $orgId, $leaveId, $status, $employeeName)
    {
        try {
            $messages = [
                'pending' => "$employeeName has submitted a new leave application requiring your approval",
                'approved' => "Your leave application has been approved",
                'rejected' => "Your leave application has been rejected"
            ];

            $message = $messages[$status] ?? "Leave status updated";

            DB::table('notifications')->insert([
                'employee_id' => $employeeId,
                'organization_id' => $orgId,
                'title' => 'Leave Application ' . ucfirst($status),
                'message' => $message,
                'type' => 'leave',
                'is_read' => 0,
                'metadata' => json_encode(['leave_id' => $leaveId, 'status' => $status]),
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            error_log("Notification creation error: " . $e->getMessage());
            // Don't fail the main operation if notification fails
        }
    }
}
