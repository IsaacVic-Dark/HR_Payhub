<?php

namespace App\Controllers;

use App\Services\DB;

class EmployeeController
{
    public function index($orgId)
    {
        try {
            $startTime = microtime(true);

            // Validate organization ID
            if (!is_numeric($orgId)) {
                return responseJson(
                    success: false,
                    message: "Invalid organization ID",
                    code: 400
                );
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

            // If no employees found
            if (empty($employees)) {
                return responseJson(
                    success: false,
                    message: "No employees found",
                    code: 404,
                    metadata: [
                        'filters' => array_merge($userFilters, ['role_filters' => $roleFilters]),
                        'total' => 0,
                        'duration' => (microtime(true) - $startTime)
                    ]
                );
            }

            // Calculate statistics
            $statistics = $this->calculateStatistics($employees, $orgId);

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
                success: true,
                data: array_values($employees),
                message: "Successfully fetched " . count($employees) . " employees",
                metadata: [
                    'filters' => array_merge($userFilters, ['role_filters' => $roleFilters]),
                    'total' => count($employees),
                    'duration' => (microtime(true) - $startTime),
                    'statistics' => $statistics ?? null,
                ],
                code: 200
            );

        } catch (\Exception $e) {
            error_log("Employee index error: " . $e->getMessage());
            return responseJson(
                success: false,
                message: "Failed to fetch employees: " . $e->getMessage(),
                code: 500
            );
        }
    }

    public function store($orgId)
    {
        try {
            // Check if user has permission to create employees
            $user = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!in_array($user['user_type'], ['admin', 'hr_manager'])) {
                return responseJson(
                    success: false,
                    message: "Not permitted to create employees",
                    code: 403
                );
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

            if (!empty($data['user_id'])) {
                $user = DB::table('users')->selectAllWhereID($data['user_id']);
                if (!$user) {
                    return responseJson(
                        success: false,
                        message: "Invalid user_id",
                        code: 400
                    );
                }
            }

            if (!empty($data['reports_to'])) {
                $manager = DB::table('employees')->selectAllWhereID($data['reports_to']);
                if (!$manager) {
                    return responseJson(
                        success: false,
                        message: "Invalid reports_to (manager)",
                        code: 400
                    );
                }
            }

            $inserted = false;
            $data['hire_date'] = date('Y-m-d', strtotime($data['hire_date']));
            $default_password = password_hash('password', PASSWORD_BCRYPT);

            DB::transaction(function () use ($data, $orgId, &$inserted, $default_password) {

                // 1. Get organization domain first (we need it for email generation)
                $getOrgSQL = "SELECT domain FROM organizations WHERE id = :org_id";
                $orgResult = DB::raw($getOrgSQL, [':org_id' => $orgId]);

                if (empty($orgResult) || !$orgResult[0]->domain) {
                    throw new \Exception("Organization not found or domain is null");
                }

                $domain = $orgResult[0]->domain;

                // 2. Generate email and username
                $baseEmail = strtolower(substr($data['first_name'], 0, 1)) . '.' . strtolower($data['surname']);
                $baseUsername = $baseEmail;
                $email = $baseEmail . '@' . $domain;
                $username = $baseUsername;

                // 3. Handle email/username conflicts by adding numeric suffix
                $emailSuffix = 1;
                while (true) {
                    $existingEmail = DB::raw(
                        "SELECT id FROM users WHERE email = :email LIMIT 1",
                        [':email' => $email]
                    );

                    if (empty($existingEmail)) {
                        break; // Email is unique, we can use it
                    }

                    $emailSuffix++;
                    $email = $baseEmail . $emailSuffix . '@' . $domain;
                    $username = $baseUsername . $emailSuffix;
                }

                // 4. Insert user with the unique email
                $personalEmail = !empty($data['personal_email']) ? "'{$data['personal_email']}'" : 'NULL';
                $middleName = !empty($data['middle_name']) ? "'{$data['middle_name']}'" : 'NULL';

                $insertUserSQL = "INSERT INTO users (
                    organization_id, 
                    username, 
                    first_name, 
                    middle_name, 
                    surname, 
                    password_hash, 
                    email, 
                    personal_email, 
                    user_type, 
                    created_at
                ) VALUES (
                    :org_id, 
                    :username, 
                    :first_name, 
                    {$middleName}, 
                    :surname, 
                    :password_hash, 
                    :email, 
                    {$personalEmail}, 
                    'employee', 
                    NOW()
                )";

                DB::raw($insertUserSQL, [
                    ':org_id' => $orgId,
                    ':username' => $username,
                    ':first_name' => $data['first_name'],
                    ':surname' => $data['surname'],
                    ':password_hash' => $default_password,
                    ':email' => $email
                ]);

                // 5. Get the user ID we just inserted
                $getUserIdSQL = "SELECT LAST_INSERT_ID() as user_id";
                $userResult = DB::raw($getUserIdSQL);
                $user_id = $userResult[0]->user_id;

                // 6. Insert employee (NO EMAIL FIELD - it's in users table)
                $insertEmployeeSQL = "INSERT INTO employees (
                    organization_id, 
                    user_id,
                    phone, 
                    hire_date, 
                    job_title, 
                    department, 
                    reports_to, 
                    base_salary, 
                    bank_account_number, 
                    tax_id, 
                    created_at
                ) VALUES (
                    :org_id,
                    :user_id,
                    :phone, 
                    :hire_date, 
                    :job_title, 
                    :department, 
                    :reports_to, 
                    :base_salary, 
                    :bank_account_number, 
                    :tax_id, 
                    NOW()
                )";

                DB::raw($insertEmployeeSQL, [
                    ':org_id' => $orgId,
                    ':user_id' => $user_id,
                    ':phone' => $data['phone'],
                    ':hire_date' => $data['hire_date'],
                    ':job_title' => $data['job_title'],
                    ':department' => $data['department'],
                    ':reports_to' => $data['reports_to'],
                    ':base_salary' => $data['base_salary'],
                    ':bank_account_number' => $data['bank_account_number'],
                    ':tax_id' => $data['tax_id']
                ]);

                $inserted = true;
            });

