<?php
// ============================================================
// cors.php — CORS Headers
// ============================================================
// Since the React app and PHP API are on the SAME domain
// (admin.codesynch.tech), CORS is technically not needed for
// same-origin requests. However we keep the headers for local
// development (localhost:3000) and to be safe.
// ============================================================
ob_start();

$ALLOWED_ORIGINS = [
    'https://admin.codesynch.tech',
    'https://codesynch.tech',
    'http://localhost:3000',              // local dev (CRA)
    'http://localhost:5173',             // local dev (Vite)
];

function setCorsHeaders(): void {
    global $ALLOWED_ORIGINS;

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (!empty($origin) && in_array($origin, $ALLOWED_ORIGINS, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } else {
        // Same-origin requests don't send an Origin header at all —
        // that's fine, no CORS header needed in that case.
        // For any unknown origin, still send the primary domain.
        header('Access-Control-Allow-Origin: https://admin.codesynch.tech');
    }

    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        ob_end_clean();
        exit;
    }
}
