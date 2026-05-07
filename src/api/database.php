<?php
// ============================================================
// database.php — PDO MySQL Connection (Hostinger)
// ============================================================
// HOW TO CONFIGURE FOR HOSTINGER:
//   1. hPanel → Hosting → MySQL Databases → create a database
//   2. Note the hostname (usually 'localhost' on Hostinger),
//      database name, username, and password
//   3. Fill in the four DB_* constants below
// ============================================================

// BUG 7 FIX: Was still pointing to InfinityFree credentials.
// Updated for Hostinger. DB_HOST is almost always 'localhost' on
// Hostinger shared hosting (same-server connection).
define('DB_HOST', 'localhost');                  // Hostinger: usually localhost
define('DB_NAME', 'u123456789_codesynch');      // ← your Hostinger DB name
define('DB_USER', 'u123456789_codesynch');      // ← your Hostinger DB user
define('DB_PASS', 'YourStrongPasswordHere');    // ← your Hostinger DB password

// JWT signing secret — must be long and random.
// IMPORTANT: Changing this after users have registered will
// invalidate all existing tokens and log everyone out.
define('JWT_SECRET', 'c0d3Synch!X#9pQr$2mZvLwN^8kYtBuA@5jFeGhDsI*7oPlK+4nRqMW&6eCbVfJy');

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
        // BUG 7 FIX: Never expose the raw exception message — it can
        // contain DB credentials. Log server-side only.
        error_log('[CodeSynch] DB connection failed: ' . $e->getMessage());
        echo json_encode(['error' => 'Database connection failed. Contact the administrator.']);
        exit;
    }

    return $pdo;
}