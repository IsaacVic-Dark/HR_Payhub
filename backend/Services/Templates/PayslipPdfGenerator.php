<?php

namespace App\Services\Templates;

use Dompdf\Dompdf;
use Dompdf\Options;

/**
 * HTML → A4 PDF using Dompdf, plus the on-disk storage convention for payslips.
 *
 * Hardening (all enforced here, not left to configuration):
 *  - remote resources disabled  → no network access during rendering
 *  - embedded PHP disabled      → no code execution from markup
 *  - JavaScript disabled
 *  - chroot limited to storage/ → no reading arbitrary local files
 *  - bundled DejaVu fonts only  → no external font CDN
 *
 * Storage convention
 *   storage/payslips/{organization_id}/{YYYY}/{MM}/{PAYSLIP-NUMBER}.pdf
 * The value kept in payslips.pdf_path is this path RELATIVE to the backend
 * root. It is never returned by the API; files are only served by
 * PayslipController::download() after an authorisation check.
 */
final class PayslipPdfGenerator
{
    public const STORAGE_ROOT = 'storage/payslips';

    /**
     * @return string raw PDF bytes
     * @throws \RuntimeException when Dompdf is not installed or rendering fails
     */
    public function render(string $html, array $meta = []): string
    {
        if (!class_exists(Dompdf::class)) {
            throw new \RuntimeException('PDF engine not installed. Run: composer require dompdf/dompdf');
        }

        $tmp = LogoResolver::absolute('storage/tmp');
        if (!is_dir($tmp)) {
            @mkdir($tmp, 0755, true);
        }

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isJavascriptEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('chroot', [LogoResolver::absolute('storage')]);
        $options->set('tempDir', $tmp);
        $options->set('fontCache', $tmp);
        $options->set('logOutputFile', '');
        $options->set('dpi', 96);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->loadHtml($html, 'UTF-8');

        try {
            $dompdf->render();
        } catch (\Throwable $e) {
            throw new \RuntimeException('PDF rendering failed: ' . $e->getMessage(), 0, $e);
        }

        // Fixed, readable metadata (document properties).
        if (method_exists($dompdf, 'addInfo')) {
            $dompdf->addInfo('Title', (string) ($meta['title'] ?? 'Payslip'));
            $dompdf->addInfo('Author', (string) ($meta['author'] ?? 'PayHub'));
            $dompdf->addInfo('Creator', 'PayHub');
            $dompdf->addInfo('Producer', 'PayHub');
            $dompdf->addInfo('Subject', (string) ($meta['subject'] ?? ''));
        }

        $bytes = $dompdf->output();
        if (!is_string($bytes) || $bytes === '' || !str_starts_with($bytes, '%PDF')) {
            throw new \RuntimeException('PDF engine returned no output');
        }
        return $bytes;
    }

    /**
     * Atomically write a payslip PDF and return its relative path.
     */
    public function store(int $orgId, string $payslipNumber, ?string $periodStart, string $bytes): string
    {
        $t    = $periodStart ? strtotime($periodStart) : false;
        $year = $t ? date('Y', $t) : date('Y');
        $mon  = $t ? date('m', $t) : date('m');
        $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $payslipNumber) ?: 'payslip';

        $rel = self::STORAGE_ROOT . "/{$orgId}/{$year}/{$mon}/{$name}.pdf";
        $abs = LogoResolver::absolute($rel);
        $dir = dirname($abs);

        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('Could not create the payslip storage directory');
        }

        $tmp = $abs . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, $bytes, LOCK_EX) === false) {
            throw new \RuntimeException('Could not write the payslip PDF');
        }
        if (!@rename($tmp, $abs)) {
            // Windows cannot rename over an existing file
            @unlink($abs);
            if (!@rename($tmp, $abs)) {
                @unlink($tmp);
                throw new \RuntimeException('Could not finalise the payslip PDF');
            }
        }
        @chmod($abs, 0640);

        return $rel;
    }

    /**
     * Resolve a stored pdf_path to a real file, but only if it lives inside
     * storage/payslips. Returns null for anything else (missing, traversal,
     * externally supplied paths outside the storage root).
     */
    public static function resolveStored(?string $relative): ?string
    {
        if (!$relative) {
            return null;
        }
        $relative = ltrim(str_replace('\\', '/', $relative), '/');
        $real     = realpath(LogoResolver::absolute($relative));
        $root     = realpath(LogoResolver::absolute(self::STORAGE_ROOT));
        if ($real === false || $root === false || !is_file($real)) {
            return null;
        }
        return str_starts_with($real, $root . DIRECTORY_SEPARATOR) ? $real : null;
    }
}
