<?php

//we have already included the autoload file in init.php
$host = $_ENV['DB_HOST'] ?? '127.0.0.1'; // default to localhost if not set
$dbname = $_ENV['DB_NAME'] ?? 'payhub';
$user = $_ENV['DB_USER'] ?? 'root';
$pass = $_ENV['DB_PASS'] ?? '';
$port = $_ENV['PORT'] ?? 3306;

//validate that the environment variables are set
if (empty($host) || empty($dbname) || empty($user) || empty($port)) {
    trigger_error("Database connection details are not set in the .env file.", E_USER_ERROR);
}

$dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
//options
$options = [
    \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
    \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
    \PDO::ATTR_EMULATE_PREPARES => false,
];

//attempt to die b4 when we fail to connect
try {
    $pdo = new \PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
   trigger_error("Database connection failed: " . $e->getMessage(), E_USER_ERROR);
}

// set global PDO instance
if (!isset($GLOBALS['pdo'])) {
    $GLOBALS['pdo'] = null;
}
$GLOBALS['pdo'] = $pdo;