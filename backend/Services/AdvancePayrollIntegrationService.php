<?php

namespace App\Services;

/**
 * AdvancePayrollIntegrationService
 *
 * Called by PayrunProcessingService::processEmployee(), which runs inside ONE
 * database transaction per employee. Three steps per employee:
 *
 *   1. rollbackForReprocess() - draft payrun being reprocessed: undo what this
 *      payrun previously applied so nothing is double-counted.
 *   2. prepare()              - read attached lines, calculate recoveries
 *      against projected net pay. Returns the total to add to deductions.
 *      (Advance recovery is a post-tax deduction: it never touches taxable
 *      income, PAYE, NSSF, SHIF or Housing Levy.)
 *   3. apply()                - after payrun_details exists: write
 *      payrun_deductions, advance_repayments, update the advance and mark the
 *      line processed, with audit logs.
 *
 * If the payrun is no longer draft (reviewed), the ledger is never touched;
 * the already-applied recoveries are simply carried into the deduction rows
 * so a recompute does not drop them.
 */
class AdvancePayrollIntegrationService
{
    private AdvanceService $advances;
    private AdvancePolicyService $policy;
    private AdvanceRecoveryService $recovery;
    private array $settingsCache = [];

    public function __construct()
    {
        $this->advances = new AdvanceService();
        $this->policy   = new AdvancePolicyService();
        $this->recovery = new AdvanceRecoveryService();
    }

    private function payrunStatus(int $orgId, int $payrunId): ?string
    {
        $r = DB::raw('SELECT status FROM payruns WHERE id = :id AND organization_id = :o', [':id' => $payrunId, ':o' => $orgId]);
        return $r[0]->status ?? null;
    }

    private function settingsFor(int $orgId, int $configId): array
    {
        if (!isset($this->settingsCache[$configId])) {
            $p = $this->policy->getPolicy($orgId, $configId) ?? $this->policy->getPolicy($orgId);
            $this->settingsCache[$configId] = $p['settings'] ?? AdvancePolicyService::DEFAULTS;
        }
        return $this->settingsCache[$configId];
    }

    // -------------------------------------------------------------------------
    // 1. Reprocess rollback (draft payruns only)
    // -------------------------------------------------------------------------