            if (!$inserted) {
                return responseJson(
                    success: false,
                    message: "Failed to create employee",
                    code: 500
                );
            }

            // Get the created employee with user details (email comes from users table)
            $result = DB::raw("
                SELECT 
                    e.*, 
                    u.username, 
                    u.email, 
                    u.personal_email, 
                    u.first_name, 
                    u.middle_name, 
                    u.surname 
                FROM employees e 
                LEFT JOIN users u ON e.user_id = u.id 
                WHERE e.phone = :phone 
                ORDER BY e.created_at DESC 
                LIMIT 1
            ", [':phone' => $data['phone']]);

            if (empty($result)) {
                return responseJson(
                    success: false,
                    message: "Employee not found",
                    code: 404
                );
            }

            // Send welcome email
            $mailSent = mail(
                $result[0]->email,
                "Welcome to HR Payhub",
                "Hello {$result[0]->first_name},\n\nYour account has been created successfully.\n\nUsername: {$result[0]->username}\nEmail: {$result[0]->email}\nTemporary Password: password\n\nPlease change your password after your first login.\n\nBest regards,\nHR Payhub Team"
            );

            return responseJson(
                success: true,
                data: $result[0],
                message: "Employee created successfully",
                metadata: [
                    'is_email_sent' => $mailSent ?? false,
                    'generated_email' => $result[0]->email ?? null,
                    'generated_username' => $result[0]->username ?? null
                ],
                code: 201
            );

        } catch (\Exception $e) {
            error_log("Employee store error: " . $e->getMessage());
            return responseJson(
                success: false,
                message: "Error creating employee: " . $e->getMessage(),
                code: 500
            );
        }
    }

    public function show($orgId, $id)
    {
        try {
            // First check if user has access to this employee
            $roleFilters = $this->applyRoleBasedFilters($orgId);

            if (isset($roleFilters['employee_id']) && $roleFilters['employee_id'] != $id) {
                return responseJson(
                    success: false,
                    message: "Access denied to this employee",
                    code: 403
                );
            }

            if (isset($roleFilters['team_employees']) && !in_array($id, $roleFilters['team_employees'])) {
                return responseJson(
                    success: false,
                    message: "Access denied to this employee",
                    code: 403
                );
            }

            $query = "SELECT e.*, u.username, u.email, u.personal_email, u.first_name, u.middle_name, u.surname 
                      FROM employees e 
                      LEFT JOIN users u ON e.user_id = u.id 
                      WHERE e.organization_id = {$orgId} AND e.id = {$id}";

            $employee = DB::raw($query);

            if (!$employee || empty($employee)) {
                return responseJson(
                    success: false,
                    message: "Employee not found",
                    code: 404
                );
            }

            // Apply field-level security
            $employee = $this->applyFieldLevelSecurity($employee, $roleFilters);

            return responseJson(
                success: true,
                data: $employee[0],
                message: "Employee fetched successfully",
                code: 200
            );

        } catch (\Exception $e) {
            error_log("Employee show error: " . $e->getMessage());
            return responseJson(
                success: false,
                message: "Failed to fetch employee: " . $e->getMessage(),
                code: 500
            );
        }
    }

    public function update($orgId, $id)
    {
        try {
            // First check if user has access to update this employee
            $roleFilters = $this->applyRoleBasedFilters($orgId);

            if (isset($roleFilters['employee_id']) && $roleFilters['employee_id'] != $id) {
                return responseJson(
                    success: false,
                    message: "Access denied to update this employee",
                    code: 403
                );
            }

            if (isset($roleFilters['team_employees']) && !in_array($id, $roleFilters['team_employees'])) {
                return responseJson(
                    success: false,
                    message: "Access denied to update this employee",
                    code: 403
                );
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
                return responseJson(
                    success: false,
                    message: "Read-only access - cannot update employees",
                    code: 403
                );
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
                    return responseJson(
                        success: false,
                        message: "No permitted fields provided for update",
                        code: 400
                    );
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
                    return responseJson(
                        success: false,
                        message: "Email already exists",
                        code: 400
                    );
                }
            }
            
            if (isset($data['user_id'])) {
                $user = DB::table('users')->selectAllWhereID($data['user_id']);
                if (!$user) {
                    return responseJson(
                        success: false,
                        message: "Invalid user_id",
                        code: 400
                    );
                }
            }
            
            if (isset($employeeData['reports_to'])) {
                $manager = DB::table('employees')->selectAllWhereID($employeeData['reports_to']);
                if (!$manager) {
                    return responseJson(
                        success: false,
                        message: "Invalid reports_to (manager)",
                        code: 400
                    );
                }
            }
            
            if (empty($employeeData) && empty($userData)) {
                return responseJson(
                    success: false,
                    message: "No data provided for update",
                    code: 400
                );
            }

            // Get employee to find user_id
            $employee = DB::table('employees')->selectAllWhere('organization_id', $orgId);
            $employee = array_filter($employee, fn($e) => $e->id == $id);
            if (!$employee) {
                return responseJson(
                    success: false,
                    message: "Employee not found",
                    code: 404
                );
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
                success: true,
                data: $updatedEmployee[0],
                message: "Employee updated successfully",
                code: 200
            );

        } catch (\Exception $e) {
            error_log("Employee update error: " . $e->getMessage());
            return responseJson(
                success: false,
                message: "Failed to update employee: " . $e->getMessage(),
                code: 500
            );
        }
    }

    public function delete($orgId, $id)
    {
        try {
            // Check if user has permission to delete employees
            $user = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!in_array($user['user_type'], ['admin', 'hr_manager'])) {
                return responseJson(
                    success: false,
                    message: "Insufficient permissions to delete employees",
                    code: 403
                );
            }

            $employee = DB::table('employees')->selectAllWhere('organization_id', $orgId);
            $employee = array_filter($employee, fn($e) => $e->id == $id);
            if (!$employee) {
                return responseJson(
                    success: false,
                    message: "Employee not found",
                    code: 404
                );
            }
            
            $deleted = DB::table('employees')->delete('id', $id);
            if ($deleted) {
                return responseJson(
                    success: true,
                    data: null,
                    message: "Employee deleted successfully",
                    code: 200
                );
            } else {
                return responseJson(
                    success: false,
                    message: "Failed to delete employee",
                    code: 500
                );
            }

        } catch (\Exception $e) {
            error_log("Employee delete error: " . $e->getMessage());
            return responseJson(
                success: false,
                message: "Failed to delete employee: " . $e->getMessage(),
                code: 500
            );
        }
    }

    private function calculateStatistics($employees, $orgId)
    {
        if (empty($employees)) {
            return null;
        }

        $stats = [
            'total' => count($employees),
            'by_department' => [],
            'by_job_title' => [],
            'salary_summary' => [],
            'tenure_summary' => [],
            'status_summary' => [],
        ];

        // Department statistics
        $departments = array_column($employees, 'department');
        $stats['by_department'] = array_count_values($departments);
        arsort($stats['by_department']);

        // Job title statistics
        $jobTitles = array_column($employees, 'job_title');
        $stats['by_job_title'] = array_count_values($jobTitles);
        arsort($stats['by_job_title']);

        // Salary statistics (if salary field is available)
        $salaries = array_filter(array_column($employees, 'base_salary'), 'is_numeric');
        if (!empty($salaries)) {
            $stats['salary_summary'] = [
                'average' => round(array_sum($salaries) / count($salaries), 2),
                'min' => min($salaries),
                'max' => max($salaries),
                'total_monthly' => array_sum($salaries),
                'total_yearly' => array_sum($salaries) * 12,
            ];
        }

        // Tenure statistics (if hire_date is available)
        $currentYear = date('Y');
        $tenureGroups = [
            '<1 year' => 0,
            '1-3 years' => 0,
            '3-5 years' => 0,
            '5-10 years' => 0,
            '>10 years' => 0,
        ];

        foreach ($employees as $employee) {
            if (!empty($employee->hire_date)) {
                $hireYear = date('Y', strtotime($employee->hire_date));
                $years = $currentYear - $hireYear;

                if ($years < 1) $tenureGroups['<1 year']++;
                elseif ($years <= 3) $tenureGroups['1-3 years']++;
                elseif ($years <= 5) $tenureGroups['3-5 years']++;
                elseif ($years <= 10) $tenureGroups['5-10 years']++;
                else $tenureGroups['>10 years']++;
            }
        }
        $stats['tenure_summary'] = $tenureGroups;

        // Status statistics (if status field exists)
        if (isset($employees[0]->status)) {
            $statuses = array_column($employees, 'status');
            $stats['status_summary'] = array_count_values($statuses);
        }

        return $stats;
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