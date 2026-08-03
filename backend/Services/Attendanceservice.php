<?php

namespace App\Services;

/**
 * AttendanceService
 * ------------------
 * Central place for attendance business rules so controllers stay thin.
 *
 *  - Office hours are org-wide, sourced from organization_configs
 *    (config_type = 'attendance', name = 'Office Hours').
 *  - Recomputes a single employee_attendance_days row from its raw punches.
 *  - Creates overtime_approvals rows automatically when overtime is detected.
 *  - Public holiday work is tracked via employee_attendance_days.approval_status
 *    (a separate "holiday work" approval, distinct from overtime approval).
 */
class AttendanceService
{
    /** Fallback config used only if the org has no 'Office Hours' row yet. */
    private const DEFAULT_CONFIG = [
        'start_time'    => '08:00:00',
        'end_time'      => '17:00:00',
        'grace_minutes' => 0,
        // ISO-8601 day-of-week numbers: 1=Mon ... 7=Sun
        'workdays'      => [1, 2, 3, 4, 5],
    ];

    /**
     * Fetch the org-wide office hours config from organization_configs.
     * config_type='attendance', name='Office Hours', settings = JSON blob.
     */
    public static function getOfficeHoursConfig($orgId)
    {
        $rows = DB::raw(
            "SELECT settings FROM organization_configs
             WHERE organization_id = :org_id
               AND config_type = 'attendance'
               AND name = 'Office Hours'
               AND is_active = 1
               AND status = 'approved'
             LIMIT 1",
            [':org_id' => $orgId]
        );

        if (empty($rows) || empty($rows[0]->settings)) {
            return self::DEFAULT_CONFIG;
        }

        $settings = json_decode($rows[0]->settings, true);
        if (!is_array($settings)) {
            return self::DEFAULT_CONFIG;
        }

        return array_merge(self::DEFAULT_CONFIG, array_filter($settings, fn($v) => $v !== null));
    }

    /**
     * Create the default 'Office Hours' config row for an org if one doesn't exist yet.
     * Called by OrganizationConfigController-style setup, or lazily on first use.
     */
    public static function ensureOfficeHoursConfig($orgId, array $settings, $createdBy = null)
    {
        $merged = array_merge(self::DEFAULT_CONFIG, $settings);

        DB::raw(
            "INSERT INTO organization_configs
                (organization_id, config_type, name, settings, status, created_by, is_active)
             VALUES
                (:org_id, 'attendance', 'Office Hours', :settings, 'approved', :created_by, 1)
             ON DUPLICATE KEY UPDATE
                settings = VALUES(settings),
                updated_at = NOW()",
            [
                ':org_id'     => $orgId,
                ':settings'   => json_encode($merged),
                ':created_by' => $createdBy,
            ]
        );

        return $merged;
    }

    public static function isWorkday($date, array $config)
    {
        $dow = (int) date('N', strtotime($date));
        return in_array($dow, array_map('intval', $config['workdays']), true);
    }

    /**
     * Returns the matching org_public_holidays row for a date, or null.
     * org_public_holidays already holds the resolved, org-scoped holiday
     * list (master overrides + custom org holidays), so no join back to
     * public_holidays_master is needed here. Note: unlike the old
     * public_holidays table, this schema has no is_recurring flag — a
     * holiday only matches on its exact stored date, and there is no
     * separate approval workflow (is_active is the only gate).
     */
    public static function getPublicHoliday($orgId, $date)
    {
        $rows = DB::raw(
            "SELECT * FROM org_public_holidays
             WHERE organization_id = :org_id
               AND is_active = 1
               AND holiday_date = :exact_date
             LIMIT 1",
            [
                ':org_id'     => $orgId,
                ':exact_date' => $date,
            ]
        );

        return $rows[0] ?? null;
    }

    private static function minutesSinceMidnight($datetime)
    {
        return (int) ((strtotime($datetime) - strtotime(date('Y-m-d', strtotime($datetime)))) / 60);
    }

    private static function timeToMinutes($time)
    {
        [$h, $m] = array_map('intval', explode(':', $time));
        return ($h * 60) + $m;
    }

