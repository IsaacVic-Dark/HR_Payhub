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
Router::resource('api/v1/organizations/{id}/configs', OrganizationConfigController::class, ['AuthMiddleware']);

// User routes with authentication
Router::resource('api/v1/users', UserController::class, ['AuthMiddleware']);

// Employee routes with authentication and organization access control
Router::resource('api/v1/organizations/{id}/employees', EmployeeController::class, [
    ['AuthMiddleware', ['admin', 'manager']],
    'LeaveAuthorizationMiddleware'
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

// Leave action routes with specific role requirements
Router::post('api/v1/organizations/{org_id}/leaves/{id}/approve', LeaveController::class . '@approve', [
    ['AuthMiddleware', ['admin', 'manager']],
    'LeaveAuthorizationMiddleware'
]);

Router::post('api/v1/organizations/{org_id}/leaves/{id}/reject', LeaveController::class . '@reject', [
    ['AuthMiddleware', ['admin', 'manager']],
    'LeaveAuthorizationMiddleware'
]);

// Notification routes with authentication
Router::resource('api/v1/notifications', NotificationController::class, ['AuthMiddleware']);

// Test route
Router::get('/api/test', function ($d) {
    echo json_encode($d);
});