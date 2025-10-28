<?php

namespace App\Controllers;

use App\Services\DB;

class LeaveController
{
    /**
     * Get all leaves with pagination and auto-expire old leaves
     */
    public function index()
    {
        try {
            // Auto-expire leaves that have passed their end date
            $this->autoExpireLeaves();

            // Get pagination parameters
            $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int)$_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            // Optional filters
            $status = $_GET['status'] ?? null;
            $approverId = $_GET['approver_id'] ?? null;
            $relieverId = $_GET['reliever_id'] ?? null;
            $leaveType = $_GET['leave_type'] ?? null;
            $month = $_GET['month'] ?? null;
            $year = $_GET['year'] ?? null;
            $name = $_GET['name'] ?? null;

            // Build WHERE clause
            $whereConditions = [];
            $countParams = [];
            $queryParams = [];
            $statsParams = [];

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

            // Month filter - fixed parameter binding
            if ($month) {
                $targetMonth = (int)$month;
                if ($targetMonth >= 1 && $targetMonth <= 12) {
                    $whereConditions[] = "MONTH(leaves.start_date) = :filter_month";
                    $countParams[':filter_month'] = $targetMonth;
                    $queryParams[':filter_month'] = $targetMonth;
                    $statsParams[':filter_month'] = $targetMonth;
                }
            }

            // Year filter - fixed parameter binding
            if ($year) {
                $targetYear = (int)$year;
                $whereConditions[] = "YEAR(leaves.start_date) = :filter_year";
                $countParams[':filter_year'] = $targetYear;
                $queryParams[':filter_year'] = $targetYear;
                $statsParams[':filter_year'] = $targetYear;
            }

            // Name filter - CONCAT first, middle, and surname (with NULL handling)
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
                $filterMessages = [];
                if ($status) $filterMessages[] = "status: $status";
                if ($approverId) $filterMessages[] = "approver ID: $approverId";
                if ($relieverId) $filterMessages[] = "reliever ID: $relieverId";
                if ($leaveType) $filterMessages[] = "leave type: $leaveType";
                if ($month) $filterMessages[] = "month: $month";
                if ($year) $filterMessages[] = "year: $year";
                if ($name) $filterMessages[] = "name: $name";

                $filterInfo = !empty($filterMessages) ? " with filters: " . implode(", ", $filterMessages) : "";

                return responseJson(
                    success: false,
                    data: [
                        'leaves' => [],
                        'statistics' => [
                            'total_leaves' => 0,                            
                            'sick' => 0,
                            'casual' => 0,
                            'annual' => 0,
                            'maternity' => 0,
                            'paternity' => 0,
                            'other' => 0                            
                        ],
                        'pagination' => [
                            'current_page' => $page,
                            'per_page' => $perPage,
                            'total' => 0,
                            'total_pages' => 0,
                            'has_next' => false,
                            'has_prev' => false
                        ]
                    ],
                    message: "No leaves found{$filterInfo}",
                    code: 404
                );
            }

            // Get statistics for leave types (removed by_status)
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
                    employees.email AS employee_email,
                    emp_users.first_name AS employee_first_name,
                    emp_users.middle_name AS employee_middle_name,
                    emp_users.surname AS employee_surname,
                    CONCAT(emp_users.first_name, ' ', COALESCE(emp_users.middle_name, ''), ' ', emp_users.surname) AS employee_full_name,
                    
                    -- Approver details
                    approver_emp.email AS approver_email,
                    approver_users.first_name AS approver_first_name,
                    approver_users.middle_name AS approver_middle_name,
                    approver_users.surname AS approver_surname,
                    CONCAT(approver_users.first_name, ' ', COALESCE(approver_users.middle_name, ''), ' ', approver_users.surname) AS approver_full_name,
                    
                    -- Reliever details
                    reliever_emp.email AS reliever_email,
                    reliever_users.first_name AS reliever_first_name,
                    reliever_users.middle_name AS reliever_middle_name,
                    reliever_users.surname AS reliever_surname,
                    CONCAT(reliever_users.first_name, ' ', COALESCE(reliever_users.middle_name, ''), ' ', reliever_users.surname) AS reliever_full_name
                    
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
                data: [
                    'leaves' => $leaves,
                    'statistics' => [
                        'total_leaves' => (int)($stats->total_leaves ?? 0),
                        'sick' => (int)($stats->sick_leaves ?? 0),
                        'casual' => (int)($stats->casual_leaves ?? 0),
                        'annual' => (int)($stats->annual_leaves ?? 0),
                        'maternity' => (int)($stats->maternity_leaves ?? 0),
                        'paternity' => (int)($stats->paternity_leaves ?? 0),
                        'other' => (int)($stats->other_leaves ?? 0)                        
                    ],
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => (int)$total,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_prev' => $page > 1
                    ]
                ],
                message: "Fetched Leaves Successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch leaves: " . $e->getMessage(),
                code: 500
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
                    employees.email AS employee_email,
                    emp_users.first_name AS employee_first_name,
                    emp_users.middle_name AS employee_middle_name,
                    emp_users.surname AS employee_surname,
                    CONCAT(emp_users.first_name, ' ', COALESCE(emp_users.middle_name, ''), ' ', emp_users.surname) AS employee_full_name,
                    
                    -- Approver details
                    approver_emp.email AS approver_email,
                    approver_users.first_name AS approver_first_name,
                    approver_users.middle_name AS approver_middle_name,
                    approver_users.surname AS approver_surname,
                    CONCAT(approver_users.first_name, ' ', COALESCE(approver_users.middle_name, ''), ' ', approver_users.surname) AS approver_full_name,
                    
                    -- Reliever details
                    reliever_emp.email AS reliever_email,
                    reliever_users.first_name AS reliever_first_name,
                    reliever_users.middle_name AS reliever_middle_name,
                    reliever_users.surname AS reliever_surname,
                    CONCAT(reliever_users.first_name, ' ', COALESCE(reliever_users.middle_name, ''), ' ', reliever_users.surname) AS reliever_full_name
                    
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
                    message: "Employee not found",
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
     */
    public function approve($id)
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $approverId = $data['approver_id'] ?? null;

        return $this->updateLeaveStatus($id, 'approved', null, $approverId);
    }

    /**
     * Reject a leave application
     */
    public function reject($id)
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $rejectionReason = $data['rejection_reason'] ?? null;
        $approverId = $data['approver_id'] ?? null;

        return $this->updateLeaveStatus($id, 'rejected', $rejectionReason, $approverId);
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
                    employees.email AS employee_email,
                    CONCAT(users.first_name, ' ', COALESCE(users.middle_name, ''), ' ', users.surname) AS employee_full_name
                    
                FROM leaves
                INNER JOIN employees ON leaves.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                
                WHERE leaves.approver_id = :approver_id AND leaves.status = 'pending'
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
                    employees.email AS employee_email,
                    CONCAT(users.first_name, ' ', COALESCE(users.middle_name, ''), ' ', users.surname) AS employee_full_name
                    
                FROM leaves
                INNER JOIN employees ON leaves.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                
                WHERE leaves.reliever_id = :reliever_id AND leaves.status = 'approved'
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
}