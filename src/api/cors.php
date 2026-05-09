<?php
// ============================================================
// cors.php — CORS Headers
// ============================================================
$ALLOWED_ORIGINS = [
    'https://api.codesynch.tech',
    'https://codesynch.tech',
    'http://localhost:3000',
    'http://localhost:5173',
];

function setCorsHeaders(): void {
    global $ALLOWED_ORIGINS;

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (!empty($origin) && in_array($origin, $ALLOWED_ORIGINS, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } else {
        header('Access-Control-Allow-Origin: https://codesynch.tech');
    }

    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Content-Type: application/json; charset=utf-8');
}
