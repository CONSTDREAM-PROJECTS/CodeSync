<?php
// ============================================================
// ping.php — GET /api/ping  (diagnostic)
// Visit: https://api.codesynch.tech/api/ping
// ============================================================
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';

setCorsHeaders();

$dbOk    = false;
$dbError = null;
try {
    $pdo  = getPDO();
    $dbOk = $pdo->query('SELECT 1')->fetchColumn() == 1;
} catch (Throwable $e) {
    $dbError = $e->getMessage();
}

echo json_encode([
    'status'         => 'ok',
    'php'            => true,
    'db'             => $dbOk,
    'db_error'       => $dbError,
    'php_version'    => PHP_VERSION,
    'origin'         => $_SERVER['HTTP_ORIGIN']       ?? 'none (same-origin or direct)',
    'server_name'    => $_SERVER['SERVER_NAME']        ?? 'unknown',
    'document_root'  => $_SERVER['DOCUMENT_ROOT']      ?? 'unknown',
    'script_path'    => __FILE__,
    'time'           => date('Y-m-d H:i:s'),
]);
