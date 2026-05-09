<?php
// ============================================================
// register.php — POST /api/register
// ============================================================
// Body (JSON): { "email": "...", "password": "..." }
// Returns:     { "token": "<JWT>", "user": { "uid", "email" },
//               "message": "Account created successfully." }
//
// BUG 1 FIX: Now includes jwt.php and returns a JWT token on 201
//   so LoginModal can log the user in automatically without a
//   second round-trip to /api/login.
//
// BUG 2 FIX: Password is no longer trimmed. Spaces are valid
//   password characters. Trimming caused a mismatch when the JS
//   side stopped trimming — user could register but not log in.
//
// BUG 6 FIX: jwt.php is now included so jwtEncode() is available.
//
// BUG 8 FIX: null guard on json_decode result so a malformed
//   request body doesn't produce PHP warnings that corrupt JSON.
//
// BUG 9 FIX: Content-Type header is set by setCorsHeaders() which
//   is always called first, ensuring proper JSON content-type.
//
// BUG 10 FIX: OPTIONS preflight request is now handled correctly
//   so CORS headers are sent before any method check.
// ============================================================
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt.php';

setCorsHeaders();

// BUG 10 FIX: Handle OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

// BUG 8 FIX: Guard against null from malformed/empty request body
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body.']);
    exit;
}

$email    = trim($body['email']    ?? '');
// BUG 2 FIX: Do NOT trim the password — spaces are valid characters.
// The JS side also no longer trims, so both sides are consistent.
$password = $body['password'] ?? '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address.']);
    exit;
}

// Gmail-only restriction
if (!str_ends_with($email, '@gmail.com')) {
    http_response_code(400);
    echo json_encode(['error' => 'Only Gmail addresses (@gmail.com) are accepted.']);
    exit;
}

if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters.']);
    exit;
}

if (!preg_match('/\d/', $password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must contain at least one number (0–9).']);
    exit;
}

if (!preg_match('/[^a-zA-Z0-9]/', $password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must contain at least one special character (e.g. !@#$%^&*).']);
    exit;
}

$pdo = getPDO();

// Check if email already exists
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'An account with this email already exists.']);
    exit;
}

// Hash and insert
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, NOW())');
$stmt->execute([$email, $hash]);
$newUserId = (int) $pdo->lastInsertId();

// BUG 1 FIX: Issue JWT immediately so the client logs in without
// needing a second /api/login call after registration.
$payload = [
    'sub'   => $newUserId,
    'email' => $email,
    'iat'   => time(),
    'exp'   => time() + (7 * 24 * 60 * 60),
];
$token = jwtEncode($payload);

http_response_code(201);
echo json_encode([
    'message' => 'Account created successfully.',
    'token'   => $token,
    'user'    => [
        'uid'   => (string) $newUserId,
        'email' => $email,
    ],
]);
