<?php

namespace App\Controllers;

use App\Models\User;
use App\Services\JWTService;
use App\Services\DB;

class AuthController
{
    public function login()
    {
        header('Content-Type: application/json');

        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['email']) || !isset($data['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email and password are required']);
            return;
        }

        $user = User::findByEmail($data['email']);

        if (!$user || !password_verify($data['password'], $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            return;
        }

        // Check if user is active
        $employee = $this->getEmployeeByUserId($user['id']);
        if (!$employee || $employee['status'] !== 'active') {
            http_response_code(403);
            echo json_encode(['error' => 'Account is not active']);
            return;
        }

        $payload = [
            'user_id' => $user['id'],
            'email' => $user['email'],
            'user_type' => $user['user_type'],
            'organization_id' => $user['organization_id'],
            'employee_id' => $employee['id'] ?? null
        ];

        $tokens = JWTService::generateToken($payload);

        echo json_encode([
            'message' => 'Login successful',
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'first_name' => $user['first_name'],
                'surname' => $user['surname'],
                'user_type' => $user['user_type'],
                'organization_id' => $user['organization_id']
            ],
            'tokens' => $tokens
        ]);
    }

    public function register()
    {
        header('Content-Type: application/json');

        $data = json_decode(file_get_contents('php://input'), true);

        // Validate required fields
        $required = ['email', 'password', 'first_name', 'surname', 'organization_name'];
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

        // Validate password strength
        if (strlen($data['password']) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 8 characters long']);
            return;
        }

        try {
            // Check if user already exists (before starting transaction)
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
                $username = $this->generateUsername($data['first_name'], $data['surname']);
                $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
                $userType = 'admin'; // First user of organization becomes admin

                $userData = [
                    'organization_id' => $organizationId,
                    'username' => $username,
                    'first_name' => $data['first_name'],
                    'middle_name' => $data['middle_name'] ?? null,
                    'surname' => $data['surname'],
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
                $employeeData = [
                    'organization_id' => $organizationId,
                    'user_id' => $userId,
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? null,
                    'hire_date' => date('Y-m-d'),
                    'job_title' => $data['job_title'] ?? 'Administrator',
                    'department' => $data['department'] ?? 'Management',
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
                    'first_name' => $data['first_name'],
                    'surname' => $data['surname'],
                    'user_type' => $result['userType'],
                    'organization_id' => $result['organizationId'],
                    'organization_name' => $data['organization_name']
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

        // Validate required fields for employee registration
        $required = ['email', 'password', 'first_name', 'surname', 'organization_id', 'job_title', 'department', 'base_salary'];
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
                (organization_id, username, first_name, middle_name, surname, password_hash, email, user_type) 
                VALUES 
                (:organization_id, :username, :first_name, :middle_name, :surname, :password_hash, :email, :user_type)
            ");

            $username = $this->generateUsername($data['first_name'], $data['surname'], $db);
            $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
            $userType = 'employee';

            $userStmt->execute([
                ':organization_id' => $data['organization_id'],
                ':username' => $username,
                ':first_name' => $data['first_name'],
                ':middle_name' => $data['middle_name'] ?? null,
                ':surname' => $data['surname'],
                ':password_hash' => $passwordHash,
                ':email' => $data['email'],
                ':user_type' => $userType
            ]);

            $userId = $db->lastInsertId();

            // Create employee record
            $employeeStmt = $db->prepare("
                INSERT INTO employees 
                (organization_id, user_id, email, phone, hire_date, job_title, department, base_salary, status, employment_type, work_location, reports_to) 
                VALUES 
                (:organization_id, :user_id, :email, :phone, :hire_date, :job_title, :department, :base_salary, :status, :employment_type, :work_location, :reports_to)
            ");

            $employeeStmt->execute([
                ':organization_id' => $data['organization_id'],
                ':user_id' => $userId,
                ':email' => $data['email'],
                ':phone' => $data['phone'] ?? null,
                ':hire_date' => $data['hire_date'] ?? date('Y-m-d'),
                ':job_title' => $data['job_title'],
                ':department' => $data['department'],
                ':base_salary' => $data['base_salary'],
                ':status' => $data['status'] ?? 'active',
                ':employment_type' => $data['employment_type'] ?? 'full_time',
                ':work_location' => $data['work_location'] ?? 'on-site',
                ':reports_to' => $data['reports_to'] ?? null
            ]);

            $employeeId = $db->lastInsertId();

            $db->commit();

            http_response_code(201);
            echo json_encode([
                'message' => 'Employee registered successfully',
                'employee' => [
                    'id' => $employeeId,
                    'user_id' => $userId,
                    'email' => $data['email'],
                    'first_name' => $data['first_name'],
                    'surname' => $data['surname'],
                    'job_title' => $data['job_title'],
                    'department' => $data['department']
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

    private function generateUsername($firstName, $lastName)
    {
        $baseUsername = strtolower($firstName[0] . $lastName);
        $baseUsername = preg_replace('/[^a-z0-9]/', '', $baseUsername);

        $username = $baseUsername;
        $counter = 1;

        // Check if username exists and find available one
        while (true) {
            $result = DB::table('users')
                ->where(['username' => $username])
                ->get(['id']);

            if (empty($result)) {
                break;
            }

            $username = $baseUsername . $counter;
            $counter++;
        }

        return $username;
    }

    public function refreshToken()
    {
        header('Content-Type: application/json');

        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['refresh_token'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Refresh token is required']);
            return;
        }

        $refreshData = JWTService::validateRefreshToken($data['refresh_token']);

        if (!$refreshData) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid refresh token']);
            return;
        }

        $user = User::find($refreshData['user_id']);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'User not found']);
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

        echo json_encode([
            'message' => 'Token refreshed successfully',
            'tokens' => $tokens
        ]);
    }

    public function logout()
    {
        header('Content-Type: application/json');
        echo json_encode(['message' => 'Logout successful']);
    }

    public function me()
    {
        header('Content-Type: application/json');

        $token = $this->getBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Token not provided']);
            return;
        }

        $userData = JWTService::validateToken($token);
        if (!$userData) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }

        $user = User::find($userData['user_id']);
        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }

        $employee = $this->getEmployeeByUserId($user['id']);

        echo json_encode([
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'first_name' => $user['first_name'],
                'surname' => $user['surname'],
                'user_type' => $user['user_type'],
                'organization_id' => $user['organization_id'],
                'employee' => $employee
            ]
        ]);
    }

    private function getBearerToken()
    {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }
        return null;
    }

    private function getEmployeeByUserId($userId)
    {
        $db = DB::getInstance();
        $stmt = $db->prepare("
            SELECT e.*, o.name as organization_name 
            FROM employees e 
            LEFT JOIN organizations o ON e.organization_id = o.id 
            WHERE e.user_id = :user_id
        ");
        $stmt->execute([':user_id' => $userId]);
        return $stmt->fetch(\PDO::FETCH_ASSOC);
    }
}
