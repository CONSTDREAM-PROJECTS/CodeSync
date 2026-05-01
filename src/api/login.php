<?php
// ============================================================
// login.php — POST /api/login
// ============================================================
// Body (JSON): { "email": "...", "password": "..." }
// Returns:     { "token": "<JWT>", "user": { "id", "email" } }
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

// ── Parse request body ────────────────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);

$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required.']);
    exit;
}

$pdo = getPDO();

// ── Fetch user by email ───────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

// Use a timing-safe comparison even on "not found" to prevent user enumeration
$dummyHash = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
$hashToCheck = $user ? $user['password_hash'] : $dummyHash;

if (!$user || !password_verify($password, $hashToCheck)) {
    http_response_code(401);
    echo json_encode(['error' => 'Incorrect email or password. Please try again.']);
    exit;
}

// ── Issue JWT (expires in 7 days) ─────────────────────────────────────────────
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
        'uid'   => (string) $user['id'],   // named 'uid' to match Firebase User shape
        'email' => $user['email'],
    ],
]);
