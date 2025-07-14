<?php

use App\Services\Router;
use App\Controllers\OrganizationController;


Router::resource('api/v1/organizations', OrganizationController::class);



Router::get('/api/test', function ($d) {
    echo json_encode($d);
});
