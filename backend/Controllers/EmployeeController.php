<?php

namespace App\Controllers;

use App\Services\DB;

class EmployeeController {
    public function index($orgId) {
        $startTime = microtime(true);
        $filters = [
            'department' => $_GET['department'] ?? null,
            'job_title' => $_GET['job_title'] ?? null,
        ];
        // Validate organization ID
        if (!is_numeric($orgId)) {
            return responseJson(null, "Invalid organization ID", 400);
        }
        // cleanup filters
        // to shorten this, but am n confused aboutit as the order matters
        // otherwise we are fuuuucked!
        array_walk($filters, function (&$value) {
            if (is_string($value)) {
                // URL decode if needed
                $value = urldecode($value);
                // Trim whitespace and special characters as before
                $value = trim($value, " \t\n\r\0\x0B");
                // Remove surrounding quotes only (if they exist)
                if (
                    (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                    (str_starts_with($value, "'") && str_ends_with($value, "'"))
                ) {
                    $value = substr($value, 1, -1);
                }
            }
        });

        $employees = cache()->remember("employees_{$orgId}_" . md5(json_encode($filters)),3600,fn() =>
                DB::table('employees')->where([
                    'organization_id' => (int)$orgId,
                    'department' => $filters['department'],
                    'job_title' => $filters['job_title'],
                ])->get()
            );
      

        // Sort employees if sort parameters are provided, use php for now
        // as implementing sorting in SQL would require dynamic query building
        // which i do not have the time for right 

        //but lets add it to filters
        $filters['sort_by'] = $_GET['sort_by'] ?? null;
        $filters['sort_order'] = $_GET['sort_order'] ?? null;

        if (isset($filters['sort_by']) && isset($filters['sort_order'])) {
            $sortBy = $filters['sort_by'];
            $sortOrder = strtolower($filters['sort_order']) === 'desc' ? SORT_DESC : SORT_ASC;
            usort($employees, function ($a, $b) use ($sortBy, $sortOrder) {
                return $sortOrder === SORT_DESC ? $b->$sortBy <=> $a->$sortBy : $a->$sortBy <=> $b->$sortBy;
            });
        }
        return responseJson(
            data: array_values($employees),
            message: empty($employees) ? "No employees found" : "successfully fetched " . count($employees) . " employees",
            metadata: ['dev_mode' => true, 'filters' => $filters, 'total' => count($employees), 'duration' => (microtime(true) - $startTime)],
            code: empty($employees) ? 404 : 200
        );
    }
    public function create($orgId) {
        $data = validate([
            'user_id' => 'numeric',
            'first_name' => 'required,string',
            'last_name' => 'required,string',
            'email' => 'required,email',
            'phone' => 'string',
            'hire_date' => 'required,string',
            'job_title' => 'string',
            'department' => 'string',
            'reports_to' => 'numeric',
            'base_salary' => 'required,numeric',
            'bank_account_number' => 'string',
            'tax_id' => 'string'
        ]);
        $existingEmail = DB::table('employees')->selectAllWhere('email', $data['email']);
        if ($existingEmail) {
            return responseJson(null, "Email already exists", 400);
        }
        if (!empty($data['user_id'])) {
            $user = DB::table('users')->selectAllWhereID($data['user_id']);
            if (!$user) {
                return responseJson(null, "Invalid user_id", 400);
            }
        }
        if (!empty($data['reports_to'])) {
            $manager = DB::table('employees')->selectAllWhereID($data['reports_to']);
            if (!$manager) {
                return responseJson(null, "Invalid reports_to (manager)", 400);
            }
        }
        $inserted = DB::table('employees')->insert([
            'organization_id' => $orgId,
            'user_id' => $data['user_id'] ?? null,
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'hire_date' => $data['hire_date'],
            'job_title' => $data['job_title'] ?? null,
            'department' => $data['department'] ?? null,
            'reports_to' => $data['reports_to'] ?? null,
            'base_salary' => $data['base_salary'],
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
            'first_name' => 'string',
            'last_name' => 'string',
            'email' => 'email',
            'phone' => 'string',
            'hire_date' => 'string',
            'job_title' => 'string',
            'department' => 'string',
            'reports_to' => 'numeric',
            'base_salary' => 'numeric',
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
