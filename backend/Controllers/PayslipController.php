<?php

namespace App\Controllers;

use App\Services\DB;

class PayslipController
{
    // -------------------------------------------------------------------------
    // Reusable SELECT columns for all payslip queries
    // Joins: payruns, payrun_details, employees
    // -------------------------------------------------------------------------
    private function payslipSelectColumns(): string
    {
        return "
            ps.id                       AS payslip_id,
            ps.organization_id,
            ps.payrun_id,
            ps.payrun_detail_id,
            ps.employee_id,
            ps.payslip_number,
            ps.status,
            ps.generated_at,
            ps.sent_at,
            ps.pdf_path,

            -- Payrun details (raw — nested by formatPayslip())
            pr.payrun_name,
            pr.pay_period_start,
            pr.pay_period_end,
            pr.pay_frequency,
            pr.status                   AS payrun_status,

            -- Earnings & deductions from payrun_details
            pd.basic_salary,
            pd.overtime_amount,
            pd.bonus_amount,
            pd.commission_amount,
            pd.gross_pay,
            pd.nssf,
            pd.shif,
            pd.housing_levy,
            pd.taxable_income,
            pd.tax_before_relief,
            pd.personal_relief,
            pd.paye,
            pd.total_deductions,
            pd.net_pay,

            -- Employee info (raw — nested by formatPayslip())
            emp.firstname               AS employee_firstname,
            emp.middlename              AS employee_middlename,
            emp.surname                 AS employee_surname,
            emp.employee_number,
            emp.job_title_id,
            emp.department_id,
            u.email                     AS employee_email
        ";
    }

    // -------------------------------------------------------------------------
    // Reusable JOINs for all payslip queries
    // -------------------------------------------------------------------------
    private function payslipJoins(): string
    {
        return "
            INNER JOIN payruns pr
                ON ps.payrun_id = pr.id
            INNER JOIN payrun_details pd
                ON ps.payrun_detail_id = pd.id
            INNER JOIN employees emp
                ON ps.employee_id = emp.id
            LEFT JOIN users u
                ON emp.user_id = u.id
        ";
    }

    // -------------------------------------------------------------------------
    // Reshape flat row into nested payslip object
    // -------------------------------------------------------------------------
    private function formatPayslip(object $ps): object
    {
        $ps->payrun = [
            'id'               => $ps->payrun_id,
            'payrun_name'      => $ps->payrun_name,
            'pay_period_start' => $ps->pay_period_start,
            'pay_period_end'   => $ps->pay_period_end,
            'pay_frequency'    => $ps->pay_frequency,
            'status'           => $ps->payrun_status,
        ];

        $ps->employee = [
            'id'              => $ps->employee_id,
            'full_name'       => trim(
                ($ps->employee_firstname ?? '') . ' ' .
                ($ps->employee_middlename ? $ps->employee_middlename . ' ' : '') .
                ($ps->employee_surname ?? '')
            ),
            'employee_number' => $ps->employee_number,
            'email'           => $ps->employee_email,
        ];

        $ps->earnings = [
            'basic_salary'      => (float) $ps->basic_salary,
            'overtime_amount'   => (float) $ps->overtime_amount,
            'bonus_amount'      => (float) $ps->bonus_amount,
            'commission_amount' => (float) $ps->commission_amount,
            'gross_pay'         => (float) $ps->gross_pay,
        ];

        $ps->deductions = [
            'nssf'             => (float) $ps->nssf,
            'shif'             => (float) $ps->shif,
            'housing_levy'     => (float) $ps->housing_levy,
            'taxable_income'   => (float) $ps->taxable_income,
            'tax_before_relief'=> (float) $ps->tax_before_relief,
            'personal_relief'  => (float) $ps->personal_relief,
            'paye'             => (float) $ps->paye,
            'total_deductions' => (float) $ps->total_deductions,
        ];

        $ps->net_pay = (float) $ps->net_pay;

        // Remove flat fields
        unset(
            $ps->payrun_name,   $ps->pay_period_start, $ps->pay_period_end,
            $ps->pay_frequency, $ps->payrun_status,
            $ps->employee_firstname, $ps->employee_middlename, $ps->employee_surname,
            $ps->employee_number, $ps->employee_email,
            $ps->basic_salary, $ps->overtime_amount, $ps->bonus_amount,
            $ps->commission_amount, $ps->gross_pay, $ps->nssf, $ps->shif,
            $ps->housing_levy, $ps->taxable_income, $ps->tax_before_relief,
            $ps->personal_relief, $ps->paye, $ps->total_deductions,
            $ps->job_title_id, $ps->department_id
        );

        return $ps;
    }

