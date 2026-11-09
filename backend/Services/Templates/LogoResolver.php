<?php

namespace App\Services\Templates;

/**
 * Logos are the only external asset a template can reference. To keep PDF
 * rendering deterministic and safe they are ALWAYS converted to a base64
 * data URI on the server — the renderer never emits a remote URL, so the PDF
 * engine never performs a network fetch.
 *
 * Accepted sources
 *   1. A file uploaded through the template-logo endpoint   (storage/template-logos/{orgId}/{token})
 *   2. The organisation's own logo (organizations.logo_url): a local file under
 *      uploads/ or storage/, or — as a last resort — an http(s) URL that passes
 *      an SSRF guard (public IPs only, size/time limited, no redirects).
 *
 * Only PNG / JPEG / GIF are embedded.
 */
final class LogoResolver
{
    public const MAX_UPLOAD_BYTES = 1048576;  // 1 MB
    public const MAX_EMBED_BYTES  = 2097152;  // 2 MB (org logos may be larger than uploads)
    public const MAX_DIMENSION    = 2400;
    public const MIN_DIMENSION    = 16;

    /** @var array<string,?string> per-request memo so a 200-payslip run decodes the logo once */
    private static array $memo = [];

    // ------------------------------------------------------------------
    // Paths
    // ------------------------------------------------------------------

    public static function storagePath(int $orgId, string $token): string
    {
        return "storage/template-logos/{$orgId}/{$token}";
    }

    public static function absolute(string $relative): string
    {
        return rtrim(BASE_PATH, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, ltrim($relative, '/\\'));
    }

    // ------------------------------------------------------------------
    // Upload
    // ------------------------------------------------------------------

    /**
     * Validate and store an uploaded logo.
     *
     * @param array $file  An entry of $_FILES
     * @return array{token?: string, error?: string}
     */
    public static function storeUpload(int $orgId, array $file): array
    {
        if (!isset($file['error']) || is_array($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
            return ['error' => 'No file was uploaded or the upload failed'];
        }
        if (($file['size'] ?? 0) > self::MAX_UPLOAD_BYTES) {
            return ['error' => 'Logo must be 1 MB or smaller'];
        }
        $tmp = $file['tmp_name'] ?? '';
        if (!is_string($tmp) || $tmp === '' || !is_uploaded_file($tmp)) {
            return ['error' => 'Invalid upload'];
        }

        $info = @getimagesize($tmp);
        if ($info === false || !in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG], true)) {
            return ['error' => 'Logo must be a PNG or JPEG image'];
        }
        [$w, $h] = $info;
        if ($w < self::MIN_DIMENSION || $h < self::MIN_DIMENSION || $w > self::MAX_DIMENSION || $h > self::MAX_DIMENSION) {
            return ['error' => 'Logo dimensions must be between ' . self::MIN_DIMENSION . ' and ' . self::MAX_DIMENSION . ' pixels'];
        }

