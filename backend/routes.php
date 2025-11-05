<?php
// routes.php

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

// Authentication routes - ALL with consistent /api/v1 prefix
Router::post('/api/v1/auth/login', AuthController::class . '@login');
Router::post('/api/v1/auth/register', AuthController::class . '@register');
Router::post('/api/v1/auth/register/employee', AuthController::class . '@registerEmployee');
Router::post('/api/v1/auth/check-email', AuthController::class . '@checkEmail');
Router::post('/api/v1/auth/refresh', AuthController::class . '@refreshToken');
Router::post('/api/v1/auth/logout', AuthController::class . '@logout');
Router::get('/api/v1/auth/me', AuthController::class . '@me');

// Your existing routes
Router::resource('api/v1/organizations', OrganizationController::class);
Router::resource('api/v1/organizations/{id}/configs', OrganizationConfigController::class);
Router::resource('api/v1/users', UserController::class);
Router::resource('api/v1/organizations/{id}/employees', EmployeeController::class);
Router::resource('api/v1/organizations/{id}/payruns', PayrunController::class);
Router::resource('api/v1/payruns/{id}/details', PayrunDetailController::class);

// Leave routes with full CRUD and actions
Router::get('api/v1/organizations/leaves', LeaveController::class . '@index');
Router::get('api/v1/organizations/leaves/statistics', LeaveController::class . '@statistics');
Router::get('api/v1/organizations/leaves/{id}', LeaveController::class . '@show');
Router::post('api/v1/organizations/leaves', LeaveController::class . '@store');
Router::put('api/v1/organizations/leaves/{id}', LeaveController::class . '@update');
Router::patch('api/v1/organizations/leaves/{id}', LeaveController::class . '@update');
Router::delete('api/v1/organizations/leaves/{id}', LeaveController::class . '@destroy');

// Leave action routes
Router::post('api/v1/organizations/leaves/{id}/approve', LeaveController::class . '@approve');
Router::post('api/v1/organizations/leaves/{id}/reject', LeaveController::class . '@reject');

// Notification routes
Router::resource('api/v1/notifications', NotificationController::class);

Router::get('/api/test', function ($d) {
    echo json_encode($d);
});