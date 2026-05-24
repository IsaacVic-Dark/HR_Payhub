<?php

/**
 * helpers/mpesa.php
 *
 * Standalone helper functions for Safaricom Daraja API (M-Pesa).
 * Include this file wherever STK push is needed:
 *   require_once __DIR__ . '/../helpers/mpesa.php';
 *
 * Functions
 * ─────────
 *  mpesa_get_token()
 *      Fetches an OAuth bearer token from Daraja and caches it for 55 minutes
 *      in a temp file (/tmp/mpesa_token_cache.json) to avoid redundant round-trips.
 *
 *  mpesa_stk_push($token, $phone, $amount, $account_ref, $description, $callback_url)
 *      Initiates an STK (Lipa na M-Pesa Online) push request.
 *      Returns the decoded Daraja response array.
 *
 * Environment variables required (load via vlucas/phpdotenv or equivalent):
 *   MPESA_CONSUMER_KEY
 *   MPESA_CONSUMER_SECRET
 *   MPESA_SHORTCODE
 *   MPESA_PASSKEY
 *   MPESA_CALLBACK_URL
 *   MPESA_ENV          (optional — 'sandbox' | 'production', default 'sandbox')
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal: resolve the correct Daraja base URL
// ─────────────────────────────────────────────────────────────────────────────
function _mpesa_base_url(): string
{
    $env = strtolower($_ENV['MPESA_ENV'] ?? getenv('MPESA_ENV') ?: 'sandbox');
    return $env === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: normalize phone to 254XXXXXXXXX
//   Accepts: 07XXXXXXXX | +2547XXXXXXXX | 2547XXXXXXXX
// ─────────────────────────────────────────────────────────────────────────────
function _mpesa_normalize_phone(string $phone): string
{
    $phone = preg_replace('/\D/', '', $phone); // strip non-digits

    if (str_starts_with($phone, '0')) {
        $phone = '254' . substr($phone, 1);
    } elseif (str_starts_with($phone, '+254')) {
        $phone = '254' . substr($phone, 4);
    }
    // already 254XXXXXXXXX or unknown — return as-is
    return $phone;
}

// ─────────────────────────────────────────────────────────────────────────────
// mpesa_get_token()
//
// Returns a valid OAuth bearer token string.
// Caches in /tmp/mpesa_token_cache.json to avoid hammering the auth endpoint.
// ─────────────────────────────────────────────────────────────────────────────
function mpesa_get_token(): string
{
    $cacheFile = sys_get_temp_dir() . '/mpesa_token_cache.json';
    $cacheLife = 55 * 60; // 55 minutes (Daraja tokens last 60 min)

    // Return cached token if still valid
    if (file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if (!empty($cached['token']) && !empty($cached['fetched_at'])) {
            if ((time() - (int) $cached['fetched_at']) < $cacheLife) {
                return $cached['token'];
            }
        }
    }

    $consumerKey    = $_ENV['MPESA_CONSUMER_KEY']    ?? getenv('MPESA_CONSUMER_KEY');
    $consumerSecret = $_ENV['MPESA_CONSUMER_SECRET'] ?? getenv('MPESA_CONSUMER_SECRET');

    if (!$consumerKey || !$consumerSecret) {
        throw new \RuntimeException('MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET not set in environment.');
    }

    $credentials = base64_encode($consumerKey . ':' . $consumerSecret);
    $url         = _mpesa_base_url() . '/oauth/v1/generate?grant_type=client_credentials';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Basic ' . $credentials],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        throw new \RuntimeException('Daraja OAuth cURL error: ' . $curlError);
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200 || empty($data['access_token'])) {
        throw new \RuntimeException(
            'Daraja OAuth failed (HTTP ' . $httpCode . '): ' . $response
        );
    }

    // Persist to cache
    file_put_contents($cacheFile, json_encode([
        'token'      => $data['access_token'],
        'fetched_at' => time(),
    ]));

    return $data['access_token'];
}

// ─────────────────────────────────────────────────────────────────────────────
// mpesa_stk_push()
//
// Initiates a Lipa na M-Pesa Online (STK push) request.
//
// @param string $token        Bearer token from mpesa_get_token()
// @param string $phone        Customer phone (normalized internally)
// @param float  $amount       Amount in KES (rounded up to int)
// @param string $account_ref  AccountReference shown on customer's phone (≤12 chars)
// @param string $description  TransactionDesc (≤13 chars)
// @param string $callback_url Your publicly-reachable Daraja callback endpoint
//
// @return array               Decoded Daraja JSON response
// ─────────────────────────────────────────────────────────────────────────────
function mpesa_stk_push(
    string $token,
    string $phone,
    float  $amount,
    string $account_ref,
    string $description,
    string $callback_url
): array {
    $shortcode  = $_ENV['MPESA_SHORTCODE'] ?? getenv('MPESA_SHORTCODE');
    $passkey    = $_ENV['MPESA_PASSKEY']   ?? getenv('MPESA_PASSKEY');

    if (!$shortcode || !$passkey) {
        throw new \RuntimeException('MPESA_SHORTCODE or MPESA_PASSKEY not set in environment.');
    }

    $timestamp = date('YmdHis');
    $password  = base64_encode($shortcode . $passkey . $timestamp);
    $phone     = _mpesa_normalize_phone($phone);

    $payload = [
        'BusinessShortCode' => $shortcode,
        'Password'          => $password,
        'Timestamp'         => $timestamp,
        'TransactionType'   => 'CustomerPayBillOnline',
        'Amount'            => (int) ceil($amount),   // Daraja requires integer
        'PartyA'            => $phone,
        'PartyB'            => $shortcode,
        'PhoneNumber'       => $phone,
        'CallBackURL'       => $callback_url,
        'AccountReference'  => substr($account_ref, 0, 12),
        'TransactionDesc'   => substr($description, 0, 13),
    ];

    $url = _mpesa_base_url() . '/mpesa/stkpush/v1/processrequest';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        throw new \RuntimeException('Daraja STK push cURL error: ' . $curlError);
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200) {
        throw new \RuntimeException(
            'Daraja STK push failed (HTTP ' . $httpCode . '): ' . $response
        );
    }

    return $data ?? [];
}