<?php
// ============================================================
// forgot_password.php — POST /api/forgot_password.php
// ============================================================
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

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

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    $token     = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

    $stmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
    $stmt->execute([$email]);

    $stmt = $pdo->prepare('INSERT INTO password_resets (email, token, expires_at, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$email, $token, $expiresAt]);

    $resetUrl = getenv('APP_URL') . '/reset-password?token=' . $token;

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('codesynch.noreply@gmail.com');   // your Gmail address
        $mail->Password   = getenv('eaba jsnf azsm gjby');   // your Gmail App Password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom(getenv('GMAIL_USER'), 'CodeSynch');
        $mail->addAddress($email);

        $mail->Subject = 'CodeSynch — Password Reset Request';
        $mail->Body    = "Hello,\n\n"
                       . "You requested a password reset for your CodeSynch account.\n\n"
                       . "Click the link below to reset your password (expires in 1 hour):\n\n"
                       . $resetUrl . "\n\n"
                       . "If you did not request this, please ignore this email.\n\n"
                       . "— The CodeSynch Team";

        $mail->send();
    } catch (Exception $e) {
        error_log('Mailer error: ' . $mail->ErrorInfo);
    }
}

http_response_code(200);
echo json_encode([
    'message' => 'If an account exists with that email, a reset link has been sent.'
]);
