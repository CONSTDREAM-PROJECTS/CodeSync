<?php
// ============================================================
// auth_check.php — JWT Auth Middleware (included by diagram endpoints)
// ============================================================
// Usage: require_once __DIR__ . '/auth_check.php';
// After inclusion, $authUser is available:
//   $authUser['uid']   — user id (integer as string)
//   $authUser['email'] — user email
// ============================================================

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt.php';

function requireAuth(): array {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['error' => 'Missing or malformed Authorization header. Expected: Bearer <token>']);
        exit;
    }

    $token   = substr($authHeader, 7);
    $payload = jwtDecode($token);

    if ($payload === null) {
        http_response_code(401);
        echo json_encode(['error' => 'Token is invalid or has expired. Please log in again.']);
        exit;
    }

    return [
        'uid'   => (string) $payload['sub'],
        'email' => $payload['email'],
    ];
}
