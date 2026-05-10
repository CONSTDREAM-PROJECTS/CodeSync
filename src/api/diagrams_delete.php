<?php
// ============================================================
// diagrams_delete.php — DELETE /api/diagrams/delete
// ============================================================
// Headers: Authorization: Bearer <token>
// Accepts diagramId from either:
//   - Query param: DELETE /diagrams_delete.php?diagramId=diagram_123
//   - JSON body:   { "diagramId": "diagram_123" }
// Returns: { "message": "Deleted." }
// ============================================================
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/auth_check.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use DELETE.']);
    exit;
}

$authUser = requireAuth();

// Accept diagramId from query param first, fall back to JSON body.
// This handles servers/proxies that strip the body on DELETE requests.
$diagramId = trim($_GET['diagramId'] ?? '');

if ($diagramId === '') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON body.']);
        exit;
    }
    $diagramId = trim($body['diagramId'] ?? '');
}

if ($diagramId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'diagramId is required.']);
    exit;
}

$pdo    = getPDO();
$userId = (int) $authUser['uid'];

$stmt = $pdo->prepare('DELETE FROM diagrams WHERE user_id = ? AND diagram_id = ?');
$stmt->execute([$userId, $diagramId]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Diagram not found or you do not own it.']);
    exit;
}

echo json_encode(['message' => 'Deleted.']);
