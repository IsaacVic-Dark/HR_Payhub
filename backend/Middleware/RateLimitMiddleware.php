<?php

namespace App\Middleware;

/**
 * Fixed-window-per-user rate limiter (sliding log) kept in small files under
 * storage/ratelimit — no extra table or dependency.
 *
 * Usage in routes.php:
 *   ['RateLimitMiddleware', ['bucket' => 'template_preview', 'limit' => 30, 'window' => 60]]
 *
 * Must run AFTER AuthMiddleware (it keys on the authenticated user).
 * Single-server implementation (flock). Behind several app servers, move the
 * counters to Redis/DB with the same interface.
 */
class RateLimitMiddleware
{
    public function handle($request, $next, $options = [])
    {
        $user = AuthMiddleware::getCurrentUser();
        if (!$user) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $bucket = preg_replace('/[^a-z0-9_]/i', '', (string) ($options['bucket'] ?? 'default')) ?: 'default';
        $limit  = max(1, (int) ($options['limit'] ?? 30));
        $window = max(1, (int) ($options['window'] ?? 60));

        $dir = rtrim(BASE_PATH, '/\\') . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'ratelimit';
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            error_log('RateLimitMiddleware: cannot create ' . $dir . ' (limiting disabled)');
            return $next($request);   // fail open: a storage problem must not block payroll
        }

        $file = $dir . DIRECTORY_SEPARATOR . $bucket . '_' . (int) $user['id'] . '.json';
        $fh   = @fopen($file, 'c+');
        if (!$fh) {
            return $next($request);
        }

        $retryAfter = 0;
        if (flock($fh, LOCK_EX)) {
            $now   = time();
            $raw   = stream_get_contents($fh);
            $times = $raw ? (json_decode($raw, true) ?: []) : [];
            $times = array_values(array_filter($times, fn($t) => is_int($t) && $t > $now - $window));

            if (count($times) >= $limit) {
                $retryAfter = max(1, $window - ($now - min($times)));
            } else {
                $times[] = $now;
                ftruncate($fh, 0);
                rewind($fh);
                fwrite($fh, json_encode($times));
            }
            flock($fh, LOCK_UN);
        }
        fclose($fh);

        if ($retryAfter > 0) {
            header('Retry-After: ' . $retryAfter);
            return responseJson(
                success: false,
                data: ['retry_after' => $retryAfter],
                message: "Too many requests. Please wait {$retryAfter} seconds and try again.",
                code: 429
            );
        }
        return $next($request);
    }
}
