<?php

namespace App\Middleware;

use App\Services\JWTService;

class AuthMiddleware
{
    public static function handle($requiredRoles = [])
    {
        $token = self::getBearerToken();
        
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication token required']);
            exit;
        }

        $userData = JWTService::validateToken($token);
        
        if (!$userData) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired token']);
            exit;
        }

        // Check role-based access
        if (!empty($requiredRoles)) {
            if (!in_array($userData['user_type'], $requiredRoles)) {
                http_response_code(403);
                echo json_encode(['error' => 'Insufficient permissions']);
                exit;
            }
        }

        return $userData;
    }

    private static function getBearerToken()
    {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }
        
        // Also check cookies
        if (isset($_COOKIE['access_token'])) {
            return $_COOKIE['access_token'];
        }

        return null;
    }
}