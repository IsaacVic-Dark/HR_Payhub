<?php

use App\Services\Router;
use App\Controllers\OrganizationController;
use App\Controllers\OrganizationConfigController;
use App\Controllers\UserController;
use App\Controllers\EmployeeController;
use App\Controllers\PayrunController;
use App\Controllers\PayrunDetailController;
use App\Controllers\AuditLogController;
use App\Controllers\LeaveController;
use App\Controllers\NotificationController;
use App\Controllers\AuthController;
use App\Controllers\PayrollController;
use App\Controllers\DepartmentController;
use App\Controllers\P9Controller;

// Authentication routes - NO authentication required
Router::post('/api/v1/auth/login', [AuthController::getInstance(), 'login']);
Router::post('/api/v1/auth/register', AuthController::class . '@register');
Router::post('/api/v1/auth/register/employee', AuthController::class . '@registerEmployee');
Router::post('/api/v1/auth/check-email', AuthController::class . '@checkEmail');
Router::post('/api/v1/auth/refresh', AuthController::class . '@refreshToken');

// Authenticated routes
Router::post('/api/v1/auth/logout',  [AuthController::getInstance(), 'logout'], ['AuthMiddleware']);
Router::get('/api/v1/auth/me', [AuthController::getInstance(), 'me'], ['AuthMiddleware']);

// Add this route for getting organization details
Router::get('api/v1/organizations/{org_id}/details', OrganizationController::class . '@showDetails', [
    'AuthMiddleware',
    'OrganizationAuthorizationMiddleware'
]);

// Also update the existing organization routes to use proper authentication
Router::get('api/v1/organizations/{id}', OrganizationController::class . '@show', [
    'AuthMiddleware',
    'OrganizationAuthorizationMiddleware'
]);

Router::put('api/v1/organizations/{id}', OrganizationController::class . '@update', [
    ['AuthMiddleware', ['admin', 'hr_manager', 'finance_manager']],
    'OrganizationAuthorizationMiddleware'
]);

Router::delete('api/v1/organizations/{id}', OrganizationController::class . '@destroy', [
    ['AuthMiddleware', ['admin']],
    'OrganizationAuthorizationMiddleware'
]);

