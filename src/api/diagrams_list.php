<?php
// ============================================================
// diagrams_list.php — GET /api/diagrams/list
// ============================================================
// Headers: Authorization: Bearer <token>
// Returns: { "diagrams": [ { id, name, diagramType, language, elementCount, updatedAt } ] }
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
$userId   = (int) $authUser['uid'];
$pdo      = getPDO();

$stmt = $pdo->prepare('
    SELECT
        diagram_id,
        name,
        diagram_type,
        language,
        elements,
        updated_at
    FROM   diagrams
    WHERE  user_id = ?
    ORDER  BY updated_at DESC
');
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

$diagrams = array_map(function ($row) {
    $elements = json_decode($row['elements'], true) ?? [];
    return [
        'id'           => $row['diagram_id'],
        'name'         => $row['name'],
        'diagramType'  => $row['diagram_type'],
        'language'     => $row['language'],
        'elementCount' => count($elements),
        'updatedAt'    => $row['updated_at'],
    ];
}, $rows);

echo json_encode(['diagrams' => $diagrams]);
