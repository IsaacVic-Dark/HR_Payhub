<?php

function is_dev(): bool {
    return ($_ENV['APP_ENVIRONMENT'] ?? null) === 'Development';
}

function request_uri(): string {
    if (!isset($_SERVER['REQUEST_URI'])) {
        return '';
    }

    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

    return $path ? trim($path, '/') : '';
}

function request_method(): string {
    // CLI/tests won't have this set — default rather than emit a warning.
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

function subtract_date(int $days_to_subtract): string {
    return (new DateTime())
        ->sub(new DateInterval("P{$days_to_subtract}D"))
        ->format('Y-m-d H:i:s');
}

function slug(string $string): string {
    $slug = preg_replace('/[^A-Za-z0-9-]+/', '-', trim($string));
    return strtolower(trim($slug, '-'));
}

/**
 * Laravel-style global response() helper.
 *
 * Usage:
 *   response()->json(['ok' => true]);
 *   response()->view('home', ['title' => 'Hi']);
 *   response()->download('/path/to/file.pdf');
 *
 * Calling response() with no args returns the Response instance so you can
 * chain off it directly, matching Laravel's helper shorthand.
 */
if (!function_exists('response')) {
    function response(): Response {
        return App\Services\Response::instance();
    }
}

/**
 * Creates and returns a shared instance of a simple file-backed cache.
 *
 * Ported from the Laravel-style cache API. Kept as an anonymous class per
 * the original design (for old-PHP plugin compatibility), but the instance
 * is now memoized per-request so repeated cache() calls don't re-read the
 * cache file from disk every time.
 *
 * MIT licensed — see https://gist.github.com/munenepeter/5bbc068d2fe2079144b6df9d55b81595
 *
 * @return object
 */
function cache() {
    static $instance = null;

    if ($instance !== null) {
        return $instance;
    }

    return $instance = new class() {
        /** @var array */
        private $data = [];

        /** @var string */
        private $file = BASE_PATH . '.cache.dat';

        /** @var bool tracks whether data has changed since last save, to avoid redundant writes */
        private $dirty = false;

        public function __construct() {
            if (!file_exists($this->file)) {
                touch($this->file);
                if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                    @exec('attrib +H ' . escapeshellarg(realpath($this->file)));
                }
            }
            $this->load();
        }

        public function put(int|string $key, mixed $value, int $expiryInSeconds) {
            $this->data[$key] = [
                'value' => $value,
                'expiry' => time() + $expiryInSeconds,
            ];
            $this->dirty = true;
            $this->save();
        }

        public function get(int|string $key) {
            if (!isset($this->data[$key])) {
                return null;
            }

            $item = $this->data[$key];
            if ($item['expiry'] !== null && time() > $item['expiry']) {
                $this->forget($key);
                return null;
            }

            return $item['value'];
        }

        public function remember(int|string $key, int $seconds, callable $callback): mixed {
            $value = $this->get($key);
            if ($value === null) {
                $value = $callback();
                $this->put($key, $value, $seconds);
            }
            return $value;
        }

        public function forget(int|string $key) {
            if (array_key_exists($key, $this->data)) {
                unset($this->data[$key]);
                $this->dirty = true;
                $this->save();
            }
        }

        private function save() {
            if (!$this->dirty) {
                return;
            }
            file_put_contents($this->file, serialize($this->data), LOCK_EX);
            $this->dirty = false;
        }

        private function load() {
            if (file_exists($this->file) && filesize($this->file) > 0 && is_readable($this->file)) {
                $content = file_get_contents($this->file);
                if (!empty($content)) {
                    $unserialized = @unserialize($content);
                    $this->data = is_array($unserialized) ? $unserialized : [];
                }
            } else {
                touch($this->file);
                $this->data = [];
            }
        }
    };
}

/**
 * Naive English pluralizer for common regular cases.
 * Rewritten to build a suffix instead of walking + concatenating char by
 * char (the original was O(n) string concatenation over every character
 * of the word just to look at the last one).
 */
