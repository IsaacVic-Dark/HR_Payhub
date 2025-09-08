<?php
// app/Controllers/AuthController.php

namespace App\Controllers;

use App\Models\User;
use App\Services\JWTService;
use App\Services\Response;

class AuthController
{
    private $jwtService;
    
    public function __construct()
    {
        $this->jwtService = new JWTService();
    }

    /**
     * Login user and return JWT token
     */
    public function login()
    {
        // Get JSON input
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validate input
        if (!isset($input['email']) || !isset($input['password'])) {
            return Response::json([
                'success' => false,
                'message' => 'Email and password are required'
            ], 400);
        }

        $email = $input['email'];
        $password = $input['password'];

        // Find user by email (you'll need to implement this in your User model)
        $user = User::findByEmail($email);
        
        if (!$user || !password_verify($password, $user['password'])) {
            return Response::json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        // Generate JWT token
        $payload = [
            'user_id' => $user['id'],
            'email' => $user['email'],
            'exp' => time() + (60 * 60) // 1 hour expiration
        ];
        
        $token = $this->jwtService->encode($payload);


        // Get the origin from request to set proper cookie domain
        $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:3000';
        $domain = parse_url($origin, PHP_URL_HOST);

        // Set HTTP-only cookie with proper settings for localhost
        setcookie('auth_token', $token, [
            'expires' => time() + (60 * 60),
            'path' => '/',
            'domain' => $domain === 'localhost' ? 'localhost' : $domain,
            'secure' => false, // false for localhost, true in production
            'httponly' => true,
            'samesite' => 'Lax' // Use 'None' if you need cross-site but requires Secure=true
        ]);

        return Response::json([
            'success' => true,
            'message' => 'Login successful',
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name']
            ]
        ]);
    }

    /**
     * Get authenticated user
     */
    public function user()
    {
        try {
            $token = $this->getTokenFromRequest();
            
            if (!$token) {
                return Response::json([
                    'success' => false,
                    'message' => 'Authentication required'
                ], 401);
            }

            $payload = $this->jwtService->decode($token);
            
            if (!$payload) {
                return Response::json([
                    'success' => false,
                    'message' => 'Invalid token'
                ], 401);
            }

            // Check if token is expired
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                return Response::json([
                    'success' => false,
                    'message' => 'Token expired'
                ], 401);
            }

            // Get user from database
            $user = User::find($payload['user_id']);
            
            if (!$user) {
                return Response::json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            return Response::json([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'name' => $user['name']
                ]
            ]);

        } catch (\Exception $e) {
            return Response::json([
                'success' => false,
                'message' => 'Authentication error'
            ], 500);
        }
    }

    /**
     * Logout user
     */
    public function logout()
    {
        // Clear the auth cookie
        setcookie('auth_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'domain' => $_SERVER['HTTP_HOST'],
            'secure' => isset($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax'
        ]);

        return Response::json([
            'success' => true,
            'message' => 'Logout successful'
        ]);
    }

    /**
     * Extract token from request
     */
    private function getTokenFromRequest()
    {
        // Check for token in cookie first
        if (isset($_COOKIE['auth_token'])) {
            return $_COOKIE['auth_token'];
        }

        // Fallback to Authorization header
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                return $matches[1];
            }
        }

        return null;
    }
}