    // -------------------------------------------------------------------------
    // Role-based scope filters — mirrors LeaveController::applyRoleBasedFilters()
    // -------------------------------------------------------------------------
    private function applyRoleBasedFilters(int $orgId, ?int $payrunId = null): array
    {
        $user     = \App\Middleware\AuthMiddleware::getCurrentUser();
        $employee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

        if (!$user || !$employee) {
            throw new \Exception('User not authenticated');
        }

        $filters = ['organization_id' => $orgId];

        if ($payrunId) {
            $filters['payrun_id'] = $payrunId;
        }

        switch ($user['user_type']) {
            // Full org visibility
            case 'admin':
            case 'payroll_manager':
            case 'finance_manager':
            case 'auditor':
                break;

            // Dept/team visibility
            case 'hr_manager':
            case 'hr_officer':
            case 'payroll_officer':
                $filters['dept_employees'] = $this->getDeptEmployeeIds($employee['id']);
                break;

            case 'department_manager':
                $filters['team_employees'] = $this->getTeamEmployeeIds($employee['id']);
                break;

            // Own only
            case 'employee':
                $filters['employee_id'] = $employee['id'];
                break;

            default:
                throw new \Exception('Unknown user role');
        }

        return $filters;
    }

    private function getTeamEmployeeIds(int $managerId): array
    {
        try {
            $result = DB::raw(
                "SELECT id FROM employees
                 WHERE reports_to = :manager_id AND status = 'active'",
                [':manager_id' => $managerId]
            );
            return array_column((array) $result, 'id');
        } catch (\Exception $e) {
            error_log("Team fetch error: " . $e->getMessage());
            return [];
        }
    }

    private function getDeptEmployeeIds(int $employeeId): array
    {
        try {
            // Get this employee's department, then return all employees in that dept
            $emp = DB::raw(
                "SELECT department_id FROM employees WHERE id = :id LIMIT 1",
                [':id' => $employeeId]
            );

            if (empty($emp) || !$emp[0]->department_id) {
                return [];
            }

            $result = DB::raw(
                "SELECT id FROM employees
                 WHERE department_id = :dept_id AND status = 'active'",
                [':dept_id' => $emp[0]->department_id]
            );
            return array_column((array) $result, 'id');
        } catch (\Exception $e) {
            error_log("Dept fetch error: " . $e->getMessage());
            return [];
        }
    }

    // -------------------------------------------------------------------------
    // Validate a payslip belongs to the org; optionally also to a payrun
    // -------------------------------------------------------------------------
    private function getPayslipWithValidation(int $payslipId, int $orgId, ?int $payrunId = null): array
    {
        $sql    = "SELECT ps.* FROM payslips ps WHERE ps.id = :id AND ps.organization_id = :org_id";
        $params = [':id' => $payslipId, ':org_id' => $orgId];

        if ($payrunId) {
            $sql             .= " AND ps.payrun_id = :payrun_id";
            $params[':payrun_id'] = $payrunId;
        }

        $result = DB::raw($sql, $params);

        if (empty($result)) {
            return [
                'success' => false,
                'data'    => responseJson(
                    success: false, data: null, message: "Payslip not found", code: 404
                )
            ];
        }

        return ['success' => true, 'data' => $result[0]];
    }

    // -------------------------------------------------------------------------
    // Verify a payrun exists, belongs to the org, and is finalized
    // -------------------------------------------------------------------------
    private function getPayrunWithValidation(int $payrunId, int $orgId): array
    {
        $result = DB::raw(
            "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id",
            [':id' => $payrunId, ':org_id' => $orgId]
        );

        if (empty($result)) {
            return [
                'success' => false,
                'data'    => responseJson(
                    success: false, data: null, message: "Payrun not found", code: 404
                )
            ];
        }

        return ['success' => true, 'data' => $result[0]];
    }

