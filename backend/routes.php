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

// Add authentication routes
// Router::post('api/v1/auth/login', AuthController::class . '@login');
// Router::post('api/v1/auth/logout', AuthController::class . '@logout');
// Router::get('api/v1/auth/user', AuthController::class . '@user');

// $router->post('/auth/register', 'AuthController@register');
// $router->post('/auth/register/employee', 'AuthController@registerEmployee');
// $router->post('/auth/check-email', 'AuthController@checkEmail');
// $router->post('/auth/login', 'AuthController@login');
// $router->post('/auth/refresh', 'AuthController@refreshToken');
// $router->post('/auth/logout', 'AuthController@logout');
// $router->get('/auth/me', 'AuthController@me');


// Authentication routes
Router::get('/auth/me', AuthController::class . '@me');                     
Router::post('/auth/register', AuthController::class . '@register');                  
Router::post('/auth/register/employee', AuthController::class . '@registerEmployee');                  
Router::post('/auth/check-email', AuthController::class . '@checkEmail');                  
Router::post('/auth/login', AuthController::class . '@login');                  
Router::post('/auth/refresh', AuthController::class . '@refreshToken');                  
Router::post('/auth/logout', AuthController::class . '@logout');                  
// Router::put('api/v1/organizations/leaves/{id}', LeaveController::class . '@update');             
// Router::patch('api/v1/organizations/leaves/{id}', LeaveController::class . '@update');      
// Router::delete('api/v1/organizations/leaves/{id}', LeaveController::class . '@destroy'); 

// Your existing routes
Router::resource('api/v1/organizations', OrganizationController::class);
Router::resource('api/v1/organizations/{id}/configs', OrganizationConfigController::class);
Router::resource('api/v1/users', UserController::class);
Router::resource('api/v1/organizations/{id}/employees', EmployeeController::class);
Router::resource('api/v1/organizations/{id}/payruns', PayrunController::class);
Router::resource('api/v1/payruns/{id}/details', PayrunDetailController::class);

// Leave routes with full CRUD and actions
Router::get('api/v1/organizations/leaves', LeaveController::class . '@index');                    // Get all leaves (paginated)
Router::get('api/v1/organizations/leaves/statistics', LeaveController::class . '@statistics');    // Get leave statistics
Router::get('api/v1/organizations/leaves/{id}', LeaveController::class . '@show');               // Get single leave
Router::post('api/v1/organizations/leaves', LeaveController::class . '@store');                  // Create leave
Router::put('api/v1/organizations/leaves/{id}', LeaveController::class . '@update');             // Update leave
Router::patch('api/v1/organizations/leaves/{id}', LeaveController::class . '@update');           // Update leave (alternative)
Router::delete('api/v1/organizations/leaves/{id}', LeaveController::class . '@destroy');         // Delete leave

// Leave action routes
Router::post('api/v1/organizations/leaves/{id}/approve', LeaveController::class . '@approve');   // Approve leave
Router::post('api/v1/organizations/leaves/{id}/reject', LeaveController::class . '@reject');     // Reject leave

// Notification routes
Router::resource('api/v1/notifications', NotificationController::class);

Router::get('/api/test', function ($d) {
    echo json_encode($d);
});