<?php

namespace App\Controllers;

use App\Services\DB;

// Include tax calculation functions
require_once __DIR__ . '/../helpers/tax.php';

class PayrollController
{
    /**
     * Get all payrolls with pagination and filters
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

            // Apply role-based filters
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

            // Get pagination parameters
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset = ($page - 1) * $perPage;

            // Optional filters
            $status = $_GET['status'] ?? null;
            $month = $_GET['month'] ?? null;
            $year = $_GET['year'] ?? null;
            $name = $_GET['name'] ?? null;
            $employeeId = $_GET['employee_id'] ?? null;

            // Validate filter inputs
            $validationErrors = [];

            if ($status && !in_array($status, ['pending', 'approved', 'paid'])) {
                $validationErrors['status'] = "Invalid status. Must be one of: pending, approved, paid";
            }

            if ($month) {
                $targetMonth = (int) $month;
                if ($targetMonth < 1 || $targetMonth > 12) {
                    $validationErrors['month'] = "Invalid month. Must be between 1 and 12";
                }
            }

            if ($year) {
                $targetYear = (int) $year;
                if ($targetYear < 1900 || $targetYear > 2100) {
                    $validationErrors['year'] = "Invalid year. Must be between 1900 and 2100";
                }
            }

            if ($employeeId && !is_numeric($employeeId)) {
                $validationErrors['employee_id'] = "Employee ID must be a valid number";
            }

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

            // Add organization filter
            $whereConditions[] = "emp_users.organization_id = :org_id";
            $countParams[':org_id'] = $org_id;
            $queryParams[':org_id'] = $org_id;
            $statsParams[':org_id'] = $org_id;

            // Apply role-based filters
            if (isset($filters['employee_id'])) {
                $whereConditions[] = "payrolls.employee_id = :role_employee_id";
                $countParams[':role_employee_id'] = $filters['employee_id'];
                $queryParams[':role_employee_id'] = $filters['employee_id'];
                $statsParams[':role_employee_id'] = $filters['employee_id'];
            }

            // Apply optional filters
            if ($status) {
                $whereConditions[] = "payrolls.status = :filter_status";
                $countParams[':filter_status'] = $status;
                $queryParams[':filter_status'] = $status;
                $statsParams[':filter_status'] = $status;
            }

            if ($month) {
                $targetMonth = (int) $month;
                $whereConditions[] = "payrolls.pay_period_month = :filter_month";
                $countParams[':filter_month'] = $targetMonth;
                $queryParams[':filter_month'] = $targetMonth;
                $statsParams[':filter_month'] = $targetMonth;
            }

            if ($year) {
                $targetYear = (int) $year;
                $whereConditions[] = "payrolls.pay_period_year = :filter_year";
                $countParams[':filter_year'] = $targetYear;
                $queryParams[':filter_year'] = $targetYear;
                $statsParams[':filter_year'] = $targetYear;
            }

            if ($employeeId) {
                $whereConditions[] = "payrolls.employee_id = :filter_employee_id";
                $countParams[':filter_employee_id'] = $employeeId;
                $queryParams[':filter_employee_id'] = $employeeId;
                $statsParams[':filter_employee_id'] = $employeeId;
            }

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
                FROM payrolls
                INNER JOIN employees ON payrolls.employee_id = employees.id
                INNER JOIN users emp_users ON employees.user_id = emp_users.id
                $whereClause
            ";

            $countResult = DB::raw($countQuery, $countParams);
            $total = $countResult[0]->total ?? 0;

            if ($total === 0) {
                return responseJson(
                    success: true,
                    data: [],
                    message: "No payrolls found matching the specified criteria",
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
                            'total_payrolls' => 0,
                            'pending' => 0,
                            'approved' => 0,
                            'paid' => 0
                        ]
                    ]
                );
            }

            // Get statistics
            $statsQuery = "
                SELECT 
                    COUNT(*) as total_payrolls,
                    SUM(CASE WHEN payrolls.status = 'pending' THEN 1 ELSE 0 END) as pending_payrolls,
                    SUM(CASE WHEN payrolls.status = 'approved' THEN 1 ELSE 0 END) as approved_payrolls,
                    SUM(CASE WHEN payrolls.status = 'paid' THEN 1 ELSE 0 END) as paid_payrolls
                FROM payrolls
                INNER JOIN employees ON payrolls.employee_id = employees.id
                INNER JOIN users emp_users ON employees.user_id = emp_users.id
                $whereClause
            ";

            $statsResult = DB::raw($statsQuery, $statsParams);
            $stats = $statsResult[0] ?? null;

            // Fetch paginated data
            $query = "
                SELECT 
                    payrolls.id AS payroll_id,
                    payrolls.employee_id,
                    payrolls.pay_period_month,
                    payrolls.pay_period_year,
                    payrolls.basic_salary,
                    payrolls.overtime_amount,
                    payrolls.bonus_amount,
                    payrolls.commission_amount,
                    payrolls.gross_pay,
                    payrolls.nssf,
                    payrolls.shif,
                    payrolls.housing_levy,
                    payrolls.taxable_income,
                    payrolls.tax_before_relief,
                    payrolls.personal_relief,
                    payrolls.paye,
                    payrolls.total_deductions,
                    payrolls.net_pay,
                    payrolls.status,
                    payrolls.approved_by,
                    payrolls.approved_at,
                    payrolls.paid_by,
                    payrolls.paid_at,
                    payrolls.created_by,
                    payrolls.created_at,
                    payrolls.updated_at,

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

                    -- Paid by details
                    paid_by_users.first_name AS paid_by_first_name,
                    paid_by_users.middle_name AS paid_by_middle_name,
                    paid_by_users.surname AS paid_by_surname,
                    CONCAT(
                        paid_by_users.first_name,
                        ' ',
                        COALESCE(paid_by_users.middle_name, ''),
                        ' ',
                        paid_by_users.surname
                    ) AS paid_by_full_name

                FROM payrolls
                INNER JOIN employees ON payrolls.employee_id = employees.id
                INNER JOIN users emp_users ON employees.user_id = emp_users.id
                LEFT JOIN users approver_users ON payrolls.approved_by = approver_users.id
                LEFT JOIN users paid_by_users ON payrolls.paid_by = paid_by_users.id
                $whereClause
                ORDER BY payrolls.pay_period_year DESC, payrolls.pay_period_month DESC, payrolls.created_at DESC
                LIMIT :pagination_limit OFFSET :pagination_offset
            ";

            $queryParams[':pagination_limit'] = $perPage;
            $queryParams[':pagination_offset'] = $offset;

            $payrolls = DB::raw($query, $queryParams);

            // Calculate pagination metadata
            $totalPages = ceil($total / $perPage);

            return responseJson(
                success: true,
                data: $payrolls,
                message: "Fetched Payrolls Successfully",
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
                        'total_payrolls' => (int) ($stats->total_payrolls ?? 0),
                        'pending' => (int) ($stats->pending_payrolls ?? 0),
                        'approved' => (int) ($stats->approved_payrolls ?? 0),
                        'paid' => (int) ($stats->paid_payrolls ?? 0)
                    ]
                ]
            );
        } catch (\Exception $e) {
            error_log("Payroll index error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch payrolls",
                code: 500,
                errors: [
                    'exception' => $e->getMessage()
                ]
            );
        }
    }

    /**
     * Get a single payroll by ID
     */
    public function show($org_id, $id)
    {
        try {
            $query = "
                SELECT 
                    payrolls.id AS payroll_id,
                    payrolls.employee_id,
                    payrolls.pay_period_month,
                    payrolls.pay_period_year,
                    payrolls.basic_salary,
                    payrolls.overtime_amount,
                    payrolls.bonus_amount,
                    payrolls.commission_amount,
                    payrolls.gross_pay,
                    payrolls.nssf,
                    payrolls.shif,
                    payrolls.housing_levy,
                    payrolls.taxable_income,
                    payrolls.tax_before_relief,
                    payrolls.personal_relief,
                    payrolls.paye,
                    payrolls.total_deductions,
                    payrolls.net_pay,
                    payrolls.status,
                    payrolls.approved_by,
                    payrolls.approved_at,
                    payrolls.paid_by,
                    payrolls.paid_at,
                    payrolls.created_by,
                    payrolls.created_at,
                    payrolls.updated_at,

                    -- Employee details
                    emp_users.email AS employee_email,
                    emp_users.first_name AS employee_first_name,
                    emp_users.middle_name AS employee_middle_name,
                    emp_users.surname AS employee_surname,
                    employees.job_title,
                    employees.department,
                    employees.bank_account_number,
                    employees.tax_id,
                    CONCAT(
                        emp_users.first_name,
                        ' ',
                        COALESCE(emp_users.middle_name, ''),
                        ' ',
                        emp_users.surname
                    ) AS employee_full_name,

                    -- Approver details
                    approver_users.first_name AS approver_first_name,
                    approver_users.surname AS approver_surname,
                    CONCAT(
                        approver_users.first_name,
                        ' ',
                        COALESCE(approver_users.middle_name, ''),
                        ' ',
                        approver_users.surname
                    ) AS approver_full_name,

                    -- Paid by details
                    paid_by_users.first_name AS paid_by_first_name,
                    paid_by_users.surname AS paid_by_surname,
                    CONCAT(
                        paid_by_users.first_name,
                        ' ',
                        COALESCE(paid_by_users.middle_name, ''),
                        ' ',
                        paid_by_users.surname
                    ) AS paid_by_full_name

                FROM payrolls
                INNER JOIN employees ON payrolls.employee_id = employees.id
                INNER JOIN users emp_users ON employees.user_id = emp_users.id
                LEFT JOIN users approver_users ON payrolls.approved_by = approver_users.id
                LEFT JOIN users paid_by_users ON payrolls.paid_by = paid_by_users.id
                WHERE payrolls.id = :id
                AND emp_users.organization_id = :org_id
            ";

            $payroll = DB::raw($query, [':id' => $id, ':org_id' => $org_id]);

            if (empty($payroll)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payroll not found",
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $payroll[0],
                message: "Payroll fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch payroll: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Generate/create a new payroll
     */
    public function store($org_id = null)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            $required = ['employee_id', 'pay_period_month', 'pay_period_year'];
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

            // Validate employee exists and belongs to organization
            $employeeCheck = DB::raw("
                SELECT e.*, u.organization_id
                FROM employees e
                INNER JOIN users u ON e.user_id = u.id
                WHERE e.id = :employee_id AND u.organization_id = :org_id
            ", [
                ':employee_id' => $data['employee_id'],
                ':org_id' => $org_id
            ]);

            if (empty($employeeCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee not found or does not belong to this organization",
                    code: 404
                );
            }

            $employee = $employeeCheck[0];

            // Check if payroll already exists for this period
            $existingPayroll = DB::table('payrolls')
                ->where([
                    'employee_id' => $data['employee_id'],
                    'pay_period_month' => $data['pay_period_month'],
                    'pay_period_year' => $data['pay_period_year']
                ])
                ->get();

            if (!empty($existingPayroll)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payroll already exists for this employee and period",
                    code: 409
                );
            }

            // Calculate payroll using tax helper
            $basicSalary = (float) ($data['basic_salary'] ?? $employee->base_salary);
            $overtimeAmount = (float) ($data['overtime_amount'] ?? 0);
            $bonusAmount = (float) ($data['bonus_amount'] ?? 0);
            $commissionAmount = (float) ($data['commission_amount'] ?? 0);

            $grossPay = $basicSalary + $overtimeAmount + $bonusAmount + $commissionAmount;

            // Calculate deductions using tax.php functions
            $nssf = calculateNSSF($basicSalary);
            $shif = $basicSalary * 0.0275;
            $housingLevy = $basicSalary * 0.015;
            $taxableIncome = $basicSalary - $nssf - $shif - $housingLevy;
            $tax = calculateProgressiveTax($taxableIncome);
            $paye = max(0, $tax - 2400);
            $totalDeductions = $nssf + $shif + $housingLevy + $paye;
            $netPay = $grossPay - $totalDeductions;

            // Prepare insert data
            $insertData = [
                'organization_id' => $org_id,
                'employee_id' => $data['employee_id'],
                'pay_period_month' => $data['pay_period_month'],
                'pay_period_year' => $data['pay_period_year'],
                'basic_salary' => $basicSalary,
                'overtime_amount' => $overtimeAmount,
                'bonus_amount' => $bonusAmount,
                'commission_amount' => $commissionAmount,
                'gross_pay' => $grossPay,
                'nssf' => $nssf,
                'shif' => $shif,
                'housing_levy' => $housingLevy,
                'taxable_income' => $taxableIncome,
                'tax_before_relief' => $tax,
                'personal_relief' => 2400,
                'paye' => $paye,
                'total_deductions' => $totalDeductions,
                'net_pay' => $netPay,
                'status' => 'pending',
                'created_by' => $currentUser['id']
            ];

            DB::table('payrolls')->insert($insertData);
            $payrollId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $payrollId],
                message: "Payroll generated successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Payroll store error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to generate payroll: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Approve a payroll
     */
    public function approve($org_id, $id)
    {
        try {
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Authentication required',
                    code: 401
                );
            }

