<?php
// ============================================================
// auth_check.php — JWT Auth Middleware
// ============================================================
// BUG 3 FIX: Original only read $_SERVER['HTTP_AUTHORIZATION'].
// On Hostinger and most shared Apache hosts, Apache strips the
// Authorization header before PHP sees it, so every authenticated
// request returned 401 "Missing Authorization header" even when
// the browser was sending it correctly.
//
// Fix: Try three locations in order:
//   1. $_SERVER['HTTP_AUTHORIZATION']        — Nginx / some Apache
//   2. $_SERVER['REDIRECT_HTTP_AUTHORIZATION']— Apache mod_rewrite
//   3. getallheaders()['Authorization']       — direct Apache read
//
// Also add a .htaccess file (see bottom comment) which explicitly
// passes the Authorization header through to PHP on Apache hosts.
// ============================================================

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt.php';

function _getAuthorizationHeader(): string {
    // 1. Standard — works on Nginx and some Apache configs
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }

    // 2. Apache CGI / PHP-FPM via mod_rewrite
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    // 3. getallheaders() reads directly from Apache request headers
    //    Most reliable on shared Hostinger/cPanel hosting.
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        // HTTP headers are case-insensitive — check both casings
        if (!empty($headers['Authorization'])) {
            return $headers['Authorization'];
        }
        if (!empty($headers['authorization'])) {
            return $headers['authorization'];
        }
    }

    return '';
}

function requireAuth(): array {
    $authHeader = _getAuthorizationHeader();

    if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
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

// ============================================================
// REQUIRED: Create public_html/api/.htaccess with this content
// so Apache passes the Authorization header through to PHP:
//
//   RewriteEngine On
//   RewriteCond %{HTTP:Authorization} ^(.*)
//   RewriteRule .* - [e=HTTP_AUTHORIZATION:%1]
//   SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1
// ============================================================