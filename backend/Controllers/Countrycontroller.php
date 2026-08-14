<?php
// app/Controllers/CountryController.php

namespace App\Controllers;

use App\Services\DB;

class CountryController
{
    // -------------------------------------------------------------------------
    // GET /api/v1/countries
    // Query params: search?, is_active?, page?, per_page?
    // Roles: super_admin only (enforced in routes.php)
    // -------------------------------------------------------------------------
    public function index(): mixed
    {
        try {
            $page    = max(1, (int) ($_GET['page'] ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 50)));
            $offset  = ($page - 1) * $perPage;

            $search   = $_GET['search']    ?? null;
            $isActive = $_GET['is_active'] ?? null;

            $where  = ["1 = 1"];
            $params = [];

            if ($search) {
                $where[] = "(name LIKE :search OR iso2 LIKE :search OR iso3 LIKE :search)";
                $params[':search'] = '%' . $search . '%';
            }

            if ($isActive !== null && $isActive !== '') {
                $where[] = "is_active = :is_active";
                $params[':is_active'] = (int) (bool) $isActive;
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $withMinimal = filter_var($_GET['with_minimal'] ?? false, FILTER_VALIDATE_BOOLEAN);

            if ($withMinimal) {
                $countries = DB::raw(
                    "SELECT id, name, iso2 FROM countries $whereClause ORDER BY name ASC",
                    $params
                );

                return responseJson(
                    success: true,
                    data: $countries,
                    message: "Countries fetched successfully",
                    code: 200
                );
            }

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM countries $whereClause",
                $params
            )[0]->total ?? 0;

            $dataParams = array_merge($params, [
                ':limit'  => $perPage,
                ':offset' => $offset,
            ]);

            $countries = DB::raw(
                "SELECT id, name, iso2, iso3, phone_code, currency_code, currency_symbol,
                        timezone, is_active, created_at, updated_at
                 FROM countries
                 $whereClause
                 ORDER BY name ASC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            return responseJson(
                success: true,
                data: $countries,
                message: "Countries fetched successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => (int) $total,
                        'total_pages'  => (int) ceil($total / $perPage),
                        'has_next'     => $page < ceil($total / $perPage),
                        'has_prev'     => $page > 1,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Country index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch countries",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /api/v1/countries/{id}
     */
    public function show(int $id): mixed
    {
        try {
            $country = DB::table('countries')->where(['id' => $id])->get();

            if (empty($country)) {
                return responseJson(success: false, data: null, message: "Country not found", code: 404);
            }

            $countyCount = DB::raw(
                "SELECT COUNT(*) as count FROM counties WHERE country_id = :country_id",
                [':country_id' => $id]
            )[0]->count ?? 0;

            $result = $country[0];
            $result->county_count = (int) $countyCount;

            return responseJson(success: true, data: $result, message: "Country fetched successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch country: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /api/v1/countries
     * Body: { name, iso2, iso3, phone_code?, currency_code?, currency_symbol?, timezone?, is_active? }
     */
    public function store(): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            foreach (['name', 'iso2', 'iso3'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Field '$f' is required",
                        code: 400
                    );
                }
            }

            $iso2 = strtoupper(trim($data['iso2']));
            $iso3 = strtoupper(trim($data['iso3']));

            if (strlen($iso2) !== 2) {
                return responseJson(success: false, data: null, message: "iso2 must be exactly 2 characters", code: 400);
            }
            if (strlen($iso3) !== 3) {
                return responseJson(success: false, data: null, message: "iso3 must be exactly 3 characters", code: 400);
            }

            $existing = DB::raw(
                "SELECT id FROM countries WHERE iso2 = :iso2 OR iso3 = :iso3 LIMIT 1",
                [':iso2' => $iso2, ':iso3' => $iso3]
            );

            if (!empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "A country with this iso2 or iso3 code already exists",
                    code: 409
                );
            }

            DB::table('countries')->insert([
                'name'            => trim($data['name']),
                'iso2'            => $iso2,
                'iso3'            => $iso3,
                'phone_code'      => $data['phone_code']      ?? null,
                'currency_code'   => isset($data['currency_code']) ? strtoupper(trim($data['currency_code'])) : null,
                'currency_symbol' => $data['currency_symbol'] ?? null,
                'timezone'        => $data['timezone']        ?? null,
                'is_active'       => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
            ]);

            $newId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $newId],
                message: "Country created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Store country error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create country: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * PUT/PATCH /api/v1/countries/{id}
     */
    public function update(int $id): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            $existing = DB::table('countries')->where(['id' => $id])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Country not found", code: 404);
            }
            $country = $existing[0];

            $updateData = [];

            if (isset($data['iso2'])) {
                $iso2 = strtoupper(trim($data['iso2']));
                if (strlen($iso2) !== 2) {
                    return responseJson(success: false, data: null, message: "iso2 must be exactly 2 characters", code: 400);
                }
                if ($iso2 !== $country->iso2) {
                    $conflict = DB::raw(
                        "SELECT id FROM countries WHERE iso2 = :iso2 AND id != :id LIMIT 1",
                        [':iso2' => $iso2, ':id' => $id]
                    );
                    if (!empty($conflict)) {
                        return responseJson(success: false, data: null, message: "A country with iso2 '$iso2' already exists", code: 409);
                    }
                }
                $updateData['iso2'] = $iso2;
            }

            if (isset($data['iso3'])) {
                $iso3 = strtoupper(trim($data['iso3']));
                if (strlen($iso3) !== 3) {
                    return responseJson(success: false, data: null, message: "iso3 must be exactly 3 characters", code: 400);
                }
                if ($iso3 !== $country->iso3) {
                    $conflict = DB::raw(
                        "SELECT id FROM countries WHERE iso3 = :iso3 AND id != :id LIMIT 1",
                        [':iso3' => $iso3, ':id' => $id]
                    );
                    if (!empty($conflict)) {
                        return responseJson(success: false, data: null, message: "A country with iso3 '$iso3' already exists", code: 409);
                    }
                }
                $updateData['iso3'] = $iso3;
            }

            $stringFields = ['name', 'phone_code', 'currency_symbol', 'timezone'];
            foreach ($stringFields as $f) {
                if (isset($data[$f])) $updateData[$f] = trim($data[$f]) ?: null;
            }

            if (isset($data['currency_code'])) {
                $updateData['currency_code'] = strtoupper(trim($data['currency_code'])) ?: null;
            }

            if (isset($data['is_active'])) {
                $updateData['is_active'] = (int) (bool) $data['is_active'];
            }

            if (empty($updateData)) {
                return responseJson(success: false, data: null, message: "No fields to update", code: 400);
            }

            DB::table('countries')->update($updateData, 'id', $id);

            return responseJson(success: true, data: null, message: "Country updated successfully");
        } catch (\Exception $e) {
            error_log("Update country error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update country: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * DELETE /api/v1/countries/{id}
     * Soft-delete only — counties and organizations may still reference this
     * row (counties.country_id, organizations.county_id), so we deactivate
     * rather than hard-delete, matching destroyLeaveType()'s pattern.
     */
    public function destroy(int $id): mixed
    {
        try {
            $existing = DB::table('countries')->where(['id' => $id])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Country not found", code: 404);
            }

            DB::table('countries')->update(['is_active' => 0], 'id', $id);

            return responseJson(success: true, data: null, message: "Country deactivated successfully");
        } catch (\Exception $e) {
            error_log("Destroy country error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete country: " . $e->getMessage(),
                code: 500
            );
        }
    }
}
