<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\AttendanceService;
use App\Middleware\AuthMiddleware;

/**
 * Manual overtime requests.
 *
 * A manual request is just a row in `overtime_approvals` with source = 'manual',
 * status = 'pending', so it shows up in the existing Overtime Approvals page and
 * goes through the existing approve / reject / resolve workflow untouched.
 *
 * Who can do what
 *   - Any user with an employee profile can request overtime for THEMSELVES.
 *   - admin and hr_manager can also request it for ANY employee in the organization.
 *   - Requests always start as 'pending' (even when an admin requests for themselves).
 *   - Only an admin can approve / reject a manual request (enforced in
 *     OvertimeApprovalController::approve / reject).
 *
 * Rules
 *   - Date cannot be in the future (end time cannot be in the future either).
 *   - Date cannot be earlier than the start of the CURRENT pay period.
 *   - End time must be after start time (same calendar day).
 *   - Reason is required.
 *   - One overtime record per employee per day (unique key on overtime_approvals);
 *     if one already exists for that day - auto-detected or manual, any status - the
 *     request is blocked.
 */
class OvertimeRequestController
{
    private const SUBMIT_ANY_EMPLOYEE_ROLES = ['admin', 'hr_manager'];
    private const INELIGIBLE_EMPLOYEE_STATUSES = ['resigned', 'terminated', 'retired', 'deceased', 'suspended'];

