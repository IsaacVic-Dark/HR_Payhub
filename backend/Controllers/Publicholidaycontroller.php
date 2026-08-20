<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\HolidayImportService;
use App\Services\HolidayLookupService;

/**
 * Public holidays.
 *
 * Replaces the old org-only public_holidays CRUD. New model:
 *   - public_holidays_master : global, per-country calendar (imported from
 *                              Mansa OR entered manually by super_admin)
 *   - org_public_holidays    : ONLY override + custom rows (never inherited rows)
 *
 * See HolidayLookupService for the merge logic and HolidayImportService for
 * the Mansa sync logic.
 *
 * Access:
 *   - public_holidays_master : super_admin only (see *Master() methods below)
 *   - org_public_holidays    : org admin only (see storeOverride/storeCustom/
 *                              update/destroy/index/check above)
 */
class PublicHolidayController
{
    private HolidayImportService $importService;
    private HolidayLookupService $lookupService;

    private const HOLIDAY_TYPES = ['national', 'regional', 'religious', 'bank', 'observance'];

    public function __construct()
    {
        $this->importService = new HolidayImportService();
        $this->lookupService = new HolidayLookupService();
    }

    // -------------------------------------------------------------------------
    // POST /api/v1/holidays/import
    // Body: { country_code?: "KE", year?: 2026 }  (country_code defaults to KE)
    // Admin only.
    // TODO: replace this manual trigger with a scheduled cron job.
    // -------------------------------------------------------------------------
    public function import(): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $countryCode = strtoupper(trim($data['country_code'] ?? 'KE'));
            $year        = (int) ($data['year'] ?? date('Y'));

            if (!preg_match('/^[A-Z]{2}$/', $countryCode)) {
                return responseJson(success: false, data: null, message: "country_code must be a 2-letter ISO code", code: 400);
            }

            if ($year < 2000 || $year > 2100) {
                return responseJson(success: false, data: null, message: "year must be between 2000 and 2100", code: 400);
            }

            $country = DB::raw(
                "SELECT id FROM countries WHERE iso2 = :cc AND is_active = 1 LIMIT 1",
                [':cc' => $countryCode]
            );

            if (empty($country)) {
                return responseJson(success: false, data: null, message: "Unknown or inactive country_code: {$countryCode}", code: 404);
            }

            $result = $this->importService->import($countryCode, $year);