            // Verify payroll exists and belongs to organization
            $payroll = $this->getPayrollWithValidation($id, $org_id);
            if (!$payroll['success']) {
                return $payroll['data'];
            }

            $payrollData = $payroll['data'];

            // Check if payroll is already approved or paid
            if ($payrollData->status === 'approved' || $payrollData->status === 'paid') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payroll has already been {$payrollData->status}",
                    code: 400
                );
            }

            // Update payroll status
            DB::table('payrolls')->update(
                [
                    'status' => 'approved',
                    'approved_by' => $currentUser['id'],
                    'approved_at' => date('Y-m-d H:i:s')
                ],
                'id',
                $id
            );

            return responseJson(
                success: true,
                data: [
                    'payroll_id' => $id,
                    'status' => 'approved',
                    'approved_by' => $currentUser['id']
                ],
                message: "Payroll approved successfully"
            );
        } catch (\Exception $e) {
            error_log("Payroll approval error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to approve payroll: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Mark payroll as paid
     */
    public function pay($org_id, $id)
    {
        try {
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Authentication required',
                    code: 401
                );
            }

            // Verify payroll exists and belongs to organization
            $payroll = $this->getPayrollWithValidation($id, $org_id);
            if (!$payroll['success']) {
                return $payroll['data'];
            }

            $payrollData = $payroll['data'];

            // Check if payroll is already paid
            if ($payrollData->status === 'paid') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payroll has already been paid",
                    code: 400
                );
            }

            // Check if payroll is approved
            if ($payrollData->status !== 'approved') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Payroll must be approved before marking as paid",
                    code: 400
                );
            }

            // Update payroll status
            DB::table('payrolls')->update(
                [
                    'status' => 'paid',
                    'paid_by' => $currentUser['id'],
                    'paid_at' => date('Y-m-d H:i:s')
                ],
                'id',
                $id
            );

            return responseJson(
                success: true,
                data: [
                    'payroll_id' => $id,
                    'status' => 'paid',
                    'paid_by' => $currentUser['id']
                ],
                message: "Payroll marked as paid successfully"
            );
        } catch (\Exception $e) {
            error_log("Payroll pay error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to mark payroll as paid: " . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * Validate payroll exists and belongs to organization
     */
    private function getPayrollWithValidation($payroll_id, $org_id)
    {
        $query = "
            SELECT 
                payrolls.*,
                emp_users.organization_id
            FROM payrolls
            INNER JOIN employees ON payrolls.employee_id = employees.id
            INNER JOIN users emp_users ON employees.user_id = emp_users.id
            WHERE payrolls.id = :payroll_id
        ";

        $result = DB::raw($query, [':payroll_id' => $payroll_id]);

        if (empty($result)) {
            return [
                'success' => false,
                'data' => responseJson(
                    success: false,
                    data: null,
                    message: "Payroll not found",
                    code: 404
                )
            ];
        }

        $payroll = $result[0];

        // Verify payroll belongs to the organization
        if ($payroll->organization_id != $org_id) {
            return [
                'success' => false,
                'data' => responseJson(
                    success: false,
                    data: null,
                    message: "Payroll does not belong to this organization",
                    code: 403
                )
            ];
        }

        return [
            'success' => true,
            'data' => $payroll
        ];
    }

    /**
     * Apply role-based filters
     */
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
            case 'payroll_manager':
            case 'payroll_officer':
            case 'finance_manager':
                // These roles can access all payrolls in their organization
                break;

            case 'employee':
                // Employees only see their own payrolls
                $filters['employee_id'] = $employee['id'];
                break;

            default:
                throw new \Exception('Insufficient permissions to access payrolls');
        }

        return $filters;
    }
}

