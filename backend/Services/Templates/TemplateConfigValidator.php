<?php

namespace App\Services\Templates;

/**
 * Strict server-side validation for document templates.
 *
 * Philosophy: allowlist everything, trust nothing.
 *  - unknown keys are rejected (never silently dropped)
 *  - booleans must be real booleans
 *  - text may not contain markup, template expressions or control characters
 *  - mandatory payroll sections can never be hidden
 *
 * Every method returns ['errors' => [field => message], 'value' => normalised]
 * and never throws for bad input.
 */
final class TemplateConfigValidator
{
    /** Characters/patterns that have no business in a label, title or footer. */
    private const FORBIDDEN_PATTERNS = [
        '/[<>]/'                       => 'must not contain "<" or ">"',
        '/\{\{|\}\}|\{%|%\}|\$\{/'     => 'must not contain template expressions',
        '/`/'                          => 'must not contain backticks',
        '/javascript\s*:/i'            => 'must not contain script URLs',
        '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/' => 'must not contain control characters',
    ];

    // ------------------------------------------------------------------
    // Whole-template validation
    // ------------------------------------------------------------------

    /**
     * Validate the top-level attributes plus the config blob.
     *
     * @param array $input  Decoded request body (or merged existing + patch)
     * @param int   $orgId  Needed to confirm an uploaded logo belongs to this tenant
     * @return array{errors: array<string,string>, value: array}
     */
    public function validateTemplate(array $input, int $orgId): array
    {
        $errors = [];
        $value  = [];

        // Reject unknown top-level keys
        $allowedTop = ['name', 'template_type', 'layout_key', 'config', 'logo', 'primary_color', 'accent_color', 'footer_text'];
        foreach (array_keys($input) as $k) {
            if (!in_array($k, $allowedTop, true)) {
                $errors[(string) $k] = 'Unknown field';
            }
        }

        // name
        $name = $this->cleanText($input['name'] ?? null, 'name', TemplateConfig::MAX_NAME_LENGTH, true, false, $errors);
        $value['name'] = $name;

        // template_type
        $type = $input['template_type'] ?? 'payslip';
        if (!is_string($type) || !in_array($type, TemplateConfig::TYPES, true)) {
            $errors['template_type'] = 'Invalid template type';
        } elseif (!in_array($type, TemplateConfig::RENDERABLE_TYPES, true)) {
            $errors['template_type'] = 'This template type is not available yet';
        }
        $value['template_type'] = is_string($type) ? $type : 'payslip';

        // layout_key (falls back to config.layout, then modern)
        $layout = $input['layout_key'] ?? ($input['config']['layout'] ?? 'modern');
        if (!is_string($layout) || !in_array($layout, TemplateConfig::LAYOUTS, true)) {
            $errors['layout_key'] = 'Layout must be one of: ' . implode(', ', TemplateConfig::LAYOUTS);
            $layout = 'modern';
        }
        $value['layout_key'] = $layout;

        // colours
        $value['primary_color'] = $this->color($input['primary_color'] ?? null, 'primary_color', $errors);
        $value['accent_color']  = $this->color($input['accent_color'] ?? null, 'accent_color', $errors);

        // logo
        $value['header_logo_url'] = $this->logo($input['logo'] ?? null, $orgId, $errors);

        // config (merged onto defaults so partial payloads are fine)
        $rawConfig = $input['config'] ?? [];
        if (!is_array($rawConfig)) {
            $errors['config'] = 'Config must be an object';
            $rawConfig = [];
        }
        // footer_text (top-level) wins over config.footerText when supplied
        if (array_key_exists('footer_text', $input) && $input['footer_text'] !== null) {
            $rawConfig['footerText'] = $input['footer_text'];
        }
        $rawConfig['layout'] = $layout;

        $cfg = $this->validateConfig($rawConfig);
        foreach ($cfg['errors'] as $k => $msg) {
            $errors['config.' . $k] = $msg;
        }
        $value['config']      = $cfg['value'];
        $value['footer_text'] = $cfg['value']['footerText'] ?? null;

        return ['errors' => $errors, 'value' => $value];
    }

    // ------------------------------------------------------------------
    // Config blob
    // ------------------------------------------------------------------

