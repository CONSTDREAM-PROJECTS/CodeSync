<?php
// ============================================================
// diagrams_save.php — POST /api/diagrams/save
// ============================================================
// Headers: Authorization: Bearer <token>
// Body (JSON): {
//   "diagramId":   "diagram_1234567890",
//   "name":        "My Class Diagram",
//   "diagramType": "class",
//   "language":    "Java",
//   "elements":    [...],
//   "connections": [...]
// }
// Returns: { "message": "Saved.", "docId": "1_diagram_1234567890" }
// ============================================================

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/auth_check.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

$authUser = requireAuth();

// ── Parse body ────────────────────────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);

$diagramId   = trim($body['diagramId']   ?? '');
$name        = trim($body['name']        ?? 'Untitled Diagram');
$diagramType = trim($body['diagramType'] ?? 'class');
$language    = trim($body['language']    ?? 'Java');
$elements    = $body['elements']    ?? [];
$connections = $body['connections'] ?? [];

if ($diagramId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'diagramId is required.']);
    exit;
}

$elementsJson    = json_encode($elements,    JSON_UNESCAPED_UNICODE);
$connectionsJson = json_encode($connections, JSON_UNESCAPED_UNICODE);
$userId          = (int) $authUser['uid'];

$pdo = getPDO();

// ── Upsert (INSERT … ON DUPLICATE KEY UPDATE) ─────────────────────────────────
$sql = '
    INSERT INTO diagrams
        (user_id, diagram_id, name, diagram_type, language, elements, connections, updated_at, created_at)
    VALUES
        (:user_id, :diagram_id, :name, :diagram_type, :language, :elements, :connections, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
        name         = VALUES(name),
        diagram_type = VALUES(diagram_type),
        language     = VALUES(language),
        elements     = VALUES(elements),
        connections  = VALUES(connections),
        updated_at   = NOW()
';

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':user_id'     => $userId,
    ':diagram_id'  => $diagramId,
    ':name'        => $name,
    ':diagram_type'=> $diagramType,
    ':language'    => $language,
    ':elements'    => $elementsJson,
    ':connections' => $connectionsJson,
]);

$docId = $userId . '_' . $diagramId;

echo json_encode(['message' => 'Saved.', 'docId' => $docId]);
