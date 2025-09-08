<?php
// app/Middleware/AuthMiddleware.php

namespace App\Middleware;

use App\Services\JWTService;
use App\Services\Response;

class AuthMiddleware
{
    public static function handle()
    {
        $jwtService = new JWTService();
        
        // Get token from request
        $token = self::getTokenFromRequest();
        
        if (!$token) {
            return Response::json([
                'success' => false,
                'message' => 'Authentication required'
            ], 401);
        }

        // Verify token
        $payload = $jwtService->decode($token);
        
        if (!$payload || (isset($payload['exp']) && $payload['exp'] < time())) {
            return Response::json([
                'success' => false,
                'message' => 'Invalid or expired token'
            ], 401);
        }

        // Store user in request for later use
        $GLOBALS['auth_user'] = $payload;
        
        return true;
    }

    private static function getTokenFromRequest()
    {
        // Check cookie first
        if (isset($_COOKIE['auth_token'])) {
            return $_COOKIE['auth_token'];
        }

        // Check Authorization header
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s+(.*)$/i', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }

        return null;
    }
}