    /**
     * @return array{errors: array<string,string>, value: array}
     */
    public function validateConfig(array $input): array
    {
        $errors   = [];
        $defaults = TemplateConfig::defaultConfig(
            isset($input['layout']) && is_string($input['layout']) ? $input['layout'] : 'modern'
        );

        // --- unknown top-level keys
        foreach (array_keys($input) as $k) {
            if (!array_key_exists($k, $defaults)) {
                $errors[(string) $k] = 'Unknown setting';
            }
        }

        $out = $defaults;

        // --- layout
        $layout = $input['layout'] ?? $defaults['layout'];
        if (!is_string($layout) || !in_array($layout, TemplateConfig::LAYOUTS, true)) {
            $errors['layout'] = 'Invalid layout';
            $layout = 'modern';
        }
        $out['layout'] = $layout;

        // --- documentTitle
        if (array_key_exists('documentTitle', $input)) {
            $out['documentTitle'] = $this->cleanText($input['documentTitle'], 'documentTitle', TemplateConfig::MAX_TITLE_LENGTH, true, false, $errors, 'documentTitle') ?? $defaults['documentTitle'];
        }

        // --- booleans
        foreach (TemplateConfig::BOOLEAN_KEYS as $key) {
            if (array_key_exists($key, $input)) {
                if (!is_bool($input[$key])) {
                    $errors[$key] = 'Must be true or false';
                } else {
                    $out[$key] = $input[$key];
                }
            }
        }
        foreach (TemplateConfig::MANDATORY_TRUE as $key) {
            if ($out[$key] !== true) {
                $errors[$key] = 'This section is mandatory and cannot be hidden';
                $out[$key]    = true;
            }
        }

        // --- footerText
        if (array_key_exists('footerText', $input)) {
            if ($input['footerText'] === null || $input['footerText'] === '') {
                $out['footerText'] = '';
            } else {
                $out['footerText'] = $this->cleanText($input['footerText'], 'footerText', TemplateConfig::MAX_FOOTER_LENGTH, false, true, $errors, 'footerText') ?? '';
            }
        }

        // --- labels
        if (array_key_exists('labels', $input)) {
            if (!is_array($input['labels']) || ($input['labels'] !== [] && array_is_list($input['labels']))) {
                $errors['labels'] = 'Labels must be an object';
            } else {
                foreach ($input['labels'] as $lk => $lv) {
                    if (!array_key_exists($lk, TemplateConfig::LABEL_DEFAULTS)) {
                        $errors["labels.$lk"] = 'Unknown label';
                        continue;
                    }
                    $clean = $this->cleanLabel($lv, "labels.$lk", $errors);
                    if ($clean !== null) {
                        $out['labels'][$lk] = $clean;
                    }
                }
            }
        }

        // --- sections
        if (array_key_exists('sections', $input)) {
            if (!is_array($input['sections']) || ($input['sections'] !== [] && array_is_list($input['sections']))) {
                $errors['sections'] = 'Sections must be an object';
            } else {
                foreach ($input['sections'] as $sk => $sv) {
                    if (!in_array($sk, TemplateConfig::SECTION_KEYS, true)) {
                        $errors["sections.$sk"] = 'Unknown section';
                        continue;
                    }
                    if (!is_array($sv)) {
                        $errors["sections.$sk"] = 'Section must be an object';
                        continue;
                    }
                    foreach (array_keys($sv) as $field) {
                        if (!in_array($field, ['visible', 'order'], true)) {
                            $errors["sections.$sk.$field"] = 'Unknown section setting';
                        }
                    }
                    if (array_key_exists('visible', $sv)) {
                        if (!is_bool($sv['visible'])) {
                            $errors["sections.$sk.visible"] = 'Must be true or false';
                        } else {
                            $out['sections'][$sk]['visible'] = $sv['visible'];
                        }
                    }
                    if (array_key_exists('order', $sv)) {
                        if (!is_int($sv['order'])) {
                            $errors["sections.$sk.order"] = 'Order must be a whole number';
                        } else {
                            $out['sections'][$sk]['order'] = $sv['order'];
                        }
                    }
                }
            }
        }

        // mandatory sections stay visible
        foreach (TemplateConfig::SECTION_KEYS as $sk) {
            if ($out['sections'][$sk]['visible'] !== true) {
                $errors["sections.$sk.visible"] = 'This section is mandatory and cannot be hidden';
                $out['sections'][$sk]['visible'] = true;
            }
        }

        // ordering must be a permutation of 1..N, no gaps, no duplicates
        $orders = array_map(fn($s) => $out['sections'][$s]['order'], TemplateConfig::SECTION_KEYS);
        $sorted = $orders;
        sort($sorted);
        if ($sorted !== range(1, count(TemplateConfig::SECTION_KEYS))) {
            $errors['sections.order'] = 'Section order must use each position from 1 to ' . count(TemplateConfig::SECTION_KEYS) . ' exactly once';
            foreach (TemplateConfig::SECTION_KEYS as $i => $sk) {
                $out['sections'][$sk]['order'] = $i + 1;
            }
        }

        return ['errors' => $errors, 'value' => $out];
    }

