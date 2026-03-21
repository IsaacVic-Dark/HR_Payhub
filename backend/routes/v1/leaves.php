<?php

use App\Services\Router;
use App\Controllers\LeaveController;

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

