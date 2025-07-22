<?php

use App\Services\Router;
use App\Controllers\OrganizationController;
use App\Controllers\OrganizationConfigController;
use App\Controllers\UserController;
use App\Controllers\EmployeeController;
use App\Controllers\PayrunController;
use App\Controllers\PayrunDetailController;


Router::resource('api/v1/organizations', OrganizationController::class);
Router::resource('api/v1/organizations/{id}/configs', OrganizationConfigController::class);
Router::resource('api/v1/users', UserController::class);
Router::resource('api/v1/organizations/{id}/employees', EmployeeController::class);
Router::resource('api/v1/organizations/{id}/payruns', PayrunController::class);
Router::resource('api/v1/payruns/{id}/details', PayrunDetailController::class);


Router::get('/api/test', function ($d) {
    echo json_encode($d);
});
