<?php
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../database.php';
require_once __DIR__ . '/../jwt.php';
setCorsHeaders();

$clientId     = getenv('GOOGLE_CLIENT_ID');
$clientSecret = getenv('GOOGLE_CLIENT_SECRET');
$redirectUri  = getenv('GOOGLE_REDIRECT_URI');
$appUrl       = getenv('APP_URL');

// ── Step 1: Exchange code for access token ────────────────────
$code = $_GET['code'] ?? '';
if (!$code) {
    redirectWithError('Google login failed. No code received.');
}

$tokenResponse = file_get_contents('https://oauth2.googleapis.com/token', false, stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query([
            'code'          => $code,
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri'  => $redirectUri,
            'grant_type'    => 'authorization_code',
        ]),
    ],
]));

$tokenData = json_decode($tokenResponse, true);
$accessToken = $tokenData['access_token'] ?? '';

if (!$accessToken) {
    redirectWithError('Google login failed. Could not get access token.');
}

// ── Step 2: Get user info from Google ────────────────────────
$userResponse = file_get_contents('https://www.googleapis.com/oauth2/v2/userinfo', false, stream_context_create([
    'http' => [
        'header' => 'Authorization: Bearer ' . $accessToken,
    ],
]));

$googleUser = json_decode($userResponse, true);
$email      = $googleUser['email']   ?? '';
$googleId   = $googleUser['id']      ?? '';
$name       = $googleUser['name']    ?? '';

if (!$email || !$googleId) {
    redirectWithError('Google login failed. Could not get user info.');
}

// Gmail only
if (!str_ends_with($email, '@gmail.com')) {
    redirectWithError('Only Gmail addresses are accepted.');
}

// ── Step 3: Find or create user ──────────────────────────────
$pdo = getPDO();

// Check if user exists by oauth_id
$stmt = $pdo->prepare('SELECT id, email, username FROM users WHERE oauth_provider = ? AND oauth_id = ?');
$stmt->execute(['google', $googleId]);
$user = $stmt->fetch();

if (!$user) {
    // Check if email already exists
    $stmt = $pdo->prepare('SELECT id, email, username FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        // Link Google to existing account
        $stmt = $pdo->prepare('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?');
        $stmt->execute(['google', $googleId, $user['id']]);
    } else {
        // Create new user
        $username = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '_', $name)) . '_' . rand(100, 999);
        $stmt = $pdo->prepare('INSERT INTO users (email, username, password_hash, oauth_provider, oauth_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
        $stmt->execute([$email, $username, '', 'google', $googleId]);
        $newId = (int) $pdo->lastInsertId();
        $user  = ['id' => $newId, 'email' => $email, 'username' => $username];
    }
}

// ── Step 4: Issue JWT and redirect back ──────────────────────
$payload = [
    'sub'      => $user['id'],
    'email'    => $user['email'],
    'username' => $user['username'] ?? '',
    'iat'      => time(),
    'exp'      => time() + (7 * 24 * 60 * 60),
];
$token = jwtEncode($payload);

// Send token back to the opener window via postMessage
echo "<!DOCTYPE html>
<html>
<head><title>Authenticating...</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type:  'OAUTH_SUCCESS',
      token: " . json_encode($token) . ",
      user:  " . json_encode(['uid' => (string)$user['id'], 'email' => $user['email'], 'username' => $user['username'] ?? '']) . "
    }, " . json_encode($appUrl) . ");
    window.close();
  } else {
    window.location.href = " . json_encode($appUrl) . ";
  }
</script>
</body>
</html>";
exit;

// ── Helper ───────────────────────────────────────────────────
function redirectWithError($message) {
    global $appUrl;
    echo "<!DOCTYPE html>
<html>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type:  'OAUTH_ERROR',
      error: " . json_encode($message) . "
    }, " . json_encode($appUrl) . ");
    window.close();
  } else {
    window.location.href = " . json_encode($appUrl) . ";
  }
</script>
</body>
</html>";
    exit;
}
