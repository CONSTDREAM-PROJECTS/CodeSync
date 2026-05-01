<?php
// ============================================================
// cors.php — CORS Headers (included by every endpoint)
// ============================================================
// REACT_ORIGIN: set this to where your React app is hosted.
// During local development use http://localhost:3000
// In production use your actual domain, e.g. https://mysite.com
// ============================================================

define('REACT_ORIGIN', 'http://localhost:3000'); // ← change for production

function setCorsHeaders(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // Allow requests from the React app origin
    if ($origin === REACT_ORIGIN) {
        header('Access-Control-Allow-Origin: ' . REACT_ORIGIN);
    } else {
        // Still set it (browser will block non-matching origins by CORS policy)
        header('Access-Control-Allow-Origin: ' . REACT_ORIGIN);
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