function pluralize(string $phrase, int $value): string {
    if ($value <= 1 || $phrase === '') {
        return $phrase;
    }

    $last = $phrase[-1];
    $lastTwo = strlen($phrase) >= 2 ? substr($phrase, -2) : '';

    if ($last === 'y' && !in_array($phrase[-2] ?? '', ['a', 'e', 'i', 'o', 'u'], true)) {
        return substr($phrase, 0, -1) . 'ies';
    }

    if (in_array($last, ['s', 'x', 'z'], true) || in_array($lastTwo, ['ch', 'sh'], true)) {
        return $phrase . 'es';
    }

    return $phrase . 's';
}

/**
 * singularize
 * Returns the singular version of common english words.
 * Rules pre-compiled once as a static array (avoids rebuilding the table on
 * every call) — logic unchanged from the original, source:
 * https://www.kavoir.com/2011/04/php-class-converting-plural-to-singular-or-vice-versa-in-english.html
 */
function singularize(string $word): string {
    static $singular = [
        '/(quiz)zes$/i' => '\1',
        '/(matr)ices$/i' => '\1ix',
        '/(vert|ind)ices$/i' => '\1ex',
        '/^(ox)en/i' => '\1',
        '/(alias|status)es$/i' => '\1',
        '/([octop|vir])i$/i' => '\1us',
        '/(cris|ax|test)es$/i' => '\1is',
        '/(shoe)s$/i' => '\1',
        '/(o)es$/i' => '\1',
        '/(bus)es$/i' => '\1',
        '/([m|l])ice$/i' => '\1ouse',
        '/(x|ch|ss|sh)es$/i' => '\1',
        '/(m)ovies$/i' => '\1ovie',
        '/(s)eries$/i' => '\1eries',
        '/([^aeiouy]|qu)ies$/i' => '\1y',
        '/([lr])ves$/i' => '\1f',
        '/(tive)s$/i' => '\1',
        '/(hive)s$/i' => '\1',
        '/([^f])ves$/i' => '\1fe',
        '/(^analy)ses$/i' => '\1sis',
        '/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$/i' => '\1\2sis',
        '/([ti])a$/i' => '\1um',
        '/(n)ews$/i' => '\1ews',
        '/s$/i' => '',
    ];

    static $uncountable = ['equipment', 'information', 'rice', 'money', 'species', 'series', 'fish', 'sheep'];

    static $irregular = [
        'person' => 'people',
        'man' => 'men',
        'child' => 'children',
        'sex' => 'sexes',
        'move' => 'moves',
    ];

    $lowercased = strtolower($word);

    foreach ($uncountable as $u) {
        if (substr($lowercased, -strlen($u)) === $u) {
            return $word;
        }
    }

    foreach ($irregular as $singularForm => $pluralForm) {
        if (preg_match('/(' . $pluralForm . ')$/i', $word, $m)) {
            return preg_replace('/(' . $pluralForm . ')$/i', $m[0][0] . substr($singularForm, 1), $word);
        }
    }

    foreach ($singular as $rule => $replacement) {
        if (preg_match($rule, $word)) {
            return preg_replace($rule, $replacement, $word);
        }
    }

    return $word;
}

function truncate(string $text, int $limit): string {
    return mb_strlen($text, 'UTF-8') > $limit
        ? mb_substr($text, 0, $limit, 'UTF-8') . '…'
        : $text;
}

function time_ago(string $datetime, bool $full = false): string {
    $now = new DateTime();
    $ago = new DateTime($datetime);
    $diff = $now->diff($ago);
    $diff->w = (int) floor($diff->d / 7);
    $diff->d -= $diff->w * 7;

    $units = [
        'y' => 'year',
        'm' => 'month',
        'w' => 'week',
        'd' => 'day',
        'h' => 'hour',
        'i' => 'minute',
        's' => 'second',
    ];

    $parts = [];
    foreach ($units as $key => $label) {
        $value = $diff->$key;
        if ($value) {
            $parts[] = $value . ' ' . $label . ($value > 1 ? 's' : '');
            if (!$full) {
                break;
            }
        }
    }

    return $parts ? implode(', ', $parts) . ' ago' : 'just now';
}

/**
 * JSON envelope helper. Delegates to the Response service so there's a
 * single place (Response::json) that actually writes headers/body — this
 * just shapes the standard envelope on top of it.
 */
