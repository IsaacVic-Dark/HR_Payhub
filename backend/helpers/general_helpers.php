<?php

function is_dev(): bool {
    return isset($_ENV['APP_ENVIRONMENT']) && $_ENV['APP_ENVIRONMENT'] === 'Development';
}

function request_uri(): string {
    if (!isset($_SERVER['REQUEST_URI'])) {
        return '';
    }

    if (!$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)) {
        return '';
    }

    return trim($path, '/');
}
function request_method(): string {
    return $_SERVER['REQUEST_METHOD'];
}

function subtract_date(int $days_to_subtract) {
    $date = date_create(date('Y-m-d H:i:s', time()));
    date_sub($date, date_interval_create_from_date_string("$days_to_subtract days"));
    return date_format($date, 'Y-m-d H:i:s');
}

function slug($string) {
    return strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $string)));
}


/**
 * Creates and returns an instance of an anonymous class that implements a simple caching mechanism.
 * 
 * i borrowed heavily from the laravel version, basically following it's api
 * 
 * Note, am not using type hints as the code is for a plugin that would otherwise be installed
 * in environments with an older php version, for more check my updated gist
 * 
 * Since this a custom addition, the contents of the cache function will be under the
 * MIT license. You can find it in my github gists for updated and environment agnostic code.
 * 
 * @see - https://gist.github.com/munenepeter/5bbc068d2fe2079144b6df9d55b81595
 *
 * @return object An instance of the anonymous cache class.
 */
function cache() {

    return new class() {

        /** @var array The array to store cached items. */
        private $data = [];

        /** @var string The filename used to persist cache data. */
        private $file = BASE_PATH . '.cache.dat';

        /**
         * Creates the cache file if it doesn't exist and loads existing cache data.
         */
        public function __construct() {
            if (!file_exists($this->file)) {
                touch($this->file);
                // hide in windows
                if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                    @exec('attrib +H ' . escapeshellarg(realpath($this->file)));
                }
            }
            $this->load();
        }

        /**
         * Stores an item in the cache.
         *
         * @param string|int $key   The key under which to store the value.
         * @param mixed      $value The value to store.
         * @param int        $expiryInSeconds Time until cache expires
         * @return void
         */
        public function put($key, $value, $expiryInSeconds) {
            $this->data[$key] = [
                'value' => $value,
                'expiry' => time() + $expiryInSeconds
            ];
            $this->save();
        }

        /**
         * Retrieves an item from the cache.
         *
         * @param string|int $key The key of the item to retrieve.
         * @return mixed|null The cached value if found and not expired, null otherwise.
         */
        public function get($key) {
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

        /**
         * Retrieves an item from the cache or stores it if it doesn't exist.
         *
         * @param string|int $key     The key under which to store/retrieve the value.
         * @param int        $seconds The number of seconds until the item expires.
         * @param callable   $callback The function to generate the value if not found in cache.
         * @return mixed The cached or newly generated value.
         */
        public function remember($key, $seconds, $callback) {
            $value = $this->get($key);
            if ($value === null) {
                $value = $callback();
                $this->put($key, $value, $seconds);
            }
            return $value;
        }

        /**
         * Removes an item from the cache.
         *
         * @param string|int $key The key of the item to remove.
         * @return void
         */
        public function forget($key) {
            unset($this->data[$key]);
            $this->save();
        }

        /**
         * Saves the cache data to the file using PHP serialization.
         *
         * @return void
         */
        private function save() {
            // Use exclusive lock to prevent corruption during concurrent writes
            file_put_contents($this->file, serialize($this->data), LOCK_EX);
        }

        /**
         * Loads the cache data from the file using PHP unserialization.
         *
         * @return void
         */
        private function load() {
            if (file_exists($this->file) && filesize($this->file) > 0 && is_readable($this->file)) {
                $content = file_get_contents($this->file);
                // ensure we don't try to unserialize empty content
                if (!empty($content)) {
                    $this->data = unserialize($content) ?? [];
                }
            } else {
                touch($this->file);
                $this->data = [];
            }
        }
    };
}


/**
 * plural
 * This returns the plural version of common english words
 * --from stackoverflow
 * 
 * @param string $phrase the word to be pluralised
 * @param int $value 
 * 
 * @return string plural 
 */
