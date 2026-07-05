/**
 * ============================================================
 * diagramUtils.js — Diagram Types & Toolbar Item Definitions
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the central registry for every diagram type the editor
 * supports and every tool available in each diagram's palette.
 * When the user switches from "Class Diagram" to "Use Case Diagram",
 * the sidebar and tool palette both re-read from here to show the
 * correct controls for that diagram type.
 *
 * TECHNICAL OVERVIEW:
 * Two exports:
 *   diagramTypes      — Array<{ id, name, category }>
 *                       Used by DiagramSidebar to render the list and
 *                       by UMLEditor for name lookups (e.g. auto-save label).
 *
 *   getToolbarItems() — (diagramId: string) => Array<{ id, icon, label, group }>
 *                       Used by ToolPalette to render the correct tool buttons.
 *                       group values: 'mode' | 'element' | 'relation'
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Imported by UMLEditor.jsx:
 *     import { diagramTypes, getToolbarItems } from '../utils/diagramUtils';
 * - diagramTypes is passed as a prop to DiagramSidebar.
 * - getToolbarItems(selectedDiagram) is passed to ToolPalette as toolbarItems.
 * - Element type ids (e.g. 'class', 'actor', 'lifeline') must match the
 *   element.type values used in UMLEditor's SVG rendering switch blocks.
 * - Relationship type ids (e.g. 'inheritance', 'include') must match the
 *   connection.type values used in UMLEditor's connection rendering.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// Diagram Type Registry
// ─────────────────────────────────────────────────────────────

/**
 * diagramTypes
 * LAYMAN'S: The full list of diagram types shown in the left sidebar.
 *   Structural diagrams describe static structure (classes, components).
 *   Behavioral diagrams describe dynamic behavior (use cases, sequences).
 * TECHNICAL: Each entry has:
 *   id       — matches selectedDiagram state in UMLEditor
 *   name     — display label in DiagramSidebar
 *   category — 'Structural' or 'Behavioral' for sidebar grouping
 */
// ─────────────────────────────────────────────────────────────
// Default Element Placement & Sizing
// ─────────────────────────────────────────────────────────────
// Extracted from UMLEditor.addElement() so the exact same placement
// formula used at runtime can also be exercised by capacity/clutter
// tests (see src/utils/__tests__/diagramCapacity.test.js) without
// duplicating the numbers in two places.

/** Element types rendered as the larger "box" shape (class-like). */
export const BOX_ELEMENT_TYPES = ['class', 'component', 'interface', 'abstract', 'enum'];

export const DEFAULT_BOX_SIZE   = { width: 200, height: 150 };
export const DEFAULT_OTHER_SIZE = { width: 150, height: 100 };

/**
 * getDefaultElementSize(type)
 * Mirrors the width/height ternary inside UMLEditor.addElement().
 */
export const getDefaultElementSize = (type) =>
  BOX_ELEMENT_TYPES.includes(type) ? { ...DEFAULT_BOX_SIZE } : { ...DEFAULT_OTHER_SIZE };

/**
 * getDefaultElementPosition(index)
 * Mirrors `x: 100 + (elements.length * 20), y: 100 + (elements.length * 20)`
 * from UMLEditor.addElement() — every new element cascades diagonally by
 * 20px per existing element on the canvas.
 */
export const getDefaultElementPosition = (index) => ({
  x: 100 + index * 20,
  y: 100 + index * 20,
});

/**
 * countOverlappingPairs(elements)
 * LAYMAN'S: Counts how many pairs of UML boxes visually overlap each other —
 *   a direct, measurable stand-in for "cluttering the Editor panel".
 * TECHNICAL: Simple O(n²) axis-aligned bounding box (AABB) intersection test,
 *   consistent with the hit-testing approach already used in
 *   handleCanvasClick(). Fine for the element counts under test (≤ a few
 *   hundred).
 */
export const countOverlappingPairs = (elements) => {
  let overlaps = 0;
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      const aw = a.width ?? 150;
      const ah = a.height ?? 100;
      const bw = b.width ?? 150;
      const bh = b.height ?? 100;
      const overlapsX = a.x < b.x + bw && a.x + aw > b.x;
      const overlapsY = a.y < b.y + bh && a.y + ah > b.y;
      if (overlapsX && overlapsY) overlaps++;
    }
  }
  return overlaps;
};

/**
 * computeDiagramBounds(elements, padding = 60)
 * Mirrors the full-bounds calculation used by handleExportPNG/JPEG/PDF in
 * UMLEditor.jsx, so tests can check how large the diagram's total canvas
 * area grows as more components are added.
 */
export const computeDiagramBounds = (elements, padding = 60) => {
  if (!elements || elements.length === 0) return { width: 0, height: 0 };
  const minX = Math.min(...elements.map((el) => el.x)) - padding;
  const minY = Math.min(...elements.map((el) => el.y)) - padding;
  const maxX = Math.max(...elements.map((el) => el.x + (el.width || 200))) + padding;
  const maxY = Math.max(...elements.map((el) => el.y + (el.height || 150))) + padding;
  return { width: maxX - minX, height: maxY - minY };
};

export const diagramTypes = [
  // ── Structural ──────────────────────────────────────────────
  { id: 'class',     name: 'Class Diagram',     category: 'Structural' },

  // ── Behavioral ──────────────────────────────────────────────
  { id: 'usecase',   name: 'Use Case Diagram',   category: 'Behavioral' },
  { id: 'sequence',  name: 'Sequence Diagram',   category: 'Behavioral' },
];

// ─────────────────────────────────────────────────────────────
// Toolbar Item Definitions per Diagram Type
// ─────────────────────────────────────────────────────────────

