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