    // -------------------------------------------------------------------------
    // Build WHERE clause + params from filters (shared by index & payrunPayslips)
    // -------------------------------------------------------------------------
    private function buildWhereFromFilters(array $filters): array
    {
        $where  = ["ps.organization_id = :org_id"];
        $params = [':org_id' => $filters['organization_id']];

        if (isset($filters['payrun_id'])) {
            $where[]             = "ps.payrun_id = :payrun_id";
            $params[':payrun_id'] = $filters['payrun_id'];
        }

        if (isset($filters['employee_id'])) {
            $where[]              = "ps.employee_id = :role_emp_id";
            $params[':role_emp_id'] = $filters['employee_id'];
        }

        if (!empty($filters['team_employees']) || !empty($filters['dept_employees'])) {
            $ids          = $filters['team_employees'] ?? $filters['dept_employees'];
            $placeholders = implode(',', array_map(fn($i) => ":scope_$i", array_keys($ids)));
            $where[]      = "ps.employee_id IN ($placeholders)";
            foreach ($ids as $i => $empId) {
                $params[":scope_$i"] = $empId;
            }
        }

        return [$where, $params];
    }

    // =========================================================================
    // PUBLIC METHODS
    // =========================================================================

    /**
     * GET /organizations/{org_id}/payslips
     * List all payslips in org with pagination and role-based scope
     */
    public function index(int $orgId): mixed
    {
        try {
            if (!$orgId || !is_numeric($orgId)) {
                return responseJson(
                    success: false, message: "Invalid organization ID", code: 400,
                    errors: ['org_id' => 'Must be a valid number']
                );
            }

            $orgCheck = DB::table('organizations')->where(['id' => $orgId])->get();
            if (empty($orgCheck)) {
                return responseJson(success: false, data: null, message: "Organization not found", code: 404);
            }

            try {
                $filters = $this->applyRoleBasedFilters($orgId);
            } catch (\Exception $e) {
                return responseJson(success: false, data: null, message: "Authentication error", code: 401);
            }

            // Pagination
            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
            $offset  = ($page - 1) * $perPage;

            // Query filters
            $statusFilter   = $_GET['status']    ?? null;
            $payrunFilter   = $_GET['payrun_id'] ?? null;
            $employeeFilter = $_GET['employee_id'] ?? null;
            $monthFilter    = $_GET['month']     ?? null;
            $yearFilter     = $_GET['year']      ?? null;

            // Validation
            $errors = [];
            if ($statusFilter && !in_array($statusFilter, ['generated', 'sent', 'acknowledged'])) {
                $errors['status'] = "Must be one of: generated, sent, acknowledged";
            }
            if ($payrunFilter && !is_numeric($payrunFilter)) {
                $errors['payrun_id'] = "Must be a valid number";
            }
            if ($monthFilter && ((int) $monthFilter < 1 || (int) $monthFilter > 12)) {
                $errors['month'] = "Must be between 1 and 12";
            }
            if ($yearFilter && ((int) $yearFilter < 1900 || (int) $yearFilter > 2100)) {
                $errors['year'] = "Must be between 1900 and 2100";
            }
            if (!empty($errors)) {
                return responseJson(success: false, data: null, message: "Validation failed", code: 400, errors: $errors);
            }

            [$where, $params] = $this->buildWhereFromFilters($filters);

            // Extra query filters on top of role scope
            if ($statusFilter) {
                $where[]             = "ps.status = :f_status";
                $params[':f_status'] = $statusFilter;
            }
            if ($payrunFilter) {
                $where[]              = "ps.payrun_id = :f_payrun";
                $params[':f_payrun']  = (int) $payrunFilter;
            }
            if ($employeeFilter && !isset($filters['employee_id'])) {
                // Only honor explicit employee filter if role can see others
                $where[]              = "ps.employee_id = :f_emp";
                $params[':f_emp']     = (int) $employeeFilter;
            }
            if ($monthFilter) {
                $where[]              = "MONTH(pr.pay_period_start) = :f_month";
                $params[':f_month']   = (int) $monthFilter;
            }
            if ($yearFilter) {
                $where[]              = "YEAR(pr.pay_period_start) = :f_year";
                $params[':f_year']    = (int) $yearFilter;
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM payslips ps
                 {$this->payslipJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: false, data: null,
                    message: "No payslips found matching the specified criteria", code: 404
                );
            }

            // Stats
            $stats = DB::raw(
                "SELECT
                    COUNT(*) as total_payslips,
                    SUM(CASE WHEN ps.status = 'generated'    THEN 1 ELSE 0 END) as generated_count,
                    SUM(CASE WHEN ps.status = 'sent'         THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN ps.status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged_count,
                    SUM(pd.gross_pay)        as total_gross_pay,
                    SUM(pd.net_pay)          as total_net_pay,
                    SUM(pd.total_deductions) as total_deductions
                 FROM payslips ps
                 {$this->payslipJoins()} $whereClause",
                $params
            )[0] ?? null;

            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $payslips = DB::raw(
                "SELECT {$this->payslipSelectColumns()}
                 FROM payslips ps
                 {$this->payslipJoins()}
                 $whereClause
                 ORDER BY ps.generated_at DESC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            $payslips = array_map(fn($p) => $this->formatPayslip($p), $payslips);

            return responseJson(
                success: true,
                data: array_values($payslips),
                message: "Payslips fetched successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => (int) $total,
                        'total_pages'  => (int) ceil($total / $perPage),
                        'has_next'     => $page < ceil($total / $perPage),
                        'has_prev'     => $page > 1,
                    ],
                    'statistics' => [
                        'total_payslips'      => (int) ($stats->total_payslips      ?? 0),
                        'total_gross_pay'     => (float) ($stats->total_gross_pay   ?? 0),
                        'total_net_pay'       => (float) ($stats->total_net_pay     ?? 0),
                        'total_deductions'    => (float) ($stats->total_deductions  ?? 0),
                        'by_status' => [
                            'generated'    => (int) ($stats->generated_count    ?? 0),
                            'sent'         => (int) ($stats->sent_count         ?? 0),
                            'acknowledged' => (int) ($stats->acknowledged_count ?? 0),
                        ],
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Payslip index error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch payslips", code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/payslips/{id}
     * Single payslip — role scope enforced by middleware
     */
    public function show(int $orgId, int $payslipId): mixed
    {
        try {
            $result = DB::raw(
                "SELECT {$this->payslipSelectColumns()}
                 FROM payslips ps
                 {$this->payslipJoins()}
                 WHERE ps.id = :id AND ps.organization_id = :org_id",
                [':id' => $payslipId, ':org_id' => $orgId]
            );

            if (empty($result)) {
                return responseJson(success: false, data: null, message: "Payslip not found", code: 404);
            }

            return responseJson(
                success: true,
                data: $this->formatPayslip($result[0]),
                message: "Payslip fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch payslip: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/payruns/{payrun_id}/payslips
     * All payslips for a specific payrun with role-based scope
     */
    public function payrunPayslips(int $orgId, int $payrunId): mixed
    {
        try {
            $payrun = $this->getPayrunWithValidation($payrunId, $orgId);
            if (!$payrun['success']) return $payrun['data'];

            try {
                $filters = $this->applyRoleBasedFilters($orgId, $payrunId);
            } catch (\Exception $e) {
                return responseJson(success: false, data: null, message: "Authentication error", code: 401);
            }

            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 20)));
            $offset  = ($page - 1) * $perPage;

            [$where, $params] = $this->buildWhereFromFilters($filters);
            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM payslips ps
                 {$this->payslipJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: true, data: [],
                    message: "No payslips found for this payrun", code: 200,
                    metadata: ['pagination' => ['total' => 0], 'payrun' => $payrun['data']]
                );
            }

            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $payslips = DB::raw(
                "SELECT {$this->payslipSelectColumns()}
                 FROM payslips ps
                 {$this->payslipJoins()}
                 $whereClause
                 ORDER BY emp.surname ASC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            $payslips = array_map(fn($p) => $this->formatPayslip($p), $payslips);

            return responseJson(
                success: true,
                data: array_values($payslips),
                message: "Payrun payslips fetched successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => (int) $total,
                        'total_pages'  => (int) ceil($total / $perPage),
                        'has_next'     => $page < ceil($total / $perPage),
                        'has_prev'     => $page > 1,
                    ],
                    'payrun' => [
                        'id'               => $payrun['data']->id,
                        'payrun_name'      => $payrun['data']->payrun_name,
                        'pay_period_start' => $payrun['data']->pay_period_start,
                        'pay_period_end'   => $payrun['data']->pay_period_end,
                        'status'           => $payrun['data']->status,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Payrun payslips error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch payrun payslips", code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/payruns/{payrun_id}/payslips/generate
     * Generate payslips from finalized payrun_details.
     * Roles: admin, payroll_manager, payroll_officer
     */
    public function generate(int $orgId, int $payrunId): mixed
    {
        try {
            $payrun = $this->getPayrunWithValidation($payrunId, $orgId);
            if (!$payrun['success']) return $payrun['data'];

            $payrunData = $payrun['data'];

            if ($payrunData->status !== 'finalized') {
                return responseJson(
                    success: false, data: null,
                    message: "Payslips can only be generated from a finalized payrun (current status: {$payrunData->status})",
                    code: 400
                );
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Optional: generate for specific employees only
            $employeeIds = $data['employee_ids'] ?? [];
            $regenerate  = (bool) ($data['regenerate'] ?? false);

            // Fetch all payrun_details for this payrun (optionally filtered by employee)
            $sql    = "SELECT * FROM payrun_details WHERE payrun_id = :payrun_id AND organization_id = :org_id";
            $params = [':payrun_id' => $payrunId, ':org_id' => $orgId];

            if (!empty($employeeIds)) {
                $placeholders = implode(',', array_map(fn($i) => ":emp_$i", array_keys($employeeIds)));
                $sql         .= " AND employee_id IN ($placeholders)";
                foreach ($employeeIds as $i => $empId) {
                    $params[":emp_$i"] = $empId;
                }
            }

            $details = DB::raw($sql, $params);

            if (empty($details)) {
                return responseJson(
                    success: false, data: null,
                    message: "No payrun details found to generate payslips from", code: 404
                );
            }

            $generated = 0;
            $skipped   = 0;
            $errors    = [];

            foreach ($details as $detail) {
                try {
                    // Check if payslip already exists for this payrun+employee
                    $existing = DB::raw(
                        "SELECT id FROM payslips WHERE payrun_id = :run AND employee_id = :emp LIMIT 1",
                        [':run' => $payrunId, ':emp' => $detail->employee_id]
                    );

                    if (!empty($existing) && !$regenerate) {
                        $skipped++;
                        continue;
                    }

                    // Build payslip number: PAYSLIP-{PAY_PERIOD_YEAR}-{PAY_PERIOD_MONTH}-{EMP_ID}
                    $period         = new \DateTime($payrunData->pay_period_start);
                    $payslipNumber  = sprintf(
                        'PAYSLIP-%s-%s-EMP%d',
                        $period->format('Y'),
                        $period->format('m'),
                        $detail->employee_id
                    );

                    if (!empty($existing) && $regenerate) {
                        // Update existing
                        DB::table('payslips')->update([
                            'payrun_detail_id' => $detail->id,
                            'payslip_number'   => $payslipNumber,
                            'status'           => 'generated',
                            'generated_at'     => date('Y-m-d H:i:s'),
                            'sent_at'          => null,
                            'pdf_path'         => null,
                        ], 'id', $existing[0]->id);
                    } else {
                        DB::table('payslips')->insert([
                            'organization_id'  => $orgId,
                            'payrun_id'        => $payrunId,
                            'payrun_detail_id' => $detail->id,
                            'employee_id'      => $detail->employee_id,
                            'payslip_number'   => $payslipNumber,
                            'status'           => 'generated',
                            'generated_at'     => date('Y-m-d H:i:s'),
                        ]);
                    }

                    $generated++;
                } catch (\Exception $e) {
                    error_log("Payslip generation error for emp {$detail->employee_id}: " . $e->getMessage());
                    $errors[] = "Employee ID {$detail->employee_id}: " . $e->getMessage();
                }
            }

            return responseJson(
                success: true,
                data: [
                    'generated' => $generated,
                    'skipped'   => $skipped,
                    'errors'    => $errors,
                ],
                message: "Payslips generated: {$generated}, skipped (already exist): {$skipped}",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Generate payslips error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to generate payslips: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/payruns/{payrun_id}/payslips/{id}/send
     * Mark a payslip as sent (generated → sent), notifies the employee.
     * Roles: admin, payroll_manager, payroll_officer, hr_officer (assigned scope)
     */
    public function send(int $orgId, int $payrunId, int $payslipId): mixed
    {
        try {
            $payslip = $this->getPayslipWithValidation($payslipId, $orgId, $payrunId);
            if (!$payslip['success']) return $payslip['data'];

            $payslipData = $payslip['data'];

            if ($payslipData->status !== 'generated') {
                return responseJson(
                    success: false, data: null,
                    message: "Only payslips with status 'generated' can be sent (current: {$payslipData->status})",
                    code: 400
                );
            }

            DB::table('payslips')->update([
                'status'  => 'sent',
                'sent_at' => date('Y-m-d H:i:s'),
            ], 'id', $payslipId);

            // Notify the employee
            $this->createPayslipNotification(
                (int) $payslipData->employee_id,
                $orgId,
                $payslipId,
                'sent'
            );

            return responseJson(
                success: true,
                data: ['payslip_id' => $payslipId, 'status' => 'sent', 'sent_at' => date('Y-m-d H:i:s')],
                message: "Payslip sent successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to send payslip: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/payruns/{payrun_id}/payslips/bulk-send
     * Mark all generated payslips in a payrun as sent.
     * Roles: admin, payroll_manager
     */
    public function bulkSend(int $orgId, int $payrunId): mixed
    {
        try {
            $payrun = $this->getPayrunWithValidation($payrunId, $orgId);
            if (!$payrun['success']) return $payrun['data'];

            $generated = DB::raw(
                "SELECT id, employee_id FROM payslips
                 WHERE payrun_id = :run AND organization_id = :org AND status = 'generated'",
                [':run' => $payrunId, ':org' => $orgId]
            );

            if (empty($generated)) {
                return responseJson(
                    success: false, data: null,
                    message: "No payslips with status 'generated' found in this payrun", code: 404
                );
            }

            $now     = date('Y-m-d H:i:s');
            $sentIds = array_column((array) $generated, 'id');

            DB::raw(
                "UPDATE payslips SET status = 'sent', sent_at = :now
                 WHERE payrun_id = :run AND organization_id = :org AND status = 'generated'",
                [':now' => $now, ':run' => $payrunId, ':org' => $orgId]
            );

            // Notify each employee
            foreach ($generated as $ps) {
                $this->createPayslipNotification(
                    (int) $ps->employee_id,
                    $orgId,
                    (int) $ps->id,
                    'sent'
                );
            }

            return responseJson(
                success: true,
                data: ['sent_count' => count($sentIds), 'payslip_ids' => $sentIds],
                message: count($sentIds) . " payslip(s) sent successfully"
            );
        } catch (\Exception $e) {
            error_log("Bulk send error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to bulk send payslips: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/payslips/{id}/acknowledge
     * Employee acknowledges receipt of their payslip (sent → acknowledged).
     * Roles: employee (own only)
     */
    public function acknowledge(int $orgId, int $payslipId): mixed
    {
        try {
            $payslip = $this->getPayslipWithValidation($payslipId, $orgId);
            if (!$payslip['success']) return $payslip['data'];

            $payslipData = $payslip['data'];

            // Enforce: employee can only acknowledge their own payslip
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();
            if ($payslipData->employee_id != $currentEmployee['id']) {
                return responseJson(
                    success: false, data: null,
                    message: "You can only acknowledge your own payslips", code: 403
                );
            }

            if ($payslipData->status !== 'sent') {
                return responseJson(
                    success: false, data: null,
                    message: "Only payslips with status 'sent' can be acknowledged (current: {$payslipData->status})",
                    code: 400
                );
            }

            DB::table('payslips')->update(['status' => 'acknowledged'], 'id', $payslipId);

            return responseJson(
                success: true,
                data: ['payslip_id' => $payslipId, 'status' => 'acknowledged'],
                message: "Payslip acknowledged successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to acknowledge payslip: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * PATCH /organizations/{org_id}/payslips/{id}/pdf-path
     * Store or update the PDF path after client-side generation.
     * Roles: admin, payroll_manager, payroll_officer
     */
    public function updatePdfPath(int $orgId, int $payslipId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['pdf_path'])) {
                return responseJson(
                    success: false, data: null, message: "pdf_path is required", code: 400
                );
            }

            $payslip = $this->getPayslipWithValidation($payslipId, $orgId);
            if (!$payslip['success']) return $payslip['data'];

            DB::table('payslips')->update(['pdf_path' => $data['pdf_path']], 'id', $payslipId);

            return responseJson(
                success: true,
                data: ['payslip_id' => $payslipId, 'pdf_path' => $data['pdf_path']],
                message: "PDF path updated successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to update PDF path: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/employees/{emp_id}/payslips
     * All payslips for a single employee across all payruns.
     * Roles: admin, payroll_manager, finance_manager, hr_manager, hr_officer (own dept),
     *        dept_manager (own team), employee (own only)
     */
    public function employeePayslips(int $orgId, int $empId): mixed
    {
        try {
            $employeeCheck = DB::raw(
                "SELECT e.*, u.email FROM employees e
                 LEFT JOIN users u ON e.user_id = u.id
                 WHERE e.id = :emp_id AND e.organization_id = :org_id",
                [':emp_id' => $empId, ':org_id' => $orgId]
            );

            if (empty($employeeCheck)) {
                return responseJson(
                    success: false, data: null,
                    message: "Employee not found in this organization", code: 404
                );
            }

            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            // Determine if current user can see this employee's payslips
            $canSeeAll = in_array($currentUser['user_type'], [
                'admin', 'payroll_manager', 'finance_manager', 'auditor', 'hr_manager',
            ]);

            if (!$canSeeAll) {
                if (in_array($currentUser['user_type'], ['hr_officer', 'payroll_officer'])) {
                    $deptIds = $this->getDeptEmployeeIds($currentEmployee['id']);
                    if (!in_array($empId, $deptIds)) {
                        return responseJson(
                            success: false, data: null,
                            message: "Access denied to this employee's payslips", code: 403
                        );
                    }
                } elseif ($currentUser['user_type'] === 'department_manager') {
                    $teamIds = $this->getTeamEmployeeIds($currentEmployee['id']);
                    if (!in_array($empId, $teamIds) && $currentEmployee['id'] != $empId) {
                        return responseJson(
                            success: false, data: null,
                            message: "Access denied to this employee's payslips", code: 403
                        );
                    }
                } elseif ($currentEmployee['id'] != $empId) {
                    return responseJson(
                        success: false, data: null,
                        message: "You can only view your own payslips", code: 403
                    );
                }
            }

            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 12)));
            $offset  = ($page - 1) * $perPage;

            $where  = ["ps.employee_id = :emp_id", "ps.organization_id = :org_id"];
            $params = [':emp_id' => $empId, ':org_id' => $orgId];

            if (isset($_GET['status'])) {
                $where[]             = "ps.status = :f_status";
                $params[':f_status'] = $_GET['status'];
            }
            if (isset($_GET['year'])) {
                $where[]             = "YEAR(pr.pay_period_start) = :f_year";
                $params[':f_year']   = (int) $_GET['year'];
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM payslips ps
                 {$this->payslipJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: true, data: [], message: "No payslips found", code: 200,
                    metadata: [
                        'pagination'    => ['total' => 0],
                        'employee_info' => [
                            'employee_id'   => $empId,
                            'employee_name' => trim(
                                ($employeeCheck[0]->firstname ?? '') . ' ' .
                                ($employeeCheck[0]->surname ?? '')
                            ),
                        ],
                    ]
                );
            }

            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $payslips = DB::raw(
                "SELECT {$this->payslipSelectColumns()}
                 FROM payslips ps
                 {$this->payslipJoins()}
                 $whereClause
                 ORDER BY pr.pay_period_start DESC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            $payslips = array_map(fn($p) => $this->formatPayslip($p), $payslips);

            return responseJson(
                success: true,
                data: array_values($payslips),
                message: "Employee payslips fetched successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => (int) $total,
                        'total_pages'  => (int) ceil($total / $perPage),
                        'has_next'     => $page < ceil($total / $perPage),
                        'has_prev'     => $page > 1,
                    ],
                    'employee_info' => [
                        'employee_id'   => (int) $empId,
                        'employee_name' => trim(
                            ($employeeCheck[0]->firstname ?? '') . ' ' .
                            ($employeeCheck[0]->surname ?? '')
                        ),
                        'email'         => $employeeCheck[0]->email ?? null,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Employee payslips error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch employee payslips", code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/payslips/statistics
     * Aggregate stats grouped by year and status.
     * Roles: admin, payroll_manager, finance_manager, hr_manager, auditor
     */
    public function statistics(int $orgId): mixed
    {
        try {
            $orgCheck = DB::table('organizations')->where(['id' => $orgId])->get();
            if (empty($orgCheck)) {
                return responseJson(success: false, data: null, message: "Organization not found", code: 404);
            }

            $yearFilter = isset($_GET['year']) ? (int) $_GET['year'] : null;

            $where  = ["ps.organization_id = :org_id"];
            $params = [':org_id' => $orgId];

            if ($yearFilter) {
                $where[]           = "YEAR(pr.pay_period_start) = :f_year";
                $params[':f_year'] = $yearFilter;
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $byYear = DB::raw(
                "SELECT
                    YEAR(pr.pay_period_start)                                          AS year,
                    COUNT(*)                                                            AS total_payslips,
                    SUM(CASE WHEN ps.status = 'generated'    THEN 1 ELSE 0 END)        AS generated_count,
                    SUM(CASE WHEN ps.status = 'sent'         THEN 1 ELSE 0 END)        AS sent_count,
                    SUM(CASE WHEN ps.status = 'acknowledged' THEN 1 ELSE 0 END)        AS acknowledged_count,
                    SUM(pd.gross_pay)                                                   AS total_gross_pay,
                    SUM(pd.net_pay)                                                     AS total_net_pay,
                    SUM(pd.total_deductions)                                            AS total_deductions,
                    SUM(pd.paye)                                                        AS total_paye,
                    SUM(pd.nssf)                                                        AS total_nssf,
                    SUM(pd.shif)                                                        AS total_shif,
                    SUM(pd.housing_levy)                                                AS total_housing_levy
                 FROM payslips ps
                 {$this->payslipJoins()}
                 $whereClause
                 GROUP BY YEAR(pr.pay_period_start)
                 ORDER BY year DESC",
                $params
            );

            return responseJson(
                success: true,
                data: $byYear,
                message: "Payslip statistics fetched successfully",
                metadata: ['count' => count($byYear)]
            );
        } catch (\Exception $e) {
            error_log("Payslip stats error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch payslip statistics", code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private function createPayslipNotification(
        int $employeeId,
        int $orgId,
        int $payslipId,
        string $status
    ): void {
        try {
            $messages = [
                'sent'         => "Your payslip has been sent and is ready to view",
                'acknowledged' => "Payslip acknowledged by employee",
            ];

            DB::table('notifications')->insert([
                'employee_id'     => $employeeId,
                'organization_id' => $orgId,
                'title'           => 'Payslip ' . ucfirst($status),
                'message'         => $messages[$status] ?? "Payslip status updated",
                'type'            => 'salary',
                'is_read'         => 0,
                'metadata'        => json_encode(['payslip_id' => $payslipId, 'status' => $status]),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Payslip notification error: " . $e->getMessage());
        }
    }
}