<?php

namespace App\Controllers;

use App\Services\DB;

class OrganizationController {
    public function index() {
        return responseJson(
            data: DB::table('organizations')->selectAll(),
            message: "Successfull fetch all organisations",
            metadata: ['dev_mode' => true]
        );
    }
    public function create() {
        // Handle file upload for logo
        $logoUrl = handleFileUpload('logo');

        $data = validate([
            'name' => 'required,string',
            'location' => 'required,string',
            // logo_url is not required if file is uploaded
            'logo_url' => $logoUrl ? '' : 'required,string',
            'currency' => 'string'
        ]);

        $finalLogoUrl = $logoUrl ?: $data['logo_url'];

        //insert into db
        $inserted = DB::table('organizations')->insert([
            'name' => $data['name'],
            'location' => $data['location'],
            'logo_url' => $finalLogoUrl,
            'currency' => strtoupper($data['currency']),
        ]);

        return responseJson(
            data: $inserted,
            message: "Organization created successfully",
            metadata: ['dev_mode' => true]
        );
    }

    public function show($id) {
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

    public function update($id) {
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

    public function delete($id) {
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