/**
 * _modeTools
 * LAYMAN'S: The Select and Delete tools that appear on every diagram's palette.
 * TECHNICAL: Always prepended to every toolbar. group: 'mode' so ToolPalette
 *   renders them before the divider separating modes from elements.
 */
const _modeTools = [
  { id: 'select', icon: '↖', label: 'Select',  group: 'mode' },
  { id: 'delete', icon: '✕', label: 'Delete',  group: 'mode' },
];

/**
 * _toolbarItems
 * LAYMAN'S: A lookup table — "for diagram X, what tools should the palette show?"
 * TECHNICAL: Keys match diagramType ids. Values are arrays of tool descriptors.
 *   Each tool has:
 *     id     — passed to UMLEditor's addElement() when clicked;
 *              for elements this becomes element.type,
 *              for relations this becomes connection.type.
 *     icon   — emoji/symbol shown on the button
 *     label  — tooltip and button text
 *     group  — 'element' | 'relation' for two-row ToolPalette layout
 */
const _toolbarItems = {

  // ── Class Diagram ─────────────────────────────────────────
  class: [
    // Elements
    { id: 'class',       icon: '▣', label: 'Class',           group: 'element' },
    { id: 'interface',   icon: '◈', label: 'Interface',        group: 'element' },
    { id: 'abstract',    icon: '◇', label: 'Abstract Class',   group: 'element' },
    { id: 'enum',        icon: '≡',  label: 'Enum',             group: 'element' },
    // Relationships
    { id: 'association',  icon: '→',  label: 'Association',     group: 'relation' },
    { id: 'inheritance',  icon: '▷',  label: 'Inheritance',     group: 'relation' },
    { id: 'aggregation',  icon: '◇→', label: 'Aggregation',     group: 'relation' },
    { id: 'composition',  icon: '◆→', label: 'Composition',     group: 'relation' },
    { id: 'dependency',   icon: '⇢',  label: 'Dependency',      group: 'relation' },
    { id: 'realization',  icon: '⇾',  label: 'Realization',     group: 'relation' },
  ],

  // ── Object Diagram ────────────────────────────────────────
  object: [
    // Elements
    { id: 'object',      icon: '▣', label: 'Object',           group: 'element' },
    // Relationships
    { id: 'link',        icon: '—',  label: 'Link',             group: 'relation' },
    { id: 'dependency',  icon: '⇢',  label: 'Dependency',       group: 'relation' },
  ],

  // ── Component Diagram ─────────────────────────────────────
  component: [
    // Elements
    { id: 'component',   icon: '⬡', label: 'Component',        group: 'element' },
    { id: 'interface',   icon: '◈', label: 'Interface',         group: 'element' },
    { id: 'package',     icon: '📦', label: 'Package',          group: 'element' },
    // Relationships
    { id: 'dependency',  icon: '⇢',  label: 'Dependency',       group: 'relation' },
    { id: 'realization', icon: '⇾',  label: 'Realization',      group: 'relation' },
    { id: 'association', icon: '→',  label: 'Association',      group: 'relation' },
  ],

  // ── Package Diagram ───────────────────────────────────────
  package: [
    // Elements
    { id: 'package',     icon: '📦', label: 'Package',          group: 'element' },
    { id: 'class',       icon: '▣', label: 'Class',             group: 'element' },
    // Relationships
    { id: 'dependency',  icon: '⇢',  label: 'Dependency',       group: 'relation' },
    { id: 'import',      icon: '⇠',  label: 'Import',           group: 'relation' },
    { id: 'association', icon: '→',  label: 'Association',      group: 'relation' },
  ],

  // ── Use Case Diagram ──────────────────────────────────────
  usecase: [
    // Elements
    { id: 'actor',       icon: '👤', label: 'Actor',            group: 'element' },
    { id: 'usecase',     icon: '⬭',  label: 'Use Case',         group: 'element' },
    { id: 'package',     icon: '▭',  label: 'System Boundary',  group: 'element' },
    // Relationships
    { id: 'association',    icon: '—',  label: 'Association',    group: 'relation' },
    { id: 'include',        icon: '‹‹', label: 'Include',        group: 'relation' },
    { id: 'extend',         icon: '‹‹', label: 'Extend',         group: 'relation' },
    { id: 'generalization', icon: '▷',  label: 'Generalization', group: 'relation' },
  ],

  // ── Sequence Diagram ──────────────────────────────────────
  sequence: [
    // Elements
    { id: 'lifeline',    icon: '|',  label: 'Lifeline',          group: 'element' },
    { id: 'actor',       icon: '👤', label: 'Actor',             group: 'element' },
    { id: 'message',     icon: '▭',  label: 'Message Box',       group: 'element' },
    // Relationships (messages between lifelines)
    { id: 'message',     icon: '→',  label: 'Sync Message',      group: 'relation' },
    { id: 'return',      icon: '←',  label: 'Return',            group: 'relation' },
    { id: 'connector',   icon: '⇢',  label: 'Async Message',     group: 'relation' },
  ],
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * getToolbarItems(diagramId)
 * ---------------------------
 * LAYMAN'S: Given a diagram type id (like "class" or "usecase"), returns
 *   the list of tool buttons that should appear in the tool palette.
 *   The mode tools (Select, Delete) are always included at the front.
 *
 * TECHNICAL: Looks up diagram-specific tools from _toolbarItems, prepends
 *   _modeTools, and returns the merged array. Falls back to class diagram
 *   tools if the diagram id is unrecognised.
 *
 * @param {string} diagramId - The active diagram type id
 * @returns {Array<{ id, icon, label, group }>}
 */
export const getToolbarItems = (diagramId) => {
  const specific = _toolbarItems[diagramId] || _toolbarItems['class'];
  return [..._modeTools, ...specific];
};