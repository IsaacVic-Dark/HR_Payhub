<?php

namespace App\Controllers;

use App\Services\DB;

class OrganizationConfigController {
    public function index($orgId) {
        $configType = $_GET['config_type'] ?? null;
        $results = DB::table('organization_configs')->selectAllWhere('organization_id', $orgId);
        if ($configType) {
            $results = array_filter($results, fn($c) => $c->config_type === $configType);
        }
        return responseJson(
            data: array_values($results),
            message: "Fetched organization configs",
            metadata: ['dev_mode' => true]
        );
    }
    public function create($orgId) {
        $data = validate([
            'config_type' => 'required,string',
            'name' => 'required,string',
            'percentage' => 'numeric',
            'fixed_amount' => 'numeric',
            'is_active' => 'numeric'
        ]);
        $inserted = DB::table('organization_configs')->insert([
            'organization_id' => $orgId,
            'config_type' => $data['config_type'],
            'name' => $data['name'],
            'percentage' => $data['percentage'] ?? null,
            'fixed_amount' => $data['fixed_amount'] ?? null,
            'is_active' => isset($data['is_active']) ? (bool)$data['is_active'] : true,
        ]);
        return responseJson(
            data: $inserted,
            message: "Organization config created successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function show($orgId, $id) {
        $config = DB::table('organization_configs')->selectAllWhere('organization_id', $orgId);
        $config = array_filter($config, fn($c) => $c->id == $id);
        if (!$config) {
            return responseJson(null, "Organization config not found", 404);
        }
        return responseJson(
            data: array_values($config)[0],
            message: "Organization config fetched successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function update($orgId, $id) {
        $data = validate([
            'config_type' => 'string',
            'name' => 'string',
            'percentage' => 'numeric',
            'fixed_amount' => 'numeric',
            'is_active' => 'numeric'
        ]);
        $updateData = array_filter($data, fn($v) => $v !== null);
        if (empty($updateData)) {
            return responseJson(null, "No data provided for update", 400);
        }
        $config = DB::table('organization_configs')->selectAllWhere('organization_id', $orgId);
        $config = array_filter($config, fn($c) => $c->id == $id);
        if (!$config) {
            return responseJson(null, "Organization config not found", 404);
        }
        $updated = DB::table('organization_configs')->update($updateData, 'id', $id);
        if ($updated) {
            $config = DB::table('organization_configs')->selectAllWhere('organization_id', $orgId);
            $config = array_filter($config, fn($c) => $c->id == $id);
            return responseJson(
                data: array_values($config)[0],
                message: "Organization config updated successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to update organization config", 500);
        }
    }
    public function delete($orgId, $id) {
        $config = DB::table('organization_configs')->selectAllWhere('organization_id', $orgId);
        $config = array_filter($config, fn($c) => $c->id == $id);
        if (!$config) {
            return responseJson(null, "Organization config not found", 404);
        }
        $deleted = DB::table('organization_configs')->delete('id', $id);
        if ($deleted) {
            return responseJson(
                data: null,
                message: "Organization config deleted successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to delete organization config", 500);
        }
    }
} 