<?php

namespace App\Controllers;

use App\Services\DB;

class PayrunDetailController {
    public function index($payrunId) {
        $employeeId = $_GET['employee_id'] ?? null;
        $details = DB::table('payrun_details')->selectAllWhere('payrun_id', $payrunId);
        if ($employeeId) {
            $details = array_filter($details, fn($d) => $d->employee_id == $employeeId);
        }
        return responseJson(
            data: array_values($details),
            message: "Fetched payrun details",
            metadata: ['dev_mode' => true]
        );
    }
    public function create($payrunId) {
        $data = validate([
            'employee_id' => 'required,numeric',
            'basic_salary' => 'required,numeric',
            'overtime_amount' => 'numeric',
            'bonus_amount' => 'numeric',
            'commission_amount' => 'numeric',
            'gross_pay' => 'required,numeric',
            'total_deductions' => 'required,numeric',
            'net_pay' => 'required,numeric'
        ]);
        $payrun = DB::table('payruns')->selectAllWhereID($payrunId);
        if (!$payrun) {
            return responseJson(null, "Invalid payrun_id", 400);
        }
        $employee = DB::table('employees')->selectAllWhereID($data['employee_id']);
        if (!$employee) {
            return responseJson(null, "Invalid employee_id", 400);
        }
        $inserted = DB::table('payrun_details')->insert([
            'payrun_id' => $payrunId,
            'employee_id' => $data['employee_id'],
            'basic_salary' => $data['basic_salary'],
            'overtime_amount' => $data['overtime_amount'] ?? 0.00,
            'bonus_amount' => $data['bonus_amount'] ?? 0.00,
            'commission_amount' => $data['commission_amount'] ?? 0.00,
            'gross_pay' => $data['gross_pay'],
            'total_deductions' => $data['total_deductions'],
            'net_pay' => $data['net_pay'],
        ]);
        return responseJson(
            data: $inserted,
            message: "Payrun detail created successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function show($payrunId, $id) {
        $detail = DB::table('payrun_details')->selectAllWhere('payrun_id', $payrunId);
        $detail = array_filter($detail, fn($d) => $d->id == $id);
        if (!$detail) {
            return responseJson(null, "Payrun detail not found", 404);
        }
        return responseJson(
            data: array_values($detail)[0],
            message: "Payrun detail fetched successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function update($payrunId, $id) {
        $data = validate([
            'employee_id' => 'numeric',
            'basic_salary' => 'numeric',
            'overtime_amount' => 'numeric',
            'bonus_amount' => 'numeric',
            'commission_amount' => 'numeric',
            'gross_pay' => 'numeric',
            'total_deductions' => 'numeric',
            'net_pay' => 'numeric'
        ]);
        if (isset($data['employee_id'])) {
            $employee = DB::table('employees')->selectAllWhereID($data['employee_id']);
            if (!$employee) {
                return responseJson(null, "Invalid employee_id", 400);
            }
        }
        $updateData = array_filter($data, fn($v) => $v !== null);
        if (empty($updateData)) {
            return responseJson(null, "No data provided for update", 400);
        }
        $detail = DB::table('payrun_details')->selectAllWhere('payrun_id', $payrunId);
        $detail = array_filter($detail, fn($d) => $d->id == $id);
        if (!$detail) {
            return responseJson(null, "Payrun detail not found", 404);
        }
        $updated = DB::table('payrun_details')->update($updateData, 'id', $id);
        if ($updated) {
            $detail = DB::table('payrun_details')->selectAllWhere('payrun_id', $payrunId);
            $detail = array_filter($detail, fn($d) => $d->id == $id);
            return responseJson(
                data: array_values($detail)[0],
                message: "Payrun detail updated successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to update payrun detail", 500);
        }
    }
    public function delete($payrunId, $id) {
        $detail = DB::table('payrun_details')->selectAllWhere('payrun_id', $payrunId);
        $detail = array_filter($detail, fn($d) => $d->id == $id);
        if (!$detail) {
            return responseJson(null, "Payrun detail not found", 404);
        }
        $deleted = DB::table('payrun_details')->delete('id', $id);
        if ($deleted) {
            return responseJson(
                data: null,
                message: "Payrun detail deleted successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to delete payrun detail", 500);
        }
    }
} 