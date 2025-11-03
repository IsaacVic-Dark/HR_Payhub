<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class JWTService
{
    private static $secretKey;
    private static $algorithm = 'HS256';

    public static function init()
    {
        self::$secretKey = $_ENV['JWT_SECRET'] ?? 'your-default-secret-key-change-in-production';
    }

    public static function generateToken($payload)
    {
        self::init();
        
        $issuedAt = time();
        $expirationTime = $issuedAt + (60 * 60); // 1 hour
        $refreshExpiration = $issuedAt + (7 * 24 * 60 * 60); // 7 days

        $tokenPayload = [
            'iss' => $_ENV['APP_URL'] ?? 'http://localhost',
            'aud' => $_ENV['APP_URL'] ?? 'http://localhost',
            'iat' => $issuedAt,
            'exp' => $expirationTime,
            'data' => $payload
        ];

        $refreshPayload = [
            'iss' => $_ENV['APP_URL'] ?? 'http://localhost',
            'aud' => $_ENV['APP_URL'] ?? 'http://localhost',
            'iat' => $issuedAt,
            'exp' => $refreshExpiration,
            'data' => ['user_id' => $payload['user_id'], 'type' => 'refresh']
        ];

        return [
            'access_token' => JWT::encode($tokenPayload, self::$secretKey, self::$algorithm),
            'refresh_token' => JWT::encode($refreshPayload, self::$secretKey, self::$algorithm),
            'expires_in' => $expirationTime
        ];
    }

    public static function validateToken($token)
    {
        self::init();
        
        try {
            $decoded = JWT::decode($token, new Key(self::$secretKey, self::$algorithm));
            return (array) $decoded->data;
        } catch (Exception $e) {
            return false;
        }
    }

    public static function validateRefreshToken($token)
    {
        self::init();
        
        try {
            $decoded = JWT::decode($token, new Key(self::$secretKey, self::$algorithm));
            $data = (array) $decoded->data;
            
            if (isset($data['type']) && $data['type'] === 'refresh') {
                return $data;
            }
            return false;
        } catch (Exception $e) {
            return false;
        }
    }
}