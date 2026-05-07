<?php
// ============================================================
// cors.php — CORS Headers (included by every endpoint)
// ============================================================
// BUG 4 FIX: Original had a hardcoded localhost:3000 origin AND
// the if/else both sent the same value regardless of the request
// origin — blocking all production requests.
// FIX: Maintain an explicit allowlist; only reflect origins that
// are in that list. Add your Hostinger domain and Vercel URL here.
// ============================================================

$ALLOWED_ORIGINS = [
    'http://localhost:3000',           // local React dev (CRA)
    'http://localhost:5173',           // local React dev (Vite)
    'admin.codesynch.tech',          // ← your Hostinger domain
    'https://codesynch.tech',      // ← with www
];

function setCorsHeaders(): void {
    global $ALLOWED_ORIGINS;

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // Only reflect an origin that is in the allowlist.
    // Reflecting every origin defeats CORS protection.
    if (in_array($origin, $ALLOWED_ORIGINS, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } else {
        // Fallback — send first allowed origin so non-browser clients
        // (Postman, curl) still work during development.
        header('Access-Control-Allow-Origin: ' . $ALLOWED_ORIGINS[0]);
    }

    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json; charset=utf-8');

    // Respond immediately to preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}