    // ------------------------------------------------------------------
    // Field helpers
    // ------------------------------------------------------------------

    /** #RRGGBB only. Null/'' = "use the layout default". */
    public function color($v, string $field, array &$errors): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        if (!is_string($v) || !preg_match('/^#[0-9A-Fa-f]{6}$/', $v)) {
            $errors[$field] = 'Must be a valid HEX colour such as #1E3A8A';
            return null;
        }
        return strtoupper($v);
    }

    /**
     * logo input shapes:
     *   null | {mode:'none'}                     → no logo
     *   {mode:'organization'}                    → use organizations.logo_url
     *   {mode:'uploaded', token:'<hex>.png'}     → file from the template logo upload endpoint
     * Returns the value to store in header_logo_url.
     */
    public function logo($v, int $orgId, array &$errors): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        if (!is_array($v)) {
            $errors['logo'] = 'Logo must be an object';
            return null;
        }
        foreach (array_keys($v) as $k) {
            if (!in_array($k, ['mode', 'token'], true)) {
                $errors["logo.$k"] = 'Unknown field';
            }
        }
        $mode = $v['mode'] ?? 'none';
        if ($mode === 'none') {
            return null;
        }
        if ($mode === 'organization') {
            return TemplateConfig::ORG_LOGO_SENTINEL;
        }
        if ($mode === 'uploaded') {
            $token = $v['token'] ?? null;
            if (!is_string($token) || !preg_match('/^[a-f0-9]{32}\.(png|jpg)$/', $token)) {
                $errors['logo.token'] = 'Invalid logo reference. Upload the logo again.';
                return null;
            }
            $rel = LogoResolver::storagePath($orgId, $token);
            if (!is_file(LogoResolver::absolute($rel))) {
                $errors['logo.token'] = 'Logo file not found. Upload the logo again.';
                return null;
            }
            return $rel;
        }
        $errors['logo.mode'] = 'Logo mode must be none, organization or uploaded';
        return null;
    }

    /**
     * Sanitise a free-text value. Returns null (and records an error) when invalid.
     *
     * @param bool $required   Empty value is an error
     * @param bool $multiline  Allow \n
     */
    private function cleanText($v, string $field, int $max, bool $required, bool $multiline, array &$errors, ?string $errorKey = null): ?string
    {
        $key = $errorKey ?? $field;
        if ($v === null || (is_string($v) && trim($v) === '')) {
            if ($required) {
                $errors[$key] = 'This field is required';
            }
            return null;
        }
        if (!is_string($v)) {
            $errors[$key] = 'Must be text';
            return null;
        }
        $v = $multiline ? str_replace(["\r\n", "\r"], "\n", $v) : $v;
        $v = trim($v);

        // Newlines are allowed in multiline fields; every other control char is not.
        $probe = $multiline ? str_replace("\n", ' ', $v) : $v;
        foreach (self::FORBIDDEN_PATTERNS as $pattern => $message) {
            if (preg_match($pattern, $probe)) {
                $errors[$key] = 'Text ' . $message;
                return null;
            }
        }
        if (!$multiline) {
            $v = preg_replace('/\s+/u', ' ', $v) ?? $v;
        }
        if (mb_strlen($v) > $max) {
            $errors[$key] = "Must not exceed {$max} characters";
            return null;
        }
        return $v;
    }

    /** Labels are short and use a tighter character set than free text. */
    private function cleanLabel($v, string $field, array &$errors): ?string
    {
        if (!is_string($v) || trim($v) === '') {
            $errors[$field] = 'Label cannot be empty';
            return null;
        }
        $v = trim(preg_replace('/\s+/u', ' ', $v) ?? $v);
        if (mb_strlen($v) > TemplateConfig::MAX_LABEL_LENGTH) {
            $errors[$field] = 'Label must not exceed ' . TemplateConfig::MAX_LABEL_LENGTH . ' characters';
            return null;
        }
        if (!preg_match('/^[\p{L}\p{N} .,&()\/\'’:%#+\-]+$/u', $v)) {
            $errors[$field] = 'Label may only contain letters, numbers, spaces and . , & ( ) / \' : % # + -';
            return null;
        }
        return $v;
    }
}
