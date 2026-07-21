<?php
// ============================================================
// database.php — PDO MySQL Connection (Hostinger)
// ============================================================
// HOW TO CONFIGURE FOR HOSTINGER:
//   1. hPanel → Hosting → MySQL Databases → create a database
//   2. Note the hostname (usually 'localhost' on Hostinger),
//      database name, username, and password
//   3. Set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASS in the
//      deployment environment. The same-account Hostinger defaults below
//      are used when an environment value is not present.
// ============================================================

// Hostinger uses localhost for a database on the same hosting account.
// Environment variables take precedence for other deployment topologies.
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'Codesynch_db');
define('DB_USER', getenv('DB_USER') ?: 'codesynch_user');
define('DB_PASS', getenv('DB_PASS') ?: '#Code_no7_#');

// JWT signing secret — must be long and random.
// IMPORTANT: Changing this after users have registered will
// invalidate all existing tokens and log everyone out.
define('JWT_SECRET', 'c0d3Synch!X#9pQr$2mZvLwN^8kYtBuA@5jFeGhDsI*7oPlK+4nRqMW&6eCbVfJy');

function getPDO(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST
         . ';port=' . DB_PORT
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
        // BUG 7 FIX: Never expose the raw exception message — it can
        // contain DB credentials. Log server-side only.
        error_log('[CodeSynch] DB connection failed: ' . $e->getMessage());
        echo json_encode(['error' => 'Database connection failed. Contact the administrator.']);
        exit;
    }

    return $pdo;
}
