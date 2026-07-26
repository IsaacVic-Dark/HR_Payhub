<?php
// app/Controllers/CountyController.php

namespace App\Controllers;

use App\Services\DB;

class CountyController
{
    // -------------------------------------------------------------------------
    // GET /api/v1/countries/{country_id}/counties
    // Query params: search?, is_active?, page?, per_page?
    // Roles: super_admin only (enforced in routes.php)
    // -------------------------------------------------------------------------
    public function index(int $countryId): mixed
    {
        try {
            $country = DB::table('countries')->where(['id' => $countryId])->get();
            if (empty($country)) {
                return responseJson(success: false, data: null, message: "Country not found", code: 404);
            }

            $page    = max(1, (int) ($_GET['page'] ?? 1));
            $perPage = max(1, min(200, (int) ($_GET['per_page'] ?? 50)));
            $offset  = ($page - 1) * $perPage;

            $search   = $_GET['search']    ?? null;
            $isActive = $_GET['is_active'] ?? null;

            $where  = ["country_id = :country_id"];
            $params = [':country_id' => $countryId];

            if ($search) {
                $where[] = "(name LIKE :search OR code LIKE :search)";
                $params[':search'] = '%' . $search . '%';
            }

            if ($isActive !== null && $isActive !== '') {
                $where[] = "is_active = :is_active";
                $params[':is_active'] = (int) (bool) $isActive;
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM counties $whereClause",
                $params
            )[0]->total ?? 0;

            $dataParams = array_merge($params, [
                ':limit'  => $perPage,
                ':offset' => $offset,
            ]);

            $counties = DB::raw(
                "SELECT id, country_id, name, code, is_active, created_at, updated_at
                 FROM counties
                 $whereClause
                 ORDER BY name ASC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            return responseJson(
                success: true,
                data: $counties,
                message: "Counties fetched successfully",
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
            error_log("County index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch counties",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /api/v1/counties/{id}
     */
    public function show(int $id): mixed
    {
        try {
            $result = DB::raw(
                "SELECT counties.id, counties.country_id, counties.name, counties.code,
                        counties.is_active, counties.created_at, counties.updated_at,
                        countries.name AS country_name, countries.iso2 AS country_iso2
                 FROM counties
                 INNER JOIN countries ON counties.country_id = countries.id
                 WHERE counties.id = :id",
                [':id' => $id]
            );

            if (empty($result)) {
                return responseJson(success: false, data: null, message: "County not found", code: 404);
            }

            return responseJson(success: true, data: $result[0], message: "County fetched successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch county: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /api/v1/countries/{country_id}/counties
     * Body: { name, code?, is_active? }
     */
    public function store(int $countryId): mixed
    {
        try {
            $country = DB::table('countries')->where(['id' => $countryId])->get();
            if (empty($country)) {
                return responseJson(success: false, data: null, message: "Country not found", code: 404);
            }

            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['name'])) {
                return responseJson(success: false, data: null, message: "Field 'name' is required", code: 400);
            }

            $name = trim($data['name']);

            $existing = DB::raw(
                "SELECT id FROM counties WHERE country_id = :country_id AND name = :name LIMIT 1",
                [':country_id' => $countryId, ':name' => $name]
            );

            if (!empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "A county named '$name' already exists for this country",
                    code: 409
                );
            }

            DB::table('counties')->insert([
                'country_id' => $countryId,
                'name'       => $name,
                'code'       => $data['code'] ?? null,
                'is_active'  => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
            ]);

            $newId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $newId],
                message: "County created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Store county error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create county: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * PUT/PATCH /api/v1/counties/{id}
     * Note: country_id is immutable via this endpoint — create a new county
     * under the correct country instead of reassigning an existing one.
     */
    public function update(int $id): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            $existing = DB::table('counties')->where(['id' => $id])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "County not found", code: 404);
            }
            $county = $existing[0];

            $updateData = [];

            if (isset($data['name'])) {
                $name = trim($data['name']);
                if ($name !== $county->name) {
                    $conflict = DB::raw(
                        "SELECT id FROM counties WHERE country_id = :country_id AND name = :name AND id != :id LIMIT 1",
                        [':country_id' => $county->country_id, ':name' => $name, ':id' => $id]
                    );
                    if (!empty($conflict)) {
                        return responseJson(success: false, data: null, message: "A county named '$name' already exists for this country", code: 409);
                    }
                }
                $updateData['name'] = $name;
            }

            if (isset($data['code'])) {
                $updateData['code'] = $data['code'] ?: null;
            }

            if (isset($data['is_active'])) {
                $updateData['is_active'] = (int) (bool) $data['is_active'];
            }

            if (empty($updateData)) {
                return responseJson(success: false, data: null, message: "No fields to update", code: 400);
            }

            DB::table('counties')->update($updateData, 'id', $id);

            return responseJson(success: true, data: null, message: "County updated successfully");
        } catch (\Exception $e) {
            error_log("Update county error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update county: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * DELETE /api/v1/counties/{id}
     * Soft-delete only — organizations.county_id may still reference this
     * row, so we deactivate rather than hard-delete.
     */
    public function destroy(int $id): mixed
    {
        try {
            $existing = DB::table('counties')->where(['id' => $id])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "County not found", code: 404);
            }

            DB::table('counties')->update(['is_active' => 0], 'id', $id);

            return responseJson(success: true, data: null, message: "County deactivated successfully");
        } catch (\Exception $e) {
            error_log("Destroy county error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete county: " . $e->getMessage(),
                code: 500
            );
        }
    }
}