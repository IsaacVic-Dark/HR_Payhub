<?php

namespace App\Controllers;

use App\Models\User;
use App\Services\JWTService;
use App\Services\DB;

class AuthController
{
    private static $instance = null;

    private function __construct()
    {
        // Private constructor to prevent direct instantiation
    }

    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // Prevent cloning
    private function __clone() {}

    // Prevent unserialization
    public function __wakeup() {}

    public function login()
    {
        header('Content-Type: application/json');

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (!isset($data['email']) || !isset($data['password'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Email and password are required'
                ]);
                return;
            }

            $user = User::findByEmail($data['email']);

            if (!$user || !password_verify($data['password'], $user['password_hash'])) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'Invalid credentials'
                ]);
                return;
            }

            // Check if user is active via employee record
            $employee = $this->getEmployeeByUserId($user['id']);

            // Uncomment this block if you want to enforce active status
            // if (!$employee || $employee['status'] !== 'active') {
            //     http_response_code(403);
            //     echo json_encode([
            //         'success' => false,
            //         'error' => 'Account is not active'
            //     ]);
            //     return;
            // }

            $payload = [
                'user_id' => $user['id'],
                'email' => $user['email'],
                'user_type' => $user['user_type'],
                'organization_id' => $user['organization_id'],
                'employee_id' => $employee['id'] ?? null
            ];

            $tokens = JWTService::generateToken($payload);

            // Set cookies
            $isProduction = ($_ENV['APP_ENV'] ?? 'development') === 'production';
            $secure = $isProduction;
            $sameSite = 'Lax';

            // Set access token cookie (expires in 1 hour)
            setcookie(
                'access_token',
                $tokens['access_token'],
                [
                    'expires' => time() + 3600,
                    'path' => '/',
                    'domain' => '',
                    'secure' => $secure,
                    'httponly' => false,
                    'samesite' => $sameSite
                ]
            );

            // Set refresh token cookie (expires in 7 days)
            setcookie(
                'refresh_token',
                $tokens['refresh_token'],
                [
                    'expires' => time() + 604800,
                    'path' => '/',
                    'domain' => '',
                    'secure' => $secure,
                    'httponly' => true,
                    'samesite' => $sameSite
                ]
            );

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'username' => $user['username'],
                    'user_type' => $user['user_type'],
                    'organization_id' => $user['organization_id'],
                    'employee' => $employee ? [
                        'id' => $employee['id'],
                        'firstname' => $employee['firstname'],
                        'middlename' => $employee['middlename'],
                        'surname' => $employee['surname'],
                        'personalemail' => $employee['personalemail'],
                        'job_title' => $employee['job_title'],
                        'status' => $employee['status']
                    ] : null
                ],
                'tokens' => $tokens
            ]);
        } catch (\Exception $e) {
            error_log('Login error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Login failed. Please try again.'
            ]);
        }
    }

    public function register()
    {
        header('Content-Type: application/json');

        $data = json_decode(file_get_contents('php://input'), true);

        // Validate required fields
        $required = ['email', 'password', 'firstname', 'surname', 'organization_name'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty(trim($data[$field]))) {
                http_response_code(400);
                echo json_encode(['error' => "Field {$field} is required"]);
                return;
            }
        }

        // Validate email format
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email format']);
            return;
        }

        // Validate personal email if provided
        if (!empty($data['personalemail']) && !filter_var($data['personalemail'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid personal email format']);
            return;
        }

        // Validate password strength
        if (strlen($data['password']) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 8 characters long']);
            return;
        }

        try {
            // Check if user already exists
            $existingUser = User::findByEmail($data['email']);
            if ($existingUser) {
                http_response_code(409);
                echo json_encode(['error' => 'User with this email already exists']);
                return;
            }

            // Use DB::transaction for the entire registration process
            $result = DB::transaction(function () use ($data) {
                // Create organization first
                $organizationData = [
                    'name' => $data['organization_name'],
                    'legal_type' => $data['legal_type'] ?? 'LTD',
                    'official_email' => $data['email'],
                    'currency' => $data['currency'] ?? 'KES',
                    'payroll_schedule' => $data['payroll_schedule'] ?? 'Monthly',
                    'is_active' => 1
                ];

                DB::table('organizations')->insert($organizationData);
                $organizationId = DB::lastInsertId();

                // Create user
                $username = $this->generateUsername($data['firstname'], $data['surname']);
                $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
                $userType = 'admin'; // First user becomes admin

                $userData = [
                    'organization_id' => $organizationId,
                    'username' => $username,
                    'password_hash' => $passwordHash,
                    'email' => $data['email'],
                    'user_type' => $userType
                ];

                DB::table('users')->insert($userData);
                $userId = DB::lastInsertId();

                // Update organization with primary administrator
                DB::table('organizations')->update(
                    ['primary_administrator_id' => $userId],
                    'id',
                    $organizationId
                );

                // Create employee record for the admin
                // Generate unique employee number
                $employeeNumber = $this->generateEmployeeNumber($organizationId);
                
                $employeeData = [
                    'organization_id' => $organizationId,
                    'user_id' => $userId,
                    'has_user' => 1,
                    'employee_number' => $employeeNumber,
                    'firstname' => $data['firstname'],
                    'middlename' => $data['middlename'] ?? null,
                    'surname' => $data['surname'],
                    'personalemail' => $data['personalemail'] ?? $data['email'], // Default to company email if not provided
                    'phone' => $data['phone'] ?? null,
                    'hire_date' => date('Y-m-d'),
                    'start_date' => date('Y-m-d'),
                    'job_title' => $data['job_title'] ?? 'Administrator',
                    'base_salary' => $data['base_salary'] ?? 0,
                    'status' => 'active',
                    'employment_type' => $data['employment_type'] ?? 'full_time',
                    'work_location' => $data['work_location'] ?? 'on-site'
                ];

                DB::table('employees')->insert($employeeData);
                $employeeId = DB::lastInsertId();

                return [
                    'userId' => $userId,
                    'organizationId' => $organizationId,
                    'employeeId' => $employeeId,
                    'userType' => $userType
                ];
            });

            // Get the created employee for response
            $employee = $this->getEmployeeByUserId($result['userId']);

            // Generate tokens for automatic login after registration
            $payload = [
                'user_id' => $result['userId'],
                'email' => $data['email'],
                'user_type' => $result['userType'],
                'organization_id' => $result['organizationId'],
                'employee_id' => $result['employeeId']
            ];

            $tokens = JWTService::generateToken($payload);

            http_response_code(201);
            echo json_encode([
                'message' => 'Registration successful',
                'user' => [
                    'id' => $result['userId'],
                    'email' => $data['email'],
                    'username' => $this->generateUsername($data['firstname'], $data['surname']),
                    'user_type' => $result['userType'],
                    'organization_id' => $result['organizationId'],
                    'organization_name' => $data['organization_name'],
                    'employee' => $employee ? [
                        'id' => $employee['id'],
                        'firstname' => $employee['firstname'],
                        'surname' => $employee['surname'],
                        'personalemail' => $employee['personalemail']
                    ] : null
                ],
                'tokens' => $tokens
            ]);
        } catch (\Exception $e) {
            error_log('Registration error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Registration failed. Please try again.']);
        }
    }

    public function registerEmployee()
    {
        header('Content-Type: application/json');

        $data = json_decode(file_get_contents('php://input'), true);

        // Validate required fields
        $required = ['email', 'password', 'firstname', 'surname', 'organization_id', 'job_title', 'base_salary'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty(trim($data[$field]))) {
                http_response_code(400);
                echo json_encode(['error' => "Field {$field} is required"]);
                return;
            }
        }

        // Validate email format
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email format']);
            return;
        }

        // Validate personal email if provided
        if (!empty($data['personalemail']) && !filter_var($data['personalemail'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid personal email format']);
            return;
        }

        // Validate password strength
        if (strlen($data['password']) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 8 characters long']);
            return;
        }

        $db = DB::getInstance();

        try {
            $db->beginTransaction();

            // Check if user already exists
            $existingUser = User::findByEmail($data['email']);
            if ($existingUser) {
                http_response_code(409);
                echo json_encode(['error' => 'User with this email already exists']);
                return;
            }

            // Check if personal email already exists in employees
            if (!empty($data['personalemail'])) {
                $stmt = $db->prepare("SELECT id FROM employees WHERE personalemail = :personalemail");
                $stmt->execute([':personalemail' => $data['personalemail']]);
                if ($stmt->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'Personal email already exists']);
                    return;
                }
            }

            // Verify organization exists
            $orgStmt = $db->prepare("SELECT id FROM organizations WHERE id = :org_id AND is_active = 1");
            $orgStmt->execute([':org_id' => $data['organization_id']]);
            $organization = $orgStmt->fetch(\PDO::FETCH_ASSOC);

            if (!$organization) {
                http_response_code(404);
                echo json_encode(['error' => 'Organization not found or inactive']);
                return;
            }

            // Create user
            $userStmt = $db->prepare("
                INSERT INTO users 
                (organization_id, username, password_hash, email, user_type) 
                VALUES 
                (:organization_id, :username, :password_hash, :email, :user_type)
            ");

            $username = $this->generateUsername($data['firstname'], $data['surname']);
            $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
            $userType = $data['user_type'] ?? 'employee';

            $userStmt->execute([
                ':organization_id' => $data['organization_id'],
                ':username' => $username,
                ':password_hash' => $passwordHash,
                ':email' => $data['email'],
                ':user_type' => $userType
            ]);

            $userId = $db->lastInsertId();

            // Generate employee number
            $employeeNumber = $this->generateEmployeeNumber($data['organization_id']);

            // Create employee record
            $employeeStmt = $db->prepare("
                INSERT INTO employees 
                (organization_id, user_id, has_user, employee_number, firstname, middlename, surname, personalemail, phone, hire_date, start_date, job_title, department_id, reports_to, base_salary, status, employment_type, work_location) 
                VALUES 
                (:organization_id, :user_id, 1, :employee_number, :firstname, :middlename, :surname, :personalemail, :phone, :hire_date, :start_date, :job_title, :department_id, :reports_to, :base_salary, :status, :employment_type, :work_location)
            ");

            $employeeStmt->execute([
                ':organization_id' => $data['organization_id'],
                ':user_id' => $userId,
                ':employee_number' => $employeeNumber,
                ':firstname' => $data['firstname'],
                ':middlename' => $data['middlename'] ?? null,
                ':surname' => $data['surname'],
                ':personalemail' => $data['personalemail'] ?? null,
                ':phone' => $data['phone'] ?? null,
                ':hire_date' => $data['hire_date'] ?? date('Y-m-d'),
                ':start_date' => $data['start_date'] ?? date('Y-m-d'),
                ':job_title' => $data['job_title'],
                ':department_id' => $data['department_id'] ?? null,
                ':reports_to' => $data['reports_to'] ?? null,
                ':base_salary' => $data['base_salary'],
                ':status' => $data['status'] ?? 'active',
                ':employment_type' => $data['employment_type'] ?? 'full_time',
                ':work_location' => $data['work_location'] ?? 'on-site'
            ]);

            $employeeId = $db->lastInsertId();

            $db->commit();

            http_response_code(201);
            echo json_encode([
                'message' => 'Employee registered successfully',
                'employee' => [
                    'id' => $employeeId,
                    'user_id' => $userId,
                    'employee_number' => $employeeNumber,
                    'email' => $data['email'],
                    'personalemail' => $data['personalemail'] ?? null,
                    'firstname' => $data['firstname'],
                    'surname' => $data['surname'],
                    'job_title' => $data['job_title'],
                    'status' => $data['status'] ?? 'active'
                ]
            ]);
        } catch (\Exception $e) {
            $db->rollBack();
            error_log('Employee registration error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Employee registration failed. Please try again.']);
        }
    }

    public function checkEmail()
    {
        header('Content-Type: application/json');

        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['email'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email is required']);
            return;
        }

        $user = User::findByEmail($data['email']);

        echo json_encode([
            'exists' => !!$user,
            'available' => !$user
        ]);
    }

    public function checkPersonalEmail()
    {
        header('Content-Type: application/json');

        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['personalemail'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Personal email is required']);
            return;
        }

        $db = DB::getInstance();
        $stmt = $db->prepare("SELECT id FROM employees WHERE personalemail = :personalemail");
        $stmt->execute([':personalemail' => $data['personalemail']]);
        $exists = $stmt->fetch();

        echo json_encode([
            'exists' => !!$exists,
            'available' => !$exists
        ]);
    }

    private function generateUsername($firstname, $surname)
    {
        $baseUsername = strtolower($firstname[0] . $surname);
        $baseUsername = preg_replace('/[^a-z0-9]/', '', $baseUsername);

        $username = $baseUsername;
        $counter = 1;

        // Check if username exists and find available one
        while (User::usernameExists($username)) {
            $username = $baseUsername . $counter;
            $counter++;
        }

        return $username;
    }

    private function generateEmployeeNumber($organizationId)
    {
        $db = DB::getInstance();
        
        // Get organization prefix
        $stmt = $db->prepare("SELECT payroll_number_prefix FROM organizations WHERE id = :org_id");
        $stmt->execute([':org_id' => $organizationId]);
        $org = $stmt->fetch(\PDO::FETCH_ASSOC);
        $prefix = $org['payroll_number_prefix'] ?? 'EMP';
        
        // Get the highest employee number for this organization
        $stmt = $db->prepare("
            SELECT employee_number FROM employees 
            WHERE organization_id = :org_id 
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([':org_id' => $organizationId]);
        $last = $stmt->fetch(\PDO::FETCH_ASSOC);
        
        if ($last && preg_match('/(\d+)$/', $last['employee_number'], $matches)) {
            $nextNumber = intval($matches[1]) + 1;
        } else {
            $nextNumber = 1;
        }
        
        return $prefix . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
    }

    public function refreshToken()
    {
        header('Content-Type: application/json');

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (!isset($data['refresh_token'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Refresh token is required'
                ]);
                return;
            }

            $refreshData = JWTService::validateRefreshToken($data['refresh_token']);

            if (!$refreshData) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'Invalid refresh token'
                ]);
                return;
            }

            $user = User::find($refreshData['user_id']);
            if (!$user) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'User not found'
                ]);
                return;
            }

            $employee = $this->getEmployeeByUserId($user['id']);

            $payload = [
                'user_id' => $user['id'],
                'email' => $user['email'],
                'user_type' => $user['user_type'],
                'organization_id' => $user['organization_id'],
                'employee_id' => $employee['id'] ?? null
            ];

            $tokens = JWTService::generateToken($payload);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Token refreshed successfully',
                'tokens' => $tokens
            ]);
        } catch (\Exception $e) {
            error_log('Refresh token error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Token refresh failed'
            ]);
        }
    }

    public function logout()
    {
        header('Content-Type: application/json');

        try {
            // Clear cookies
            $isProduction = ($_ENV['APP_ENV'] ?? 'development') === 'production';
            $secure = $isProduction;
            
            setcookie('access_token', '', [
                'expires' => time() - 3600,
                'path' => '/',
                'domain' => '',
                'secure' => $secure,
                'httponly' => false,
                'samesite' => 'Lax'
            ]);
            
            setcookie('refresh_token', '', [
                'expires' => time() - 3600,
                'path' => '/',
                'domain' => '',
                'secure' => $secure,
                'httponly' => true,
                'samesite' => 'Lax'
            ]);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Logout successful'
            ]);
        } catch (\Exception $e) {
            error_log('Logout error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Logout failed'
            ]);
        }
    }

    public function me()
    {
        header('Content-Type: application/json');

        try {
            $token = $this->getBearerToken();
            if (!$token) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'Token not provided'
                ]);
                return;
            }

            $userData = JWTService::validateToken($token);
            if (!$userData) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'Invalid token'
                ]);
                return;
            }

            $user = User::find($userData['user_id']);
            if (!$user) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'error' => 'User not found'
                ]);
                return;
            }

            $employee = $this->getEmployeeByUserId($user['id']);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'username' => $user['username'],
                    'user_type' => $user['user_type'],
                    'organization_id' => $user['organization_id'],
                    'employee' => $employee ? [
                        'id' => $employee['id'],
                        'employee_number' => $employee['employee_number'],
                        'firstname' => $employee['firstname'],
                        'middlename' => $employee['middlename'],
                        'surname' => $employee['surname'],
                        'personalemail' => $employee['personalemail'],
                        'phone' => $employee['phone'],
                        'job_title' => $employee['job_title'],
                        'department_id' => $employee['department_id'],
                        'status' => $employee['status'],
                        'employment_type' => $employee['employment_type'],
                        'work_location' => $employee['work_location']
                    ] : null
                ]
            ]);
        } catch (\Exception $e) {
            error_log('Me endpoint error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Internal server error'
            ]);
        }
    }

    private function getBearerToken()
    {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }
        
        // Also check cookies as fallback
        if (isset($_COOKIE['access_token'])) {
            return $_COOKIE['access_token'];
        }
        
        return null;
    }

    private function getEmployeeByUserId($userId)
    {
        $result = DB::table('employees')
            ->where(['user_id' => $userId])
            ->get(['*']);

        return !empty($result) ? (array)$result[0] : null;
    }
}