            if (!$result['success']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: $result['message'],
                    code: 502,
                    errors: isset($result['debug']) ? ['debug' => $result['debug']] : null // TEMP DEBUG ONLY
                );
            }

            return responseJson(
                success: true,
                data: $result['data'],
                message: "Public holidays imported successfully.",
                metadata: ['warnings' => $result['warnings']]
            );
        } catch (\Exception $e) {
            error_log("Holiday import error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to import public holidays: " . $e->getMessage(), code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/v1/organizations/{org_id}/holidays?year=
    // Merged view: master (inherited) + org overrides + org customs.
    // -------------------------------------------------------------------------
    public function index(int $orgId): mixed
    {
        try {
            $orgCheck = DB::table('organizations')->where(['id' => $orgId])->get();
            if (empty($orgCheck)) {
                return responseJson(success: false, data: null, message: "Organization not found", code: 404);
            }

            $year = (int) ($_GET['year'] ?? date('Y'));

            $result = $this->lookupService->getOrgHolidays($orgId, $year);

            return responseJson(
                success: true,
                data: $result['holidays'],
                message: "Holidays fetched successfully",
                metadata: ['country_code' => $result['country_code'], 'year' => $year]
            );
        } catch (\Exception $e) {
            error_log("Holiday index error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: $e->getMessage(), code: 400);
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/v1/organizations/{org_id}/holidays/check?date=YYYY-MM-DD
    // -------------------------------------------------------------------------
    public function check(int $orgId): mixed
    {
        try {
            $date = $_GET['date'] ?? null;
            if (!$date || !\DateTime::createFromFormat('Y-m-d', $date)) {
                return responseJson(success: false, data: null, message: "A valid 'date' query param (YYYY-MM-DD) is required", code: 400);
            }

            $orgCheck = DB::table('organizations')->where(['id' => $orgId])->get();
            if (empty($orgCheck)) {
                return responseJson(success: false, data: null, message: "Organization not found", code: 404);
            }

            $result = $this->lookupService->isHoliday($orgId, $date);

            return responseJson(success: true, data: $result, message: "Holiday check complete");
        } catch (\Exception $e) {
            error_log("Holiday check error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: $e->getMessage(), code: 400);
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/v1/organizations/{org_id}/holidays/override
    // Body: { master_holiday_id, is_paid?, is_active?, holiday_date?, name?, notes? }
    // Upserted on (organization_id, master_holiday_id) — one override per
    // master holiday per org.
    // -------------------------------------------------------------------------
    public function storeOverride(int $orgId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['master_holiday_id'])) {
                return responseJson(success: false, data: null, message: "master_holiday_id is required", code: 400);
            }

            $master = DB::table('public_holidays_master')
                ->where(['id' => $data['master_holiday_id']])
                ->get();

            if (empty($master)) {
                return responseJson(success: false, data: null, message: "Master holiday not found", code: 404);
            }
            $master = $master[0];

            $countryCode = $this->lookupService->resolveOrgCountryCode($orgId);
            if (!$countryCode) {
                return responseJson(success: false, data: null, message: "Organization has no active country assigned", code: 422);
            }

            $params = [
                ':org_id'     => $orgId,
                ':cc'         => $countryCode,
                ':master_id'  => $master->id,
                ':date'       => $data['holiday_date'] ?? $master->holiday_date,
                ':name'       => $data['name'] ?? $master->name,
                ':is_paid'    => isset($data['is_paid']) ? (int) (bool) $data['is_paid'] : 1,
                ':is_active'  => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
                ':notes'      => $data['notes'] ?? null,
                ':created_by' => $_SERVER['AUTH_USER_ID'] ?? null, // set upstream by AuthMiddleware
            ];

            DB::raw(
                "INSERT INTO org_public_holidays
                    (organization_id, country_code, master_holiday_id, holiday_date, name, source, is_paid, is_active, notes, created_by, created_at, updated_at)
                 VALUES
                    (:org_id, :cc, :master_id, :date, :name, 'override', :is_paid, :is_active, :notes, :created_by, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE
                    holiday_date = VALUES(holiday_date),
                    name         = VALUES(name),
                    is_paid      = VALUES(is_paid),
                    is_active    = VALUES(is_active),
                    notes        = VALUES(notes),
                    updated_at   = NOW()",
                $params
            );

            return responseJson(success: true, data: null, message: "Holiday override saved successfully", code: 201);
        } catch (\Exception $e) {
            error_log("Store holiday override error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to save override: " . $e->getMessage(), code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/v1/organizations/{org_id}/holidays/custom
    // Body: { holiday_date, name, is_paid?, notes? }
    // -------------------------------------------------------------------------
    public function storeCustom(int $orgId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            foreach (['holiday_date', 'name'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(success: false, data: null, message: "Field '$f' is required", code: 400);
                }
            }

            $countryCode = $this->lookupService->resolveOrgCountryCode($orgId);
            if (!$countryCode) {
                return responseJson(success: false, data: null, message: "Organization has no active country assigned", code: 422);
            }

            $existing = DB::raw(
                "SELECT id FROM org_public_holidays
                 WHERE organization_id = :org_id AND holiday_date = :date AND name = :name
                 LIMIT 1",
                [':org_id' => $orgId, ':date' => $data['holiday_date'], ':name' => $data['name']]
            );

            if (!empty($existing)) {
                return responseJson(success: false, data: null, message: "A holiday with that date and name already exists for this organization", code: 409);
            }

            DB::table('org_public_holidays')->insert([
                'organization_id'   => $orgId,
                'country_code'      => $countryCode,
                'master_holiday_id' => null,
                'holiday_date'      => $data['holiday_date'],
                'name'              => $data['name'],
                'source'            => 'custom',
                'is_paid'           => isset($data['is_paid']) ? (int) (bool) $data['is_paid'] : 1,
                'is_active'         => 1,
                'notes'             => $data['notes'] ?? null,
                'created_by'        => $_SERVER['AUTH_USER_ID'] ?? null,
                'created_at'        => date('Y-m-d H:i:s'),
            ]);

            return responseJson(success: true, data: null, message: "Custom holiday created successfully", code: 201);
        } catch (\Exception $e) {
            error_log("Store custom holiday error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to create custom holiday: " . $e->getMessage(), code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/v1/organizations/{org_id}/holidays/{id}
    // Updates an override or custom row only — never touches master data.
    // -------------------------------------------------------------------------
    public function update(int $orgId, int $id): mixed
    {
        try {
            $existing = DB::table('org_public_holidays')
                ->where(['id' => $id, 'organization_id' => $orgId])
                ->get();

            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Holiday record not found", code: 404);
            }

            $data = json_decode(file_get_contents('php://input'), true);
            $updateData = [];

            foreach (['is_paid', 'is_active'] as $f) {
                if (isset($data[$f])) $updateData[$f] = (int) (bool) $data[$f];
            }
            if (isset($data['notes'])) $updateData['notes'] = $data['notes'];
            if (isset($data['holiday_date'])) $updateData['holiday_date'] = $data['holiday_date'];
            if (isset($data['name'])) $updateData['name'] = $data['name'];

            if (empty($updateData)) {
                return responseJson(success: false, data: null, message: "No fields to update", code: 400);
            }

            DB::table('org_public_holidays')->update($updateData, 'id', $id);

            return responseJson(success: true, data: null, message: "Holiday updated successfully");
        } catch (\Exception $e) {
            error_log("Update holiday error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to update holiday: " . $e->getMessage(), code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /api/v1/organizations/{org_id}/holidays/{id}
    // Soft-delete only — sets is_active = 0. Never hard-deletes (audit trail).
    // -------------------------------------------------------------------------
    public function destroy(int $orgId, int $id): mixed
    {
        try {
            $existing = DB::table('org_public_holidays')
                ->where(['id' => $id, 'organization_id' => $orgId])
                ->get();

            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Holiday record not found", code: 404);
            }

            DB::table('org_public_holidays')->update(['is_active' => 0], 'id', $id);

            return responseJson(success: true, data: null, message: "Holiday deactivated successfully");
        } catch (\Exception $e) {
            error_log("Destroy holiday error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to deactivate holiday: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // MASTER HOLIDAY CALENDAR — super_admin only.
    // Manages public_holidays_master directly, on top of whatever Import from
    // Mansa already populated. Rows can come from source='api_mansa' (import)
    // or source='manual' (created here) — both are fully editable/deactivatable
    // through these endpoints.
    // =========================================================================

    // -------------------------------------------------------------------------
    // GET /api/v1/holidays/master?country_code=&year=&search=&is_active=&page=&per_page=
    // -------------------------------------------------------------------------
    public function indexMaster(): mixed
    {
        try {
            $countryCode = isset($_GET['country_code']) && $_GET['country_code'] !== ''
                ? strtoupper(trim($_GET['country_code']))
                : null;
            $year     = isset($_GET['year']) && $_GET['year'] !== '' ? (int) $_GET['year'] : null;
            $search   = isset($_GET['search']) && $_GET['search'] !== '' ? trim($_GET['search']) : null;
            $isActive = isset($_GET['is_active']) && $_GET['is_active'] !== '' ? (int) $_GET['is_active'] : null;
            $page     = max(1, (int) ($_GET['page'] ?? 1));
            $perPage  = max(1, min(100, (int) ($_GET['per_page'] ?? 15)));
            $offset   = ($page - 1) * $perPage;

            if ($countryCode && !preg_match('/^[A-Z]{2}$/', $countryCode)) {
                return responseJson(success: false, data: null, message: "country_code must be a 2-letter ISO code", code: 400);
            }

            $where  = [];
            $params = [];

            if ($countryCode) {
                $where[]        = 'country_code = :cc';
                $params[':cc']  = $countryCode;
            }
            if ($year) {
                $where[]          = 'YEAR(holiday_date) = :year';
                $params[':year']  = $year;
            }
            if ($search) {
                $where[]            = 'name LIKE :search';
                $params[':search']  = '%' . $search . '%';
            }
            if ($isActive !== null) {
                $where[]               = 'is_active = :is_active';
                $params[':is_active']  = $isActive;
            }

            $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

            $totalRow = DB::raw("SELECT COUNT(*) AS cnt FROM public_holidays_master {$whereSql}", $params);
            $total    = (int) ($totalRow[0]->cnt ?? 0);

            $rows = DB::raw(
                "SELECT * FROM public_holidays_master {$whereSql}
                 ORDER BY holiday_date ASC
                 LIMIT {$perPage} OFFSET {$offset}",
                $params
            );

            return responseJson(
                success: true,
                data: $rows,
                message: "Master holidays fetched successfully",
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => $total,
                        'total_pages'  => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Master holiday index error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: $e->getMessage(), code: 400);
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/v1/holidays/master/{id}
    // -------------------------------------------------------------------------
    public function showMaster(int $id): mixed
    {
        try {
            $row = DB::table('public_holidays_master')->where(['id' => $id])->get();

            if (empty($row)) {
                return responseJson(success: false, data: null, message: "Master holiday not found", code: 404);
            }

            return responseJson(success: true, data: $row[0], message: "Master holiday fetched successfully");
        } catch (\Exception $e) {
            error_log("Master holiday show error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: $e->getMessage(), code: 400);
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/v1/holidays/master
    // Body: { country_code, holiday_date, name, type?, is_active? }
    // Manually adds a holiday to the master calendar (on top of whatever
    // Import from Mansa already populated).
    // -------------------------------------------------------------------------
    public function storeMaster(): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            foreach (['country_code', 'holiday_date', 'name'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(success: false, data: null, message: "Field '$f' is required", code: 400);
                }
            }

            $countryCode = strtoupper(trim($data['country_code']));
            if (!preg_match('/^[A-Z]{2}$/', $countryCode)) {
                return responseJson(success: false, data: null, message: "country_code must be a 2-letter ISO code", code: 400);
            }

            $country = DB::raw(
                "SELECT id FROM countries WHERE iso2 = :cc AND is_active = 1 LIMIT 1",
                [':cc' => $countryCode]
            );
            if (empty($country)) {
                return responseJson(success: false, data: null, message: "Unknown or inactive country_code: {$countryCode}", code: 404);
            }

            if (!\DateTime::createFromFormat('Y-m-d', $data['holiday_date'])) {
                return responseJson(success: false, data: null, message: "holiday_date must be in YYYY-MM-DD format", code: 400);
            }

            if (isset($data['type']) && $data['type'] !== null && !in_array($data['type'], self::HOLIDAY_TYPES, true)) {
                return responseJson(success: false, data: null, message: "type must be one of: " . implode(', ', self::HOLIDAY_TYPES), code: 400);
            }

            $existing = DB::raw(
                "SELECT id FROM public_holidays_master WHERE country_code = :cc AND holiday_date = :date AND name = :name LIMIT 1",
                [':cc' => $countryCode, ':date' => $data['holiday_date'], ':name' => $data['name']]
            );
            if (!empty($existing)) {
                return responseJson(success: false, data: null, message: "A holiday with that date and name already exists for this country", code: 409);
            }

            DB::table('public_holidays_master')->insert([
                'country_code' => $countryCode,
                'holiday_date' => $data['holiday_date'],
                'name'         => $data['name'],
                'type'         => $data['type'] ?? null,
                'is_active'    => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
                'source'       => 'manual',
                'source_id'    => null,
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);

            return responseJson(success: true, data: null, message: "Master holiday created successfully", code: 201);
        } catch (\Exception $e) {
            error_log("Master holiday store error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to create master holiday: " . $e->getMessage(), code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // PUT/PATCH /api/v1/holidays/master/{id}
    // Body: { holiday_date?, name?, type?, is_active? }
    // country_code is intentionally not editable here — deactivate + recreate
    // under the correct country instead, to avoid orphaning org overrides
    // that reference master_holiday_id.
    // -------------------------------------------------------------------------
    public function updateMaster(int $id): mixed
    {
        try {
            $existing = DB::table('public_holidays_master')->where(['id' => $id])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Master holiday not found", code: 404);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $updateData = [];

            if (isset($data['holiday_date'])) {
                if (!\DateTime::createFromFormat('Y-m-d', $data['holiday_date'])) {
                    return responseJson(success: false, data: null, message: "holiday_date must be in YYYY-MM-DD format", code: 400);
                }
                $updateData['holiday_date'] = $data['holiday_date'];
            }

            if (isset($data['name'])) {
                $updateData['name'] = $data['name'];
            }

            if (array_key_exists('type', $data)) {
                if ($data['type'] !== null && !in_array($data['type'], self::HOLIDAY_TYPES, true)) {
                    return responseJson(success: false, data: null, message: "type must be one of: " . implode(', ', self::HOLIDAY_TYPES), code: 400);
                }
                $updateData['type'] = $data['type'];
            }

            if (isset($data['is_active'])) {
                $updateData['is_active'] = (int) (bool) $data['is_active'];
            }

            if (empty($updateData)) {
                return responseJson(success: false, data: null, message: "No fields to update", code: 400);
            }

            $updateData['updated_at'] = date('Y-m-d H:i:s');

            DB::table('public_holidays_master')->update($updateData, 'id', $id);

            return responseJson(success: true, data: null, message: "Master holiday updated successfully");
        } catch (\Exception $e) {
            error_log("Master holiday update error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to update master holiday: " . $e->getMessage(), code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /api/v1/holidays/master/{id}
    // Soft-delete only — sets is_active = 0. Never hard-deletes (audit trail,
    // and org overrides may still reference this master_holiday_id).
    // Reactivating is the same PUT/PATCH endpoint above with is_active: 1.
    // -------------------------------------------------------------------------
    public function destroyMaster(int $id): mixed
    {
        try {
            $existing = DB::table('public_holidays_master')->where(['id' => $id])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Master holiday not found", code: 404);
            }

            DB::table('public_holidays_master')->update(
                ['is_active' => 0, 'updated_at' => date('Y-m-d H:i:s')],
                'id',
                $id
            );

            return responseJson(success: true, data: null, message: "Master holiday deactivated successfully");
        } catch (\Exception $e) {
            error_log("Master holiday destroy error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to deactivate master holiday: " . $e->getMessage(), code: 500);
        }
    }
}