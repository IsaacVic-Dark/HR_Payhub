<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\AttendanceService;
use App\Services\EmployeeService;
use App\Middleware\AuthMiddleware;

class AttendanceController
{
    /**
     * POST /api/v1/organizations/{org_id}/attendance/check-in
     * Employee self-service check-in. Also usable by biometric middleware
     * relaying a device punch for the *currently authenticated* employee.
     */
    public function checkIn($orgId)
    {
        try {
            $employee = AuthMiddleware::getCurrentEmployee();
            $user     = AuthMiddleware::getCurrentUser();

            if (!$employee) {
                return responseJson(success: false, message: "No employee record for current user", code: 400);
            }

            $data = validate([
                'source'    => 'string',
                'device_id' => 'string',
                'remarks'   => 'string',
            ]);

            return $this->recordPunch($orgId, (int) $employee['id'], 'check_in', [
                'source'    => $data['source'] ?? 'api',
                'device_id' => $data['device_id'] ?? null,
                'remarks'   => $data['remarks'] ?? null,
            ], (int) $user['id']);
        } catch (\Exception $e) {
            error_log("Attendance check-in error: " . $e->getMessage());
            return responseJson(success: false, message: "Check-in failed: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/attendance/check-out
     */
    public function checkOut($orgId)
    {
        try {
            $employee = AuthMiddleware::getCurrentEmployee();
            $user     = AuthMiddleware::getCurrentUser();

            if (!$employee) {
                return responseJson(success: false, message: "No employee record for current user", code: 400);
            }

            $data = validate([
                'source'    => 'string',
                'device_id' => 'string',
                'remarks'   => 'string',
            ]);

            return $this->recordPunch($orgId, (int) $employee['id'], 'check_out', [
                'source'    => $data['source'] ?? 'api',
                'device_id' => $data['device_id'] ?? null,
                'remarks'   => $data['remarks'] ?? null,
            ], (int) $user['id']);
        } catch (\Exception $e) {
            error_log("Attendance check-out error: " . $e->getMessage());
            return responseJson(success: false, message: "Check-out failed: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/employees/{employee_id}/attendance/manual
     * HR / biometric-device-integration entry point. Accepts an explicit
     * punch_time so it can backfill biometric payloads or HR corrections.
     */
    public function manualPunch($orgId, $employeeId)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();

            $data = validate([
                'punch_type'  => 'required,string',
                'punch_time'  => 'required,string',
                'source'      => 'string',
                'device_id'   => 'string',
                'remarks'     => 'string',
                'reason'      => 'required,string',
            ]);

            if (!in_array($data['punch_type'], ['check_in', 'check_out'], true)) {
                return responseJson(success: false, message: "punch_type must be check_in or check_out", code: 400);
            }

            $punchTime = date('Y-m-d H:i:s', strtotime($data['punch_time']));
            if (!$punchTime) {
                return responseJson(success: false, message: "Invalid punch_time", code: 400);
            }

            $result = $this->recordPunch($orgId, (int) $employeeId, $data['punch_type'], [
                'source'     => $data['source'] ?? 'manual',
                'device_id'  => $data['device_id'] ?? null,
                'remarks'    => $data['remarks'] ?? $data['reason'],
                'punch_time' => $punchTime,
            ], (int) $user['id']);

            return $result;
        } catch (\Exception $e) {
            error_log("Manual punch error: " . $e->getMessage());
            return responseJson(success: false, message: "Manual punch failed: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * Shared punch-recording logic for both self-service and manual/biometric entry.
     */
    private function recordPunch($orgId, $employeeId, $punchType, array $opts, $createdBy)
    {
        if (!$this->employeeBelongsToOrg($employeeId, $orgId)) {
            return responseJson(success: false, message: "Employee not found in this organization", code: 404);
        }

        $punchTime = $opts['punch_time'] ?? date('Y-m-d H:i:s');
        $date      = date('Y-m-d', strtotime($punchTime));

        // Prevent invalid sequences: no check-in while already checked-in-and-not-out,
        // and no check-out without an open check-in for the day.
        $openState = $this->getOpenPunchState($orgId, $employeeId, $date);

        if ($punchType === 'check_in' && $openState === 'checked_in') {
            return responseJson(success: false, message: "Employee is already checked in today. Check out first.", code: 409);
        }

        if ($punchType === 'check_out' && $openState !== 'checked_in') {
            return responseJson(success: false, message: "No open check-in found for today. Cannot check out.", code: 409);
        }

        DB::raw(
            "INSERT INTO employee_attendance_punches
                (organization_id, employee_id, attendance_date, punch_type, punch_time,
                 source, device_id, remarks, created_by, status)
             VALUES
                (:org_id, :employee_id, :date, :punch_type, :punch_time,
                 :source, :device_id, :remarks, :created_by, 'approved')",
            [
                ':org_id'      => $orgId,
                ':employee_id' => $employeeId,
                ':date'        => $date,
                ':punch_type'  => $punchType,
                ':punch_time'  => $punchTime,
                ':source'      => $opts['source'] ?? 'api',
                ':device_id'   => $opts['device_id'] ?? null,
                ':remarks'     => $opts['remarks'] ?? null,
                ':created_by'  => $createdBy,
            ]
        );

        // Real-time processing: recompute the day's summary immediately,
        // which also raises an overtime_approvals request if applicable.
        $summary = AttendanceService::recomputeDay($orgId, $employeeId, $date, $createdBy);

        return responseJson(
            success: true,
            data: array_merge(['employee_id' => $employeeId, 'attendance_date' => $date], $summary),
            message: $punchType === 'check_in' ? "Checked in successfully" : "Checked out successfully",
            code: 200
        );
    }

    private function getOpenPunchState($orgId, $employeeId, $date)
    {
        $rows = DB::raw(
            "SELECT check_in_time, check_out_time FROM employee_attendance_days
             WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date
             LIMIT 1",
            [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
        );

        if (empty($rows)) {
            return 'none';
        }

        if ($rows[0]->check_in_time && !$rows[0]->check_out_time) {
            return 'checked_in';
        }

        return 'closed';
    }

    private function employeeBelongsToOrg($employeeId, $orgId)
    {
        $rows = DB::raw(
            "SELECT id FROM employees WHERE id = :id AND organization_id = :org_id LIMIT 1",
            [':id' => $employeeId, ':org_id' => $orgId]
        );
        return !empty($rows);
    }

    /**
     * GET /api/v1/organizations/{org_id}/attendance
     * List/summary of attendance days with filters. Row-level scoping
     * (own-only / team-only) is applied by AttendanceAuthorizationMiddleware
     * upstream; here we additionally honour any employee_id filter passed.
     */
    public function index($orgId)
    {
        try {
            if (!is_numeric($orgId)) {
                return responseJson(success: false, message: "Invalid organization ID", code: 400);
            }

            $filters = [
                'employee_id'   => $_GET['employee_id']   ?? null,
                'department_id' => $_GET['department_id'] ?? null,
                'status'        => $_GET['status']        ?? null,
                'date_from'     => $_GET['date_from']     ?? null,
                'date_to'       => $_GET['date_to']       ?? null,
            ];

            // Dashboard-counts day: defaults to today, independently
            // overridable via ?date= regardless of the list's date_from/date_to.
            $dashboardDate = $_GET['date'] ?? date('Y-m-d');

            $query  = "SELECT ad.*, e.firstname, e.middlename, e.surname, e.employee_number,
                              JSON_OBJECT('id', jt.id, 'title', jt.title) AS job_title
                       FROM employee_attendance_days ad
                       JOIN employees e ON ad.employee_id = e.id
                       LEFT JOIN job_titles jt ON e.job_title_id = jt.id
                       WHERE ad.organization_id = :org_id";
            $params = [':org_id' => $orgId];

            if (!empty($filters['employee_id'])) {
                $query .= " AND ad.employee_id = :employee_id";
                $params[':employee_id'] = $filters['employee_id'];
            }
            if (!empty($filters['department_id'])) {
                $query .= " AND e.department_id = :department_id";
                $params[':department_id'] = $filters['department_id'];
            }
            if (!empty($filters['status'])) {
                $query .= " AND ad.status = :status";
                $params[':status'] = $filters['status'];
            }
            if (!empty($filters['date_from'])) {
                $query .= " AND ad.attendance_date >= :date_from";
                $params[':date_from'] = $filters['date_from'];
            }
            if (!empty($filters['date_to'])) {
                $query .= " AND ad.attendance_date <= :date_to";
                $params[':date_to'] = $filters['date_to'];
            }

            $query .= " ORDER BY ad.attendance_date DESC, e.surname ASC";

            $days = DB::raw($query, $params);

            // MySQL JSON_OBJECT() comes back as a JSON string via PDO — decode it,
            // and null out job_title entirely when the employee has no job_title_id.
            foreach ($days as $day) {
                $jobTitle = json_decode($day->job_title, true);
                $day->job_title = ($jobTitle && $jobTitle['id'] !== null) ? $jobTitle : null;
            }

            $counts = $this->getDashboardCounts(
                $orgId,
                $dashboardDate,
                $filters['department_id'],
                $filters['employee_id']
            );

            return responseJson(
                success: true,
                data: $days,
                message: "Fetched " . count($days) . " attendance day(s)",
                metadata: array_merge(
                    ['filters' => $filters, 'total' => count($days), 'dashboard_date' => $dashboardDate],
                    $counts
                ),
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Attendance index error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch attendance: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * Builds the single-day dashboard tile counts for the attendance list view.
     * Scoped to the same department_id / employee_id filters as the list itself.
     *
     *  - total_employees: currently-employed headcount (via EmployeeService)
     *  - present_count: anyone with a check_in_time recorded for the day
     *  - on_leave_count: distinct employees on an approved leave covering the day
     *  - absent_count: employee_attendance_days rows explicitly marked 'absent'
     *    (only exists for days a row was created — see note on real-time processing)
     *  - late_count: employee_attendance_days rows with late_minutes > 0
     */
    private function getDashboardCounts($orgId, $date, $departmentId = null, $employeeId = null)
    {
        $totalEmployees = EmployeeService::countEmployees($orgId, $departmentId, $employeeId);

        $baseParams = [':org_id' => $orgId, ':date' => $date];
        $employeeFilterSql = '';
        if (!empty($employeeId)) {
            $employeeFilterSql .= " AND ad.employee_id = :employee_id";
            $baseParams[':employee_id'] = $employeeId;
        }
        $departmentFilterSql = '';
        if (!empty($departmentId)) {
            $departmentFilterSql = " AND e.department_id = :department_id";
            $baseParams[':department_id'] = $departmentId;
        }

        $present = DB::raw(
            "SELECT COUNT(*) as count FROM employee_attendance_days ad
             JOIN employees e ON ad.employee_id = e.id
             WHERE ad.organization_id = :org_id AND ad.attendance_date = :date
               AND ad.check_in_time IS NOT NULL" . $employeeFilterSql . $departmentFilterSql,
            $baseParams
        );

        $absent = DB::raw(
            "SELECT COUNT(*) as count FROM employee_attendance_days ad
             JOIN employees e ON ad.employee_id = e.id
             WHERE ad.organization_id = :org_id AND ad.attendance_date = :date
               AND ad.status = 'absent'" . $employeeFilterSql . $departmentFilterSql,
            $baseParams
        );

        $late = DB::raw(
            "SELECT COUNT(*) as count FROM employee_attendance_days ad
             JOIN employees e ON ad.employee_id = e.id
             WHERE ad.organization_id = :org_id AND ad.attendance_date = :date
               AND ad.late_minutes > 0" . $employeeFilterSql . $departmentFilterSql,
            $baseParams
        );

        $onLeaveParams = [':org_id' => $orgId, ':date' => $date];
        $onLeaveEmployeeFilterSql = '';
        if (!empty($employeeId)) {
            $onLeaveEmployeeFilterSql .= " AND l.employee_id = :employee_id";
            $onLeaveParams[':employee_id'] = $employeeId;
        }
        $onLeaveDepartmentFilterSql = '';
        if (!empty($departmentId)) {
            $onLeaveDepartmentFilterSql = " AND e.department_id = :department_id";
            $onLeaveParams[':department_id'] = $departmentId;
        }

        $onLeave = DB::raw(
            "SELECT COUNT(DISTINCT l.employee_id) as count FROM leaves l
             JOIN employees e ON l.employee_id = e.id
             WHERE l.organization_id = :org_id AND l.status = 'approved'
               AND :date BETWEEN l.start_date AND l.end_date"
                . $onLeaveEmployeeFilterSql . $onLeaveDepartmentFilterSql,
            $onLeaveParams
        );

        return [
            'total_employees'    => $totalEmployees,
            'present_count'      => (int) ($present[0]->count ?? 0),
            'on_leave_count'     => (int) ($onLeave[0]->count ?? 0),
            'absent_count'       => (int) ($absent[0]->count ?? 0),
            'late_count'         => (int) ($late[0]->count ?? 0),
        ];
    }

    /**
     * GET /api/v1/organizations/{org_id}/employees/{employee_id}/attendance/{date}
     * Full detail for one employee/day: computed summary + raw punches + adjustments.
     */
    public function show($orgId, $employeeId, $date)
    {
        try {
            if (!$this->employeeBelongsToOrg($employeeId, $orgId)) {
                return responseJson(success: false, message: "Employee not found in this organization", code: 404);
            }

            $day = DB::raw(
                "SELECT * FROM employee_attendance_days
                 WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date
                 LIMIT 1",
                [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
            );

            $punches = DB::raw(
                "SELECT * FROM employee_attendance_punches
                 WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date
                 ORDER BY punch_time ASC",
                [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
            );

            $adjustments = [];
            if (!empty($day)) {
                $adjustments = DB::raw(
                    "SELECT * FROM attendance_adjustments WHERE attendance_day_id = :day_id ORDER BY created_at DESC",
                    [':day_id' => $day[0]->id]
                );
            }

            $overtime = [];
            if (!empty($day)) {
                $overtime = DB::raw(
                    "SELECT * FROM overtime_approvals WHERE attendance_day_id = :day_id LIMIT 1",
                    [':day_id' => $day[0]->id]
                );
            }

            if (empty($day)) {
                return responseJson(
                    success: true,
                    data: [
                        'summary'     => null,
                        'punches'     => $punches,
                        'adjustments' => [],
                        'overtime'    => null,
                    ],
                    message: "No attendance recorded for this date",
                    code: 200
                );
            }

            return responseJson(
                success: true,
                data: [
                    'summary'     => $day[0],
                    'punches'     => $punches,
                    'adjustments' => $adjustments,
                    'overtime'    => $overtime[0] ?? null,
                ],
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Attendance show error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch attendance detail: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * PUT /api/v1/organizations/{org_id}/employees/{employee_id}/attendance/{date}
     * HR correction of a day's check-in/check-out. Fully audit-logged via
     * attendance_adjustments, then the day is recomputed from the corrected punches.
     */
    public function adjustDay($orgId, $employeeId, $date)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();

            $data = validate([
                'check_in_time'  => 'string',
                'check_out_time' => 'string',
                'reason'         => 'required,string',
            ]);

            if (empty($data['check_in_time']) && empty($data['check_out_time'])) {
                return responseJson(success: false, message: "Provide at least one of check_in_time or check_out_time", code: 400);
            }

            if (!$this->employeeBelongsToOrg($employeeId, $orgId)) {
                return responseJson(success: false, message: "Employee not found in this organization", code: 404);
            }

            $existing = DB::raw(
                "SELECT * FROM employee_attendance_days
                 WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date
                 LIMIT 1",
                [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
            );
            $oldValue = $existing[0] ?? null;

            DB::transaction(function () use ($orgId, $employeeId, $date, $data, $user, $oldValue) {
                // Correct/insert the underlying punch rows so recomputeDay() reflects the edit.
                if (!empty($data['check_in_time'])) {
                    $this->upsertCorrectedPunch($orgId, $employeeId, $date, 'check_in', $data['check_in_time'], $user['id']);
                }
                if (!empty($data['check_out_time'])) {
                    $this->upsertCorrectedPunch($orgId, $employeeId, $date, 'check_out', $data['check_out_time'], $user['id']);
                }

                $newSummary = AttendanceService::recomputeDay($orgId, $employeeId, $date, $user['id']);

                $dayRow = DB::raw(
                    "SELECT id FROM employee_attendance_days
                     WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date LIMIT 1",
                    [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
                );

                AttendanceService::logAdjustment(
                    $orgId,
                    $dayRow[0]->id,
                    $oldValue ? 'edit' : 'late_entry',
                    $oldValue,
                    $newSummary,
                    $data['reason'],
                    $user['id']
                );
            });

            $updated = DB::raw(
                "SELECT * FROM employee_attendance_days
                 WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date LIMIT 1",
                [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
            );

            return responseJson(success: true, data: $updated[0] ?? null, message: "Attendance day corrected", code: 200);
        } catch (\Exception $e) {
            error_log("Attendance adjust error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to correct attendance: " . $e->getMessage(), code: 500);
        }
    }

    private function upsertCorrectedPunch($orgId, $employeeId, $date, $punchType, $time, $createdBy)
    {
        $normalizedTime = date('Y-m-d H:i:s', strtotime($time));

        // Deactivate prior punches of the same type for the day, then insert
        // the corrected one — keeps a full history instead of destructive UPDATE.
        DB::raw(
            "UPDATE employee_attendance_punches
             SET is_active = 0
             WHERE organization_id = :org_id AND employee_id = :employee_id
               AND attendance_date = :date AND punch_type = :punch_type AND is_active = 1",
            [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date, ':punch_type' => $punchType]
        );

        DB::raw(
            "INSERT INTO employee_attendance_punches
                (organization_id, employee_id, attendance_date, punch_type, punch_time, source, created_by, status)
             VALUES
                (:org_id, :employee_id, :date, :punch_type, :punch_time, 'manual', :created_by, 'approved')",
            [
                ':org_id'      => $orgId,
                ':employee_id' => $employeeId,
                ':date'        => $date,
                ':punch_type'  => $punchType,
                ':punch_time'  => $normalizedTime,
                ':created_by'  => $createdBy,
            ]
        );
    }

    /**
     * POST /api/v1/organizations/{org_id}/employees/{employee_id}/attendance/{date}/approve-holiday-work
     * Approves pay for a day worked on a public holiday. Distinct from
     * overtime approval — holiday work is withheld from payroll until
     * a manager/HR explicitly authorizes it.
     */
    public function approveHolidayWork($orgId, $employeeId, $date)
    {
        return $this->decideHolidayWork($orgId, $employeeId, $date, true);
    }

    /**
     * POST /api/v1/organizations/{org_id}/employees/{employee_id}/attendance/{date}/reject-holiday-work
     */
    public function rejectHolidayWork($orgId, $employeeId, $date)
    {
        return $this->decideHolidayWork($orgId, $employeeId, $date, false);
    }

    private function decideHolidayWork($orgId, $employeeId, $date, $approve)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();
            $data = validate(['notes' => 'string']);

            $day = DB::raw(
                "SELECT * FROM employee_attendance_days
                 WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date
                 LIMIT 1",
                [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
            );

            if (empty($day)) {
                return responseJson(success: false, message: "No attendance record for this date", code: 404);
            }

            if (!$day[0]->is_public_holiday) {
                return responseJson(success: false, message: "This day is not flagged as a public holiday", code: 400);
            }

            if ($day[0]->approval_status !== 'pending') {
                return responseJson(success: false, message: "This day is not pending holiday-work approval", code: 400);
            }

            $newApprovalStatus = $approve ? 'approved' : 'rejected';
            $salaryIncluded    = $approve ? 1 : 0;

            DB::raw(
                "UPDATE employee_attendance_days
                 SET approval_status = :approval_status, salary_included = :salary_included,
                     approved_by = :approved_by, approved_at = NOW(), updated_at = NOW()
                 WHERE id = :id",
                [
                    ':approval_status' => $newApprovalStatus,
                    ':salary_included' => $salaryIncluded,
                    ':approved_by'     => $user['id'],
                    ':id'              => $day[0]->id,
                ]
            );

            AttendanceService::logAdjustment(
                $orgId,
                $day[0]->id,
                'override',
                $day[0],
                ['approval_status' => $newApprovalStatus, 'salary_included' => $salaryIncluded],
                $data['notes'] ?? ($approve ? 'Holiday work approved' : 'Holiday work rejected'),
                $user['id']
            );

            return responseJson(success: true, message: "Holiday work " . $newApprovalStatus, code: 200);
        } catch (\Exception $e) {
            error_log("Holiday work decision error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to process holiday work decision: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * GET /api/v1/organizations/{org_id}/attendance/payroll-summary

     * Payroll-ready aggregate for a date range: only pulls in salary-includable
     * base attendance plus any *approved* overtime (still separate columns so
     * PayrunController can rate overtime differently from base pay).
     */
    public function payrollSummary($orgId)
    {
        try {
            $dateFrom = $_GET['date_from'] ?? null;
            $dateTo   = $_GET['date_to']   ?? null;

            if (!$dateFrom || !$dateTo) {
                return responseJson(success: false, message: "date_from and date_to are required", code: 400);
            }

            $rows = DB::raw(
                "SELECT
                    ad.employee_id,
                    e.employee_number, e.firstname, e.middlename, e.surname,
                    SUM(ad.worked_minutes)  AS total_worked_minutes,
                    SUM(CASE WHEN ad.salary_included = 1 THEN ad.scheduled_minutes ELSE 0 END) AS payable_scheduled_minutes,
                    SUM(ad.late_minutes)    AS total_late_minutes,
                    SUM(CASE WHEN oa.status = 'approved' THEN oa.overtime_minutes ELSE 0 END) AS approved_overtime_minutes,
                    SUM(CASE WHEN oa.status = 'pending'  THEN oa.overtime_minutes ELSE 0 END) AS pending_overtime_minutes,
                    SUM(CASE WHEN ad.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
                    SUM(CASE WHEN ad.is_public_holiday = 1 AND ad.salary_included = 1 THEN 1 ELSE 0 END) AS paid_holiday_work_days
                 FROM employee_attendance_days ad
                 JOIN employees e ON ad.employee_id = e.id
                 LEFT JOIN overtime_approvals oa ON oa.attendance_day_id = ad.id
                 WHERE ad.organization_id = :org_id
                   AND ad.attendance_date BETWEEN :date_from AND :date_to
                 GROUP BY ad.employee_id, e.employee_number, e.firstname, e.middlename, e.surname
                 ORDER BY e.surname ASC",
                [':org_id' => $orgId, ':date_from' => $dateFrom, ':date_to' => $dateTo]
            );

            return responseJson(
                success: true,
                data: $rows,
                message: "Payroll attendance summary generated",
                metadata: ['date_from' => $dateFrom, 'date_to' => $dateTo, 'total_employees' => count($rows)],
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Attendance payroll summary error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to build payroll summary: " . $e->getMessage(), code: 500);
        }
    }
}