function pluralize($phrase, $value) {
    $plural = '';
    if ($value > 1) {
        for ($i = 0; $i < strlen($phrase); $i++) {
            if ($i == strlen($phrase) - 1) {
                $plural .= ($phrase[$i] == 'y') ? 'ies' : (($phrase[$i] == 's' || $phrase[$i] == 'x' || $phrase[$i] == 'z' || $phrase[$i] == 'ch' || $phrase[$i] == 'sh') ? $phrase[$i] . 'es' : $phrase[$i] . 's');
            } else {
                $plural .= $phrase[$i];
            }
        }
        return $plural;
    }
    return $phrase;
}
/**
 * singularize
 * This returns the singular version of common english words
 * --from https://www.kavoir.com/2011/04/php-class-converting-plural-to-singular-or-vice-versa-in-english.html
 * 
 * @param string $phrase the word to be pluralised
 * @param int $value 
 * 
 * @return string plural 
 */

function singularize($word) {
    $singular = array(
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
    );

    $uncountable = array('equipment', 'information', 'rice', 'money', 'species', 'series', 'fish', 'sheep');

    $irregular = array(
        'person' => 'people',
        'man' => 'men',
        'child' => 'children',
        'sex' => 'sexes',
        'move' => 'moves'
    );

    $lowercased_word = strtolower($word);
    foreach ($uncountable as $_uncountable) {
        if (substr($lowercased_word, (-1 * strlen($_uncountable))) == $_uncountable) {
            return $word;
        }
    }

    foreach ($irregular as $_plural => $_singular) {
        if (preg_match('/(' . $_singular . ')$/i', $word, $arr)) {
            return preg_replace('/(' . $_singular . ')$/i', substr($arr[0], 0, 1) . substr($_plural, 1), $word);
        }
    }

    foreach ($singular as $rule => $replacement) {
        if (preg_match($rule, $word)) {
            return preg_replace($rule, $replacement, $word);
        }
    }

    return $word;
}
function truncate(string $text, int $limit) {
    return mb_strlen($text, 'UTF-8') > $limit ? mb_substr($text, 0, $limit, 'UTF-8') . "…" : $text;
}

function time_ago($datetime, $full = false) {
    $now = new \DateTime;
    $ago = new \DateTime($datetime);
    $diff = $now->diff($ago);

    $weeks = floor($diff->d / 7);
    $diff->d -= $weeks * 7;

    $string = array(
        'y' => 'year',
        'm' => 'month',
        'w' => 'week',
        'd' => 'day',
        'h' => 'hour',
        'i' => 'minute',
        's' => 'second',
    );
    foreach ($string as $k => &$v) {
        if ($diff->$k) {
            $v = $diff->$k . ' ' . $v . ($diff->$k > 1 ? 's' : '');
        } else {
            unset($string[$k]);
        }
    }

    if (!$full) $string = array_slice($string, 0, 1);
    return $string ? implode(', ', $string) . ' ago' : 'just now';
}

function responseJson($data, string $message, int $code = 200, array $metadata = []) {
    if (str_contains($message, 'error')) {
        $code = 500;
    }
    http_response_code($code);

    echo json_encode([
        'data' => $data,
        'message' => $message,
        'metadata' => $metadata ?: null
    ]);
    exit(0);
}
function getInputData(): array {
    $input = file_get_contents('php://input');
    $json = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        responseJson(null, 'Invalid JSON input.', 400);
    }

    return is_array($json) ? $json : [];
}

function validate(array $rules): array {
    $input = array_merge($_GET, $_POST, getInputData());
    $errors = [];
    $sanitized = [];

    foreach ($rules as $field => $ruleStr) {
        $value = $input[$field] ?? null;
        $ruleList = array_map('trim', explode(',', $ruleStr));
        $isRequired = in_array('required', $ruleList);

        if ($isRequired && ($value === null || $value === '')) {
            $errors[$field] = "$field is required.";
            continue;
        }

        if ($value === null || $value === '') {
            $sanitized[$field] = null;
            continue;
        }

        foreach ($ruleList as $rule) {
            if ($rule === 'string' && !is_string($value)) {
                $errors[$field] = "$field must be a string.";
                break;
            }

            if ($rule === 'numeric' && !is_numeric($value)) {
                $errors[$field] = "$field must be numeric.";
                break;
            }

            if ($rule === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $errors[$field] = "$field must be a valid email address.";
                break;
            }

            if ($rule === 'url' && !filter_var($value, FILTER_VALIDATE_URL)) {
                $errors[$field] = "$field must be a valid URL.";
                break;
            }

            if (str_starts_with($rule, 'max-length')) {
                $limit = (int)substr($rule, strlen('max-length'));
                if (strlen($value) > $limit) {
                    $errors[$field] = "$field must not exceed $limit characters.";
                    break;
                }
            }

            if (str_starts_with($rule, 'min-length')) {
                $limit = (int)substr($rule, strlen('min-length'));
                if (strlen($value) < $limit) {
                    $errors[$field] = "$field must be at least $limit characters.";
                    break;
                }
            }
        }

        if (!isset($errors[$field])) {
            $sanitized[$field] = htmlspecialchars(trim((string)$value));
        }
    }

    if (!empty($errors)) {
        responseJson($errors, 'Validation error', 400);
    }

    return $sanitized;
}

