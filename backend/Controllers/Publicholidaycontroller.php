<?php

namespace App\Controllers;

use App\Services\DB;
use App\Middleware\AuthMiddleware;

class PublicHolidayController
{
    /**
     * GET /api/v1/organizations/{org_id}/public-holidays
     */
    public function index($orgId)
    {
        try {
            $year = $_GET['year'] ?? null;

            $query  = "SELECT * FROM public_holidays WHERE organization_id = :org_id AND is_active = 1";
            $params = [':org_id' => $orgId];

            if (!empty($year)) {
                $query .= " AND (YEAR(holiday_date) = :year OR is_recurring = 1)";
                $params[':year'] = $year;
            }

            $query .= " ORDER BY holiday_date ASC";

            $holidays = DB::raw($query, $params);

            return responseJson(success: true, data: $holidays, message: "Fetched " . count($holidays) . " holiday(s)", code: 200);
        } catch (\Exception $e) {
            error_log("Public holiday index error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch holidays: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/public-holidays
     * HR/admin create holidays directly as approved (matches organization_configs
     * convention of created-by-privileged-role rows defaulting to approved).
     */
    public function store($orgId)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();

            $data = validate([
                'holiday_date'   => 'required,string',
                'name'           => 'required,string',
                'is_recurring'   => 'boolean',
                'applies_to_all' => 'boolean',
                'notes'          => 'string',
            ]);

            $holidayDate = date('Y-m-d', strtotime($data['holiday_date']));

            $existing = DB::raw(
                "SELECT id FROM public_holidays
                 WHERE organization_id = :org_id AND holiday_date = :date AND name = :name LIMIT 1",
                [':org_id' => $orgId, ':date' => $holidayDate, ':name' => $data['name']]
            );

            if (!empty($existing)) {
                return responseJson(success: false, message: "This holiday already exists for that date", code: 400);
            }

            DB::raw(
                "INSERT INTO public_holidays
                    (organization_id, holiday_date, name, is_recurring, applies_to_all, notes, status, created_by, approved_by, approved_at)
                 VALUES
                    (:org_id, :date, :name, :is_recurring, :applies_to_all, :notes, 'approved', :created_by, :approved_by, NOW())",
                [
                    ':org_id'         => $orgId,
                    ':date'           => $holidayDate,
                    ':name'           => $data['name'],
                    ':is_recurring'   => !empty($data['is_recurring']) ? 1 : 0,
                    ':applies_to_all' => isset($data['applies_to_all']) ? (int) $data['applies_to_all'] : 1,
                    ':notes'          => $data['notes'] ?? null,
                    ':created_by'     => $user['id'],
                    ':approved_by'    => $user['id'],
                ]
            );

            $created = DB::raw("SELECT * FROM public_holidays WHERE id = LAST_INSERT_ID()");

            return responseJson(success: true, data: $created[0] ?? null, message: "Public holiday created", code: 201);
        } catch (\Exception $e) {
            error_log("Public holiday store error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to create holiday: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * PUT /api/v1/organizations/{org_id}/public-holidays/{id}
     */
    public function update($orgId, $id)
    {
        try {
            $existing = DB::raw(
                "SELECT * FROM public_holidays WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $orgId]
            );

            if (empty($existing)) {
                return responseJson(success: false, message: "Holiday not found", code: 404);
            }

            $data = validate([
                'holiday_date'   => 'string',
                'name'           => 'string',
                'is_recurring'   => 'boolean',
                'applies_to_all' => 'boolean',
                'notes'          => 'string',
            ]);

            $fields = [];
            $params = [':id' => $id];

            $map = [
                'holiday_date'   => 'holiday_date',
                'name'           => 'name',
                'is_recurring'   => 'is_recurring',
                'applies_to_all' => 'applies_to_all',
                'notes'          => 'notes',
            ];

            foreach ($map as $inputKey => $column) {
                if (isset($data[$inputKey])) {
                    $value = $inputKey === 'holiday_date' ? date('Y-m-d', strtotime($data[$inputKey])) : $data[$inputKey];
                    $fields[] = "{$column} = :{$column}";
                    $params[":{$column}"] = $value;
                }
            }

            if (empty($fields)) {
                return responseJson(success: false, message: "No fields provided to update", code: 400);
            }

            $query = "UPDATE public_holidays SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = :id";
            DB::raw($query, $params);

            $updated = DB::raw("SELECT * FROM public_holidays WHERE id = :id", [':id' => $id]);

            return responseJson(success: true, data: $updated[0] ?? null, message: "Holiday updated", code: 200);
        } catch (\Exception $e) {
            error_log("Public holiday update error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to update holiday: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * DELETE /api/v1/organizations/{org_id}/public-holidays/{id}
     * Soft delete — preserves history for any attendance days already tied to it.
     */
    public function destroy($orgId, $id)
    {
        try {
            $existing = DB::raw(
                "SELECT id FROM public_holidays WHERE id = :id AND organization_id = :org_id LIMIT 1",
                [':id' => $id, ':org_id' => $orgId]
            );

            if (empty($existing)) {
                return responseJson(success: false, message: "Holiday not found", code: 404);
            }

            DB::raw("UPDATE public_holidays SET is_active = 0, updated_at = NOW() WHERE id = :id", [':id' => $id]);

            return responseJson(success: true, message: "Holiday removed", code: 200);
        } catch (\Exception $e) {
            error_log("Public holiday destroy error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to remove holiday: " . $e->getMessage(), code: 500);
        }
    }
}