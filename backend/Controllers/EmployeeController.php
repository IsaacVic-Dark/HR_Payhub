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

        $query = "SELECT e.*, u.username, u.email, u.first_name, u.last_name 
                  FROM employees e 
                  LEFT JOIN users u ON e.user_id = u.id 
                  WHERE e.organization_id = {$orgId}";

        if (!empty($filters['department'])) {
            $query .= " AND e.department = '{$filters['department']}'";
        }

        if (!empty($filters['job_title'])) {
            $query .= " AND e.job_title = '{$filters['job_title']}'";
        }

        $employees = DB::raw($query);


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
    public function store($orgId) {
        $data = validate([
            'user_id' => 'numeric',
            'first_name' => 'required,string',
            'last_name' => 'required,string',
            'phone' => 'string',
            'hire_date' => 'required,string',
            'job_title' => 'string',
            'department' => 'string',
            'reports_to' => 'required,numeric',
            'base_salary' => 'required,numeric',
            'bank_account_number' => 'string',
            'tax_id' => 'string'
        ]);

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
        $inserted = false;

        //convert hire_date to MySQL format
        $data['hire_date'] = date('Y-m-d', strtotime($data['hire_date']));

        $default_password = password_hash('default_password', PASSWORD_BCRYPT);

        try {
            DB::transaction(function () use ($data, $orgId, &$inserted, $default_password) {

                // 1. Insert employee first and get the ID
                $insertEmployeeSQL = "INSERT INTO employees (organization_id, phone, hire_date, job_title, department, reports_to, base_salary, bank_account_number, tax_id, created_at) 
            VALUES ({$orgId}, '{$data['phone']}', '{$data['hire_date']}', '{$data['job_title']}', '{$data['department']}', {$data['reports_to']}, {$data['base_salary']}, '{$data['bank_account_number']}', '{$data['tax_id']}', NOW())
        ";

                DB::raw($insertEmployeeSQL);

                // 2. Get the employee ID we just inserted
                $getEmployeeIdSQL = "SELECT LAST_INSERT_ID() as employee_id";
                $employeeResult = DB::raw($getEmployeeIdSQL);
                $employee_id = $employeeResult[0]->employee_id;

                // 3. Get organization domain
                $getOrgSQL = "SELECT domain FROM organizations WHERE id = {$orgId}";
                $orgResult = DB::raw($getOrgSQL);

                if (empty($orgResult) || !$orgResult[0]->domain) {
                    throw new \Exception("Organization not found or domain is null");
                }

                $domain = $orgResult[0]->domain;

                // 4. Generate email
                $email = strtolower(substr($data['first_name'], 0, 1)) . '.' . strtolower($data['last_name']) . '@' . $domain;

                //generate username
                $username = strtolower(substr($data['first_name'], 0, 1)) . '.' . strtolower($data['last_name']);

                // 5. Insert user
                $insertUserSQL = "INSERT INTO users (organization_id, username, first_name, last_name, password_hash, email, user_type, created_at) 
            VALUES ({$orgId}, '{$username}', '{$data['first_name']}', '{$data['last_name']}', '{$default_password}', '{$email}', 'employee', NOW())
";

                DB::raw($insertUserSQL);

                // 6. Get the user ID we just inserted
                $getUserIdSQL = "SELECT LAST_INSERT_ID() as user_id";
                $userResult = DB::raw($getUserIdSQL);
                $user_id = $userResult[0]->user_id;

                // 7. Update employee with user_id
                $updateEmployeeSQL = "UPDATE employees SET user_id = {$user_id} WHERE id = {$employee_id};";
                DB::raw($updateEmployeeSQL);

                $inserted = true;
            });

            if (!$inserted) {
                return responseJson(null, "Failed to create employee", 500);
            } else {
                // Get the created employee with user details
                $result = DB::raw("SELECT e.*, u.username, u.email, u.first_name, u.last_name 
                                    FROM employees e 
                                    LEFT JOIN users u ON e.user_id = u.id 
                                    WHERE e.phone = '{$data['phone']}' 
                                    ORDER BY e.created_at DESC 
                                    LIMIT 1");
                if (empty($result)) {
                    return responseJson(null, "Employee not found", 404);
                }
                $mailSent = mail(
                    $result[0]->email,
                    "Welcome to HR Payhub",
                    "Hello {$result[0]->first_name},\n\nYour account has been created successfully. Your username is {$result[0]->username} and your password is 'default_password'. Please change it after your first login.\n\nBest regards,\nHR Payhub Team"
                );
                return responseJson(
                    data: $result[0] ?? null,
                    message: "Employee created successfully",
                    metadata: ['dev_mode' => true, 'is_email_sent' => $mailSent ?? false, 'request_url' => $_SERVER['REQUEST_URI']]
                );
            }
        } catch (\Exception $e) {
            return responseJson(null, "Error creating employee: " . $e->getMessage(), 500);
        }
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
    /*
     * Update an employee's details
     * @param int $orgId Organization ID
     * @param int $id Employee ID
     * @return JSON response
     * 
     * @todo - update to use the create's logic
     */
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
    /*
     * Delete an employee
     * @param int $orgId Organization ID
     * @param int $id Employee ID
     * @return JSON response
     * 
     * @todo - add soft delete functionality
     */
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
