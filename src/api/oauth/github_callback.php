<?php
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../database.php';
require_once __DIR__ . '/../jwt.php';
setCorsHeaders();

$clientId     = getenv('GITHUB_CLIENT_ID');
$clientSecret = getenv('GITHUB_CLIENT_SECRET');
$redirectUri  = getenv('GITHUB_REDIRECT_URI');
$appUrl       = getenv('APP_URL');

// ── Step 1: Exchange code for access token ────────────────────
$code = $_GET['code'] ?? '';
if (!$code) {
    redirectWithError('GitHub login failed. No code received.');
}

$tokenResponse = file_get_contents('https://github.com/login/oauth/access_token', false, stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/x-www-form-urlencoded\r\nAccept: application/json",
        'content' => http_build_query([
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'code'          => $code,
            'redirect_uri'  => $redirectUri,
        ]),
    ],
]));

$tokenData   = json_decode($tokenResponse, true);
$accessToken = $tokenData['access_token'] ?? '';

if (!$accessToken) {
    redirectWithError('GitHub login failed. Could not get access token.');
}

// ── Step 2: Get user info from GitHub ────────────────────────
$userResponse = file_get_contents('https://api.github.com/user', false, stream_context_create([
    'http' => [
        'header' => "Authorization: Bearer {$accessToken}\r\nUser-Agent: CodeSynch",
    ],
]));

$githubUser = json_decode($userResponse, true);
$githubId   = (string)($githubUser['id']    ?? '');
$name       = $githubUser['login']           ?? '';

if (!$githubId) {
    redirectWithError('GitHub login failed. Could not get user info.');
}

// ── Step 3: Get email (may be private on GitHub) ─────────────
$email = $githubUser['email'] ?? '';

if (!$email) {
    // Fetch from emails endpoint
    $emailResponse = file_get_contents('https://api.github.com/user/emails', false, stream_context_create([
        'http' => [
            'header' => "Authorization: Bearer {$accessToken}\r\nUser-Agent: CodeSynch",
        ],
    ]));

    $emails = json_decode($emailResponse, true);
    foreach ($emails as $e) {
        if ($e['primary'] && $e['verified']) {
            $email = $e['email'];
            break;
        }
    }
}

if (!$email) {
    redirectWithError('GitHub login failed. No verified email found. Please make your GitHub email public.');
}

// Gmail only
if (!str_ends_with($email, '@gmail.com')) {
    redirectWithError('Only Gmail addresses are accepted. Please use a GitHub account linked to a Gmail address.');
}

// ── Step 4: Find or create user ──────────────────────────────
$pdo = getPDO();

// Check if user exists by oauth_id
$stmt = $pdo->prepare('SELECT id, email, username FROM users WHERE oauth_provider = ? AND oauth_id = ?');
$stmt->execute(['github', $githubId]);
$user = $stmt->fetch();

if (!$user) {
    // Check if email already exists
    $stmt = $pdo->prepare('SELECT id, email, username FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        // Link GitHub to existing account
        $stmt = $pdo->prepare('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?');
        $stmt->execute(['github', $githubId, $user['id']]);
    } else {
        // Create new user
        $username = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '_', $name)) . '_' . rand(100, 999);
        $stmt = $pdo->prepare('INSERT INTO users (email, username, password_hash, oauth_provider, oauth_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
        $stmt->execute([$email, $username, '', 'github', $githubId]);
        $newId = (int) $pdo->lastInsertId();
        $user  = ['id' => $newId, 'email' => $email, 'username' => $username];
    }
}

// ── Step 5: Issue JWT and redirect back ──────────────────────
$payload = [
    'sub'      => $user['id'],
    'email'    => $user['email'],
    'username' => $user['username'] ?? '',
    'iat'      => time(),
    'exp'      => time() + (7 * 24 * 60 * 60),
];
$token = jwtEncode($payload);

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
