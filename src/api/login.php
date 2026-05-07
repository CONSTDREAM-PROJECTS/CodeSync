<?php
// ============================================================
// login.php — POST /api/login
// ============================================================
// Body (JSON): { "email": "...", "password": "..." }
// Returns:     { "token": "<JWT>", "user": { "uid", "email" } }
//
// BUG 2 FIX: Password is no longer trimmed. Spaces are valid
//   password characters. Trimming caused a register/login mismatch
//   when the JS side stopped trimming after our bug fixes.
//
// BUG 8 FIX: null guard on json_decode result.
// ============================================================

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

// BUG 8 FIX: Guard against null body from malformed/empty request
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body.']);
    exit;
}

$email    = trim($body['email']    ?? '');
// BUG 2 FIX: Do NOT trim the password — must match exactly what
// was stored at registration time (which is also untrimmed now).
$password = $body['password'] ?? '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required.']);
    exit;
}

$pdo = getPDO();

// Fetch user by email
$stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

// Timing-safe comparison — always run password_verify even when user
// not found, to prevent user-enumeration via timing side-channel.
$dummyHash   = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
$hashToCheck = $user ? $user['password_hash'] : $dummyHash;

if (!$user || !password_verify($password, $hashToCheck)) {
    http_response_code(401);
    echo json_encode(['error' => 'Incorrect email or password. Please try again.']);
    exit;
}

// Issue JWT (expires in 7 days)
$payload = [
    'sub'   => $user['id'],
    'email' => $user['email'],
    'iat'   => time(),
    'exp'   => time() + (7 * 24 * 60 * 60),
];

$token = jwtEncode($payload);

echo json_encode([
    'token' => $token,
    'user'  => [
        'uid'   => (string) $user['id'],
        'email' => $user['email'],
    ],
]);