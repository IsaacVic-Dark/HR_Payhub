<?php

use App\Services\DB;
/**
 * init.php - this is the main entry point for the application
 * 
 * @author Peter Munene <munenenjega@gmail.com>
 */

//include the autoload file and all helpers
require_once __DIR__ . '/../vendor/autoload.php';

//attempt to copy the .env.example
if (!file_exists(BASE_PATH . '.env')) {
    if(!file_exists(BASE_PATH . '.env.example') || !copy(BASE_PATH . '.env.example', BASE_PATH . '.env')) {
        trigger_error("Please create a .env file with your database connection details.", E_USER_ERROR);
    }
}
//load the environment variables from the .env file
$dotenv = Dotenv\Dotenv::createImmutable(BASE_PATH);
$dotenv->load();

//enable error reporting if in dev
if (isset($_ENV['APP_ENVIRONMENT']) && $_ENV['APP_ENVIRONMENT'] === 'Development') {
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

//validate provided timezone from env
if (isset($_ENV['APP_TIMEZONE']) && in_array($_ENV['APP_TIMEZONE'], timezone_identifiers_list())) {
    date_default_timezone_set($_ENV['APP_TIMEZONE']);
} else {
    date_default_timezone_set('Africa/Nairobi'); // default timezone
}

// Set the error handler
set_error_handler('customErrorHandler');

//Handle fatal errors and exceptions
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_PARSE])) {
        customErrorHandler($error['type'], $error['message'], $error['file'], $error['line']);
    }
});

set_exception_handler(function($exception) {
    customErrorHandler(
        E_ERROR,
        $exception->getMessage(),
        $exception->getFile(),
        $exception->getLine(),
        []
    );
});

//set up db connection globally, it fails,and throws an exception if it cannot connect
//and we can use the $pdo variable in any file that includes this init.php
//or we can use $GLOBALS['pdo'] to access the PDO instance
require_once __DIR__ . '/../database/db.php';

DB::getInstance($pdo);

//autoload all the files, after setting up db so that we have access to it
// and any helpers that we define
foreach (glob(__DIR__ . '/*.php') as $file) {
    if (basename($file) === 'init.php') {
        continue; // skip init.php to avoid circular loading
    }
    require_once $file;
}


function customErrorHandler($severity, $message, $file, $line, $context = []) {
    // Intercept 'Unknown database' error
    if (stripos($message, 'Unknown database') !== false) {
        if (php_sapi_name() === 'cli') {
            fwrite(STDOUT, "Database does not exist. Run migrations to create it? [y/N]: ");
            $input = strtolower(trim(fgets(STDIN)));
            if ($input === 'y') {
                system('php ' . escapeshellarg(__DIR__ . '/../database/run_migrations.php'));
                // Try to reload (user should rerun script)
                exit("Migration attempted. Please rerun your command.\n");
            } else {
                exit("Aborted. Database does not exist.\n");
            }
      } else {
    // Web: show a styled notice and button to run migrations
    echo '
    <div style="max-width: 600px; margin: 100px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; font-family: Verdana, sans-serif; background-color: #f9f9f9; text-align: center;">
        <h2 style="color: #b30000; margin-bottom: 10px;">Database Missing</h2>
        <p style="margin-bottom: 20px; color: #333;">
            The database required for this application does not currently exist.
        </p>
        <form method="post">
            <button type="submit" name="run_migration" value="1"
                style="background-color: #007BFF; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                Run Migrations Now
            </button>
        </form>
    </div>';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['run_migration'])) {
        include __DIR__ . '/../database/run_migrations.php';
        echo '<script>setTimeout(function(){ location.reload(); }, 2000);</script>';
    }
    exit;
}

    }
    // Don't handle errors that are suppressed with @
    if (!(error_reporting() & $severity)) {
        return false;
    }
    
    // Get error type name
    $errorTypes = [
        E_ERROR => 'Fatal Error',
        E_WARNING => 'Warning',
        E_PARSE => 'Parse Error',
        E_NOTICE => 'Notice',
        E_CORE_ERROR => 'Core Error',
        E_CORE_WARNING => 'Core Warning',
        E_COMPILE_ERROR => 'Compile Error',
        E_COMPILE_WARNING => 'Compile Warning',
        E_USER_ERROR => 'User Error',
        E_USER_WARNING => 'User Warning',
        E_USER_NOTICE => 'User Notice',
        E_RECOVERABLE_ERROR => 'Recoverable Error',
        E_DEPRECATED => 'Deprecated',
        E_USER_DEPRECATED => 'User Deprecated'
    ];
    
    $errorType = $errorTypes[$severity] ?? 'Unknown Error';
    
    // Get stack trace
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
    
    // Get code context around the error
    $codeContext = getCodeContext($file, $line);
    
    // Get request information
    $requestInfo = [
        'url' => $_SERVER['REQUEST_METHOD'] . ' ' . $_SERVER['REQUEST_URI'],
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'Unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    // Display the error
    displayError($errorType, $message, $file, $line, $trace, $codeContext, $requestInfo);
    
    // Stop execution for fatal errors
    if ($severity === E_ERROR || $severity === E_CORE_ERROR || $severity === E_COMPILE_ERROR) {
        exit(1);
    }
    
    return true;
}

