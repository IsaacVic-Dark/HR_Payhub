<?php

namespace App\Services;

/**
 * AdvanceRecoveryService
 *
 * Pure calculation of how much of an advance is recovered in one payrun.
 * All maths is on integer cents (see Money).
 *
 *   equal   : min(balance, round(amount_approved / number_of_recoveries, 2))
 *   custom  : advance_payrun_lines.scheduled_amount
 *   safety  : min(recovery, balance, max recovery that keeps projected net pay
 *             >= minimum_net_pay_after_recovery)
 *
 * Rounding true-up: on the FINAL scheduled instalment of an equal schedule
 * the whole remaining balance is recovered, so rounding never strands a few
 * cents (e.g. 25,000 / 3 => 8,333.33 + 8,333.33 + 8,333.34).
 */
class AdvanceRecoveryService
{
    public const MODE_EQUAL  = 'equal';
    public const MODE_CUSTOM = 'custom';

    /**
     * @param array $advance          advances row (array)
     * @param array $line             advance_payrun_lines row (array)
     * @param int   $availableNetCents projected net pay BEFORE this recovery
     *                                 (gross - statutory - other deductions - earlier recoveries)
     * @param array $settings         policy settings
     * @param int   $processedCount   number of this advance's lines already processed
     *
     * @return array ['amount_cents'=>int, 'requested_cents'=>int, 'capped'=>bool,
     *                'skipped'=>bool, 'mode'=>string, 'max_safe_cents'=>int,
     *                'projected_net_cents'=>int]
     * @throws AdvanceException when the cap bites and partial recovery is not allowed
     */
    public function calculate(array $advance, array $line, int $availableNetCents, array $settings, int $processedCount): array
    {
        $balance  = Money::toCents($advance['balance_remaining']);
        $approved = Money::toCents($advance['amount_approved']);
        $meta     = $this->meta($advance);
        $mode     = $meta['recovery_mode'] ?? self::MODE_EQUAL;

        if ($mode === self::MODE_CUSTOM) {
            $planned = Money::toCents($line['scheduled_amount']);
        } else {
            $n       = max(1, (int) ($advance['number_of_recoveries'] ?: 1));
            $planned = min($balance, Money::divRound($approved, $n));
            if ($processedCount + 1 >= $n) {
                $planned = $balance; // final instalment sweeps rounding residue
            }
        }

        $requested = min($planned, $balance);

        $minNet  = Money::toCents($settings['minimum_net_pay_after_recovery'] ?? 0);
        $maxSafe = max(0, $availableNetCents - $minNet);

        $amount = min($requested, $maxSafe);
        $capped = $amount < $requested;

        if ($capped && empty($settings['allow_partial_recovery'])) {
            throw new AdvanceException(
                sprintf(
                    'Advance %s: recovery of KES %s would reduce projected net pay (KES %s) below the minimum net pay of KES %s and partial recovery is not allowed',
                    $advance['advance_number'],
                    Money::display($requested),
                    Money::display($availableNetCents),
                    Money::display($minNet)
                ),
                422,
                ['advance_id' => (int) $advance['id']]
            );
        }

        return [
            'amount_cents'        => max(0, $amount),
            'requested_cents'     => $requested,
            'capped'              => $capped,
            'skipped'             => $amount <= 0,
            'mode'                => $mode,
            'max_safe_cents'      => $maxSafe,
            'projected_net_cents' => $availableNetCents - max(0, $amount),
        ];
    }

    /** Scheduled amount shown on a line when attached in equal mode. */
    public function equalInstalment(array $advance): int
    {
        $n = max(1, (int) ($advance['number_of_recoveries'] ?: 1));
        return min(
            Money::toCents($advance['balance_remaining']),
            Money::divRound(Money::toCents($advance['amount_approved']), $n)
        );
    }

    private function meta(array $advance): array
    {
        $m = $advance['metadata'] ?? null;
        if (is_string($m)) {
            $m = json_decode($m, true);
        }
        return is_array($m) ? $m : [];
    }
}