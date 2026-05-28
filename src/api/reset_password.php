<?php
// ============================================================
// reset_password.php — POST /api/reset_password.php
// ============================================================
// Body (JSON): { "token": "...", "password": "..." }
// Validates token and updates user password.
// ============================================================
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body.']);
    exit;
}

$token    = trim($body['token']    ?? '');
$password = $body['password'] ?? '';

if ($token === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Token and password are required.']);
    exit;
}

// Validate password requirements
if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters.']);
    exit;
}

if (!preg_match('/\d/', $password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must contain at least one number (0-9).']);
    exit;
}

if (!preg_match('/[^a-zA-Z0-9]/', $password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must contain at least one special character.']);
    exit;
}

$pdo = getPDO();

// Find valid token that hasn't expired
$stmt = $pdo->prepare('
    SELECT email FROM password_resets 
    WHERE token = ? 
    AND expires_at > NOW()
');
$stmt->execute([$token]);
$reset = $stmt->fetch();

if (!$reset) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or expired reset token. Please request a new one.']);
    exit;
}

$email = $reset['email'];

// Update password
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
$stmt->execute([$hash, $email]);

// Delete used token
$stmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
$stmt->execute([$email]);

http_response_code(200);
echo json_encode([
    'message' => 'Password reset successfully. You can now log in with your new password.'
]);
