<?php
require_once __DIR__ . '/../cors.php';
setCorsHeaders();

$clientId     = getenv('GOOGLE_CLIENT_ID');
$redirectUri  = getenv('GOOGLE_REDIRECT_URI');

$params = http_build_query([
    'client_id'     => $clientId,
    'redirect_uri'  => $redirectUri,
    'response_type' => 'code',
    'scope'         => 'openid email profile',
    'access_type'   => 'offline',
    'prompt'        => 'select_account',
]);

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
exit;