// Organization Config routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/configs', OrganizationConfigController::class . '@index', [
    'AuthMiddleware',
    'OrganizationConfigAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/configs/{id}', OrganizationConfigController::class . '@show', [
    'AuthMiddleware',
    'OrganizationConfigAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/configs', OrganizationConfigController::class . '@store', [
    ['AuthMiddleware', ['admin', 'payroll_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

Router::put('api/v1/organizations/{org_id}/configs/{id}', OrganizationConfigController::class . '@update', [
    ['AuthMiddleware', ['admin', 'payroll_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

Router::patch('api/v1/organizations/{org_id}/configs/{id}', OrganizationConfigController::class . '@update', [
    ['AuthMiddleware', ['admin', 'payroll_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

Router::delete('api/v1/organizations/{org_id}/configs/{id}', OrganizationConfigController::class . '@destroy', [
    ['AuthMiddleware', ['admin', 'payroll_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

// Configuration approval/rejection routes
Router::post('api/v1/organizations/{org_id}/configs/{id}/approve', OrganizationConfigController::class . '@approve', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'finance_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/configs/{id}/reject', OrganizationConfigController::class . '@reject', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'finance_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

// Pending approvals route
Router::get('api/v1/organizations/{org_id}/configs/pending', OrganizationConfigController::class . '@getPendingApprovals', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'finance_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

// Bulk operations (optional)
Router::post('api/v1/organizations/{org_id}/configs/bulk-import', OrganizationConfigController::class . '@bulkImport', [
    ['AuthMiddleware', ['admin', 'payroll_manager']],
    'OrganizationConfigAuthorizationMiddleware'
]);

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

// Payrun routes with comprehensive authentication and authorization
Router::post('api/v1/organizations/{org_id}/payruns', PayrunController::class . '@store', [
    'AuthMiddleware',
    'PayrunAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/payruns', PayrunController::class . '@index', [
    'AuthMiddleware',
    'PayrunAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/payrun/{payrun_id}', PayrunController::class . '@show', [
    'AuthMiddleware',
    'PayrunAuthorizationMiddleware'
]);

Router::put('api/v1/organizations/{org_id}/payrun/{payrun_id}', PayrunController::class . '@update', [
    'AuthMiddleware',
    'PayrunAuthorizationMiddleware'
]);

Router::delete('api/v1/organizations/{org_id}/payrun/{payrun_id}', PayrunController::class . '@destroy', [
    'AuthMiddleware',
    'PayrunAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/payrun/{payrun_id}/process', PayrunController::class . '@processPayrun', [
    ['AuthMiddleware', ['admin', 'super_admin', 'payroll_manager', 'payroll_officer']],
    'PayrunAuthorizationMiddleware'
]);

// Review a payrun (draft → reviewed)
// Allowed roles: admin, payroll_manager, hr_manager, payroll_officer
Router::post('api/v1/organizations/{org_id}/payrun/{payrun_id}/review', PayrunController::class . '@reviewPayrun', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'hr_manager', 'payroll_officer']],
    'PayrunAuthorizationMiddleware'
]);

// Finalize a payrun (reviewed → finalized) — also auto-creates next draft payrun
// Allowed roles: admin, payroll_manager, finance_manager
Router::post('api/v1/organizations/{org_id}/payrun/{payrun_id}/finalize', PayrunController::class . '@finalizePayrun', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'finance_manager']],
    'PayrunAuthorizationMiddleware'
]);

// Audit Log routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/audit-logs', AuditLogController::class . '@index', [
    'AuthMiddleware',
    'AuditLogAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/audit-logs/{id}', AuditLogController::class . '@show', [
    'AuthMiddleware',
    'AuditLogAuthorizationMiddleware'
]);

// Payrun Details routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/payrun/{payrun_id}/employees', PayrunDetailController::class . '@getEmployees', [
    'AuthMiddleware',
    'PayrunDetailAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/payrun/{payrun_id}/details', PayrunDetailController::class . '@index', [
    'AuthMiddleware',
    'PayrunDetailAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/payrun/{payrun_id}/details', PayrunDetailController::class . '@create', [
    'AuthMiddleware',
    'PayrunDetailAuthorizationMiddleware'
]);

Router::get('api/v1/organizations/{org_id}/payrun/{payrun_id}/details/{id}', PayrunDetailController::class . '@show', [
    'AuthMiddleware',
    'PayrunDetailAuthorizationMiddleware'
]);

Router::put('api/v1/organizations/{org_id}/payrun/{payrun_id}/details/{id}', PayrunDetailController::class . '@update', [
    'AuthMiddleware',
    'PayrunDetailAuthorizationMiddleware'
]);

Router::delete('api/v1/organizations/{org_id}/payrun/{payrun_id}/details/{id}', PayrunDetailController::class . '@delete', [
    'AuthMiddleware',
    'PayrunDetailAuthorizationMiddleware'
]);

// GET /api/v1/organizations/{org_id}/p9-forms/statistics
// Aggregate totals grouped by year and status (uses 4 stored total columns directly).
// Roles: admin, hr_manager, payroll_manager, payroll_officer, finance_manager, auditor
Router::get('api/v1/organizations/{org_id}/p9-forms/statistics', P9Controller::class . '@statistics', [
    ['AuthMiddleware', ['admin', 'hr_manager', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor']],
    'P9AuthorizationMiddleware',
]);

// POST /api/v1/organizations/{org_id}/p9-forms/bulk-send
// Mark all 'generated' P9 forms for a given year as 'sent' in one call.
// Body: { "year": 2024 }
// Roles: admin, payroll_manager
// NOTE: replaces old bulk-finalize — status lifecycle is generated→sent→filed
Router::post('api/v1/organizations/{org_id}/p9-forms/bulk-send', P9Controller::class . '@bulkSend', [
    ['AuthMiddleware', ['admin', 'payroll_manager']],
    'P9AuthorizationMiddleware',
]);

// POST /api/v1/organizations/{org_id}/p9-forms/generate
// Generate (or re-generate) P9 forms for a given year.
// Body: { "year": 2024, "employee_ids": [1,2,3], "regenerate": false }
// Roles: admin, payroll_manager, payroll_officer
Router::post('api/v1/organizations/{org_id}/p9-forms/generate', P9Controller::class . '@generate', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'payroll_officer']],
    'P9AuthorizationMiddleware',
]);

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

// GET /api/v1/organizations/{org_id}/p9-forms
// Paginated list. Supports ?year, ?employee_id, ?status, ?department_id, ?page, ?per_page
// Roles: all authenticated org members (employees scoped to own records by middleware)
Router::get('api/v1/organizations/{org_id}/p9-forms', P9Controller::class . '@index', [
    'AuthMiddleware',
    'P9AuthorizationMiddleware',
]);

// ---------------------------------------------------------------------------
// Single P9 form
// ---------------------------------------------------------------------------

// GET /api/v1/organizations/{org_id}/p9-forms/{id}
// Returns header + decoded monthly_data breakdown.
// Roles: all authenticated (employees own only, dept managers team only — enforced by middleware)
Router::get('api/v1/organizations/{org_id}/p9-forms/{id}', P9Controller::class . '@show', [
    'AuthMiddleware',
    'P9AuthorizationMiddleware',
]);

// POST /api/v1/organizations/{org_id}/p9-forms/{id}/send
// Advance status: generated → sent (P9 distributed to employee).
// NOTE: replaces old /finalize — lifecycle step is now 'sent' not 'finalized'
// Roles: admin, payroll_manager, payroll_officer
Router::post('api/v1/organizations/{org_id}/p9-forms/{id}/send', P9Controller::class . '@markSent', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'payroll_officer']],
    'P9AuthorizationMiddleware',
]);

// POST /api/v1/organizations/{org_id}/p9-forms/{id}/file
// Advance status: sent → filed (submitted to KRA).
// Body (optional): { "pdfpath": "/storage/p9/2024/P9-2024-EMP001.pdf" }
// NOTE: replaces old /mark-submitted — maps to p9forms.status = 'filed'
// Roles: admin, payroll_manager
Router::post('api/v1/organizations/{org_id}/p9-forms/{id}/file', P9Controller::class . '@markFiled', [
    ['AuthMiddleware', ['admin', 'payroll_manager']],
    'P9AuthorizationMiddleware',
]);

// PATCH /api/v1/organizations/{org_id}/p9-forms/{id}/pdf-path
// Store the server PDF path after PDF generation.
// Body: { "pdfpath": "/storage/p9/2024/P9-2024-EMP001.pdf" }
// Roles: admin, payroll_manager, payroll_officer
Router::patch('api/v1/organizations/{org_id}/p9-forms/{id}/pdf-path', P9Controller::class . '@updatePdfPath', [
    ['AuthMiddleware', ['admin', 'payroll_manager', 'payroll_officer']],
    'P9AuthorizationMiddleware',
]);

// ---------------------------------------------------------------------------
// Employee-scoped
// ---------------------------------------------------------------------------

// GET /api/v1/organizations/{org_id}/employees/{id}/p9-forms
// All P9 forms for one employee across all years (monthly_data excluded from list).
// Roles: all authenticated (employees own only — enforced by middleware)
Router::get('api/v1/organizations/{org_id}/employees/{id}/p9-forms', P9Controller::class . '@employeeP9s', [
    'AuthMiddleware',
    'P9AuthorizationMiddleware',
]);

// Department routes

// List all departments
Router::get('api/v1/organizations/{org_id}/departments', DepartmentController::class . '@index', [
    'AuthMiddleware',
    'DepartmentAuthorizationMiddleware'
]);

// Get a single department
Router::get('api/v1/organizations/{org_id}/departments/{id}', DepartmentController::class . '@show', [
    'AuthMiddleware',
    'DepartmentAuthorizationMiddleware'
]);

// Create a department — admin, hr_manager only
Router::post('api/v1/organizations/{org_id}/departments', DepartmentController::class . '@store', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'DepartmentAuthorizationMiddleware'
]);

// Update a department — admin, hr_manager only
Router::put('api/v1/organizations/{org_id}/departments/{id}', DepartmentController::class . '@update', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'DepartmentAuthorizationMiddleware'
]);

Router::patch('api/v1/organizations/{org_id}/departments/{id}', DepartmentController::class . '@update', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'DepartmentAuthorizationMiddleware'
]);

// Soft-delete (deactivate) a department — admin, hr_manager only
Router::delete('api/v1/organizations/{org_id}/departments/{id}', DepartmentController::class . '@destroy', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'DepartmentAuthorizationMiddleware'
]);

// Assign or change department head — admin, hr_manager only
Router::post('api/v1/organizations/{org_id}/departments/{id}/assign-head', DepartmentController::class . '@assignHead', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'DepartmentAuthorizationMiddleware'
]);

// List employees in a department
Router::get('api/v1/organizations/{org_id}/departments/{id}/employees', DepartmentController::class . '@employees', [
    'AuthMiddleware',
    'DepartmentAuthorizationMiddleware'
]);

// Leave routes with comprehensive authentication and authorization
Router::get('api/v1/organizations/{org_id}/leaves', LeaveController::class . '@index', [
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

// 1. CANCEL — employee cancels their own pending leave
Router::patch('api/v1/organizations/{org_id}/leaves/{id}/cancel', LeaveController::class . '@cancel', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

// 2. ASSIGN RELIEVER — update reliever on an existing leave
//    Was assignReliever($id) scoped only by leave ID — now also scoped by org
Router::put('api/v1/organizations/{org_id}/leaves/{id}/assign-reliever', LeaveController::class . '@assignReliever', [
    ['AuthMiddleware', ['admin', 'hr_manager', 'hr_officer', 'department_manager']],
    'LeaveAuthorizationMiddleware'
]);

// 5. LEAVE TYPES — list all active leave types for an org
Router::get('api/v1/organizations/{org_id}/leave-types', LeaveController::class . '@getLeaveTypes', [
    'AuthMiddleware',
    'LeaveAuthorizationMiddleware'
]);

// ADD THESE THREE BELOW:

// Create a new leave type — admin, hr_manager only
Router::post('api/v1/organizations/{org_id}/leave-types', LeaveController::class . '@storeLeaveType', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'LeaveAuthorizationMiddleware'
]);

// Update a leave type — admin, hr_manager only
Router::put('api/v1/organizations/{org_id}/leave-types/{type_id}', LeaveController::class . '@updateLeaveType', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'LeaveAuthorizationMiddleware'
]);

Router::patch('api/v1/organizations/{org_id}/leave-types/{type_id}', LeaveController::class . '@updateLeaveType', [
    ['AuthMiddleware', ['admin', 'hr_manager']],
    'LeaveAuthorizationMiddleware'
]);

// Delete (deactivate) a leave type — admin only
Router::delete('api/v1/organizations/{org_id}/leave-types/{type_id}', LeaveController::class . '@destroyLeaveType', [
    ['AuthMiddleware', ['admin']],
    'LeaveAuthorizationMiddleware'
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