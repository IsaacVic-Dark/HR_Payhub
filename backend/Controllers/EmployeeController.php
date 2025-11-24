<?php

namespace App\Controllers;

use App\Services\DB;

class EmployeeController {
    public function index($orgId) {
        $startTime = microtime(true);
        
        // Validate organization ID
        if (!is_numeric($orgId)) {
            return responseJson(null, "Invalid organization ID", 400);
        }

        // Apply role-based filters FIRST
        $roleFilters = $this->applyRoleBasedFilters($orgId);
        
        // Then apply user-provided filters
        $userFilters = [
            'department' => $_GET['department'] ?? null,
            'job_title' => $_GET['job_title'] ?? null,
        ];
        
        // Cleanup user filters
        array_walk($userFilters, function (&$value) {
            if (is_string($value)) {
                $value = urldecode($value);
                $value = trim($value, " \t\n\r\0\x0B");
                if (
                    (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                    (str_starts_with($value, "'") && str_ends_with($value, "'"))
                ) {
                    $value = substr($value, 1, -1);
                }
            }
        });

        // Build base query with role-based filtering
        $queryData = $this->buildRoleBasedQuery($orgId, $roleFilters);
        $query = $queryData['query'];
        $params = $queryData['params'];

        // Apply user filters
        if (!empty($userFilters['department'])) {
            $query .= " AND e.department = :department";
            $params[':department'] = $userFilters['department'];
        }

        if (!empty($userFilters['job_title'])) {
            $query .= " AND e.job_title = :job_title";
            $params[':job_title'] = $userFilters['job_title'];
        }

        // Execute query with parameters to prevent SQL injection
        $employees = empty($params) ? DB::raw($query) : DB::raw($query, $params);

        // Apply sorting
        $userFilters['sort_by'] = $_GET['sort_by'] ?? null;
        $userFilters['sort_order'] = $_GET['sort_order'] ?? null;

        if (isset($userFilters['sort_by']) && isset($userFilters['sort_order'])) {
            $sortBy = $userFilters['sort_by'];
            $sortOrder = strtolower($userFilters['sort_order']) === 'desc' ? SORT_DESC : SORT_ASC;
            usort($employees, function ($a, $b) use ($sortBy, $sortOrder) {
                return $sortOrder === SORT_DESC ? $b->$sortBy <=> $a->$sortBy : $a->$sortBy <=> $b->$sortBy;
            });
        }

        // Apply field-level security based on role
        $employees = $this->applyFieldLevelSecurity($employees, $roleFilters);

        return responseJson(
            data: array_values($employees),
            message: empty($employees) ? "No employees found" : "successfully fetched " . count($employees) . " employees",
            metadata: [
                'dev_mode' => true, 
                'filters' => array_merge($userFilters, ['role_filters' => $roleFilters]), 
                'total' => count($employees), 
                'duration' => (microtime(true) - $startTime)
            ],
            code: empty($employees) ? 404 : 200
        );
    }
    
    public function store($orgId) {
        // Check if user has permission to create employees
        $user = \App\Middleware\AuthMiddleware::getCurrentUser();
        if (!in_array($user['user_type'], ['admin', 'hr_manager'])) {
            return responseJson(null, "Not permitted to create employees", 403);
        }

        $data = validate([
            'user_id' => 'numeric',
            'first_name' => 'required,string',
            'middle_name' => 'string',
            'surname' => 'required,string',
            'personal_email' => 'email',
            'phone' => 'string',
            'hire_date' => 'required,string',
            'job_title' => 'string',
            'department' => 'string',
            'reports_to' => 'required,numeric',
            'base_salary' => 'required,numeric',
            'bank_account_number' => 'string',
            'tax_id' => 'string'
        ]);

        // echo $data['first_name'] . ' ' . $data['middle_name'] . ' ' . $data['surname'];

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

        $default_password = password_hash('password', PASSWORD_BCRYPT);

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
                $email = strtolower(substr($data['first_name'], 0, 1)) . '.' . strtolower($data['surname']) . '@' . $domain;

                //generate username
                $username = strtolower(substr($data['first_name'], 0, 1)) . '.' . strtolower($data['surname']);

                // 5. Insert user with personal_email, middle_name, and surname
                $personalEmail = !empty($data['personal_email']) ? "'{$data['personal_email']}'" : 'NULL';
                $middleName = !empty($data['middle_name']) ? "'{$data['middle_name']}'" : 'NULL';
                
                $insertUserSQL = "INSERT INTO users (organization_id, username, first_name, middle_name, surname, password_hash, email, personal_email, user_type, created_at) 
            VALUES ({$orgId}, '{$username}', '{$data['first_name']}', {$middleName}, '{$data['surname']}', '{$default_password}', '{$email}', {$personalEmail}, 'employee', NOW())
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
                $result = DB::raw("SELECT e.*, u.username, u.email, u.personal_email, u.first_name, u.middle_name, u.surname 
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
        // First check if user has access to this employee
        $roleFilters = $this->applyRoleBasedFilters($orgId);
        
        if (isset($roleFilters['employee_id']) && $roleFilters['employee_id'] != $id) {
            return responseJson(null, "Access denied to this employee", 403);
        }
        
        if (isset($roleFilters['team_employees']) && !in_array($id, $roleFilters['team_employees'])) {
            return responseJson(null, "Access denied to this employee", 403);
        }

        $query = "SELECT e.*, u.username, u.email, u.personal_email, u.first_name, u.middle_name, u.surname 
                  FROM employees e 
                  LEFT JOIN users u ON e.user_id = u.id 
                  WHERE e.organization_id = {$orgId} AND e.id = {$id}";
        
        $employee = DB::raw($query);
        
        if (!$employee || empty($employee)) {
            return responseJson(null, "Employee not found", 404);
        }
        
        // Apply field-level security
        $employee = $this->applyFieldLevelSecurity($employee, $roleFilters);
        
        return responseJson(
            data: $employee[0],
            message: "Employee fetched successfully",
            metadata: ['dev_mode' => true],
            code: 200
        );
    }
    
    /*
     * Update an employee's details
     * @param int $orgId Organization ID
     * @param int $id Employee ID
     * @return JSON response
     */
    public function update($orgId, $id) {
        // First check if user has access to update this employee
        $roleFilters = $this->applyRoleBasedFilters($orgId);
        
        if (isset($roleFilters['employee_id']) && $roleFilters['employee_id'] != $id) {
            return responseJson(null, "Access denied to update this employee", 403);
        }
        
        if (isset($roleFilters['team_employees']) && !in_array($id, $roleFilters['team_employees'])) {
            return responseJson(null, "Access denied to update this employee", 403);
        }

        // Check if user has permission to update based on role
        $user = \App\Middleware\AuthMiddleware::getCurrentUser();
        $allowedRoles = ['admin', 'hr_manager'];
        
        // Employees can only update their own basic info
        if ($user['user_type'] === 'employee') {
            $allowedFields = ['phone', 'personal_email'];
        } 
        // Managers can update team members' basic info but not financial data
        elseif ($user['user_type'] === 'department_manager') {
            $allowedFields = ['phone', 'job_title', 'department'];
        }
        // Payroll can only update payroll-related fields
        elseif (in_array($user['user_type'], ['payroll_manager', 'payroll_officer'])) {
            $allowedFields = ['base_salary', 'bank_account_number', 'tax_id'];
        }
        // Finance can only update financial fields
        elseif (in_array($user['user_type'], ['accountant', 'finance_manager'])) {
            $allowedFields = ['bank_account_number', 'tax_id'];
        }
        // Auditors have no update permissions
        elseif (in_array($user['user_type'], ['auditor', 'compliance_officer'])) {
            return responseJson(null, "Read-only access - cannot update employees", 403);
        }

        $data = validate([
            'user_id' => 'numeric',
            'first_name' => 'string',
            'middle_name' => 'string',
            'surname' => 'string',
            'email' => 'email',
            'personal_email' => 'email',
            'phone' => 'string',
            'hire_date' => 'string',
            'job_title' => 'string',
            'department' => 'string',
            'reports_to' => 'numeric',
            'base_salary' => 'numeric',
            'bank_account_number' => 'string',
            'tax_id' => 'string'
        ]);
        
        // Filter data based on user role permissions
        if (isset($allowedFields)) {
            $data = array_intersect_key($data, array_flip($allowedFields));
            if (empty($data)) {
                return responseJson(null, "No permitted fields provided for update", 400);
            }
        }
        
        // Separate employee data from user data
        $employeeData = array_filter([
            'phone' => $data['phone'] ?? null,
            'hire_date' => $data['hire_date'] ?? null,
            'job_title' => $data['job_title'] ?? null,
            'department' => $data['department'] ?? null,
            'reports_to' => $data['reports_to'] ?? null,
            'base_salary' => $data['base_salary'] ?? null,
            'bank_account_number' => $data['bank_account_number'] ?? null,
            'tax_id' => $data['tax_id'] ?? null
        ], fn($v) => $v !== null);
        
        $userData = array_filter([
            'first_name' => $data['first_name'] ?? null,
            'middle_name' => $data['middle_name'] ?? null,
            'surname' => $data['surname'] ?? null,
            'email' => $data['email'] ?? null,
            'personal_email' => $data['personal_email'] ?? null
        ], fn($v) => $v !== null);
        
        if (isset($userData['email'])) {
            $existingEmail = DB::table('users')->selectAllWhere('email', $userData['email']);
            if ($existingEmail && $existingEmail[0]->id != $data['user_id']) {
                return responseJson(null, "Email already exists", 400);
            }
        }
        if (isset($data['user_id'])) {
            $user = DB::table('users')->selectAllWhereID($data['user_id']);
            if (!$user) {
                return responseJson(null, "Invalid user_id", 400);
            }
        }
        if (isset($employeeData['reports_to'])) {
            $manager = DB::table('employees')->selectAllWhereID($employeeData['reports_to']);
            if (!$manager) {
                return responseJson(null, "Invalid reports_to (manager)", 400);
            }
        }
        if (empty($employeeData) && empty($userData)) {
            return responseJson(null, "No data provided for update", 400);
        }
        
        // Get employee to find user_id
        $employee = DB::table('employees')->selectAllWhere('organization_id', $orgId);
        $employee = array_filter($employee, fn($e) => $e->id == $id);
        if (!$employee) {
            return responseJson(null, "Employee not found", 404);
        }
        
        $employee = array_values($employee)[0];
        
        // Update employee table
        if (!empty($employeeData)) {
            DB::table('employees')->update($employeeData, 'id', $id);
        }
        
        // Update user table
        if (!empty($userData) && $employee->user_id) {
            DB::table('users')->update($userData, 'id', $employee->user_id);
        }
        
        // Fetch updated employee with user details
        $query = "SELECT e.*, u.username, u.email, u.personal_email, u.first_name, u.middle_name, u.surname 
                  FROM employees e 
                  LEFT JOIN users u ON e.user_id = u.id 
                  WHERE e.organization_id = {$orgId} AND e.id = {$id}";
        
        $updatedEmployee = DB::raw($query);
        
        // Apply field-level security
        $updatedEmployee = $this->applyFieldLevelSecurity($updatedEmployee, $roleFilters);
        
        return responseJson(
            data: $updatedEmployee[0],
            message: "Employee updated successfully",
            metadata: ['dev_mode' => true]
        );
    }
    
    /*
     * Delete an employee
     * @param int $orgId Organization ID
     * @param int $id Employee ID
     * @return JSON response
     */
    public function delete($orgId, $id) {
        // Check if user has permission to delete employees
        $user = \App\Middleware\AuthMiddleware::getCurrentUser();
        if (!in_array($user['user_type'], ['admin', 'hr_manager'])) {
            return responseJson(null, "Insufficient permissions to delete employees", 403);
        }

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

    private function buildRoleBasedQuery($orgId, $roleFilters)
    {
        $baseFields = "e.id, e.organization_id, e.user_id, e.phone, e.hire_date, e.job_title, e.department, e.reports_to, e.status, e.created_at";
        
        // Field-level security based on role
        if (isset($roleFilters['payroll_access']) || isset($roleFilters['financial_access'])) {
            // Payroll/Finance roles can see financial data
            $baseFields .= ", e.base_salary, e.bank_account_number, e.tax_id";
        }
        
        if (isset($roleFilters['full_access']) || in_array($roleFilters['user_type'] ?? '', ['admin', 'hr_manager'])) {
            // Full access roles can see all fields
            $baseFields = "e.*";
        }

        $query = "SELECT {$baseFields}, u.username, u.email, u.personal_email, u.first_name, u.middle_name, u.surname 
                  FROM employees e 
                  LEFT JOIN users u ON e.user_id = u.id 
                  WHERE e.organization_id = :org_id";
        $params = [':org_id' => $orgId];

        // Apply role-based WHERE conditions
        if (isset($roleFilters['employee_id'])) {
            $query .= " AND e.id = :employee_id";
            $params[':employee_id'] = $roleFilters['employee_id'];
        }

        if (isset($roleFilters['team_employees']) && !empty($roleFilters['team_employees'])) {
            $placeholders = implode(',', array_fill(0, count($roleFilters['team_employees']), '?'));
            $query .= " AND e.id IN ($placeholders)";
            $params = array_merge($params, $roleFilters['team_employees']);
        }

        return ['query' => $query, 'params' => $params];
    }

    private function applyFieldLevelSecurity($employees, $roleFilters)
    {
        $sensitiveFields = ['base_salary', 'bank_account_number', 'tax_id', 'personal_email'];
        
        foreach ($employees as $employee) {
            // Remove sensitive fields based on role
            if (isset($roleFilters['employee_id'])) {
                // Employees can see all their own data
                continue;
            }
            
            if (isset($roleFilters['team_employees'])) {
                // Managers cannot see sensitive financial data of team members
                foreach ($sensitiveFields as $field) {
                    if (isset($employee->$field)) {
                        unset($employee->$field);
                    }
                }
            }
            
            if (isset($roleFilters['read_only'])) {
                // Auditors can see financial data but not personal contact info
                if (isset($employee->personal_email)) {
                    unset($employee->personal_email);
                }
                if (isset($employee->phone)) {
                    unset($employee->phone);
                }
            }
        }
        
        return $employees;
    }

    private function applyRoleBasedFilters($orgId)
    {
        $user = \App\Middleware\AuthMiddleware::getCurrentUser();
        $employee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

        if (!$user || !$employee) {
            throw new \Exception('User not authenticated');
        }

        $filters = ['user_type' => $user['user_type']];

        switch ($user['user_type']) {
            case 'admin':
            case 'hr_manager':
                // Full access to all employees
                $filters['organization'] = $orgId;
                $filters['full_access'] = true;
                break;

            case 'payroll_manager':
            case 'payroll_officer':
                // Access to all employees but with payroll field restrictions
                $filters['organization'] = $orgId;
                $filters['payroll_access'] = true;
                break;

            case 'department_manager':
                // Access to team members only
                $filters['organization'] = $orgId;
                $filters['team_employees'] = $this->getTeamEmployeeIds($employee['id']);
                break;

            case 'accountant':
            case 'finance_manager':
                // Access to financial data only
                $filters['organization'] = $orgId;
                $filters['financial_access'] = true;
                break;

            case 'auditor':
            case 'compliance_officer':
                // Read-only access to all employees
                $filters['organization'] = $orgId;
                $filters['read_only'] = true;
                break;

            case 'employee':
                // Access to own data only
                $filters['organization'] = $orgId;
                $filters['employee_id'] = $employee['id'];
                break;

            default:
                throw new \Exception('Unknown user role: ' . $user['user_type']);
        }

        return $filters;
    }

    private function getTeamEmployeeIds($managerId)
    {
        try {
            $query = "
                SELECT id 
                FROM employees 
                WHERE reports_to = :manager_id 
                AND status = 'active'
            ";
            
            $result = DB::raw($query, [':manager_id' => $managerId]);
            return array_column($result, 'id');
        } catch (\Exception $e) {
            error_log('Team employee fetch error: ' . $e->getMessage());
            return [];
        }
    }
}