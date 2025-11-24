<?php
// app/Middleware/EmployeeAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class EmployeeAuthorizationMiddleware
{
    public function handle($request, $next, $scope = 'read')
    {
        $user = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required',
                code: 401
            );
        }

        // Super admins cannot access organization data (privacy)
        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organization data is restricted',
                code: 403
            );
        }

        // Apply role-based access control
        switch ($user['user_type']) {
            case 'admin':
                // Admins can access all employees in their organization
                break;
                
            case 'hr_manager':
                // HR Managers can access all employees for HR operations
                break;
                
            case 'payroll_manager':
            case 'payroll_officer':
                // Payroll roles can access employee payroll-related data
                if (!$this->canPayrollAccess($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this employee resource',
                        code: 403
                    );
                }
                break;
                
            case 'department_manager':
                // Department managers can access their team members
                if (!$this->canManagerAccess($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this employee resource',
                        code: 403
                    );
                }
                break;
                
            case 'accountant':
            case 'finance_manager':
                // Finance roles can access financial data only
                if (!$this->canFinanceAccess($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this employee resource',
                        code: 403
                    );
                }
                break;
                
            case 'auditor':
            case 'compliance_officer':
                // Read-only access for auditors
                if (!$this->canAuditAccess($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this employee resource',
                        code: 403
                    );
                }
                break;
                
            case 'employee':
                // Employees can only access their own data
                if (!$this->canEmployeeAccess($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You can only access your own employee data',
                        code: 403
                    );
                }
                break;
                
            default:
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Unknown user role',
                    code: 403
                );
        }

        return $next($request);
    }

    private function canPayrollAccess($payrollUserId, $request, $scope)
    {
        // Payroll roles can view all employees but with limited fields
        // For specific employee access, check if it's within their payroll scope
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $employeeId = $request['params'][1];
            
            // For write operations, payroll needs additional validation
            if ($scope === 'write' && !$this->isPayrollActionAllowed($request)) {
                return false;
            }
            
            return $this->isEmployeeInOrganization($employeeId);
        }

        // For listing, payroll can see all employees (with field restrictions in controller)
        return true;
    }

    private function canManagerAccess($managerId, $request, $scope)
    {
        // Department managers can access their direct reports
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $employeeId = $request['params'][1];
            return $this->isEmployeeInManagerTeam($employeeId, $managerId);
        }

        // For listing, managers can see their team members
        return true;
    }

    private function canFinanceAccess($financeUserId, $request, $scope)
    {
        // Finance roles can only access financial-related data
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $employeeId = $request['params'][1];
            
            // Finance can view employee financial data but not personal HR data
            if ($scope === 'write' && !$this->isFinanceActionAllowed($request)) {
                return false;
            }
            
            return $this->isEmployeeInOrganization($employeeId);
        }

        // For listing, finance can see all employees (with financial field restrictions)
        return true;
    }

    private function canAuditAccess($auditorId, $request, $scope)
    {
        // Auditors have read-only access
        if ($scope !== 'read') {
            return false;
        }

        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $employeeId = $request['params'][1];
            return $this->isEmployeeInOrganization($employeeId);
        }

        // Auditors can list all employees for audit purposes
        return true;
    }

    private function canEmployeeAccess($employeeId, $request, $scope)
    {
        // Employees can only access their own data
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $targetEmployeeId = $request['params'][1];
            return $this->isSameEmployee($targetEmployeeId, $employeeId);
        }

        // For listing, employees should only see themselves
        // This will be handled in the controller with proper filtering
        return true;
    }

    private function isEmployeeInManagerTeam($employeeId, $managerId)
    {
        try {
            $query = "
                SELECT COUNT(*) as count 
                FROM employees 
                WHERE id = :employee_id 
                AND reports_to = :manager_id
                AND status = 'active'
            ";
            
            $result = DB::raw($query, [
                ':employee_id' => $employeeId,
                ':manager_id' => $managerId
            ]);
            
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Manager team access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isEmployeeInOrganization($employeeId)
    {
        try {
            $orgId = AuthMiddleware::getCurrentOrganizationId();
            
            $query = "
                SELECT COUNT(*) as count 
                FROM employees 
                WHERE id = :employee_id 
                AND organization_id = :org_id
            ";
            
            $result = DB::raw($query, [
                ':employee_id' => $employeeId,
                ':org_id' => $orgId
            ]);
            
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Organization employee check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isSameEmployee($targetEmployeeId, $currentEmployeeId)
    {
        return $targetEmployeeId == $currentEmployeeId;
    }

    private function isPayrollActionAllowed($request)
    {
        // Payroll can only perform specific write operations
        $allowedActions = ['update_salary', 'update_allowances', 'update_deductions'];
        $method = $request['method'] ?? '';
        $path = $request['path'] ?? '';
        
        // Implement logic to check if the current request is a payroll-allowed action
        return $this->isPayrollRelatedUpdate($request);
    }

    private function isFinanceActionAllowed($request)
    {
        // Finance can only perform financial-related updates
        $method = $request['method'] ?? '';
        $path = $request['path'] ?? '';
        
        // Implement logic to check if the current request is finance-related
        return $this->isFinancialUpdate($request);
    }

    private function isPayrollRelatedUpdate($request)
    {
        // Check if the update is related to payroll fields only
        $payrollFields = ['base_salary', 'allowances', 'deductions', 'bank_account_number', 'tax_id'];
        
        if (isset($request['data'])) {
            $data = $request['data'];
            $updateFields = array_keys($data);
            
            // Check if all update fields are payroll-related
            foreach ($updateFields as $field) {
                if (!in_array($field, $payrollFields)) {
                    return false;
                }
            }
            return true;
        }
        
        return false;
    }

    private function isFinancialUpdate($request)
    {
        // Check if the update is related to financial fields only
        $financialFields = ['base_salary', 'bank_account_number', 'tax_id'];
        
        if (isset($request['data'])) {
            $data = $request['data'];
            $updateFields = array_keys($data);
            
            // Check if all update fields are financial-related
            foreach ($updateFields as $field) {
                if (!in_array($field, $financialFields)) {
                    return false;
                }
            }
            return true;
        }
        
        return false;
    }
}