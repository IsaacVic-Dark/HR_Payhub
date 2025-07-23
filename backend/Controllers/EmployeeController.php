<?php

namespace App\Controllers;

use App\Services\DB;

class EmployeeController {
    public function index($orgId) {
        $filters = [
            'department' => $_GET['department'] ?? null,
            'position' => $_GET['position'] ?? null,
        ];
        $employees = DB::table('employees')->selectAllWhere('organization_id', $orgId);

        foreach ($filters as $key => $val) {
            if ($val !== null) {
                $employees = array_filter($employees, fn($e) => $e->$key == $val);
            }
        }
        return responseJson(
            data: array_values($employees),
            message: empty($employees) ? "No employees found" : "Fetched employees",
            metadata: ['dev_mode' => true],
            code: empty($employees) ? 404 : 200
        );
    }
    public function create($orgId) {
        $data = validate([
            // 'user_id' => 'numeric',
            'f_name' => 'required,string',
            'l_name' => 'required,string',
            // 'email' => 'required,email',
            'phone' => 'string',
            // 'hire_date' => 'required,string',
            'position' => 'string',
            'department' => 'string',
            'reports_to' => 'numeric',
            'salary' => 'required,numeric',
            'bank_account_number' => 'string',
            'tax_id' => 'nullable|string'
        ]);

        // Generate a random user_id for demonstration purposes
        // $user_id = strtoupper(bin2hex(random_bytes(4)));
        $user_id = 31;

        $hire_date = date('Y-m-d');

        $company = "Techhub";

        $generatedEmail = strtolower($data['f_name'][0] . $data['l_name']) . '@' . strtolower($company) . '.com';

        $existingEmail = DB::table('employees')->selectAllWhere('email', $generatedEmail);
        if ($existingEmail) {
            return responseJson(null, "Email already exists", 400);
        }
        // if (!empty($user_id)) {
        //     $user = DB::table('users')->selectAllWhereID($data['user_id']);
        //     if (!$user) {
        //         return responseJson(null, "Invalid user_id", 400);
        //     }
        // }
        if (!empty($data['reports_to'])) {
            $manager = DB::table('employees')->selectAllWhereID($data['reports_to']);
            if (!$manager) {
                return responseJson(null, "Invalid reports_to (manager)", 400);
            }
        }
        $inserted = DB::table('employees')->insert([
            'organization_id' => $orgId,
            'user_id' => $user_id,
            'f_name' => $data['f_name'],
            'l_name' => $data['l_name'],
            'email' => $generatedEmail,
            'phone' => $data['phone'] ?? null,
            'hire_date' => $hire_date,
            'position' => $data['position'] ?? null,
            'department' => $data['department'] ?? null,
            'reports_to' => $data['reports_to'] ?? null,
            'salary' => $data['salary'],
            'bank_account_number' => $data['bank_account_number'] ?? null,
            'tax_id' => $data['tax_id'] ?? null,
        ]);
        if (!$inserted) {
            return responseJson(null, "Failed to create employee", 500);
        }
        return responseJson(
            data: $inserted,
            message: "Employee created successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function show($orgId, $id) {
        $employee = DB::table('employees')->selectAllWhere('organization_id', $orgId);
        $employee = array_filter($employee, fn($e) => $e->id == $id);
        if (!$employee) {
            return responseJson(null, "Employee not found", 404);
        }
        return responseJson(
            data: array_values($employee)[0],
            message: empty($employee) ? "No employee found" : "Employee fetched successfully",
            metadata: ['dev_mode' => true],
            code: empty($employee) ? 404 : 200
        );
    }
    public function update($orgId, $id) {
        $data = validate([
            'user_id' => 'numeric',
            'f_name' => 'string',
            'l_name' => 'string',
            'email' => 'email',
            'phone' => 'string',
            'hire_date' => 'string',
            'position' => 'string',
            'department' => 'string',
            'reports_to' => 'numeric',
            'salary' => 'numeric',
            'bank_account_number' => 'string',
            'tax_id' => 'string'
        ]);
        $updateData = array_filter($data, fn($v) => $v !== null);
        if (isset($updateData['email'])) {
            $existingEmail = DB::table('employees')->selectAllWhere('email', $updateData['email']);
            if ($existingEmail && $existingEmail[0]->id != $id) {
                return responseJson(null, "Email already exists", 400);
            }
        }
        if (isset($updateData['user_id'])) {
            $user = DB::table('users')->selectAllWhereID($updateData['user_id']);
            if (!$user) {
                return responseJson(null, "Invalid user_id", 400);
            }
        }
        if (isset($updateData['reports_to'])) {
            $manager = DB::table('employees')->selectAllWhereID($updateData['reports_to']);
            if (!$manager) {
                return responseJson(null, "Invalid reports_to (manager)", 400);
            }
        }
        if (empty($updateData)) {
            return responseJson(null, "No data provided for update", 400);
        }
        $employee = DB::table('employees')->selectAllWhere('organization_id', $orgId);
        $employee = array_filter($employee, fn($e) => $e->id == $id);
        if (!$employee) {
            return responseJson(null, "Employee not found", 404);
        }
        $updated = DB::table('employees')->update($updateData, 'id', $id);
        if ($updated) {
            $employee = DB::table('employees')->selectAllWhere('organization_id', $orgId);
            $employee = array_filter($employee, fn($e) => $e->id == $id);
            return responseJson(
                data: array_values($employee)[0],
                message: "Employee updated successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to update employee", 500);
        }
    }
    public function delete($orgId, $id) {
        $employee = DB::table('employees')->selectAllWhere('organization_id', $orgId);
        $employee = array_filter($employee, fn($e) => $e->id == $id);
        if (!$employee) {
            return responseJson(null, "Employee not found", 404);
        }
        $deleted = DB::table('employees')->delete('id', $id);
        if ($deleted) {
            return responseJson(
                data: null,
                message: "Employee deleted successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to delete employee", 500);
        }
    }
}
