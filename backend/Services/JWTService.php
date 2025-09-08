<?php
// app/Services/JWTService.php

namespace App\Services;

class JWTService
{
    private $secretKey;
    private $algorithm = 'HS256';

    public function __construct()
    {
        // Use a secure secret key from environment or config
        $this->secretKey = getenv('JWT_SECRET') ?: 'your-secret-key-change-in-production';
    }

    public function encode($payload)
    {
        $header = json_encode(['typ' => 'JWT', 'alg' => $this->algorithm]);
        $payload = json_encode($payload);
        
        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->secretKey, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);
        
        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    public function decode($jwt)
    {
        $tokenParts = explode('.', $jwt);
        if (count($tokenParts) !== 3) {
            return false;
        }
        
        list($header, $payload, $signatureProvided) = $tokenParts;
        
        $headerDecoded = $this->base64UrlDecode($header);
        $payloadDecoded = $this->base64UrlDecode($payload);
        
        $base64UrlHeader = $this->base64UrlEncode($headerDecoded);
        $base64UrlPayload = $this->base64UrlEncode($payloadDecoded);
        
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->secretKey, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);
        
        if ($base64UrlSignature !== $signatureProvided) {
            return false;
        }
        
        return json_decode($payloadDecoded, true);
    }

    private function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode($data)
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}