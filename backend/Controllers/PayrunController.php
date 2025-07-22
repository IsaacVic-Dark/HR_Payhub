<?php

namespace App\Controllers;

use App\Services\DB;

class PayrunController {
    public function index($orgId) {
        $filters = [
            'status' => $_GET['status'] ?? null,
            'pay_frequency' => $_GET['pay_frequency'] ?? null,
        ];
        $payruns = DB::table('payruns')->selectAllWhere('organization_id', $orgId);
        foreach ($filters as $key => $val) {
            if ($val !== null) {
                $payruns = array_filter($payruns, fn($p) => $p->$key == $val);
            }
        }
        return responseJson(
            data: array_values($payruns),
            message: "Fetched payruns",
            metadata: ['dev_mode' => true]
        );
    }
    public function create($orgId) {
        $data = validate([
            'payrun_name' => 'required,string',
            'pay_period_start' => 'required,string',
            'pay_period_end' => 'required,string',
            'pay_frequency' => 'string',
            'status' => 'string',
            'created_by' => 'required,numeric',
            'reviewed_by' => 'numeric',
            'finalized_by' => 'numeric',
            'total_gross_pay' => 'numeric',
            'total_deductions' => 'numeric',
            'total_net_pay' => 'numeric',
            'employee_count' => 'numeric',
            'reviewed_at' => 'string',
            'finalized_at' => 'string'
        ]);
        $allowedFrequencies = ['weekly', 'bi-weekly', 'monthly'];
        $allowedStatuses = ['draft', 'reviewed', 'finalized'];
        if (isset($data['pay_frequency']) && !in_array($data['pay_frequency'], $allowedFrequencies)) {
            return responseJson(null, "Invalid pay_frequency", 400);
        }
        if (isset($data['status']) && !in_array($data['status'], $allowedStatuses)) {
            return responseJson(null, "Invalid status", 400);
        }
        $userFields = ['created_by', 'reviewed_by', 'finalized_by'];
        foreach ($userFields as $field) {
            if (!empty($data[$field])) {
                $user = DB::table('users')->selectAllWhereID($data[$field]);
                if (!$user) {
                    return responseJson(null, "Invalid $field", 400);
                }
            }
        }
        $inserted = DB::table('payruns')->insert([
            'organization_id' => $orgId,
            'payrun_name' => $data['payrun_name'],
            'pay_period_start' => $data['pay_period_start'],
            'pay_period_end' => $data['pay_period_end'],
            'pay_frequency' => $data['pay_frequency'] ?? 'monthly',
            'status' => $data['status'] ?? 'draft',
            'total_gross_pay' => $data['total_gross_pay'] ?? 0.00,
            'total_deductions' => $data['total_deductions'] ?? 0.00,
            'total_net_pay' => $data['total_net_pay'] ?? 0.00,
            'employee_count' => $data['employee_count'] ?? 0,
            'created_by' => $data['created_by'],
            'reviewed_by' => $data['reviewed_by'] ?? null,
            'finalized_by' => $data['finalized_by'] ?? null,
            'reviewed_at' => $data['reviewed_at'] ?? null,
            'finalized_at' => $data['finalized_at'] ?? null,
        ]);
        return responseJson(
            data: $inserted,
            message: "Payrun created successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function show($orgId, $id) {
        $payrun = DB::table('payruns')->selectAllWhere('organization_id', $orgId);
        $payrun = array_filter($payrun, fn($p) => $p->id == $id);
        if (!$payrun) {
            return responseJson(null, "Payrun not found", 404);
        }
        return responseJson(
            data: array_values($payrun)[0],
            message: "Payrun fetched successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function update($orgId, $id) {
        $data = validate([
            'payrun_name' => 'string',
            'pay_period_start' => 'string',
            'pay_period_end' => 'string',
            'pay_frequency' => 'string',
            'status' => 'string',
            'created_by' => 'numeric',
            'reviewed_by' => 'numeric',
            'finalized_by' => 'numeric',
            'total_gross_pay' => 'numeric',
            'total_deductions' => 'numeric',
            'total_net_pay' => 'numeric',
            'employee_count' => 'numeric',
            'reviewed_at' => 'string',
            'finalized_at' => 'string'
        ]);
        $allowedFrequencies = ['weekly', 'bi-weekly', 'monthly'];
        $allowedStatuses = ['draft', 'reviewed', 'finalized'];
        if (isset($data['pay_frequency']) && !in_array($data['pay_frequency'], $allowedFrequencies)) {
            return responseJson(null, "Invalid pay_frequency", 400);
        }
        if (isset($data['status']) && !in_array($data['status'], $allowedStatuses)) {
            return responseJson(null, "Invalid status", 400);
        }
        $userFields = ['created_by', 'reviewed_by', 'finalized_by'];
        foreach ($userFields as $field) {
            if (!empty($data[$field])) {
                $user = DB::table('users')->selectAllWhereID($data[$field]);
                if (!$user) {
                    return responseJson(null, "Invalid $field", 400);
                }
            }
        }
        $updateData = array_filter($data, fn($v) => $v !== null);
        if (empty($updateData)) {
            return responseJson(null, "No data provided for update", 400);
        }
        $payrun = DB::table('payruns')->selectAllWhere('organization_id', $orgId);
        $payrun = array_filter($payrun, fn($p) => $p->id == $id);
        if (!$payrun) {
            return responseJson(null, "Payrun not found", 404);
        }
        $updated = DB::table('payruns')->update($updateData, 'id', $id);
        if ($updated) {
            $payrun = DB::table('payruns')->selectAllWhere('organization_id', $orgId);
            $payrun = array_filter($payrun, fn($p) => $p->id == $id);
            return responseJson(
                data: array_values($payrun)[0],
                message: "Payrun updated successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to update payrun", 500);
        }
    }
    public function delete($orgId, $id) {
        $payrun = DB::table('payruns')->selectAllWhere('organization_id', $orgId);
        $payrun = array_filter($payrun, fn($p) => $p->id == $id);
        if (!$payrun) {
            return responseJson(null, "Payrun not found", 404);
        }
        $deleted = DB::table('payruns')->delete('id', $id);
        if ($deleted) {
            return responseJson(
                data: null,
                message: "Payrun deleted successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to delete payrun", 500);
        }
    }
} 