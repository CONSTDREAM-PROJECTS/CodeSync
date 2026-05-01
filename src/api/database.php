<?php
// ============================================================
// database.php — PDO MySQL Connection
// ============================================================
// HOW TO CONFIGURE:
//   1. Replace DB_HOST with your InfinityFree MySQL hostname
//      (found in InfinityFree control panel → MySQL Databases)
//   2. Replace DB_NAME, DB_USER, DB_PASS with your credentials
// ============================================================

define('DB_HOST', 'sql100.infinityfree.com');   // ← change to your host
define('DB_NAME', 'if0_41743134_codesynch');    // ← change to your DB name
define('DB_USER', 'if0_41743134');              // ← change to your DB user
define('DB_PASS', 'Seph7837');          // ← change to your password

define('JWT_SECRET', 'Thisisalongfortycharacterstextthatineedtoinput');

function getPDO(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST
         . ';dbname=' . DB_NAME
         . ';charset=utf8mb4';

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Database connection failed. Check credentials.']);
        exit;
    }

    return $pdo;
}
