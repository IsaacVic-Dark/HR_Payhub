<?php

namespace App\Controllers;

use App\Services\DB;

class PayrunDetailController
{
    /**
     * Get all employees for a payrun
     */
    public function getEmployees($org_id, $payrun_id)
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

            // Validate payrun ID
            if (!$payrun_id || !is_numeric($payrun_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing payrun ID",
                    code: 404,
                    errors: [
                        'payrun_id' => 'Payrun ID is required and must be a valid number'
                    ]
                );
            }

            // Verify payrun exists and belongs to organization
            $payrunCheck = DB::raw(
                "SELECT * FROM payruns WHERE id = :payrun_id AND organization_id = :org_id",
                [':payrun_id' => $payrun_id, ':org_id' => $org_id]
            );

            if (empty($payrunCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun not found or does not belong to this organization",
                    code: 404
                );
            }

            // Get pagination parameters
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            // Fetch payrun details with employee information
            $query = "
                SELECT 
                    payrun_details.*,
                    employees.id,
                    employees.job_title,
                    employees.department,
                    users.first_name as employee_first_name,
                    users.middle_name as employee_middle_name,
                    users.surname as employee_surname,
                    users.email as employee_email,
                    CONCAT(users.first_name, ' ', COALESCE(users.middle_name, ''), ' ', users.surname) as employee_full_name
                FROM payrun_details
                INNER JOIN employees ON payrun_details.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                WHERE payrun_details.payrun_id = :payrun_id
                ORDER BY users.surname, users.first_name
                LIMIT :pagination_limit OFFSET :pagination_offset
            ";

            $countQuery = "
                SELECT COUNT(*) as total
                FROM payrun_details
                WHERE payrun_id = :payrun_id
            ";

            $countResult = DB::raw($countQuery, [':payrun_id' => $payrun_id]);
            $total = $countResult[0]->total ?? 0;

            $payrunDetails = DB::raw($query, [
                ':payrun_id' => $payrun_id,
                ':pagination_limit' => $perPage,
                ':pagination_offset' => $offset
            ]);

            // Calculate pagination metadata
            $totalPages = ceil($total / $perPage);

            return responseJson(
                success: true,
                data: $payrunDetails,
                message: "Fetched Payrun Employees Successfully",
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
                    'payrun' => [
                        'id' => $payrunCheck[0]->id,
                        'payrun_name' => $payrunCheck[0]->payrun_name,
                        'pay_period_start' => $payrunCheck[0]->pay_period_start,
                        'pay_period_end' => $payrunCheck[0]->pay_period_end,
                        'status' => $payrunCheck[0]->status
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Payrun detail getEmployees error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch payrun employees",
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
     * Get all payrun details (existing method for backward compatibility)
     */
    public function index($payrunId)
    {
        return $this->getEmployees(null, $payrunId);
    }

    /**
     * Create a payrun detail
     */
    public function create($payrunId)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            $required = ['employee_id', 'basic_salary', 'gross_pay', 'total_deductions', 'net_pay'];
            foreach ($required as $field) {
                if (!isset($data[$field])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Field '$field' is required",
                        code: 400
                    );
                }
            }

            // Verify payrun exists
            $payrun = DB::table('payruns')->selectAllWhereID($payrunId);
            if (empty($payrun)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid payrun_id",
                    code: 400
                );
            }

            // Verify employee exists
            $employee = DB::table('employees')->selectAllWhereID($data['employee_id']);
            if (empty($employee)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid employee_id",
                    code: 400
                );
            }

            $insertData = [
                'payrun_id' => $payrunId,
                'employee_id' => $data['employee_id'],
                'basic_salary' => $data['basic_salary'],
                'overtime_amount' => $data['overtime_amount'] ?? 0.00,
                'bonus_amount' => $data['bonus_amount'] ?? 0.00,
                'commission_amount' => $data['commission_amount'] ?? 0.00,
                'gross_pay' => $data['gross_pay'],
                'total_deductions' => $data['total_deductions'],
                'net_pay' => $data['net_pay'],
            ];

            DB::table('payrun_details')->insert($insertData);
            $detailId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $detailId],
                message: "Payrun detail created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create payrun detail: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Get a single payrun detail
     */
    public function show($payrunId, $id)
    {
        try {
            $detail = DB::raw(
                "SELECT 
                    payrun_details.*,
                    employees.employee_number,
                    employees.job_title,
                    employees.department,
                    users.first_name as employee_first_name,
                    users.middle_name as employee_middle_name,
                    users.surname as employee_surname,
                    users.email as employee_email,
                    CONCAT(users.first_name, ' ', COALESCE(users.middle_name, ''), ' ', users.surname) as employee_full_name
                FROM payrun_details
                INNER JOIN employees ON payrun_details.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                WHERE payrun_details.id = :id AND payrun_details.payrun_id = :payrun_id",
                [':id' => $id, ':payrun_id' => $payrunId]
            );

            if (empty($detail)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun detail not found",
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $detail[0],
                message: "Payrun detail fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch payrun detail: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Update a payrun detail
     */
    public function update($payrunId, $id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Check if detail exists
            $existingDetail = DB::raw(
                "SELECT * FROM payrun_details WHERE id = :id AND payrun_id = :payrun_id",
                [':id' => $id, ':payrun_id' => $payrunId]
            );

            if (empty($existingDetail)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun detail not found",
                    code: 404
                );
            }

            $updateData = [];

            // Build update data
            $allowedFields = [
                'employee_id', 'basic_salary', 'overtime_amount', 'bonus_amount',
                'commission_amount', 'gross_pay', 'total_deductions', 'net_pay'
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

            // Validate employee if being updated
            if (isset($updateData['employee_id'])) {
                $employee = DB::table('employees')->selectAllWhereID($updateData['employee_id']);
                if (empty($employee)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Invalid employee_id",
                        code: 400
                    );
                }
            }

            DB::table('payrun_details')->update($updateData, 'id', $id);

            return responseJson(
                success: true,
                data: null,
                message: "Payrun detail updated successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update payrun detail: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Delete a payrun detail
     */
    public function delete($payrunId, $id)
    {
        try {
            // Check if detail exists
            $existingDetail = DB::raw(
                "SELECT * FROM payrun_details WHERE id = :id AND payrun_id = :payrun_id",
                [':id' => $id, ':payrun_id' => $payrunId]
            );

            if (empty($existingDetail)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payrun detail not found",
                    code: 404
                );
            }

            DB::table('payrun_details')->delete('id', $id);

            return responseJson(
                success: true,
                data: null,
                message: "Payrun detail deleted successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete payrun detail: " . $e->getMessage(),
                code: 500
            );
        }
    }
}
