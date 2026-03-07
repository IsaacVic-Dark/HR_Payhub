<?php

namespace App\Controllers;

use App\Services\DB;

require_once __DIR__ . '/../helpers/tax.php';

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
                    employees.employee_number,
                    employees.department_id,
                    departments.name as department,
                    users.first_name as employee_first_name,
                    users.middle_name as employee_middle_name,
                    users.surname as employee_surname,
                    users.email as employee_email,
                    CONCAT(users.first_name, ' ', COALESCE(users.middle_name, ''), ' ', users.surname) as employee_full_name
                FROM payrun_details
                INNER JOIN employees ON payrun_details.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                LEFT JOIN departments ON employees.department_id = departments.id
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
     * Manually create a single payrun detail.
     * NOTE: Under normal flow, details are auto-generated in PayrunController::finalizePayrun().
     * This endpoint is for manual corrections / one-off additions only.
     */
    public function create($payrunId)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields — gross_pay/total_deductions/net_pay are now calculated
            $required = ['employee_id', 'basic_salary'];
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

            // Verify payrun exists and get org_id
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

            $basicSalary      = (float) $data['basic_salary'];
            $overtimeAmount   = (float) ($data['overtime_amount']   ?? 0.00);
            $bonusAmount      = (float) ($data['bonus_amount']      ?? 0.00);
            $commissionAmount = (float) ($data['commission_amount'] ?? 0.00);
            $extraDeductions  = (float) ($data['extra_deductions']  ?? 0.00);

            $grossPay = $basicSalary + $overtimeAmount + $bonusAmount + $commissionAmount;

            // Load org tax config and calculate
            $orgId  = $payrun[0]->organization_id;
            $config = loadTaxConfig($orgId);
            $tax    = calculateNetPay($basicSalary, $grossPay, $config, $extraDeductions);

            var_dump($tax); // Debugging output

            $insertData = [
                'payrun_id'          => $payrunId,
                'organization_id'    => $orgId,
                'employee_id'        => $data['employee_id'],
                'basic_salary'       => $tax['basic_salary'],
                'overtime_amount'    => $overtimeAmount,
                'bonus_amount'       => $bonusAmount,
                'commission_amount'  => $commissionAmount,
                'nssf'               => $tax['nssf'],
                'shif'               => $tax['shif'],
                'housing_levy'       => $tax['housing_levy'],
                'taxable_income'     => $tax['taxable_income'],
                'tax_before_relief'  => $tax['tax_before_relief'],
                'personal_relief'    => $tax['personal_relief'],
                'paye'               => $tax['paye'],
                'gross_pay'          => $tax['gross_pay'],
                'total_deductions'   => $tax['total_deductions'],
                'net_pay'            => $tax['net_pay'],
            ];

            DB::table('payrun_details')->insert($insertData);
            $detailId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $detailId, 'tax_breakdown' => $tax],
                message: "Payrun detail created successfully",
                code: 201
            );
        } catch (\InvalidArgumentException $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Invalid salary data: " . $e->getMessage(),
                code: 400
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
                    employees.department_id,
                    departments.name as department,
                    users.first_name as employee_first_name,
                    users.middle_name as employee_middle_name,
                    users.surname as employee_surname,
                    users.email as employee_email,
                    CONCAT(users.first_name, ' ', COALESCE(users.middle_name, ''), ' ', users.surname) as employee_full_name
                FROM payrun_details
                INNER JOIN employees ON payrun_details.employee_id = employees.id
                INNER JOIN users ON employees.user_id = users.id
                LEFT JOIN departments ON employees.department_id = departments.id
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

            $existingDetail = DB::raw(
                "SELECT payrun_details.*, payruns.organization_id
             FROM payrun_details
             INNER JOIN payruns ON payrun_details.payrun_id = payruns.id
             WHERE payrun_details.id = :id AND payrun_details.payrun_id = :payrun_id",
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

            $current = $existingDetail[0];

            // Merge incoming changes over existing values
            $basicSalary      = (float) ($data['basic_salary']      ?? $current->basic_salary);
            $overtimeAmount   = (float) ($data['overtime_amount']   ?? $current->overtime_amount);
            $bonusAmount      = (float) ($data['bonus_amount']      ?? $current->bonus_amount);
            $commissionAmount = (float) ($data['commission_amount'] ?? $current->commission_amount);
            $extraDeductions  = (float) ($data['extra_deductions']  ?? 0.00);

            // Validate employee if being changed
            if (isset($data['employee_id'])) {
                $employee = DB::table('employees')->selectAllWhereID($data['employee_id']);
                if (empty($employee)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Invalid employee_id",
                        code: 400
                    );
                }
            }

            $grossPay = $basicSalary + $overtimeAmount + $bonusAmount + $commissionAmount;
            $config   = loadTaxConfig($current->organization_id);
            $tax      = calculateNetPay($basicSalary, $grossPay, $config, $extraDeductions);

            $updateData = [
                'basic_salary'      => $tax['basic_salary'],
                'overtime_amount'   => $overtimeAmount,
                'bonus_amount'      => $bonusAmount,
                'commission_amount' => $commissionAmount,
                'nssf'              => $tax['nssf'],
                'shif'              => $tax['shif'],
                'housing_levy'      => $tax['housing_levy'],
                'taxable_income'    => $tax['taxable_income'],
                'tax_before_relief' => $tax['tax_before_relief'],
                'personal_relief'   => $tax['personal_relief'],
                'paye'              => $tax['paye'],
                'gross_pay'         => $tax['gross_pay'],
                'total_deductions'  => $tax['total_deductions'],
                'net_pay'           => $tax['net_pay'],
            ];

            if (isset($data['employee_id'])) {
                $updateData['employee_id'] = $data['employee_id'];
            }

            DB::table('payrun_details')->update($updateData, 'id', $id);

            return responseJson(
                success: true,
                data: ['tax_breakdown' => $tax],
                message: "Payrun detail updated successfully"
            );
        } catch (\InvalidArgumentException $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Invalid salary data: " . $e->getMessage(),
                code: 400
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
