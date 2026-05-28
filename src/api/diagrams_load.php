<?php
// ============================================================
// diagrams_load.php — GET /api/diagrams/load?diagramId=xxx
// ============================================================
// Headers: Authorization: Bearer <token>
// Returns: { "data": { diagram fields } } or { "data": null }
// ============================================================

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/auth_check.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use GET.']);
    exit;
}

$authUser = requireAuth();

$diagramId = trim($_GET['diagramId'] ?? '');

if ($diagramId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'diagramId query parameter is required.']);
    exit;
}

$pdo    = getPDO();
$userId = (int) $authUser['uid'];

$stmt = $pdo->prepare('
    SELECT diagram_id, name, diagram_type, language, elements, connections, updated_at, created_at
    FROM   diagrams
    WHERE  user_id = ? AND diagram_id = ?
');
$stmt->execute([$userId, $diagramId]);
$row = $stmt->fetch();

if (!$row) {
    echo json_encode(['data' => null]);
    exit;
}

// Decode JSON columns back to arrays
$row['elements']    = json_decode($row['elements'],    true) ?? [];
$row['connections'] = json_decode($row['connections'], true) ?? [];

echo json_encode(['data' => $row]);
