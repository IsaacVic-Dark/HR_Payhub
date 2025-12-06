<?php

use App\Services\Router;

/**
 * index.php - for payhub
 * 
 * this is an api endpoint in php for our payhub app
 * 
 */

const BASE_PATH = __DIR__ . '/';

require_once __DIR__ . '/helpers/init.php';

// Handle CORS preflight OPTIONS requests first
if (request_method() === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Max-Age: 86400"); // 24 hours
    http_response_code(200);
    exit(0);
}

// Set CORS headers for all responses
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

//return html
//include the docs.html file, if no /api in the request uri
if (request_method() === 'GET' && !str_contains(request_uri(), 'api')) {
    header("Content-Type: text/html");
    include_once BASE_PATH . 'docs.html';
    exit(0);
} else {
    header("Content-Type: application/json");
}

//route routes
Router::load(BASE_PATH . 'routes.php')->direct(request_uri(), strtoupper(request_method()));