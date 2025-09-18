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
use App\Controllers\AuthController; // Add this line

// In your routes.php, add this at the end:
// Router::options('api/v1/{any}', function($any) {
//     http_response_code(200);
//     exit;
// });

// Router::options('api/v1/{any}/{id}', function($any, $id) {
//     http_response_code(200);
//     exit;
// });

// Add authentication routes
Router::post('api/v1/auth/login', AuthController::class . '@login');
Router::post('api/v1/auth/logout', AuthController::class . '@logout');
Router::get('api/v1/auth/user', AuthController::class . '@user');

// Your existing routes
Router::resource('api/v1/organizations', OrganizationController::class);
Router::resource('api/v1/organizations/{id}/configs', OrganizationConfigController::class);
Router::resource('api/v1/users', UserController::class);
Router::resource('api/v1/organizations/{id}/employees', EmployeeController::class);
Router::resource('api/v1/organizations/{id}/payruns', PayrunController::class);
Router::resource('api/v1/organizations/leaves', LeaveController::class);
Router::resource('api/v1/organizations/notifications', NotificationController::class);
Router::resource('api/v1/payruns/{id}/details', PayrunDetailController::class);

Router::get('/api/test', function ($d) {
    echo json_encode($d);
});