function responseJson(
    bool $success,
    $data = null,
    string $message = '',
    int $code = 200,
    $metadata = null,
    array $errors = []
): void {
    $payload = [
        'success' => $success,
        'message' => $message,
        'code' => $code,
        'timestamp' => time(),
    ];

    if ($data !== null) {
        $payload['data'] = $data;
    }

    if ($metadata !== null) {
        $payload['metadata'] = $metadata;
    }

    if (!$success && !empty($errors)) {
        $payload['errors'] = $errors;
    }

    if (class_exists(App\Services\Response::class)) {
        App\Services\Response::instance()->json($payload, $code);
    } else {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($payload);
    }

    exit;
}

/**
 * Reads and decodes the raw request body once per request instead of
 * re-reading php://input (and re-decoding) on every call — validate()
 * used to call this on every invocation, which meant re-parsing the body
 * for every field-set validated in a request.
 */
function getInputData(): array {
    static $cached = null;

    if ($cached !== null) {
        return $cached;
    }

    $raw = file_get_contents('php://input');

    if ($raw === '' || $raw === false) {
        return $cached = [];
    }

    $json = json_decode($raw, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        responseJson(
            success: false,
            message: 'Invalid JSON input.',
            code: 400,
        );
    }

    return $cached = (is_array($json) ? $json : []);
}

/**
 * Lightweight field validator.
 * Rule-check dispatch pulled into a static lookup of closures instead of a
 * long if/elseif chain repeated for every field — cheaper to extend too.
 */
function validate(array $rules): array {
    static $checks = null;

    if ($checks === null) {
        $checks = [
            'string' => fn($v) => is_string($v) ? null : 'must be a string.',
            'numeric' => fn($v) => is_numeric($v) ? null : 'must be numeric.',
            'email' => fn($v) => filter_var($v, FILTER_VALIDATE_EMAIL) ? null : 'must be a valid email address.',
            'url' => fn($v) => filter_var($v, FILTER_VALIDATE_URL) ? null : 'must be a valid URL.',
        ];
    }

    $input = array_merge($_GET, $_POST, getInputData());
    $errors = [];
    $sanitized = [];

    foreach ($rules as $field => $ruleStr) {
        $value = $input[$field] ?? null;
        $ruleList = array_map('trim', explode(',', $ruleStr));
        $isRequired = in_array('required', $ruleList, true);

        if ($isRequired && ($value === null || $value === '')) {
            $errors[$field] = "$field is required.";
            continue;
        }

        if ($value === null || $value === '') {
            $sanitized[$field] = null;
            continue;
        }

        foreach ($ruleList as $rule) {
            if (isset($checks[$rule])) {
                if ($err = $checks[$rule]($value)) {
                    $errors[$field] = "$field $err";
                    break;
                }
                continue;
            }

            if (str_starts_with($rule, 'max-length')) {
                $limit = (int) substr($rule, strlen('max-length'));
                if (strlen((string) $value) > $limit) {
                    $errors[$field] = "$field must not exceed $limit characters.";
                    break;
                }
            } elseif (str_starts_with($rule, 'min-length')) {
                $limit = (int) substr($rule, strlen('min-length'));
                if (strlen((string) $value) < $limit) {
                    $errors[$field] = "$field must be at least $limit characters.";
                    break;
                }
            }
        }

        if (!isset($errors[$field])) {
            $sanitized[$field] = htmlspecialchars(trim((string) $value));
        }
    }

    if (!empty($errors)) {
        responseJson(
            success: false,
            data: $errors,
            message: 'Validation error',
            code: 400,
        );
    }

    return $sanitized;
}

function handleFileUpload(string $key, ?string $uploadDir = null): ?string {
    $uploadDir ??= BASE_PATH . 'uploads/';

    if (!isset($_FILES[$key]) || $_FILES[$key]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        return null;
    }

    $originalName = $_FILES[$key]['name'];
    $tmpPath = $_FILES[$key]['tmp_name'];
    $ext = pathinfo($originalName, PATHINFO_EXTENSION);

    $filename = uniqid('upload_', true) . ($ext !== '' ? '.' . $ext : '');
    $destination = rtrim($uploadDir, '/') . '/' . $filename;

    return move_uploaded_file($tmpPath, $destination) ? $destination : null;
}

