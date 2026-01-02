<?php
// routes.php (Updated)

use App\Services\Router;
use App\Controllers\OrganizationController;
use App\Controllers\OrganizationConfigController;
use App\Controllers\UserController;
use App\Controllers\EmployeeController;
use App\Controllers\PayrunController;
use App\Controllers\PayrunDetailController;
use App\Controllers\LeaveController;
use App\Controllers\NotificationController;
use App\Controllers\AuthController;
use App\Controllers\PayrollController;

// Authentication routes - NO authentication required
Router::post('/api/v1/auth/login', [AuthController::getInstance(), 'login']);
Router::post('/api/v1/auth/register', AuthController::class . '@register');
Router::post('/api/v1/auth/register/employee', AuthController::class . '@registerEmployee');
Router::post('/api/v1/auth/check-email', AuthController::class . '@checkEmail');
Router::post('/api/v1/auth/refresh', AuthController::class . '@refreshToken');

// Authenticated routes
Router::post('/api/v1/auth/logout',  [AuthController::getInstance(), 'logout'], ['AuthMiddleware']);
Router::get('/api/v1/auth/me', [AuthController::getInstance(), 'me'], ['AuthMiddleware']);

// Organization routes with authentication
Router::resource('api/v1/organizations', OrganizationController::class, ['AuthMiddleware']);
Router::put('api/v1/organizations/{id}', OrganizationController::class . '@update');
Router::resource('api/v1/organizations/{id}/configs', OrganizationConfigController::class, ['AuthMiddleware']);

// User routes with authentication
Router::resource('api/v1/users', UserController::class, ['AuthMiddleware']);

// Employee routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/employees', EmployeeController::class . '@index', [
    'AuthMiddleware',
    'EmployeeAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/employees/{id}', EmployeeController::class . '@show', [
    'AuthMiddleware',
    'EmployeeAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/employees', EmployeeController::class . '@store', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'EmployeeAuthorizationMiddleware'
]);

Router::put('api/v1/organizations/{org_id}/employees/{id}', EmployeeController::class . '@update', [
    'AuthMiddleware',
    'EmployeeAuthorizationMiddleware'
]);

Router::patch('api/v1/organizations/{org_id}/employees/{id}', EmployeeController::class . '@update', [
    'AuthMiddleware',
    'EmployeeAuthorizationMiddleware'
]);

Router::delete('api/v1/organizations/{org_id}/employees/{id}', EmployeeController::class . '@delete', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'EmployeeAuthorizationMiddleware'
]);

// Special employee data access routes
Router::get('api/v1/organizations/{org_id}/employees/{id}/payroll-data', EmployeeController::class . '@getPayrollData', [
    ['AuthMiddleware', ['admin', 'hr_manager', 'payroll_manager', 'payroll_officer']],
    'EmployeeAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/employees/{id}/financial-data', EmployeeController::class . '@getFinancialData', [
    ['AuthMiddleware', ['admin', 'finance_manager', 'accountant', 'auditor']],
    'EmployeeAuthorizationMiddleware'
]);

// Payrun routes with authentication
Router::resource('api/v1/organizations/{id}/payruns', PayrunController::class, ['AuthMiddleware']);
Router::resource('api/v1/payruns/{id}/details', PayrunDetailController::class, ['AuthMiddleware']);

// Leave routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/leaves', LeaveController::class . '@index', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/leaves/statistics', LeaveController::class . '@statistics', [
    'AuthMiddleware', 
    'LeaveAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/leaves/{id}', LeaveController::class . '@show', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/leaves', LeaveController::class . '@store', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

Router::put('api/v1/organizations/{org_id}/leaves/{id}', LeaveController::class . '@update', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

Router::patch('api/v1/organizations/{org_id}/leaves/{id}', LeaveController::class . '@update', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

Router::delete('api/v1/organizations/{org_id}/leaves/{id}', LeaveController::class . '@destroy', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

// Leave approval/rejection routes - no need to pass approver_id
Router::post('api/v1/organizations/{org_id}/leaves/{id}/approve', LeaveController::class . '@approve', [
    ['AuthMiddleware', ['admin', 'hr_manager', 'hr_officer', 'department_manager']],
    'LeaveAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/leaves/{id}/reject', LeaveController::class . '@reject', [
    ['AuthMiddleware', ['admin', 'hr_manager', 'hr_officer', 'department_manager']],
    'LeaveAuthorizationMiddleware'
]);

// Employee leave routes
Router::get('api/v1/organizations/{org_id}/employees/{id}/leaves', LeaveController::class . '@myLeaves', [
    'AuthMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/employees/{id}/leaves', LeaveController::class . '@applyLeave', [
    'AuthMiddleware'
]);

// Notification routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/notifications', NotificationController::class . '@index', [
    'AuthMiddleware',
    'NotificationAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/notifications/{id}', NotificationController::class . '@show', [
    'AuthMiddleware',
    'NotificationAuthorizationMiddleware'
]);

Router::patch('api/v1/organizations/{org_id}/notifications/{id}/read', NotificationController::class . '@markAsRead', [
    'AuthMiddleware',
    'NotificationAuthorizationMiddleware'
]);

Router::patch('api/v1/organizations/{org_id}/notifications/mark-all-read', NotificationController::class . '@markAllAsRead', [
    'AuthMiddleware',
    'NotificationAuthorizationMiddleware'
]);

Router::delete('api/v1/organizations/{org_id}/notifications/{id}', NotificationController::class . '@destroy', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'NotificationAuthorizationMiddleware'
]);

// Payroll routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/payrolls', PayrollController::class . '@index', [
    'AuthMiddleware',
    'PayrollAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/payrolls/{id}', PayrollController::class . '@show', [
    'AuthMiddleware',
    'PayrollAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/payrolls', PayrollController::class . '@store', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'payroll_officer']],
    'PayrollAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/payrolls/{id}/approve', PayrollController::class . '@approve', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'finance_manager']],
    'PayrollAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/payrolls/{id}/pay', PayrollController::class . '@pay', [
    ['AuthMiddleware', ['admin', 'finance_manager']],
    'PayrollAuthorizationMiddleware'
]);

// Test route
Router::get('/api/test', function ($d) {
    echo json_encode($d);
});