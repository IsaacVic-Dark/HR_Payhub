<?php

// Default credentials (customize as needed)
$host = $_ENV['DB_HOST'] ?? 'localhost';
$user = $_ENV['DB_USERNAME'] ?? ($_ENV['DB_USER'] ?? 'root');
$pass = $_ENV['DB_PASSWORD'] ?? ($_ENV['DB_PASS'] ?? '');
$dbname = $_ENV['DB_NAME'] ?? 'payhub';
$schemaFile = __DIR__ . '/schema.sql';

function print_msg($msg) {
    if (php_sapi_name() === 'cli') {
        echo $msg . "\n";
    } else {
        echo "<pre>" . htmlspecialchars($msg) . "</pre>";
    }
}

// 1. Try shell_exec with mysql CLI
$cmd = sprintf(
    'mysql -h%s -u%s %s %s < %s 2>&1',
    escapeshellarg($host),
    escapeshellarg($user),
    $pass ? '-p' . escapeshellarg($pass) : '',
    escapeshellarg($dbname),
    escapeshellarg($schemaFile)
);

$shell_output = shell_exec($cmd);
if ($shell_output !== null && stripos($shell_output, 'ERROR') === false) {
    print_msg("Migration completed successfully using mysql CLI.");
    exit;
} else {
    print_msg("mysql CLI failed or not available. Trying PDO method...\n" . ($shell_output ?: ''));
}

// 2. Fallback to PDO
try {
    $pdo = new PDO("mysql:host=$host", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (Exception $e) {
    exit("Could not connect to MySQL: " . $e->getMessage() . "\n");
}

if (!file_exists($schemaFile)) {
    exit("Schema file not found: $schemaFile\n");
}

$sql = file_get_contents($schemaFile);

try {
    $pdo->exec($sql);
    print_msg("Migration completed successfully using PDO!");
} catch (Exception $e) {
    print_msg("Migration failed: " . $e->getMessage());
}