// misc helpers

function paginate(array $data, int $per_page = 10, int $page = 1): array {
    $per_page = max(1, $per_page);
    $total = count($data);
    $pages = (int) max(1, ceil($total / $per_page));
    $current_page = isset($_GET['page']) ? (int) $_GET['page'] : $page;
    $current_page = max(1, min($current_page, $pages));

    $offset = ($current_page - 1) * $per_page;
    if ($offset >= $total) {
        $offset = 0;
        $current_page = 1;
    }

    return [
        'total' => $total,
        'per_page' => $per_page,
        'current_page' => $current_page,
        'total_pages' => $pages,
        'links' => [
            'first' => '?page=1',
            'last' => '?page=' . $pages,
            'next' => $current_page < $pages ? '?page=' . ($current_page + 1) : null,
            'prev' => $current_page > 1 ? '?page=' . ($current_page - 1) : null,
        ],
        'data' => array_slice($data, $offset, $per_page),
    ];
}

/**
 * dd
 *
 * Dump a variable with debug info and halt execution.
 */
function dd($var): void {
    if (!headers_sent()) {
        header('Content-Type: text/html');
    }

    $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
    $caller = $backtrace[0] ?? [];
    $filename = $caller['file'] ?? 'Unknown file';
    $line = $caller['line'] ?? 'Unknown line';
    $shortFilename = basename($filename);

    if (php_sapi_name() === 'cli') {
        echo "\n" . str_repeat('=', 50) . "\n";
        echo "DD DEBUG OUTPUT\n";
        echo "File: {$shortFilename}\n";
        echo "Line: {$line}\n";
        echo "Full Path: {$filename}\n";
        echo str_repeat('=', 50) . "\n\n";

        var_dump($var);

        echo "\n" . str_repeat('-', 30) . "\n";
        echo "BACKTRACE:\n";
        echo str_repeat('-', 30) . "\n";
        debug_print_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);

        exit;
    }

    ini_set('highlight.keyword', '#a50000; font-weight: bolder');
    ini_set('highlight.string', '#5825b6; font-weight: lighter;');

    ob_start();
    highlight_string("<?php\n" . var_export($var, true) . '?>');
    $highlighted_output = str_replace(['&lt;?php', '?&gt;'], '', ob_get_clean());

    echo '<div style="font-family: console, monospace;">';
    echo '<div style="background:rgba(233, 236, 239, 0.5); padding: 10px; margin-bottom: 15px; border-radius: 4px;">';
    echo 'dumped in: ' . htmlspecialchars($shortFilename) . ':' . htmlspecialchars((string) $line) . '<small> (' . htmlspecialchars($filename) . ')</small><br>';
    echo '</div>';

    echo '<div style="background: white; padding: 15px; border-radius: 4px; border: 1px dashed rgba(205, 207, 209, 0.87);">';
    echo $highlighted_output;
    echo '</div>';

    echo '<div style="margin-top: 15px; background: #fff3cd; padding: 15px; border-radius: 4px;">';
    echo '<strong style="color:rgba(133, 101, 4, 0.53); margin-bottom: 10px; display: block;">Call Stack:</strong>';
    echo '<div style="background: white; padding: 10px; border-radius: 4px; font-size: 12px; max-height: 200px; overflow-y: auto;">';

    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
    foreach ($trace as $i => $call) {
        if ($i === 0) {
            continue;
        }

        $file = isset($call['file']) ? basename($call['file']) : 'Unknown';
        $line = $call['line'] ?? '?';
        $function = $call['function'] ?? 'Unknown';
        $class = isset($call['class']) ? $call['class'] . $call['type'] : '';

        echo '<div style="margin-bottom: 5px; padding: 5px; background: #f8f9fa;">';
        echo "<strong>#{$i}:</strong> {$class}{$function}() ";
        echo "<span style='color: #6c757d;'>in {$file}:{$line}</span>";
        echo '</div>';
    }

    echo '</div>';
    echo '</div>';
    echo '</div>';

    exit;
}