    /**
     * GET /api/v1/organizations/{org_id}/overtime-requests/meta
     * Date window the request modal should allow.
     */
    public function meta($orgId)
    {
        try {
            $employee = AuthMiddleware::getCurrentEmployee();
            $today    = date('Y-m-d');
            $period   = $this->currentPeriod($orgId, $today);

            return responseJson(
                success: true,
                data: [
                    'today'         => $today,
                    'min_date'      => $period['start'],
                    'period_label'  => $period['label'],
                    'period_source' => $period['source'],
                    'employee_id'   => isset($employee['id']) ? (int) $employee['id'] : null,
                ],
                message: 'Overtime request window',
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Overtime request meta error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to load overtime request window: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * GET /api/v1/organizations/{org_id}/my-overtime-requests
     * The logged-in user's own overtime (auto-detected and manual), newest first.
     */
    public function mine($orgId)
    {
        try {
            $employee = AuthMiddleware::getCurrentEmployee();
            if (empty($employee['id'])) {
                return responseJson(success: false, message: "Your account is not linked to an employee profile", code: 400);
            }

            $rows = DB::raw(
                "SELECT oa.*, e.employee_number, e.firstname, e.middlename, e.surname,
                        ad.attendance_date, ad.check_in_time, ad.check_out_time, ad.scheduled_minutes,
                        COALESCE(
                            NULLIF(TRIM(CONCAT_WS(' ', re.firstname, re.middlename, re.surname)), ''),
                            ru.username
                        ) AS requested_by_name,
                        ru.email AS requested_by_email
                FROM overtime_approvals oa
                JOIN employees e ON oa.employee_id = e.id
                JOIN employee_attendance_days ad ON oa.attendance_day_id = ad.id
                LEFT JOIN users ru ON oa.requested_by = ru.id
                LEFT JOIN employees re ON re.user_id = ru.id
                WHERE oa.organization_id = :org_id AND oa.status = :status AND oa.is_active = 1
                ORDER BY ad.attendance_date DESC",
                [':org_id' => $orgId, ':status' => $status]
            );

            return responseJson(success: true, data: $rows, message: "Fetched " . count($rows) . " overtime record(s)", code: 200);
        } catch (\Exception $e) {
            error_log("My overtime requests error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch your overtime: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/overtime-requests
     * Body: { employee_id?, date: "YYYY-MM-DD", start_time: "HH:MM", end_time: "HH:MM", reason }
     * employee_id omitted = request for yourself.
     */
    public function store($orgId)
    {
        try {
            $user     = AuthMiddleware::getCurrentUser();
            $myself   = AuthMiddleware::getCurrentEmployee();
            $input    = getInputData();
            $userType = $user['user_type'] ?? '';

            // ---- Who is the request for? ------------------------------------
            $targetId = isset($input['employee_id']) && $input['employee_id'] !== ''
                ? (int) $input['employee_id']
                : (int) ($myself['id'] ?? 0);

            if ($targetId <= 0) {
                return responseJson(success: false, message: "Your account is not linked to an employee profile. Select an employee.", code: 400);
            }

            $isSelf = $myself && (int) $myself['id'] === $targetId;
            if (!$isSelf && !in_array($userType, self::SUBMIT_ANY_EMPLOYEE_ROLES, true)) {
                return responseJson(success: false, message: "You can only request overtime for yourself", code: 403);
            }

            $employee = $this->findEligibleEmployee($orgId, $targetId);
            if (!$employee) {
                return responseJson(success: false, message: "Employee not found in this organization, or not eligible for overtime", code: 404);
            }

            // ---- Validate input ---------------------------------------------
            $errors = [];
            $date   = trim((string) ($input['date'] ?? ''));
            $start  = $this->normalizeTime($input['start_time'] ?? '');
            $end    = $this->normalizeTime($input['end_time'] ?? '');
            $reason = trim((string) ($input['reason'] ?? ''));

            $dateObj = \DateTime::createFromFormat('!Y-m-d', $date);
            if (!$dateObj || $dateObj->format('Y-m-d') !== $date) {
                $errors['date'] = 'date must be a valid date (YYYY-MM-DD).';
            }
            if ($start === null) {
                $errors['start_time'] = 'start_time must be a valid time (HH:MM).';
            }
            if ($end === null) {
                $errors['end_time'] = 'end_time must be a valid time (HH:MM).';
            }
            if ($reason === '') {
                $errors['reason'] = 'reason is required.';
            } elseif (mb_strlen($reason) > 1000) {
                $errors['reason'] = 'reason must not exceed 1000 characters.';
            }
            if (!empty($errors)) {
                return responseJson(success: false, message: 'Validation error', code: 400, errors: $errors);
            }

            $today  = date('Y-m-d');
            $period = $this->currentPeriod($orgId, $today);

            if ($date > $today) {
                return responseJson(success: false, message: "Overtime cannot be requested for a future date", code: 400, errors: ['date' => 'Date cannot be in the future.']);
            }
            if ($date < $period['start']) {
                return responseJson(
                    success: false,
                    message: "Overtime can only be requested from the start of the current pay period ({$period['start']}) onwards",
                    code: 400,
                    errors: ['date' => "Date cannot be earlier than {$period['start']} (current pay period)."]
                );
            }

            $startAt = "$date $start:00";
            $endAt   = "$date $end:00";
            if (strtotime($endAt) <= strtotime($startAt)) {
                return responseJson(
                    success: false,
                    message: "End time must be after start time (a request covers a single calendar day)",
                    code: 400,
                    errors: ['end_time' => 'End time must be after start time.']
                );
            }
            if (strtotime($endAt) > time()) {
                return responseJson(success: false, message: "Overtime end time cannot be in the future", code: 400, errors: ['end_time' => 'End time cannot be in the future.']);
            }

            $minutes = (int) round((strtotime($endAt) - strtotime($startAt)) / 60);

            // ---- Make sure an attendance day exists for that date ------------
            $dayId = $this->findAttendanceDayId($orgId, $targetId, $date);

            // ---- Block if this employee already has overtime for the day -----
            if ($dayId) {
                $existing = DB::raw(
                    "SELECT id, status, source FROM overtime_approvals
                     WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_day_id = :day_id
                     LIMIT 1",
                    [':org_id' => $orgId, ':employee_id' => $targetId, ':day_id' => $dayId]
                );
                if (!empty($existing)) {
                    return responseJson(
                        success: false,
                        message: "An overtime record already exists for $date (status: {$existing[0]->status}). " .
                            "Only one overtime record per employee per day is allowed.",
                        code: 409
                    );
                }
            } else {
                // No attendance record yet (weekend, forgotten punch...). Build the standard
                // day row the same way attendance does, so holiday/weekend flags stay correct.
                AttendanceService::recomputeDay($orgId, $targetId, $date, $user['id']);
                $dayId = $this->findAttendanceDayId($orgId, $targetId, $date);
                if (!$dayId) {
                    return responseJson(success: false, message: "Could not create an attendance record for $date", code: 500);
                }
            }

            // ---- Insert the pending request ----------------------------------
            try {
                DB::raw(
                    "INSERT INTO overtime_approvals
                        (organization_id, attendance_day_id, employee_id, overtime_minutes,
                         source, reason, overtime_start, overtime_end, requested_by, status)
                     VALUES
                        (:org_id, :day_id, :employee_id, :minutes,
                         'manual', :reason, :start_at, :end_at, :requested_by, 'pending')",
                    [
                        ':org_id'       => $orgId,
                        ':day_id'       => $dayId,
                        ':employee_id'  => $targetId,
                        ':minutes'      => $minutes,
                        ':reason'       => $reason,
                        ':start_at'     => $startAt,
                        ':end_at'       => $endAt,
                        ':requested_by' => $user['id'],
                    ]
                );
            } catch (\Exception $e) {
                // Two people submitting at the same moment: unique key wins.
                if (stripos($e->getMessage(), 'Duplicate entry') !== false) {
                    return responseJson(success: false, message: "An overtime record already exists for $date", code: 409);
                }
                throw $e;
            }

            $newId = (int) DB::lastInsertId();
            $row   = DB::raw("SELECT * FROM overtime_approvals WHERE id = :id", [':id' => $newId]);

            $this->audit($orgId, (int) $user['id'], $newId, 'submit', [
                'source'          => 'manual',
                'employee_id'     => $targetId,
                'attendance_date' => $date,
                'overtime_start'  => $startAt,
                'overtime_end'    => $endAt,
                'overtime_minutes' => $minutes,
                'on_behalf'       => !$isSelf,
            ]);

            $this->notifySubmission((int) $orgId, $newId, $employee, $date, $minutes, $user, $myself, $isSelf);

            return responseJson(
                success: true,
                data: $row[0] ?? null,
                message: "Overtime request submitted and sent for approval",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Overtime request store error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to submit overtime request: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * DELETE /api/v1/organizations/{org_id}/overtime-requests/{id}
     * Withdraw a still-pending MANUAL request. Allowed for the person who submitted it,
     * the employee it is for, or an admin.
     */
    public function withdraw($orgId, $id)
    {
        try {
            $user   = AuthMiddleware::getCurrentUser();
            $myself = AuthMiddleware::getCurrentEmployee();

            $rows = DB::raw(
                "SELECT * FROM overtime_approvals
                 WHERE id = :id AND organization_id = :org_id AND source = 'manual' AND status = 'pending' AND is_active = 1
                 LIMIT 1",
                [':id' => $id, ':org_id' => $orgId]
            );
            if (empty($rows)) {
                return responseJson(success: false, message: "Pending manual overtime request not found", code: 404);
            }
            $request = $rows[0];

            $isRequester = (int) $request->requested_by === (int) $user['id'];
            $isOwner     = $myself && (int) $myself['id'] === (int) $request->employee_id;
            $isAdmin     = ($user['user_type'] ?? '') === 'admin';
            if (!$isRequester && !$isOwner && !$isAdmin) {
                return responseJson(success: false, message: "You cannot withdraw this request", code: 403);
            }

            DB::raw(
                "DELETE FROM overtime_approvals WHERE id = :id AND status = 'pending' AND source = 'manual'",
                [':id' => $id]
            );

            $this->audit($orgId, (int) $user['id'], (int) $id, 'cancelled', [
                'source'           => 'manual',
                'employee_id'      => (int) $request->employee_id,
                'overtime_minutes' => (int) $request->overtime_minutes,
            ]);

            return responseJson(success: true, message: "Overtime request withdrawn", code: 200);
        } catch (\Exception $e) {
            error_log("Overtime request withdraw error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to withdraw overtime request: " . $e->getMessage(), code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // Notifications (in-app, stored in the `notifications` table)
    // -------------------------------------------------------------------------

    /**
     * Called by OvertimeApprovalController after a MANUAL request is approved/rejected.
     * $request is the overtime_approvals row (as returned by findPending()).
     */
    public static function notifyDecision(int $orgId, $request, string $decision, int $decidedByUserId, ?string $note = null): void
    {
        try {
            $approver = AuthMiddleware::getCurrentEmployee();
            // Admin approving their own request does not need to notify themselves.
            if ($approver && (int) $approver['id'] === (int) $request->employee_id) {
                return;
            }

            $date = DB::raw(
                "SELECT ad.attendance_date FROM employee_attendance_days ad WHERE ad.id = :id LIMIT 1",
                [':id' => $request->attendance_day_id]
            )[0]->attendance_date ?? '';

            $duration = self::formatDuration((int) $request->overtime_minutes);
            $title    = $decision === 'approved' ? 'Overtime request approved' : 'Overtime request rejected';
            $message  = "Your overtime request for $date ($duration) was $decision." .
                ($note ? " Note: $note" : '');

            self::insertNotification($orgId, (int) $request->employee_id, $title, $message, [
                'overtime_approval_id' => (int) $request->id,
                'decision'             => $decision,
                'link'                 => '/myovertime',
            ]);
            self::emailEmployee((int) $request->employee_id, $title, $message);
        } catch (\Throwable $e) {
            error_log("Overtime decision notification failed: " . $e->getMessage());
        }
    }

    private function notifySubmission(int $orgId, int $requestId, $employee, string $date, int $minutes, $user, $myself, bool $isSelf): void
    {
        try {
            $duration = self::formatDuration($minutes);
            $name     = trim(implode(' ', array_filter([$employee->firstname, $employee->middlename, $employee->surname])));
            $submitterEmployeeId = $myself['id'] ?? null;

            // 1) Admins (single-step approval) - except the person who just submitted.
            $adminTitle = 'New overtime request awaiting approval';
            $adminMsg   = $isSelf
                ? "$name requested $duration of overtime for $date."
                : "An overtime request of $duration for $name ($date) was submitted by a manager.";

            $notified = [];
            foreach ($this->adminEmployeeIds($orgId) as $adminEmployeeId) {
                if ($submitterEmployeeId && (int) $adminEmployeeId === (int) $submitterEmployeeId) {
                    continue;
                }
                $notified[(int) $adminEmployeeId] = true;
                self::insertNotification($orgId, (int) $adminEmployeeId, $adminTitle, $adminMsg, [
                    'overtime_approval_id' => $requestId,
                    'link'                 => '/payrun/overtime-approvals',
                ]);
                self::emailEmployee((int) $adminEmployeeId, $adminTitle, $adminMsg);
            }

            // 2) The employee, when someone else submitted on their behalf.
            if (!$isSelf && empty($notified[(int) $employee->id])) {
                $title = 'Overtime request submitted for you';
                $msg   = "An overtime request of $duration for $date was submitted on your behalf and is awaiting approval.";
                self::insertNotification($orgId, (int) $employee->id, $title, $msg, [
                    'overtime_approval_id' => $requestId,
                    'link'                 => '/myovertime',
                ]);
                self::emailEmployee((int) $employee->id, $title, $msg);
            }
        } catch (\Throwable $e) {
            // Never fail the request because a notification could not be written.
            error_log("Overtime submission notification failed: " . $e->getMessage());
        }
    }

    private function adminEmployeeIds(int $orgId): array
    {
        $rows = DB::raw(
            "SELECT e.id FROM users u
             JOIN employees e ON e.user_id = u.id AND e.organization_id = :org_emp
             WHERE u.organization_id = :org_user AND u.user_type = 'admin'",
            [':org_emp' => $orgId, ':org_user' => $orgId]
        );
        return array_map(fn($r) => (int) $r->id, $rows ?: []);
    }

    private static function insertNotification(int $orgId, int $employeeId, string $title, string $message, array $metadata): void
    {
        DB::raw(
            "INSERT INTO notifications (employee_id, organization_id, title, message, type, metadata)
             VALUES (:employee_id, :org_id, :title, :message, 'other', :metadata)",
            [
                ':employee_id' => $employeeId,
                ':org_id'      => $orgId,
                ':title'       => $title,
                ':message'     => $message,
                ':metadata'    => json_encode($metadata),
            ]
        );
    }

    /** Best-effort. sendEmail() is currently a stub in helpers/send_emails.php; this starts working as soon as it is implemented. */
    private static function emailEmployee(int $employeeId, string $subject, string $message): void
    {
        try {
            $rows = DB::raw(
                "SELECT u.email FROM employees e JOIN users u ON u.id = e.user_id WHERE e.id = :id LIMIT 1",
                [':id' => $employeeId]
            );
            $to = $rows[0]->email ?? null;
            if ($to && function_exists('sendEmail')) {
                sendEmail($to, $subject, $message);
            }
        } catch (\Throwable $e) {
            error_log("Overtime email failed: " . $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function findEligibleEmployee($orgId, int $employeeId)
    {
        $rows = DB::raw(
            "SELECT id, firstname, middlename, surname, status FROM employees
             WHERE id = :id AND organization_id = :org_id LIMIT 1",
            [':id' => $employeeId, ':org_id' => $orgId]
        );
        $employee = $rows[0] ?? null;
        if (!$employee || in_array($employee->status, self::INELIGIBLE_EMPLOYEE_STATUSES, true)) {
            return null;
        }
        return $employee;
    }

    private function findAttendanceDayId($orgId, int $employeeId, string $date)
    {
        $rows = DB::raw(
            "SELECT id FROM employee_attendance_days
             WHERE organization_id = :org_id AND employee_id = :employee_id AND attendance_date = :date
             LIMIT 1",
            [':org_id' => $orgId, ':employee_id' => $employeeId, ':date' => $date]
        );
        return $rows[0]->id ?? null;
    }

    /**
     * Start of the current pay period.
     *  1) A regular, non-deleted payrun whose period contains today wins.
     *  2) Otherwise fall back to the organization's payroll_schedule
     *     (Monthly = 1st of month, Bi-Monthly = 1st or 16th, Weekly = Monday).
     */
    private function currentPeriod($orgId, string $today): array
    {
        $payrun = DB::raw(
            "SELECT payrun_name, pay_period_start FROM payruns
             WHERE organization_id = :org_id AND deleted_at IS NULL AND payrun_type = 'regular'
               AND :today BETWEEN pay_period_start AND pay_period_end
             ORDER BY pay_period_start ASC LIMIT 1",
            [':org_id' => $orgId, ':today' => $today]
        );
        if (!empty($payrun)) {
            return [
                'start'  => $payrun[0]->pay_period_start,
                'label'  => $payrun[0]->payrun_name,
                'source' => 'payrun',
            ];
        }

        $org      = DB::raw("SELECT payroll_schedule FROM organizations WHERE id = :id LIMIT 1", [':id' => $orgId]);
        $schedule = $org[0]->payroll_schedule ?? 'Monthly';
        $ts       = strtotime($today);

        switch ($schedule) {
            case 'Weekly':
                $start = date('Y-m-d', strtotime('monday this week', $ts));
                $label = 'Current week';
                break;
            case 'Bi-Monthly':
                $start = (int) date('j', $ts) <= 15 ? date('Y-m-01', $ts) : date('Y-m-16', $ts);
                $label = 'Current half-month';
                break;
            default:
                $start = date('Y-m-01', $ts);
                $label = 'Current month';
        }

        return ['start' => $start, 'label' => $label, 'source' => 'schedule'];
    }

    /** Accepts "H:i" or "H:i:s"; returns "H:i" or null when invalid. */
    private function normalizeTime($value): ?string
    {
        $value = trim((string) $value);
        if (!preg_match('/^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/', $value, $m)) {
            return null;
        }
        return str_pad($m[1], 2, '0', STR_PAD_LEFT) . ':' . $m[2];
    }

    private static function formatDuration(int $minutes): string
    {
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;
        return $h > 0 ? ($m > 0 ? "{$h}h {$m}m" : "{$h}h") : "{$m}m";
    }

    private function audit($orgId, int $userId, int $entityId, string $action, array $details): void
    {
        try {
            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id'         => $userId,
                'entity_type'     => 'overtime_approvals',
                'entity_id'       => $entityId,
                'action'          => $action,
                'details'         => json_encode($details),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Failed to create audit log: " . $e->getMessage());
        }
    }
}
