<?php

namespace App\Controllers;

class EmployeeController {
    private $pdo;
    private $defaultLimit = 5;
    private $emailDomain = 'payroll.com';

    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Fetch all employees with pagination
     * @return array [employees, totalPages, currentPage]
     */
    public function fetchAllEmployees(): array {


        $stmt = $this->pdo->prepare("
            SELECT e.*, pd.*
            FROM employees AS e 
            JOIN payrun_details AS pd ON pd.employee_id = e.id
        ");

        $stmt->execute();

        $employees = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        return $employees;
    }

    /**
     * Fetch employee by ID
     * @param int $id
     * @return array|false
     */
    public function fetchEmployeeById(int $id) {
        $stmt = $this->pdo->prepare("SELECT * FROM employees WHERE EmployeeID = :id");
        $stmt->bindParam(':id', $id, \PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetch(\PDO::FETCH_ASSOC);
    }

    /**
     * Search employees by name
     * @param string $name
     * @return array
     */
    public function fetchEmployeeByName(string $name): array {
        $searchTerm = "%{$name}%";
        $stmt = $this->pdo->prepare("
            SELECT * FROM employees 
            WHERE FirstName LIKE :name OR LastName LIKE :name
        ");

        $stmt->bindParam(':name', $searchTerm, \PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Delete employee by ID
     * @param int $id
     * @return bool
     */
    public function deleteEmployeeById(int $id): bool {
        try {
            $this->pdo->beginTransaction();

            // Delete from related tables first (if needed)
            $this->deleteEmployeeRelatedData($id);

            // Delete employee
            $stmt = $this->pdo->prepare("DELETE FROM employees WHERE EmployeeID = :id");
            $stmt->bindParam(':id', $id, \PDO::PARAM_INT);
            $result = $stmt->execute();

            $this->pdo->commit();
            return $result;
        } catch (\Exception $e) {
            $this->pdo->rollBack();
            throw new \Exception("Failed to delete employee: " . $e->getMessage());
        }
    }

    /**
     * Add new employee with related records
     * @param array $employeeDetail
     * @return int Employee ID
     */
    public function addEmployee(array $employeeDetail): int {
        try {
            $this->pdo->beginTransaction();

            // Generate credentials
            $credentials = $this->generateEmployeeCredentials($employeeDetail);

            // Insert employee
            $employeeId = $this->insertEmployee($employeeDetail, $credentials['email']);

            // Insert user account
            $this->insertUserAccount($employeeDetail, $credentials, $employeeId);

            // Insert payroll record
            $this->insertPayrollRecord($employeeId, $employeeDetail['Salary']);

            $this->pdo->commit();
            return $employeeId;
        } catch (\Exception $e) {
            $this->pdo->rollBack();
            throw new \Exception("Failed to add employee: " . $e->getMessage());
        }
    }

    /**
     * Update existing employee
     * @param int $id
     * @param array $employeeDetail
     * @return bool
     */
    public function updateEmployee(int $id, array $employeeDetail): bool {
        try {
            $stmt = $this->pdo->prepare("
                UPDATE Employees SET 
                    FirstName = :FirstName, 
                    LastName = :LastName, 
                    Email = :Email, 
                    Phone = :Phone, 
                    HireDate = :HireDate, 
                    JobTitle = :JobTitle, 
                    Department = :Department, 
                    Salary = :Salary, 
                    BankAccountNumber = :BankAccountNumber, 
                    TaxID = :TaxID
                WHERE EmployeeID = :id
            ");

            return $stmt->execute([
                ':FirstName' => $employeeDetail['FirstName'],
                ':LastName' => $employeeDetail['LastName'],
                ':Email' => $employeeDetail['Email'],
                ':Phone' => $employeeDetail['Phone'],
                ':HireDate' => $employeeDetail['HireDate'],
                ':JobTitle' => $employeeDetail['JobTitle'],
                ':Department' => $employeeDetail['Department'],
                ':Salary' => $employeeDetail['Salary'],
                ':BankAccountNumber' => $employeeDetail['BankAccountNumber'],
                ':TaxID' => $employeeDetail['TaxID'],
                ':id' => $id
            ]);
        } catch (\Exception $e) {
            throw new \Exception("Failed to update employee: " . $e->getMessage());
        }
    }

    /**
     * Count total employees
     * @return int
     */
    public function countEmployees(): int {
        $stmt = $this->pdo->query("SELECT COUNT(*) FROM employees");
        $countEmployees = $stmt->fetchColumn();
        return json_encode($countEmployees);
    }

    /**
     * Set pagination limit
     * @param int $limit
     */
    public function setDefaultLimit(int $limit): void {
        $this->defaultLimit = $limit;
    }

    // Private helper methods

    /**
     * Generate email and password for new employee
     * @param array $employeeDetail
     * @return array
     */
    private function generateEmployeeCredentials(array $employeeDetail): array {
        $firstName = strtolower($employeeDetail['FirstName']);
        $lastName = strtolower($employeeDetail['LastName']);

        $email = "{$firstName}.{$lastName}@{$this->emailDomain}";
        $rawPassword = "payroll@{$firstName}";
        $hashedPassword = password_hash($rawPassword, PASSWORD_BCRYPT);
        $username = "{$firstName}.{$lastName}";

        return [
            'email' => $email,
            'username' => $username,
            'rawPassword' => $rawPassword,
            'hashedPassword' => $hashedPassword
        ];
    }

    /**
     * Insert employee record
     * @param array $employeeDetail
     * @param string $email
     * @return int Employee ID
     */
    private function insertEmployee(array $employeeDetail, string $email): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO Employees (
                FirstName, LastName, Email, Phone, HireDate, 
                JobTitle, Department, Salary, BankAccountNumber, TaxID
            ) VALUES (
                :FirstName, :LastName, :Email, :Phone, :HireDate,
                :JobTitle, :Department, :Salary, :BankAccountNumber, :TaxID
            )
        ");

        $stmt->execute([
            ':FirstName' => $employeeDetail['FirstName'],
            ':LastName' => $employeeDetail['LastName'],
            ':Email' => $email,
            ':Phone' => $employeeDetail['Phone'],
            ':HireDate' => $employeeDetail['HireDate'],
            ':JobTitle' => $employeeDetail['JobTitle'],
            ':Department' => $employeeDetail['Department'],
            ':Salary' => $employeeDetail['Salary'],
            ':BankAccountNumber' => $employeeDetail['BankAccountNumber'],
            ':TaxID' => $employeeDetail['TaxID'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Insert user account
     * @param array $employeeDetail
     * @param array $credentials
     * @param int $employeeId
     */
    private function insertUserAccount(array $employeeDetail, array $credentials, int $employeeId): void {
        $department = strtolower($employeeDetail['Department']);
        $userType = ($department === 'hr') ? 'admin' : 'user';

        $stmt = $this->pdo->prepare("
            INSERT INTO Users (
                Username, PasswordHash, Email, UserType
            ) VALUES (
                :Username, :PasswordHash, :Email, :UserType
            )
        ");

        $stmt->execute([
            ':Username' => $credentials['username'],
            ':PasswordHash' => $credentials['hashedPassword'],
            ':Email' => $credentials['email'],
            ':UserType' => $userType
        ]);
    }

    /**
     * Insert payroll record
     * @param int $employeeId
     * @param float $baseSalary
     */
    private function insertPayrollRecord(int $employeeId, float $baseSalary): void {
        $payPeriodStart = date('Y-m-01');
        $payPeriodEnd = date('Y-m-t');

        $stmt = $this->pdo->prepare("
            INSERT INTO Payroll (
                EmployeeID, PayPeriodStart, PayPeriodEnd, BaseSalary
            ) VALUES (
                :EmployeeID, :PayPeriodStart, :PayPeriodEnd, :BaseSalary
            )
        ");

        $stmt->execute([
            ':EmployeeID' => $employeeId,
            ':PayPeriodStart' => $payPeriodStart,
            ':PayPeriodEnd' => $payPeriodEnd,
            ':BaseSalary' => $baseSalary
        ]);
    }

    /**
     * Delete employee related data (payroll, user accounts, etc.)
     * @param int $employeeId
     */
    private function deleteEmployeeRelatedData(int $employeeId): void {
        // Delete from payroll
        $stmt = $this->pdo->prepare("DELETE FROM payroll WHERE EmployeeID = :id");
        $stmt->bindParam(':id', $employeeId, \PDO::PARAM_INT);
        $stmt->execute();

        // Delete from users (if needed)
        // You might need to get the email first to match the user record
        $employee = $this->fetchEmployeeById($employeeId);
        if ($employee) {
            $stmt = $this->pdo->prepare("DELETE FROM users WHERE Email = :email");
            $stmt->bindParam(':email', $employee['Email'], \PDO::PARAM_STR);
            $stmt->execute();
        }
    }
}