    public function rollbackForReprocess(int $orgId, int $payrunId, int $employeeId, int $userId): void
    {
        if ($this->payrunStatus($orgId, $payrunId) !== 'draft') {
            return; // reviewed payruns keep their ledger
        }

        $lines = DB::raw(
            "SELECT * FROM advance_payrun_lines
              WHERE organization_id = :o AND payrun_id = :p AND employee_id = :e AND status = 'processed'",
            [':o' => $orgId, ':p' => $payrunId, ':e' => $employeeId]
        );

        foreach ($lines as $line) {
            $adv = $this->advances->find($orgId, (int) $line->advance_id, true);
            if (!$adv) continue;

            $reps = DB::raw(
                "SELECT * FROM advance_repayments
                  WHERE advance_id = :a AND payrun_id = :p AND method = 'payroll_deduction' AND status = 'applied'
                  FOR UPDATE",
                [':a' => (int) $adv['id'], ':p' => $payrunId]
            );

            $undo = 0;
            foreach ($reps as $rep) {
                $undo += Money::toCents($rep->amount);
                DB::table('advance_repayments')->update([
                    'status' => 'reversed',
                    'notes'  => trim(($rep->notes ?? '') . ' [reversed: payrun reprocessed]'),
                ], 'id', (int) $rep->id);
            }

            $recovered = Money::toCents($adv['amount_recovered']) - $undo;
            $balance   = Money::toCents($adv['amount_approved']) - $recovered;
            $status    = AdvanceService::statusFor($balance, $recovered);

            DB::table('advances')->update([
                'amount_recovered'  => Money::format($recovered),
                'balance_remaining' => Money::format($balance),
                'status'            => $status,
                'updated_by'        => $userId,
            ], 'id', (int) $adv['id']);
            DB::table('advance_payrun_lines')->update(['status' => 'attached', 'processed_at' => null], 'id', (int) $line->id);

            AdvanceService::writeAudit($orgId, $userId, 'advance', (int) $adv['id'], 'advance_reversed', [
                'reason'            => 'payrun_reprocess',
                'payrun_id'         => $payrunId,
                'old_status'        => $adv['status'],
                'new_status'        => $status,
                'amount_reversed'   => Money::format($undo),
                'balance_remaining' => Money::format($balance),
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // 2. Prepare
    // -------------------------------------------------------------------------

    /**
     * @param int $netBeforeAdvanceCents projected net pay before any advance recovery
     * @return array ['mode'=>'new'|'carry', 'total'=>float, 'items'=>[['config_id','amount']], 'plans'=>[...]]
     */
    public function prepare(int $orgId, int $payrunId, int $employeeId, int $userId, int $netBeforeAdvanceCents): array
    {
        $empty = ['mode' => 'new', 'total' => 0.0, 'items' => [], 'plans' => []];

        // Non-draft payrun: carry already-applied recoveries, never touch the ledger.
        if ($this->payrunStatus($orgId, $payrunId) !== 'draft') {
            return $this->carry($orgId, $payrunId, $employeeId);
        }

        $lines = DB::raw(
            "SELECT * FROM advance_payrun_lines
              WHERE organization_id = :o AND payrun_id = :p AND employee_id = :e AND status = 'attached'
              ORDER BY id ASC",
            [':o' => $orgId, ':p' => $payrunId, ':e' => $employeeId]
        );
        if (empty($lines)) {
            return $empty;
        }

        $available = max(0, $netBeforeAdvanceCents);
        $items = []; $plans = []; $totalCents = 0;

        foreach ($lines as $line) {
            $adv = $this->advances->find($orgId, (int) $line->advance_id, true);

            if (!$adv || !in_array($adv['status'], ['disbursed', 'partially_recovered'], true)) {
                $this->failLine($orgId, $userId, $line, $adv,
                    'Advance is not in a recoverable status' . ($adv ? " ({$adv['status']})" : ' (not found)'));
                continue;
            }

            $settings = $this->settingsFor($orgId, (int) $adv['policy_config_id']);
            $processed = (int) (DB::raw(
                "SELECT COUNT(*) AS c FROM advance_payrun_lines WHERE advance_id = :a AND status = 'processed'",
                [':a' => (int) $adv['id']])[0]->c ?? 0);

            // May throw AdvanceException (partial recovery disallowed) -> employee's transaction rolls back.
            $calc = $this->recovery->calculate((array) $adv, (array) $line, $available, $settings, $processed);

            if ($calc['skipped']) {
                $this->failLine($orgId, $userId, $line, $adv,
                    'No safe recovery amount: projected net pay is at or below the minimum net pay');
                continue;
            }

            $available  -= $calc['amount_cents'];
            $totalCents += $calc['amount_cents'];
            $items[] = ['config_id' => (int) $adv['policy_config_id'], 'amount' => (float) Money::format($calc['amount_cents'])];
            $plans[] = [
                'line'  => (array) $line,
                'calc'  => $calc,
                'advance_id' => (int) $adv['id'],
            ];
        }

        return ['mode' => 'new', 'total' => (float) Money::format($totalCents), 'items' => $items, 'plans' => $plans];
    }

    private function carry(int $orgId, int $payrunId, int $employeeId): array
    {
        $rows = DB::raw(
            "SELECT r.amount, a.policy_config_id
               FROM advance_repayments r
               INNER JOIN advances a ON a.id = r.advance_id
              WHERE r.organization_id = :o AND r.payrun_id = :p AND r.employee_id = :e
                AND r.method = 'payroll_deduction' AND r.status = 'applied'",
            [':o' => $orgId, ':p' => $payrunId, ':e' => $employeeId]
        );
        $items = []; $total = 0;
        foreach ($rows as $r) {
            $total += Money::toCents($r->amount);
            $items[] = ['config_id' => (int) $r->policy_config_id, 'amount' => (float) $r->amount];
        }
        return ['mode' => 'carry', 'total' => (float) Money::format($total), 'items' => $items, 'plans' => []];
    }

    private function failLine(int $orgId, int $userId, object $line, ?array $adv, string $reason): void
    {
        DB::table('advance_payrun_lines')->update(['status' => 'failed'], 'id', (int) $line->id);
        AdvanceService::writeAudit($orgId, $userId, 'advance', (int) $line->advance_id, 'advance_recovery_skipped', [
            'payrun_id'        => (int) $line->payrun_id,
            'line_id'          => (int) $line->id,
            'reason'           => $reason,
            'scheduled_amount' => $line->scheduled_amount,
            'advance_status'   => $adv['status'] ?? null,
        ]);
    }

    // -------------------------------------------------------------------------
    // 3. Apply
    // -------------------------------------------------------------------------

    /**
     * Write deduction rows, ledger rows and advance updates. Call AFTER the
     * payrun_details row exists and the old payrun_deductions were cleared.
     */
    public function apply(array $prepared, int $detailId, int $orgId, int $payrunId, int $employeeId, int $userId, string $periodEnd): void
    {
        // Carry mode: just re-create the deduction rows.
        if ($prepared['mode'] === 'carry') {
            foreach ($prepared['items'] as $item) {
                if ($item['amount'] > 0) {
                    DB::table('payrun_deductions')->insert([
                        'payrun_detail_id' => $detailId,
                        'config_id'        => $item['config_id'],
                        'amount'           => $item['amount'],
                    ]);
                }
            }
            return;
        }

        foreach ($prepared['plans'] as $i => $plan) {
            $cents = $plan['calc']['amount_cents'];
            $adv   = $this->advances->find($orgId, $plan['advance_id'], true);

            // 5. one payrun_deductions row, using the advance policy config_id
            DB::table('payrun_deductions')->insert([
                'payrun_detail_id' => $detailId,
                'config_id'        => (int) $adv['policy_config_id'],
                'amount'           => Money::format($cents),
            ]);

            // 6-7, 9, 11. repayment row, advance update, audit logs, repaid notification
            $this->advances->recordRepayment($adv, $cents, 'payroll_deduction', $userId, [
                'payrun_id'        => $payrunId,
                'payrun_detail_id' => $detailId,
                'date'             => $periodEnd,
                'notes'            => 'Payroll recovery (' . $plan['calc']['mode'] . ')'
                    . ($plan['calc']['capped'] ? ' - reduced to keep minimum net pay' : ''),
            ]);

            // 8. mark the line processed
            DB::table('advance_payrun_lines')->update([
                'status'       => 'processed',
                'processed_at' => date('Y-m-d H:i:s'),
            ], 'id', (int) $plan['line']['id']);
        }
    }
}