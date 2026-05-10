<?php
require_once __DIR__ . '/../cors.php';
setCorsHeaders();

$clientId    = getenv('GITHUB_CLIENT_ID');
$redirectUri = getenv('GITHUB_REDIRECT_URI');

$params = http_build_query([
    'client_id'    => $clientId,
    'redirect_uri' => $redirectUri,
    'scope'        => 'user:email',
]);

header('Location: https://github.com/login/oauth/authorize?' . $params);
exit;
