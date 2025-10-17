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
            $employeeId = $_GET['employee_id'] ?? null;
            $leaveType = $_GET['leave_type'] ?? null;
            $month = $_GET['month'] ?? null; // Format: 1-12
            $year = $_GET['year'] ?? null; // Format: YYYY
            $name = $_GET['name'] ?? null; // Search in first_name, middle_name, or surname

            // Build WHERE clause
            $whereConditions = [];
            $params = [];

            if ($status) {
                $whereConditions[] = "leaves.status = :status";
                $params[':status'] = $status;
            }

            if ($employeeId) {
                $whereConditions[] = "leaves.employee_id = :employee_id";
                $params[':employee_id'] = $employeeId;
            }

            if ($leaveType) {
                $whereConditions[] = "leaves.leave_type = :leave_type";
                $params[':leave_type'] = $leaveType;
            }

            // Month and Year filter - filter by any leave that overlaps with the specified month/year
            if ($month || $year) {
                // Use current year if not specified
                $targetYear = $year ? (int)$year : (int)date('Y');
                // Use current month if not specified
                $targetMonth = $month ? (int)$month : (int)date('m');
                
                // Validate month range
                if ($targetMonth >= 1 && $targetMonth <= 12) {
                    $startOfMonth = sprintf('%04d-%02d-01', $targetYear, $targetMonth);
                    $endOfMonth = date('Y-m-t', strtotime($startOfMonth));
                    
                    $whereConditions[] = "(
                        (leaves.start_date BETWEEN :month_start AND :month_end) OR
                        (leaves.end_date BETWEEN :month_start AND :month_end) OR
                        (leaves.start_date <= :month_start AND leaves.end_date >= :month_end)
                    )";
                    $params[':month_start'] = $startOfMonth;
                    $params[':month_end'] = $endOfMonth;
                }
            }

            // Name filter - search in first_name, middle_name, or surname
            if ($name) {
                $whereConditions[] = "(
                    users.first_name LIKE :name OR 
                    users.middle_name LIKE :name OR 
                    users.surname LIKE :name
                )";
                $params[':name'] = '%' . $name . '%';
            }

            $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";

            // Count total records
            $countQuery = "
                SELECT COUNT(*) as total
                FROM leaves
                INNER JOIN employees ON leaves.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                $whereClause
            ";
            
            $countResult = DB::raw($countQuery, $params);
            $total = $countResult[0]->total ?? 0;

            // Fetch paginated data
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
                    leaves.updated_at,
                    employees.email AS employee_email,
                    employees.id AS employee_id,
                    users.first_name,
                    users.middle_name,
                    users.surname
                FROM leaves
                INNER JOIN employees ON leaves.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                $whereClause
                ORDER BY leaves.created_at DESC
                LIMIT :limit OFFSET :offset
            ";

            $params[':limit'] = $perPage;
            $params[':offset'] = $offset;

            $leaves = DB::raw($query, $params);

            // Calculate pagination metadata
            $totalPages = ceil($total / $perPage);

            return responseJson(
                success: true,
                data: [
                    'leaves' => $leaves,
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
                statusCode: 500
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
                    leaves.leave_type,
                    leaves.start_date,
                    leaves.end_date,
                    leaves.status,
                    leaves.reason,
                    leaves.created_at,
                    leaves.updated_at,
                    employees.email AS employee_email,
                    users.first_name,
                    users.middle_name,
                    users.surname
                FROM leaves
                INNER JOIN employees ON leaves.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                WHERE leaves.id = :id
            ";

            $leave = DB::raw($query, [':id' => $id]);

            if (empty($leave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    statusCode: 404
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
                statusCode: 500
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
                        statusCode: 400
                    );
                }
            }

            // Validate dates
            if (strtotime($data['start_date']) > strtotime($data['end_date'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Start date must be before end date",
                    statusCode: 400
                );
            }

            // Check if employee exists
            $employeeCheck = DB::raw("SELECT id FROM employees WHERE id = :id", [':id' => $data['employee_id']]);
            if (empty($employeeCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee not found",
                    statusCode: 404
                );
            }

            $query = "
                INSERT INTO leaves (employee_id, leave_type, start_date, end_date, reason, status, created_at)
                VALUES (:employee_id, :leave_type, :start_date, :end_date, :reason, 'pending', NOW())
            ";

            $params = [
                ':employee_id' => $data['employee_id'],
                ':leave_type' => $data['leave_type'],
                ':start_date' => $data['start_date'],
                ':end_date' => $data['end_date'],
                ':reason' => $data['reason'] ?? null
            ];

            DB::raw($query, $params);
            $leaveId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $leaveId],
                message: "Leave application created successfully",
                statusCode: 201
            );

        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create leave: " . $e->getMessage(),
                statusCode: 500
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
            $existingLeave = DB::raw("SELECT * FROM leaves WHERE id = :id", [':id' => $id]);
            if (empty($existingLeave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    statusCode: 404
                );
            }

            // Don't allow updating approved/rejected leaves
            if (in_array($existingLeave[0]['status'], ['approved', 'rejected'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot update a leave that has been approved or rejected",
                    statusCode: 400
                );
            }

            $updateFields = [];
            $params = [':id' => $id];

            if (isset($data['leave_type'])) {
                $updateFields[] = "leave_type = :leave_type";
                $params[':leave_type'] = $data['leave_type'];
            }

            if (isset($data['start_date'])) {
                $updateFields[] = "start_date = :start_date";
                $params[':start_date'] = $data['start_date'];
            }

            if (isset($data['end_date'])) {
                $updateFields[] = "end_date = :end_date";
                $params[':end_date'] = $data['end_date'];
            }

            if (isset($data['reason'])) {
                $updateFields[] = "reason = :reason";
                $params[':reason'] = $data['reason'];
            }

            if (empty($updateFields)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No fields to update",
                    statusCode: 400
                );
            }

            $updateFields[] = "updated_at = NOW()";

            $query = "UPDATE leaves SET " . implode(", ", $updateFields) . " WHERE id = :id";

            DB::raw($query, $params);
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
                statusCode: 500
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
            $existingLeave = DB::raw("SELECT * FROM leaves WHERE id = :id", [':id' => $id]);
            if (empty($existingLeave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    statusCode: 404
                );
            }

            // Only allow deleting pending leaves
            if ($existingLeave[0]['status'] !== 'pending') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only pending leaves can be deleted",
                    statusCode: 400
                );
            }

            $query = "DELETE FROM leaves WHERE id = :id";

            DB::raw($query, [':id' => $id]);
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
                statusCode: 500
            );
        }
    }

    /**
     * Approve a leave application
     */
    public function approve($id)
    {
        return $this->updateLeaveStatus($id, 'approved');
    }

    /**
     * Reject a leave application
     */
    public function reject($id)
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $rejectionReason = $data['rejection_reason'] ?? null;

        return $this->updateLeaveStatus($id, 'rejected', $rejectionReason);
    }

    /**
     * Helper method to update leave status
     */
    private function updateLeaveStatus($id, $status, $rejectionReason = null)
    {
        try {
            // Check if leave exists
            $existingLeave = DB::raw("SELECT * FROM leaves WHERE id = :id", [':id' => $id]);
            if (empty($existingLeave)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    statusCode: 404
                );
            }

            // Check if leave is already processed
            if (in_array($existingLeave[0]->status, ['approved', 'rejected'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave has already been " . $existingLeave[0]->status,
                    statusCode: 400
                );
            }

            $query = "UPDATE leaves SET status = :status, updated_at = NOW()";
            $params = [':status' => $status, ':id' => $id];

            if ($rejectionReason && $status === 'rejected') {
                // Assuming you have a rejection_reason column
                $query .= ", rejection_reason = :rejection_reason";
                $params[':rejection_reason'] = $rejectionReason;
            }

            $query .= " WHERE id = :id";

            DB::raw($query, $params);
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
                statusCode: 500
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
            // Log error but don't fail the request
            error_log("Failed to auto-expire leaves: " . $e->getMessage());
        }
    }

    /**
     * Get leave statistics
     */
    public function statistics($employeeId = null)
    {
        try {
            // Allow employee_id as query parameter or route parameter
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
                statusCode: 500
            );
        }
    }

}