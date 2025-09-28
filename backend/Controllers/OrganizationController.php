<?php

namespace App\Controllers;

use App\Services\DB;

class OrganizationController
{
    public function index()
    {
        // Get query params from request
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $name = isset($_GET['name']) ? trim($_GET['name']) : null;

        $offset = ($page - 1) * $limit;

        // Build WHERE clause and bindings
        $whereClause = '';
        $bindings = [];
        
        if ($name) {
            $whereClause = "WHERE `name` LIKE :name";
            $bindings = ['name' => "%{$name}%"];
        }

        // Get total count
        $countSql = "SELECT COUNT(*) as count FROM organizations {$whereClause}";
        $totalResult = DB::raw($countSql, $bindings);
        $total = isset($totalResult[0]) ? (int) $totalResult[0]->count : 0;

        // Build main query
        $sql = "SELECT * FROM organizations {$whereClause} ORDER BY `created_at` DESC LIMIT {$limit} OFFSET {$offset}";
        
        // Fetch paginated data
        $organizations = DB::raw($sql, $bindings);

        // Calculate pagination metadata
        $totalPages = ceil($total / $limit);

        return responseJson(
            success: true,
            data: $organizations,
            message: "Organizations fetched successfully",
            metadata: [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => $totalPages,
                'dev_mode' => true
            ]
        );
    }
    public function store()
    {
        // Handle file upload for logo
        $logoUrl = handleFileUpload('logo');

        $data = validate([
            'name' => 'required,string',
            'location' => 'required,string',
            // logo_url is not required if file is uploaded
            'logo_url' => $logoUrl ? '' : 'string',
            'domain' => 'string',
            'currency' => 'string'
        ]);

        $finalLogoUrl = $logoUrl ?: $data['logo_url'];

        //insert into db
        $inserted = DB::table('organizations')->insert([
            'name' => $data['name'],
            'location' => $data['location'],
            'domain' => $data['domain'],
            'logo_url' => $finalLogoUrl,
            'currency' => strtoupper($data['currency']),
        ]);

        return responseJson(
            data: $inserted,
            message: "Organization created successfully",
            metadata: ['dev_mode' => true]
        );
    }

    public function show($id)
    {
        $org = DB::table('organizations')->selectAllWhereID($id);
        if (!$org || count($org) === 0) {
            return responseJson(null, "Organization not found", 404);
        }
        return responseJson(
            data: $org[0],
            message: "Organization fetched successfully",
            metadata: ['dev_mode' => true]
        );
    }

    public function update($id)
    {
        // Handle file upload for logo
        $logoUrl = handleFileUpload('logo');

        $data = validate([
            'name' => 'string',
            'location' => 'string',
            'logo_url' => 'string',
            'currency' => 'string'
        ]);

        // Remove nulls (fields not provided)
        $updateData = array_filter($data, fn($v) => $v !== null);
        if ($logoUrl) {
            $updateData['logo_url'] = $logoUrl;
        }
        if (empty($updateData)) {
            return responseJson(null, "No data provided for update", 400);
        }

        $org = DB::table('organizations')->selectAllWhereID($id);
        if (!$org || count($org) === 0) {
            return responseJson(null, "Organization not found", 404);
        }

        $updated = DB::table('organizations')->update($updateData, 'id', $id);
        if ($updated) {
            $org = DB::table('organizations')->selectAllWhereID($id);
            return responseJson(
                data: $org[0],
                message: "Organization updated successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to update organization", 500);
        }
    }

    public function destroy($id)
    {
        $org = DB::table('organizations')->selectAllWhereID($id);
        if (!$org || count($org) === 0) {
            return responseJson(null, "Organization not found", 404);
        }
        $deleted = DB::table('organizations')->delete('id', $id);
        if ($deleted) {
            return responseJson(
                data: null,
                message: "Organization deleted successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to delete organization", 500);
        }
    }
}
