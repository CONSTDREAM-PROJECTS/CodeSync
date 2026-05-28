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
//
// BUG 5 FIX: VALUES() in ON DUPLICATE KEY UPDATE is deprecated
//   since MySQL 8.0.20 and removed in some builds. Replaced with
//   the modern alias syntax using a row alias.
//
// BUG 8 FIX: null guard on json_decode result.
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

// BUG 8 FIX: Guard against null body
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body.']);
    exit;
}

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

// BUG 5 FIX: Use row alias instead of deprecated VALUES() function.
// The "new_row" alias is supported in MySQL 8.0.19+ and MariaDB 10.3.3+.
// Falls back gracefully on older versions by detecting MySQL version.
$mysqlVersion = $pdo->query('SELECT VERSION()')->fetchColumn();
$useAlias     = version_compare($mysqlVersion, '8.0.19', '>=');

if ($useAlias) {
    // Modern syntax using row alias (MySQL 8.0.19+ / MariaDB 10.3.3+)
    $sql = '
        INSERT INTO diagrams
            (user_id, diagram_id, name, diagram_type, language, elements, connections, updated_at, created_at)
        VALUES
            (:user_id, :diagram_id, :name, :diagram_type, :language, :elements, :connections, NOW(), NOW())
        AS new_row
        ON DUPLICATE KEY UPDATE
            name         = new_row.name,
            diagram_type = new_row.diagram_type,
            language     = new_row.language,
            elements     = new_row.elements,
            connections  = new_row.connections,
            updated_at   = NOW()
    ';
} else {
    // Legacy syntax for MySQL < 8.0.19 / older MariaDB
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
}

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':user_id'      => $userId,
    ':diagram_id'   => $diagramId,
    ':name'         => $name,
    ':diagram_type' => $diagramType,
    ':language'     => $language,
    ':elements'     => $elementsJson,
    ':connections'  => $connectionsJson,
]);

$docId = $userId . '_' . $diagramId;
echo json_encode(['message' => 'Saved.', 'docId' => $docId]);