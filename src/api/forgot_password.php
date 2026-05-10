<?php
// ============================================================
// forgot_password.php — POST /api/forgot_password.php
// ============================================================
// Body (JSON): { "email": "..." }
// Sends a password reset link to the user's email.
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

$email = trim($body['email'] ?? '');

if ($email === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Email is required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address.']);
    exit;
}

$pdo = getPDO();

// Always return success even if email not found
// This prevents user enumeration attacks
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    // Generate secure token
    $token     = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // Delete any existing reset tokens for this email
    $stmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
    $stmt->execute([$email]);

    // Store new token
    $stmt = $pdo->prepare('INSERT INTO password_resets (email, token, expires_at, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$email, $token, $expiresAt]);

    // Send reset email
    $resetUrl = getenv('APP_URL') . '/reset-password?token=' . $token;

    $subject = 'CodeSynch — Password Reset Request';
    $message = "Hello,\n\n"
             . "You requested a password reset for your CodeSynch account.\n\n"
             . "Click the link below to reset your password (expires in 1 hour):\n\n"
             . $resetUrl . "\n\n"
             . "If you did not request this, please ignore this email.\n\n"
             . "— The CodeSynch Team";

    $headers = "From: noreply@codesynch.tech\r\n"
             . "Reply-To: noreply@codesynch.tech\r\n"
             . "X-Mailer: PHP/" . phpversion();

    mail($email, $subject, $message, $headers);
}

// Always return success
http_response_code(200);
echo json_encode([
    'message' => 'If an account exists with that email, a reset link has been sent.'
]);