    /**
     * Recompute an employee_attendance_days row from scratch using all
     * active, non-rejected punches for that employee/date. Safe to call
     * repeatedly (idempotent) — used after check-in, check-out, manual
     * punch creation, and after any adjustment.
     *
     * Returns the computed array of column values that were written.
     */
    public static function recomputeDay($orgId, $employeeId, $date, $actorUserId = null)
    {
        $punches = DB::raw(
            "SELECT * FROM employee_attendance_punches
             WHERE organization_id = :org_id
               AND employee_id = :employee_id
               AND attendance_date = :date
               AND is_active = 1
               AND status != 'rejected'
             ORDER BY punch_time ASC",
            [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
        );

        $firstCheckIn  = null;
        $lastCheckOut  = null;
        $usedPunchIds  = [];

        foreach ($punches as $p) {
            $usedPunchIds[] = (int) $p->id;
            if ($p->punch_type === 'check_in' && $firstCheckIn === null) {
                $firstCheckIn = $p->punch_time;
            }
            if ($p->punch_type === 'check_out') {
                $lastCheckOut = $p->punch_time; // keep the latest check_out
            }
        }

        $config     = self::getOfficeHoursConfig($orgId);
        $isWorkday  = self::isWorkday($date, $config);
        $holiday    = self::getPublicHoliday($orgId, $date);
        $isHoliday  = $holiday !== null;
        $isWeekend  = !$isWorkday;

        $workedMinutes     = 0;
        $scheduledMinutes  = ($isWorkday && !$isHoliday)
            ? max(0, self::timeToMinutes($config['end_time']) - self::timeToMinutes($config['start_time']))
            : 0;
        $lateMinutes       = 0;
        $earlyLeaveMinutes = 0;
        $overtimeMinutes   = 0;

        if ($firstCheckIn && $lastCheckOut && strtotime($lastCheckOut) > strtotime($firstCheckIn)) {
            $workedMinutes = (int) round((strtotime($lastCheckOut) - strtotime($firstCheckIn)) / 60);
        }

        if ($firstCheckIn && $isWorkday && !$isHoliday) {
            $checkInMinutes = self::minutesSinceMidnight($firstCheckIn);
            $graceEnd       = self::timeToMinutes($config['start_time']) + (int) $config['grace_minutes'];
            $lateMinutes    = max(0, $checkInMinutes - $graceEnd);
        }

        if ($lastCheckOut && $isWorkday && !$isHoliday) {
            $checkOutMinutes     = self::minutesSinceMidnight($lastCheckOut);
            $officeEndMin        = self::timeToMinutes($config['end_time']);
            $graceMinutes        = (int) $config['grace_minutes'];
            $earlyLeaveThreshold = $officeEndMin - $graceMinutes;

            // Only counts as early leave once they're out past the grace window —
            // e.g. checking out 10 min early with a 15-min grace period is fine.
            $earlyLeaveMinutes = max(0, $earlyLeaveThreshold - $checkOutMinutes);

            // Overtime is unaffected by grace — it's measured against the exact
            // scheduled end time, not the grace-adjusted one.
            $overtimeMinutes   = max(0, $checkOutMinutes - $officeEndMin);
        } elseif ($workedMinutes > 0 && !$isWorkday && !$isHoliday) {
            // Work performed on a day the employee isn't scheduled to work at all
            // (e.g. a weekend). There's no office start/end time to compare
            // against here, so the entire worked duration is overtime — unlike
            // the branch above, which only counts minutes *past* the scheduled
            // end time. Without this branch, scheduledMinutes is already 0 for
            // non-workdays, so overtimeMinutes silently stayed 0 no matter how
            // long the employee worked, and no overtime_approvals row was ever
            // raised for it.
            $overtimeMinutes = $workedMinutes;
        }

        // Determine status
        if (empty($punches)) {
            $status = $isHoliday ? 'holiday' : ($isWeekend ? 'absent' : 'absent');
        } elseif ($isHoliday) {
            $status = 'holiday';
        } elseif ($firstCheckIn && !$lastCheckOut) {
            $status = 'partial';
        } else {
            $status = 'present';
        }

        // Approval routing:
        //  - Overtime on a normal working day requires overtime approval.
        //  - Any work performed on a public holiday requires a separate
        //    "holiday work" approval before that day's pay is included.
        $needsHolidayApproval = $isHoliday && $workedMinutes > 0;
        $approvalStatus = 'not_required';
        if ($needsHolidayApproval) {
            $approvalStatus = 'pending';
        } elseif ($overtimeMinutes > 0) {
            $approvalStatus = 'pending';
        }

        // Regular (non-holiday, non-overtime) attendance auto-processes into
        // payroll as soon as the day is computed. Holiday-worked days are
        // withheld from payroll until approved.
        $salaryIncluded = $needsHolidayApproval ? 0 : 1;

        $sourceSummary = json_encode([
            'punch_ids'   => $usedPunchIds,
            'computed_at' => date('c'),
        ]);

        DB::raw(
            "INSERT INTO employee_attendance_days
                (organization_id, employee_id, attendance_date, check_in_time, check_out_time,
                 worked_minutes, scheduled_minutes, overtime_minutes, late_minutes, early_leave_minutes,
                 is_public_holiday, is_weekend, status, approval_status, salary_included,
                 source_summary, created_by)
             VALUES
                (:org_id, :employee_id, :date, :check_in, :check_out,
                 :worked, :scheduled, :overtime, :late, :early,
                 :is_holiday, :is_weekend, :status, :approval_status, :salary_included,
                 :source_summary, :created_by)
             ON DUPLICATE KEY UPDATE
                check_in_time = VALUES(check_in_time),
                check_out_time = VALUES(check_out_time),
                worked_minutes = VALUES(worked_minutes),
                scheduled_minutes = VALUES(scheduled_minutes),
                overtime_minutes = VALUES(overtime_minutes),
                late_minutes = VALUES(late_minutes),
                early_leave_minutes = VALUES(early_leave_minutes),
                is_public_holiday = VALUES(is_public_holiday),
                is_weekend = VALUES(is_weekend),
                status = VALUES(status),
                approval_status = VALUES(approval_status),
                salary_included = VALUES(salary_included),
                source_summary = VALUES(source_summary),
                updated_at = NOW()",
            [
                ':org_id'          => $orgId,
                ':employee_id'     => $employeeId,
                ':date'            => $date,
                ':check_in'        => $firstCheckIn,
                ':check_out'       => $lastCheckOut,
                ':worked'          => $workedMinutes,
                ':scheduled'       => $scheduledMinutes,
                ':overtime'        => $overtimeMinutes,
                ':late'            => $lateMinutes,
                ':early'           => $earlyLeaveMinutes,
                ':is_holiday'      => $isHoliday ? 1 : 0,
                ':is_weekend'      => $isWeekend ? 1 : 0,
                ':status'          => $status,
                ':approval_status' => $approvalStatus,
                ':salary_included' => $salaryIncluded,
                ':source_summary'  => $sourceSummary,
                ':created_by'      => $actorUserId,
            ]
        );

        $dayRow = DB::raw(
            "SELECT id FROM employee_attendance_days
             WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date
             LIMIT 1",
            [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
        );
        $attendanceDayId = $dayRow[0]->id ?? null;

        // Sync overtime_approvals: create a pending request when overtime exists
        // and none exists yet for this day; do not overwrite an already-decided one.
        if ($attendanceDayId && $overtimeMinutes > 0) {
            self::ensureOvertimeApprovalRequest($orgId, $attendanceDayId, $employeeId, $overtimeMinutes, $actorUserId);
        }

        // Lateness/early-leave deduction only applies on a normal scheduled
        // workday — holiday-work pay is a separate approval path entirely.
        $attendanceDeduction = null;
        if ($attendanceDayId && $isWorkday && !$isHoliday) {
            $attendanceDeduction = self::calculateAttendanceDeduction(
                $orgId,
                $employeeId,
                $attendanceDayId,
                $date,
                $lateMinutes,
                $earlyLeaveMinutes,
                $scheduledMinutes,
                $actorUserId
            );
        }

        return [
            'attendance_day_id'    => $attendanceDayId,
            'check_in_time'        => $firstCheckIn,
            'check_out_time'       => $lastCheckOut,
            'worked_minutes'       => $workedMinutes,
            'scheduled_minutes'    => $scheduledMinutes,
            'overtime_minutes'     => $overtimeMinutes,
            'late_minutes'         => $lateMinutes,
            'early_leave_minutes'  => $earlyLeaveMinutes,
            'is_public_holiday'    => $isHoliday,
            'is_weekend'           => $isWeekend,
            'status'               => $status,
            'approval_status'      => $approvalStatus,
            'salary_included'      => $salaryIncluded,
            'attendance_deduction' => $attendanceDeduction,
        ];
    }

    /**
     * Fetch the org's lateness/early-leave deduction policy from
     * organization_configs (config_type='attendance'):
     *   - 'Lateness Deduction Policy'          (value_text) no_deduction | per_minute | daily_rate | leave_balance
     *   - 'Lateness Deduction Leave Type'      (value_text) leave_types.code to debit (leave_balance policy only)
     *   - 'Lateness Leave Conversion Tiers'    (settings JSON) [{min_minutes, leave_days}, ...]
     */
    public static function getAttendanceDeductionPolicy($orgId)
    {
        $rows = DB::raw(
            "SELECT name, value_text, settings FROM organization_configs
             WHERE organization_id = :org_id
               AND config_type = 'attendance'
               AND name IN ('Lateness Deduction Policy', 'Lateness Deduction Leave Type', 'Lateness Leave Conversion Tiers')
               AND is_active = 1
               AND status = 'approved'",
            [':org_id' => $orgId]
        );

        $policy = [
            'policy'          => 'no_deduction',
            'leave_type_code' => 'ANNUAL',
            'tiers'           => [],
        ];

        foreach ($rows as $row) {
            if ($row->name === 'Lateness Deduction Policy' && $row->value_text) {
                $policy['policy'] = $row->value_text;
            } elseif ($row->name === 'Lateness Deduction Leave Type' && $row->value_text) {
                $policy['leave_type_code'] = $row->value_text;
            } elseif ($row->name === 'Lateness Leave Conversion Tiers' && $row->settings) {
                $tiers = json_decode($row->settings, true);
                if (is_array($tiers)) {
                    // Sort highest threshold first so resolveLeaveDaysFromTiers()
                    // returns the largest tier the minutes actually clear.
                    usort($tiers, fn($a, $b) => $b['min_minutes'] <=> $a['min_minutes']);
                    $policy['tiers'] = $tiers;
                }
            }
        }

        return $policy;
    }

    /**
     * Picks the leave-day equivalent for a given number of billable minutes,
     * using the highest tier threshold the minutes clear. Returns 0 if the
     * minutes don't reach even the lowest configured tier.
     */
    private static function resolveLeaveDaysFromTiers(int $billableMinutes, array $tiers): float
    {
        foreach ($tiers as $tier) {
            if ($billableMinutes >= (int) $tier['min_minutes']) {
                return (float) $tier['leave_days'];
            }
        }
        return 0.0;
    }

    /**
     * Computes and persists the lateness/early-leave deduction for one
     * attendance day, according to the org's active policy. Called from
     * recomputeDay() immediately after late/early-leave minutes are known.
     *
     * Idempotent like the rest of recomputeDay(), but only touches rows that
     * are still 'pending'. A deduction already realized into a payrun (cash)
     * or already debited from leave_balances/waived (leave_balance) is left
     * untouched — a later attendance correction on that day needs manual HR
     * reconciliation rather than silently rewriting pay or leave history.
     *
     * Rate convention: daily_rate = base_salary / 30 (fixed org-wide divisor,
     * not the actual count of working days in the calendar month).
     */
    public static function calculateAttendanceDeduction(
        $orgId,
        $employeeId,
        $attendanceDayId,
        $date,
        int $lateMinutes,
        int $earlyLeaveMinutes,
        int $scheduledMinutes,
        $actorUserId = null
    ) {
        if (!$attendanceDayId) {
            return null;
        }

        $billableMinutes = $lateMinutes + $earlyLeaveMinutes;

        // On time, or grace absorbed the whole gap — nothing to record.
        if ($billableMinutes <= 0) {
            return null;
        }

        $existing = DB::raw(
            "SELECT id, status FROM attendance_deductions
             WHERE organization_id = :org_id AND attendance_day_id = :day_id
             
             LIMIT 1",
            [':org_id' => $orgId, ':day_id' => $attendanceDayId]
        );

        // Already realized into a payrun, already debited from leave, or
        // manually waived by HR — leave it alone. A later correction to this
        // day's punches must not silently rewrite pay/leave already actioned.
        if (!empty($existing) && $existing[0]->status !== 'pending') {
            error_log(
                "attendance_deductions #{$existing[0]->id} for day #{$attendanceDayId} is " .
                    "'{$existing[0]->status}' — skipping recompute; needs manual HR review if punches changed."
            );
            return null;
        }

        $policy = self::getAttendanceDeductionPolicy($orgId);

        $employeeRow = DB::raw(
            "SELECT base_salary FROM employees WHERE id = :id LIMIT 1",
            [':id' => $employeeId]
        );
        $baseSalary = (float) ($employeeRow[0]->base_salary ?? 0);

        // Fixed 30-day divisor per org convention.
        $workingDaysInMonth = 30;
        $dailyRate  = $workingDaysInMonth > 0 ? $baseSalary / $workingDaysInMonth : 0.0;
        $minuteRate = $scheduledMinutes > 0 ? $dailyRate / $scheduledMinutes : 0.0;

        $rateSnapshot = [
            'base_salary'           => $baseSalary,
            'working_days_in_month' => $workingDaysInMonth,
            'daily_rate'            => round($dailyRate, 4),
            'minute_rate'           => round($minuteRate, 4),
            'scheduled_minutes'     => $scheduledMinutes,
            'policy'                => $policy['policy'],
        ];

        $cashAmount        = 0.0;
        $leaveDaysDeducted = 0.0;
        $leaveTypeId       = null;
        $status            = 'applied';
        $waivedReason      = null;

        switch ($policy['policy']) {
            case 'per_minute':
                $cashAmount = round($billableMinutes * $minuteRate, 2);
                $status     = 'pending'; // realized into payrun_deductions at payroll time
                break;

            case 'daily_rate':
                // Any billable lateness/early-leave past grace marks the
                // whole day unpaid — not prorated by minutes.
                $cashAmount = round($dailyRate, 2);
                $status     = 'pending';
                break;

            case 'leave_balance':
                $leaveDaysDeducted = self::resolveLeaveDaysFromTiers($billableMinutes, $policy['tiers']);

                if ($leaveDaysDeducted > 0) {
                    $leaveType = DB::raw(
                        "SELECT id, allow_negative_balance FROM leave_types
                         WHERE organization_id = :org_id AND code = :code AND is_active = 1 LIMIT 1",
                        [':org_id' => $orgId, ':code' => $policy['leave_type_code']]
                    );

                    if (empty($leaveType)) {
                        // Misconfigured org — no matching leave type. Don't block attendance processing.
                        $leaveDaysDeducted = 0.0;
                        $status       = 'waived';
                        $waivedReason = "Configured leave type code '{$policy['leave_type_code']}' not found";
                        break;
                    }

                    $leaveTypeId   = (int) $leaveType[0]->id;
                    $allowNegative = (bool) $leaveType[0]->allow_negative_balance;
                    $currentYear   = (int) date('Y', strtotime($date));

                    $balanceRow = DB::raw(
                        "SELECT (entitled_days + accrued_days + carried_over - used_days - pending_days) AS available_days
                         FROM leave_balances
                         WHERE employee_id = :emp AND leave_type_id = :type AND leave_year = :year LIMIT 1",
                        [':emp' => $employeeId, ':type' => $leaveTypeId, ':year' => $currentYear]
                    );
                    $available = !empty($balanceRow) ? (float) $balanceRow[0]->available_days : 0.0;

                    if (!$allowNegative && $leaveDaysDeducted > $available) {
                        // Per org policy: skip the deduction, flag for HR review
                        // (no cash fallback, no negative balance).
                        $leaveDaysDeducted = 0.0;
                        $status       = 'waived';
                        $waivedReason = "Insufficient Annual Leave balance ({$available} available) — flagged for HR review";
                    } else {
                        DB::raw(
                            "UPDATE leave_balances
                             SET used_days = used_days + :days, updated_at = NOW()
                             WHERE employee_id = :emp AND leave_type_id = :type AND leave_year = :year",
                            [':days' => $leaveDaysDeducted, ':emp' => $employeeId, ':type' => $leaveTypeId, ':year' => $currentYear]
                        );
                        $status = 'applied';
                    }
                } else {
                    // Billable minutes didn't reach even the lowest tier —
                    // logged for audit, no balance change.
                    $status = 'applied';
                }
                break;

            case 'no_deduction':
            default:
                // Logged for HR visibility only; cash_amount/leave_days stay 0.
                $status = 'applied';
                break;
        }

        $params = [
            ':org_id'        => $orgId,
            ':employee_id'   => $employeeId,
            ':day_id'        => $attendanceDayId,
            ':date'          => $date,
            ':late'          => $lateMinutes,
            ':early'         => $earlyLeaveMinutes,
            ':billable'      => $billableMinutes,
            ':policy'        => $policy['policy'] === 'no_deduction' ? 'none' : $policy['policy'],
            ':cash'          => $cashAmount,
            ':leave_type'    => $leaveTypeId,
            ':leave_days'    => $leaveDaysDeducted,
            ':snapshot'      => json_encode($rateSnapshot),
            ':status'        => $status,
            ':waived_reason' => $waivedReason,
            ':created_by'    => $actorUserId,
        ];

        if (!empty($existing)) {
            DB::raw(
                "UPDATE attendance_deductions SET
                    late_minutes = :late, early_leave_minutes = :early, billable_minutes = :billable,
                    policy_applied = :policy, cash_amount = :cash, leave_type_id = :leave_type,
                    leave_days_deducted = :leave_days, rate_snapshot = :snapshot, status = :status,
                    waived_reason = :waived_reason, updated_at = NOW()
                 WHERE id = :id",
                array_merge($params, [':id' => $existing[0]->id])
            );
        } else {
            DB::raw(
                "INSERT INTO attendance_deductions
                    (organization_id, employee_id, attendance_day_id, deduction_date, late_minutes,
                     early_leave_minutes, billable_minutes, policy_applied, cash_amount, leave_type_id,
                     leave_days_deducted, rate_snapshot, status, waived_reason, created_by)
                 VALUES
                    (:org_id, :employee_id, :day_id, :date, :late,
                     :early, :billable, :policy, :cash, :leave_type,
                     :leave_days, :snapshot, :status, :waived_reason, :created_by)",
                $params
            );
        }

        return [
            'policy_applied'      => $policy['policy'],
            'cash_amount'         => $cashAmount,
            'leave_days_deducted' => $leaveDaysDeducted,
            'status'              => $status,
            'waived_reason'       => $waivedReason,
        ];
    }

    /**
     * Insert a pending overtime_approvals row if one doesn't already exist
     * for this attendance day, or refresh the minutes on an existing
     * still-pending row (e.g. employee stayed even later on a re-checkout).
     * Never touches a row that has already been approved/rejected.
     */
    private static function ensureOvertimeApprovalRequest($orgId, $attendanceDayId, $employeeId, $overtimeMinutes, $requestedBy)
    {
        $existing = DB::raw(
            "SELECT id, status FROM overtime_approvals
             WHERE organization_id = :org_id AND attendance_day_id = :day_id AND employee_id = :employee_id
             LIMIT 1",
            [':org_id' => $orgId, ':day_id' => $attendanceDayId, ':employee_id' => $employeeId]
        );

        if (!empty($existing)) {
            if ($existing[0]->status === 'pending') {
                DB::raw(
                    "UPDATE overtime_approvals SET overtime_minutes = :minutes, updated_at = NOW()
                     WHERE id = :id",
                    [':minutes' => $overtimeMinutes, ':id' => $existing[0]->id]
                );
            }
            return;
        }

        DB::raw(
            "INSERT INTO overtime_approvals
                (organization_id, attendance_day_id, employee_id, overtime_minutes, requested_by, status)
             VALUES
                (:org_id, :day_id, :employee_id, :minutes, :requested_by, 'pending')",
            [
                ':org_id'       => $orgId,
                ':day_id'       => $attendanceDayId,
                ':employee_id'  => $employeeId,
                ':minutes'      => $overtimeMinutes,
                ':requested_by' => $requestedBy,
            ]
        );
    }

    /**
     * Write an audit-log row to attendance_adjustments capturing a before/after
     * snapshot of an employee_attendance_days row.
     */
    public static function logAdjustment($orgId, $attendanceDayId, $type, $oldValue, $newValue, $reason, $createdBy, $status = 'approved')
    {
        DB::raw(
            "INSERT INTO attendance_adjustments
                (organization_id, attendance_day_id, adjustment_type, old_value, new_value, reason, created_by, status)
             VALUES
                (:org_id, :day_id, :type, :old_value, :new_value, :reason, :created_by, :status)",
            [
                ':org_id'     => $orgId,
                ':day_id'     => $attendanceDayId,
                ':type'       => $type,
                ':old_value'  => json_encode($oldValue),
                ':new_value'  => json_encode($newValue),
                ':reason'     => $reason,
                ':created_by' => $createdBy,
                ':status'     => $status,
            ]
        );
    }
}