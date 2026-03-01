<?php

namespace App\Services;

require_once __DIR__ . '/../helpers/tax.php';

/**
 * PayrunProcessingService
 *
 * Processes all employees for a given payrun in a single operation.
 *
 * Workflow:
 *  1. Load organisation tax config from organization_configs
 *  2. Fetch all active employees in the organisation
 *  3. For each employee:
 *     a. Gather basic salary, overtime, bonuses, commissions
 *     b. Pull in-period benefits (allowances, per diems, refunds) → add to gross
 *     c. Pull in-period voluntary deductions (loans, advances, Sacco) → extra deductions
 *     d. Calculate gross pay, NSSF, SHIF, Housing Levy, PAYE, net pay
 *     e. Upsert payrun_details row
 *     f. Insert payrun_deductions rows per config item
 *  4. Update payrun totals (total_gross_pay, total_deductions, total_net_pay, employee_count)
 *  5. Write audit log
 */
class PayrunProcessingService
{
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Process an entire payrun.
     *
     * @param  int   $orgId      Organisation ID
     * @param  int   $payrunId   Payrun ID (must be in 'draft' or 'reviewed' status)
     * @param  int   $userId     ID of the user triggering the process
     * @return array  Summary: employee_count, total_gross, total_deductions, total_net, errors[]
     */
    public function process(int $orgId, int $payrunId, int $userId): array
    {
        // 1. Load payrun header
        $payrun = $this->getPayrun($payrunId, $orgId);

        if (!$payrun) {
            throw new \RuntimeException("Payrun #$payrunId not found for organisation #$orgId");
        }

        if ($payrun->status === 'finalized') {
            throw new \RuntimeException("Payrun #$payrunId is already finalised and cannot be reprocessed");
        }

        // 2. Load statutory rates from organization_configs
        $taxConfig = loadTaxConfig($orgId);

        // 3. Load all voluntary/org deduction configs (loans, advances, Sacco, benefit, per_diem)
        $deductionConfigs = $this->getDeductionConfigs($orgId);

        // 4. Load all active employees
        $employees = $this->getActiveEmployees($orgId);

        if (empty($employees)) {
            throw new \RuntimeException("No active employees found for organisation #$orgId");
        }

        $summary = [
            'employee_count'   => 0,
            'total_gross'      => 0.0,
            'total_deductions' => 0.0,
            'total_net'        => 0.0,
            'errors'           => [],
        ];

        // 5. Process each employee
        foreach ($employees as $employee) {
            try {
                $result = $this->processEmployee(
                    $employee,
                    $payrun,
                    $taxConfig,
                    $deductionConfigs,
                    $orgId
                );

                $summary['employee_count']++;
                $summary['total_gross']      += $result['gross_pay'];
                $summary['total_deductions'] += $result['total_deductions'];
                $summary['total_net']        += $result['net_pay'];
            } catch (\Exception $e) {
                $summary['errors'][] = [
                    'employee_id'     => $employee->id,
                    'employee_number' => $employee->employee_number,
                    'error'           => $e->getMessage(),
                ];
                error_log("Payrun #$payrunId – employee #{$employee->id} error: " . $e->getMessage());
            }
        }

        // 6. Update payrun header totals
        DB::table('payruns')->update(
            [
                'employee_count'   => $summary['employee_count'],
                'total_gross_pay'  => round($summary['total_gross'], 2),
                'total_deductions' => round($summary['total_deductions'], 2),
                'total_net_pay'    => round($summary['total_net'], 2),
                'status'           => 'reviewed',
                'reviewed_by'      => $userId,
                'reviewed_at'      => date('Y-m-d H:i:s'),
            ],
            'id',
            $payrunId
        );

        // 7. Audit log
        $this->audit($orgId, $userId, 'payruns', $payrunId, 'update', [
            'action'  => 'process_payrun',
            'summary' => $summary,
        ]);

        return $summary;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function getPayrun(int $payrunId, int $orgId): ?object
    {
        $rows = DB::raw(
            "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id",
            [':id' => $payrunId, ':org_id' => $orgId]
        );

        return $rows[0] ?? null;
    }

    private function getActiveEmployees(int $orgId): array
    {
        return DB::raw(
            "SELECT 
                e.id,
                e.employee_number,
                e.base_salary,
                e.hire_date,
                e.job_title,
                e.department,
                e.bank_account_number,
                e.tax_id,
                e.employment_type,
                u.first_name,
                u.middle_name,
                u.surname,
                u.email,
                ep.national_id,
                ep.kra_pin,
                ep.nssf_number,
                ep.shif_number
             FROM employees e
             INNER JOIN users u ON e.user_id = u.id
             LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
             WHERE e.organization_id = :org_id
               AND e.status IN ('active', 'on_probation')",
            [':org_id' => $orgId]
        );
    }

    /**
     * Get all approved, active deduction/benefit configs for the organisation
     * (excludes 'tax' configs — those are handled by loadTaxConfig)
     */
    private function getDeductionConfigs(int $orgId): array
    {
        $rows = DB::raw(
            "SELECT * FROM organization_configs
              WHERE organization_id = :org_id
                AND config_type IN ('deduction','loan','advance','benefit','per_diem','refund')
                AND is_active = 1
                AND status = 'approved'",
            [':org_id' => $orgId]
        );

        $indexed = [];
        foreach ($rows as $row) {
            $indexed[$row->id] = $row;
        }

        return $indexed;
    }

    /**
     * Process a single employee: calculate all earnings and deductions,
     * write payrun_details and payrun_deductions rows.
     */
    private function processEmployee(
        object $employee,
        object $payrun,
        array  $taxConfig,
        array  $deductionConfigs,
        int    $orgId
    ): array {
        $periodStart = $payrun->pay_period_start;
        $periodEnd   = $payrun->pay_period_end;
        $employeeId  = $employee->id;

        // --- Earnings ---
        $basicSalary     = (float) $employee->base_salary;
        $overtimeAmount  = $this->getOvertimeAmount($employeeId, $periodStart, $periodEnd);
        $bonusAmount     = $this->getBenefitAmount($employeeId, $periodStart, $periodEnd, 'bonus', $orgId);
        $commissionAmount = 0.0; // extend here if you track commissions separately

        // Benefits that add to gross (allowances, per diems)
        $benefitsAmount  = $this->getApprovedBenefitsTotal($employeeId, $periodStart, $periodEnd);
        $perDiemAmount   = $this->getApprovedPerDiemsTotal($employeeId, $periodStart, $periodEnd);

        $grossPay = $basicSalary + $overtimeAmount + $bonusAmount + $commissionAmount
                  + $benefitsAmount + $perDiemAmount;

        // --- Voluntary/org deductions ---
        $loanDeductions    = $this->getLoanInstalment($employeeId, $periodStart, $periodEnd, $deductionConfigs);
        $advanceDeductions = $this->getAdvanceDeduction($employeeId, $periodStart, $periodEnd, $deductionConfigs);
        $extraDeductions   = $loanDeductions['total'] + $advanceDeductions['total'];

        // --- Statutory calculations ---
        $calc = calculateNetPay($basicSalary, $grossPay, $taxConfig, $extraDeductions);

        // --- Upsert payrun_details ---
        $existingDetail = DB::raw(
            "SELECT id FROM payrun_details WHERE payrun_id = :pr AND employee_id = :emp",
            [':pr' => $payrun->id, ':emp' => $employeeId]
        );

        $detailData = [
            'payrun_id'        => $payrun->id,
            'employee_id'      => $employeeId,
            'basic_salary'     => $calc['basic_salary'],
            'overtime_amount'  => round($overtimeAmount, 2),
            'bonus_amount'     => round($bonusAmount + $benefitsAmount + $perDiemAmount, 2),
            'commission_amount'=> round($commissionAmount, 2),
            'gross_pay'        => $calc['gross_pay'],
            'total_deductions' => $calc['total_deductions'],
            'net_pay'          => $calc['net_pay'],
        ];

        if (!empty($existingDetail)) {
            $detailId = $existingDetail[0]->id;
            DB::table('payrun_details')->update($detailData, 'id', $detailId);

            // Remove old deduction lines so we can re-insert cleanly
            DB::raw(
                "DELETE FROM payrun_deductions WHERE payrun_detail_id = :id",
                [':id' => $detailId]
            );
        } else {
            DB::table('payrun_details')->insert($detailData);
            $detailId = DB::lastInsertId();
        }

        // --- Insert payrun_deductions rows ---
        $this->insertStatutoryDeductions($detailId, $calc, $orgId);
        $this->insertVoluntaryDeductions($detailId, $loanDeductions['items']);
        $this->insertVoluntaryDeductions($detailId, $advanceDeductions['items']);

        return $calc;
    }

    // -------------------------------------------------------------------------
    // Earnings helpers
    // -------------------------------------------------------------------------

    /**
     * Overtime: extend this to read from a timesheets or overtime_records table.
     * For now returns 0 unless you already have an overtime table.
     */
    private function getOvertimeAmount(int $employeeId, string $start, string $end): float
    {
        // TODO: replace with actual overtime query when timesheet module is ready
        // Example:
        // SELECT SUM(amount) FROM overtime_records
        // WHERE employee_id = :emp AND record_date BETWEEN :start AND :end AND status = 'approved'
        return 0.0;
    }

    /**
     * Approved benefits (allowances) for the pay period.
     */
    private function getApprovedBenefitsTotal(int $employeeId, string $start, string $end): float
    {
        $rows = DB::raw(
            "SELECT COALESCE(SUM(b.amount), 0) as total
               FROM benefits b
               INNER JOIN organization_configs oc ON b.config_id = oc.id
              WHERE b.employee_id = :emp
                AND b.date_granted BETWEEN :start AND :end
                AND oc.config_type = 'benefit'",
            [':emp' => $employeeId, ':start' => $start, ':end' => $end]
        );

        return (float) ($rows[0]->total ?? 0);
    }

    /**
     * Approved per diems for the pay period.
     */
    private function getApprovedPerDiemsTotal(int $employeeId, string $start, string $end): float
    {
        $rows = DB::raw(
            "SELECT COALESCE(SUM(amount), 0) as total
               FROM per_diems
              WHERE employee_id = :emp
                AND trip_date BETWEEN :start AND :end
                AND status = 'approved'",
            [':emp' => $employeeId, ':start' => $start, ':end' => $end]
        );

        return (float) ($rows[0]->total ?? 0);
    }

    /**
     * Bonus amounts stored as benefits with config_type-specific naming.
     * Adjust the 'name' filter to match your actual config naming.
     */
    private function getBenefitAmount(
        int    $employeeId,
        string $start,
        string $end,
        string $configName,
        int    $orgId
    ): float {
        $rows = DB::raw(
            "SELECT COALESCE(SUM(b.amount), 0) as total
               FROM benefits b
               INNER JOIN organization_configs oc ON b.config_id = oc.id
              WHERE b.employee_id = :emp
                AND b.date_granted BETWEEN :start AND :end
                AND oc.organization_id = :org
                AND LOWER(oc.name) LIKE :name",
            [
                ':emp'   => $employeeId,
                ':start' => $start,
                ':end'   => $end,
                ':org'   => $orgId,
                ':name'  => '%' . strtolower($configName) . '%',
            ]
        );

        return (float) ($rows[0]->total ?? 0);
    }

    // -------------------------------------------------------------------------
    // Deduction helpers
    // -------------------------------------------------------------------------

    /**
     * Loan repayment instalments due within the pay period.
     * Returns ['total' => float, 'items' => [['config_id'=>, 'amount'=>], ...]]
     */
    private function getLoanInstalment(
        int   $employeeId,
        string $start,
        string $end,
        array  $configs
    ): array {
        $rows = DB::raw(
            "SELECT l.config_id,
                    oc.fixed_amount as instalment,
                    oc.percentage   as instalment_pct,
                    e.base_salary
               FROM loans l
               INNER JOIN organization_configs oc ON l.config_id = oc.id
               INNER JOIN employees e ON e.id = l.employee_id
              WHERE l.employee_id = :emp
                AND l.status = 'approved'
                AND l.start_date <= :end
                AND (l.end_date IS NULL OR l.end_date >= :start)",
            [':emp' => $employeeId, ':start' => $start, ':end' => $end]
        );

        $items = [];
        $total = 0.0;

        foreach ($rows as $row) {
            $amount = $row->instalment !== null
                ? (float) $row->instalment
                : (float) $row->base_salary * ((float) $row->instalment_pct / 100);
            $items[] = ['config_id' => $row->config_id, 'amount' => round($amount, 2)];
            $total   += $amount;
        }

        return ['total' => $total, 'items' => $items];
    }

    /**
     * Advance repayment deductions within the pay period.
     */
    private function getAdvanceDeduction(
        int    $employeeId,
        string $start,
        string $end,
        array  $configs
    ): array {
        $rows = DB::raw(
            "SELECT a.config_id,
                    oc.fixed_amount as deduct_amount
               FROM advances a
               INNER JOIN organization_configs oc ON a.config_id = oc.id
              WHERE a.employee_id = :emp
                AND a.status = 'approved'
                AND a.request_date <= :end",
            [':emp' => $employeeId, ':end' => $end]
        );

        $items = [];
        $total = 0.0;

        foreach ($rows as $row) {
            $amount  = (float) ($row->deduct_amount ?? 0);
            $items[] = ['config_id' => $row->config_id, 'amount' => round($amount, 2)];
            $total   += $amount;
        }

        return ['total' => $total, 'items' => $items];
    }

    // -------------------------------------------------------------------------
    // payrun_deductions helpers
    // -------------------------------------------------------------------------

    /**
     * Write the 5 statutory deduction rows (NSSF, SHIF, Housing Levy, PAYE, Personal Relief offset)
     * by matching them to organization_configs of type 'tax'.
     */
    private function insertStatutoryDeductions(int $detailId, array $calc, int $orgId): void
    {
        // Map calculation keys → expected config names in organization_configs
        $statutory = [
            'NSSF Rate'         => $calc['nssf'],
            'SHIF Rate'         => $calc['shif'],
            'Housing Levy Rate' => $calc['housing_levy'],
            'Personal Relief'   => $calc['personal_relief'],  // recorded as relief given
            // PAYE is a derived figure; store it against a 'PAYE' config if present
        ];

        foreach ($statutory as $configName => $amount) {
            if ($amount <= 0) continue;

            $config = DB::raw(
                "SELECT id FROM organization_configs
                  WHERE organization_id = :org
                    AND config_type = 'tax'
                    AND name = :name
                    AND is_active = 1
                  LIMIT 1",
                [':org' => $orgId, ':name' => $configName]
            );

            if (!empty($config)) {
                DB::table('payrun_deductions')->insert([
                    'payrun_detail_id' => $detailId,
                    'config_id'        => $config[0]->id,
                    'amount'           => round($amount, 2),
                ]);
            }
        }

        // PAYE — store if 'PAYE' config exists, else just rely on payrun_details.total_deductions
        $payeConfig = DB::raw(
            "SELECT id FROM organization_configs
              WHERE organization_id = :org AND config_type = 'tax' AND name = 'PAYE' AND is_active = 1 LIMIT 1",
            [':org' => $orgId]
        );

        if (!empty($payeConfig) && $calc['paye'] > 0) {
            DB::table('payrun_deductions')->insert([
                'payrun_detail_id' => $detailId,
                'config_id'        => $payeConfig[0]->id,
                'amount'           => round($calc['paye'], 2),
            ]);
        }
    }

    /**
     * Write voluntary deduction rows (loans, advances, etc.).
     */
    private function insertVoluntaryDeductions(int $detailId, array $items): void
    {
        foreach ($items as $item) {
            if ($item['amount'] <= 0) continue;
            DB::table('payrun_deductions')->insert([
                'payrun_detail_id' => $detailId,
                'config_id'        => $item['config_id'],
                'amount'           => $item['amount'],
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // Audit log
    // -------------------------------------------------------------------------

    private function audit(
        int    $orgId,
        int    $userId,
        string $entity,
        int    $entityId,
        string $action,
        array  $details
    ): void {
        try {
            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id'         => $userId,
                'entity_type'     => $entity,
                'entity_id'       => $entityId,
                'action'          => $action,
                'details'         => json_encode($details),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Audit log failed: " . $e->getMessage());
        }
    }
}