function getCodeContext($file, $errorLine, $contextLines = 3) {
    if (!file_exists($file)) {
        return [];
    }
    
    $lines = file($file, FILE_IGNORE_NEW_LINES);
    $startLine = max(0, $errorLine - $contextLines - 1);
    $endLine = min(count($lines) - 1, $errorLine + $contextLines - 1);
    
    $context = [];
    for ($i = $startLine; $i <= $endLine; $i++) {
        $context[] = [
            'number' => $i + 1,
            'content' => $lines[$i] ?? '',
            'isError' => ($i + 1) === $errorLine
        ];
    }
    
    return $context;
}

//this was generated using ai to resemble what laravel provides
function displayError($errorType, $message, $file, $line, $trace, $codeContext, $requestInfo) {
    // Clear any existing output
    if (ob_get_level()) {
        ob_clean();
    }
    
    // Set content type
    header('Content-Type: text/html; charset=UTF-8');
    
    $html = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - ' . htmlspecialchars($errorType) . '</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #c3c1c13d;
            color: #374151;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
    
        <!-- Error Header -->
        <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-bottom: 1.5rem; padding: 2rem;">
            <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                <div style="width: 48px; height: 48px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 1rem;">
                    <svg style="width: 24px; height: 24px; color: #dc2626;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div>
                    <h1 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem;">
                        ' . htmlspecialchars($errorType) . '
                    </h1>
                    <p style="color: #6b7280; font-size: 0.875rem;">
                        Thrown in <code style="background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 4px; font-size: 0.75rem;">' . htmlspecialchars($file) . '</code> at line <strong>' . $line . '</strong>
                    </p>
                </div>
            </div>
            
            <div style="background: #f9fafb; border-left: 4px solid #dc2626; padding: 1rem; border-radius: 0 4px 4px 0;">
                <p style="font-size: 1.125rem; color: #111827; font-weight: 500;">
                    ' . htmlspecialchars($message) . '
                </p>
            </div>
        </div>
        ';

  

    // Code Context
    if (!empty($codeContext)) {
        $html .= '
        <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-bottom: 1.5rem;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid #f3f4f6;">
                <h2 style="font-size: 1.25rem; font-weight: 600; color: #111827;">Code Context</h2>
                <p style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">
                    ' . htmlspecialchars($file) . '
                </p>
            </div>
            
            <div style="background: #1f2937; padding: 1.5rem; font-family: \'SF Mono\', Monaco, \'Cascadia Code\', \'Roboto Mono\', Consolas, \'Courier New\', monospace; font-size: 0.875rem; overflow-x: auto;">';
        
        foreach ($codeContext as $contextLine) {
            $lineNumber = $contextLine['number'];
            $content = htmlspecialchars($contextLine['content']);
            
            if ($contextLine['isError']) {
                $html .= '
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 0 4px 4px 0;">
                    <span style="display: inline-block; width: 2rem; text-align: right; margin-right: 1rem; color: #dc2626; font-weight: 600;">' . $lineNumber . '</span>
                    <span style="color: #dc2626;">' . $content . '</span>
                </div>';
            } else {
                $html .= '
                <div style="color: #6b7280; margin-bottom: 0.5rem;">
                    <span style="display: inline-block; width: 2rem; text-align: right; margin-right: 1rem;">' . $lineNumber . '</span>
                    <span style="color: #d1d5db;">' . $content . '</span>
                </div>';
            }
        }
        
        $html .= '
            </div>
        </div>';
    }
    // Request Info
    $html .= '
        <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid #f3f4f6;">
                <h2 style="font-size: 1.25rem; font-weight: 600; color: #111827;">Request Information</h2>
            </div>
            
            <div style="padding: 1.5rem 2rem;">
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 1rem 2rem; font-size: 0.875rem;">
                    <div style="color: #6b7280; font-weight: 600;">URL:</div>
                    <div style="color: #374151;"><code>' . htmlspecialchars($requestInfo['url']) . '</code></div>
                    
                    <div style="color: #6b7280; font-weight: 600;">IP:</div>
                    <div style="color: #374151;">' . htmlspecialchars($requestInfo['ip']) . '</div>
                    
                    <div style="color: #6b7280; font-weight: 600;">User Agent:</div>
                    <code style="color: #374151;">' . htmlspecialchars($requestInfo['user_agent']) . '</code>
                    
                    <div style="color: #6b7280; font-weight: 600;">Timestamp:</div>
                    <code style="color: #374151;">' . htmlspecialchars($requestInfo['timestamp']) . '</code>
                </div>
            </div>
        </div>
    </div>
</body>
</html>';

    echo $html;
    exit;
}
