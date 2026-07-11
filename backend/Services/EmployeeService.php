<?php

namespace App\Services;

/**
 * EmployeeService
 * ----------------
 * Lightweight read-side helpers for employee-related aggregates.
 * Add further employee query/reporting methods here as needed.
 */
class EmployeeService
{
    /**
     * Count employees for an organization, optionally scoped to a single
     * department and/or a single employee — mirrors the department_id /
     * employee_id filters used by AttendanceController::index() so the
     * "total employees" metric lines up with whatever slice is being viewed.
     *
     * Only counts employees considered "currently employed" for attendance
     * purposes (active, on_leave, on_probation, suspended). Resigned,
     * terminated, retired, and deceased employees are excluded.
     */
    public static function countEmployees($orgId, $departmentId = null, $employeeId = null)
    {
        $query = "SELECT COUNT(*) as count FROM employees
                  WHERE organization_id = :org_id
                    AND status IN ('active','on_leave','on_probation','suspended')";
        $params = [':org_id' => $orgId];

        if (!empty($employeeId)) {
            $query .= " AND id = :employee_id";
            $params[':employee_id'] = $employeeId;
        }

        if (!empty($departmentId)) {
            $query .= " AND department_id = :department_id";
            $params[':department_id'] = $departmentId;
        }

        $result = DB::raw($query, $params);
        return (int) ($result[0]->count ?? 0);
    }
}