function handleFileUpload(string $key, string $uploadDir = BASE_PATH.'uploads/'): ?string {
    if (!isset($_FILES[$key]) || $_FILES[$key]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $originalName = $_FILES[$key]['name'];
    $tmpPath = $_FILES[$key]['tmp_name'];
    $ext = pathinfo($originalName, PATHINFO_EXTENSION);

    $filename = uniqid('upload_', true) . '.' . $ext;
    $destination = rtrim($uploadDir, '/') . '/' . $filename;

    if (move_uploaded_file($tmpPath, $destination)) {
        return $destination;
    }

    return null;
}



//misc helpers


function paginate(array $data, int $per_page = 10, int $page = 1): array {
    $total = count($data);
    $pages = ceil($total / $per_page);
    $current_page = isset($_GET['page']) ? (int)$_GET['page'] : $page;

    if ($current_page < 1) {
        $current_page = 1;
    } elseif ($current_page > $pages) {
        $current_page = $pages;
    }

    $offset = ($current_page - 1) * $per_page;

    if ($offset < 0) {
        $offset = 0;
    }
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
        'data' => array_slice($data, $offset, $per_page)
    ];
}

/**
 * dd
 * 
 * dump the results & die with debug information
 * 
 * @param mixed $data variable to be dumped
 * 
 * @return void
 */
function dd($var) {
    header("Content-Type: text/html");
    // Get backtrace information
    $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
    $caller = $backtrace[0] ?? [];

    $filename = $caller['file'] ?? 'Unknown file';
    $line = $caller['line'] ?? 'Unknown line';

    // Get just the filename without full path for cleaner output
    $shortFilename = basename($filename);

    if (php_sapi_name() === 'cli') {
        // CLI output with debug info
        echo "\n" . str_repeat('=', 50) . "\n";
        echo "DD DEBUG OUTPUT\n";
        echo "File: {$shortFilename}\n";
        echo "Line: {$line}\n";
        echo "Full Path: {$filename}\n";
        echo str_repeat('=', 50) . "\n\n";

        var_dump($var);

        // Add backtrace for CLI
        echo "\n" . str_repeat('-', 30) . "\n";
        echo "BACKTRACE:\n";
        echo str_repeat('-', 30) . "\n";
        debug_print_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);

        die();
    }

    // Web output with enhanced styling
    ini_set("highlight.keyword", "#a50000; font-weight: bolder");
    ini_set("highlight.string", "#5825b6; font-weight: lighter;");

    ob_start();
    highlight_string("<?php\n" . var_export($var, true) . "?>");
    $highlighted_output = ob_get_clean();
    $highlighted_output = str_replace(["&lt;?php", "?&gt;"], '', $highlighted_output);


    echo '<div style="font-family: console, monospace; ">';
    echo '<div style="background:rgba(233, 236, 239, 0.5); padding: 10px; margin-bottom: 15px; border-radius: 4px; ">';
    echo  'dumped in: ' . htmlspecialchars($shortFilename) . ':' . htmlspecialchars($line) . '<small> (' . htmlspecialchars($filename) . ')</small><br>';
    echo '</div>';

    // Variable dump
    echo '<div style="background: white; padding: 15px; border-radius: 4px; border: 1px dashed rgba(205, 207, 209, 0.87);">';
    echo $highlighted_output;
    echo '</div>';

    // Backtrace section
    echo '<div style="margin-top: 15px; background: #fff3cd; padding: 15px; border-radius: 4px; ">';
    echo '<strong style="color:rgba(133, 101, 4, 0.53); margin-bottom: 10px; display: block;">Call Stack:</strong>';
    echo '<div style="background: white; padding: 10px; border-radius: 4px; font-size: 12px; max-height: 200px; overflow-y: auto;">';

    // Custom backtrace formatting for web
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
    foreach ($trace as $i => $call) {
        if ($i === 0) continue; // Skip the dd() call itself

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

    die();
}
