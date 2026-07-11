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
     * Returns the matching public_holidays row for a date, or null.
     * Supports both fixed-date holidays and recurring (MM-DD) holidays.
     */
    public static function getPublicHoliday($orgId, $date)
    {
        $rows = DB::raw(
            "SELECT * FROM public_holidays
             WHERE organization_id = :org_id
               AND is_active = 1
               AND status = 'approved'
               AND applies_to_all = 1
               AND (
                    holiday_date = :exact_date
                    OR (is_recurring = 1 AND DATE_FORMAT(holiday_date, '%m-%d') = DATE_FORMAT(:md_date, '%m-%d'))
               )
             LIMIT 1",
            [
                ':org_id'     => $orgId,
                ':exact_date' => $date,
                ':md_date'    => $date,
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
            $checkOutMinutes = self::minutesSinceMidnight($lastCheckOut);
            $officeEndMin    = self::timeToMinutes($config['end_time']);
            $earlyLeaveMinutes = max(0, $officeEndMin - $checkOutMinutes);
            $overtimeMinutes   = max(0, $checkOutMinutes - $officeEndMin);
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

        return [
            'attendance_day_id'   => $attendanceDayId,
            'check_in_time'       => $firstCheckIn,
            'check_out_time'      => $lastCheckOut,
            'worked_minutes'      => $workedMinutes,
            'scheduled_minutes'   => $scheduledMinutes,
            'overtime_minutes'    => $overtimeMinutes,
            'late_minutes'        => $lateMinutes,
            'early_leave_minutes' => $earlyLeaveMinutes,
            'is_public_holiday'   => $isHoliday,
            'is_weekend'          => $isWeekend,
            'status'              => $status,
            'approval_status'     => $approvalStatus,
            'salary_included'     => $salaryIncluded,
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