<?php

use App\Services\Router;
use App\Controllers\OrganizationController;
use App\Controllers\EmployeeController;


Router::resource('api/v1/organizations', OrganizationController::class);
Router::resource('api/v1/employees', EmployeeController::class);


Router::get('/api/test', function ($d) {
    echo json_encode($d);
});