        $isPng = $info[2] === IMAGETYPE_PNG;
        $token = bin2hex(random_bytes(16)) . ($isPng ? '.png' : '.jpg');
        $dir   = self::absolute("storage/template-logos/{$orgId}");
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return ['error' => 'Could not store the logo'];
        }
        $dest = $dir . DIRECTORY_SEPARATOR . $token;

        // Re-encode through GD when available: this strips metadata and any
        // non-image payload appended to the file.
        $written = false;
        if (extension_loaded('gd')) {
            $img = $isPng ? @imagecreatefrompng($tmp) : @imagecreatefromjpeg($tmp);
            if ($img !== false) {
                if ($isPng) {
                    imagealphablending($img, false);
                    imagesavealpha($img, true);
                    $written = imagepng($img, $dest, 6);
                } else {
                    $written = imagejpeg($img, $dest, 90);
                }
                imagedestroy($img);
            }
        }
        if (!$written) {
            $written = @move_uploaded_file($tmp, $dest);
        }
        if (!$written) {
            return ['error' => 'Could not store the logo'];
        }
        @chmod($dest, 0640);

        return ['token' => $token];
    }

    // ------------------------------------------------------------------
    // Resolve to data URI
    // ------------------------------------------------------------------

    /**
     * @param ?string $stored       document_templates.header_logo_url
     * @param ?string $orgLogoUrl   organizations.logo_url
     */
    public static function dataUri(?string $stored, ?string $orgLogoUrl): ?string
    {
        if ($stored === null || $stored === '') {
            return null;
        }
        $key = $stored === TemplateConfig::ORG_LOGO_SENTINEL ? 'org:' . (string) $orgLogoUrl : 'file:' . $stored;
        if (array_key_exists($key, self::$memo)) {
            return self::$memo[$key];
        }

        $bytes = null;
        if ($stored === TemplateConfig::ORG_LOGO_SENTINEL) {
            $bytes = self::readOrganizationLogo($orgLogoUrl);
        } elseif (str_starts_with($stored, 'storage/template-logos/')) {
            $bytes = self::readLocal(self::absolute($stored), [self::absolute('storage/template-logos')]);
        }

        return self::$memo[$key] = self::toDataUri($bytes);
    }

    private static function readOrganizationLogo(?string $logoUrl): ?string
    {
        if (!$logoUrl) {
            return null;
        }
        if (preg_match('#^https?://#i', $logoUrl)) {
            return self::fetchRemote($logoUrl);
        }
        // Local path: may be absolute (handleFileUpload returns an absolute path) or relative.
        $path = preg_match('#^([a-zA-Z]:[\\\\/]|/)#', $logoUrl) ? $logoUrl : self::absolute($logoUrl);
        return self::readLocal($path, [self::absolute('uploads'), self::absolute('storage')]);
    }

    /** Read a file only if it really lives inside one of the allowed roots. */
    private static function readLocal(string $path, array $allowedRoots): ?string
    {
        $real = realpath($path);
        if ($real === false || !is_file($real)) {
            return null;
        }
        foreach ($allowedRoots as $root) {
            $rootReal = realpath($root);
            if ($rootReal !== false && str_starts_with($real, $rootReal . DIRECTORY_SEPARATOR)) {
                if (filesize($real) > self::MAX_EMBED_BYTES) {
                    return null;
                }
                $data = @file_get_contents($real);
                return $data === false ? null : $data;
            }
        }
        return null; // outside the allowed roots (path traversal attempt or misconfiguration)
    }

    /**
     * Fetch a remote image with an SSRF guard. Returns null on any doubt.
     */
    private static function fetchRemote(string $url): ?string
    {
        if (!function_exists('curl_init')) {
            return null;
        }
        $parts = parse_url($url);
        if (!$parts || empty($parts['host']) || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return null;
        }
        $host = $parts['host'];
        $port = $parts['port'] ?? (strtolower($parts['scheme']) === 'https' ? 443 : 80);
        if (!in_array($port, [80, 443], true)) {
            return null;
        }

        // Resolve ourselves, require every address to be public, then pin the IP
        // so a DNS rebind cannot swap it between check and use.
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if (!$ips) {
            return null;
        }
        foreach ($ips as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return null;
            }
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_RESOLVE        => ["{$host}:{$port}:{$ips[0]}"],
            CURLOPT_MAXFILESIZE    => self::MAX_EMBED_BYTES,
            CURLOPT_USERAGENT      => 'PayHub-Template-Logo/1.0',
            CURLOPT_HTTPHEADER     => ['Accept: image/png,image/jpeg,image/gif'],
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($body === false || $code !== 200 || strlen($body) > self::MAX_EMBED_BYTES) {
            return null;
        }
        return $body;
    }

    /** Confirm the bytes really are a PNG/JPEG/GIF of sane size, then base64 them. */
    private static function toDataUri(?string $bytes): ?string
    {
        if ($bytes === null || $bytes === '') {
            return null;
        }
        $info = @getimagesizefromstring($bytes);
        if ($info === false) {
            return null;
        }
        $mime = match ($info[2]) {
            IMAGETYPE_PNG  => 'image/png',
            IMAGETYPE_JPEG => 'image/jpeg',
            IMAGETYPE_GIF  => 'image/gif',
            default        => null,
        };
        if ($mime === null || $info[0] > self::MAX_DIMENSION || $info[1] > self::MAX_DIMENSION) {
            return null;
        }
        return 'data:' . $mime . ';base64,' . base64_encode($bytes);
    }
}
