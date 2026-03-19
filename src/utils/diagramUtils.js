/**
 * ============================================================
 * diagramUtils.js — Diagram Configuration & Toolbar Registry
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Think of this as the "menu" file for the entire app. It defines:
 *   1. Which diagram types exist and how they appear in the sidebar
 *   2. Which tools/buttons appear in the tool palette for each diagram type
 *
 * Every time you switch from "Class Diagram" to "Use Case Diagram",
 * the app reads this file to know what tools to show in the palette.
 *
 * TECHNICAL OVERVIEW:
 * Exports two things:
 *   - diagramTypes  → Array of diagram descriptors consumed by DiagramSidebar
 *   - getToolbarItems(diagramId) → Returns the correct tool list for ToolPalette
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - UMLEditor.jsx imports both and passes them as props to child components
 * - DiagramSidebar receives diagramTypes to render the left nav
 * - ToolPalette receives the result of getToolbarItems() to render the tool bar
 * - addElement() in UMLEditor uses the item.id values from toolbar items
 *   as the element type string — so these IDs must match the type checks
 *   in UMLEditor's rendering logic exactly.
 * ============================================================
 */


// ─────────────────────────────────────────────────────────────
// DIAGRAM TYPES
// Used by: DiagramSidebar (renders the left sidebar navigation)
// Shape: { id, name, category }
//   id       → matches selectedDiagram state in UMLEditor
//   name     → display label in the sidebar
//   category → 'Structural' | 'Behavioral' (used for section grouping)
// ─────────────────────────────────────────────────────────────

export const diagramTypes = [
  // ── Structural ─────────────────────────────────────────────
  {
    id:       'class',
    name:     'Class Diagram',
    category: 'Structural'
  },

  // ── Behavioral ─────────────────────────────────────────────
  {
    id:       'usecase',
    name:     'Use Case Diagram',
    category: 'Behavioral'
  },
  {
    id:       'sequence',
    name:     'Sequence Diagram',
    category: 'Behavioral'
  }
];


// ─────────────────────────────────────────────────────────────
// TOOLBAR ITEMS PER DIAGRAM TYPE
// Used by: ToolPalette (renders the horizontal tool palette)
// Shape per item: { id, label, icon }
//   id    → passed to addElement(type) or onToolSelect(type) in UMLEditor
//           MUST match the type strings used in UMLEditor's rendering switch
//   label → display text on the button
//   icon  → emoji/symbol shown on the button
//
// Two special IDs that trigger onToolSelect instead of onElementAdd:
//   'select' → activates selection mode
//   'delete' → activates deletion mode (click element to delete)
//
// All other IDs are split into two groups inside UMLEditor.addElement():
//   - Element types  → create a new canvas node
//   - Relationship types → set selectedTool so the next two clicks draw a connection
// ─────────────────────────────────────────────────────────────

const CLASS_DIAGRAM_TOOLS = [
  // ── Mode controls ──────────────────────────────────────────
  { id: 'select',        label: 'Select',         icon: '↖️',  group: 'mode'     },
  { id: 'delete',        label: 'Delete',          icon: '🗑️', group: 'mode'     },

  // ── Element types ──────────────────────────────────────────
  { id: 'class',         label: 'Class',           icon: '📦',  group: 'element'  },
  { id: 'interface',     label: 'Interface',       icon: '🔷',  group: 'element'  },
  { id: 'abstract',      label: 'Abstract Class',  icon: '📐',  group: 'element'  },
  { id: 'object',        label: 'Object',          icon: '🟦',  group: 'element'  },
  { id: 'package',       label: 'Package',         icon: '📁',  group: 'element'  },
  { id: 'component',     label: 'Component',       icon: '⚙️',  group: 'element'  },

  // ── Relationship types ─────────────────────────────────────
  { id: 'association',   label: 'Association',     icon: '—',   group: 'relation' },
  { id: 'inheritance',   label: 'Inheritance',     icon: '△',   group: 'relation' },
  { id: 'aggregation',   label: 'Aggregation',     icon: '◇',   group: 'relation' },
  { id: 'composition',   label: 'Composition',     icon: '◆',   group: 'relation' },
  { id: 'dependency',    label: 'Dependency',      icon: '⤳',   group: 'relation' },
  { id: 'realization',   label: 'Realization',     icon: '⇢',   group: 'relation' }
];

const USE_CASE_DIAGRAM_TOOLS = [
  // ── Mode controls ──────────────────────────────────────────
  { id: 'select',        label: 'Select',          icon: '↖️',  group: 'mode'     },
  { id: 'delete',        label: 'Delete',           icon: '🗑️', group: 'mode'     },

  // ── Element types ──────────────────────────────────────────
  { id: 'actor',         label: 'Actor',            icon: '🧍',  group: 'element'  },
  { id: 'usecase',       label: 'Use Case',         icon: '⭕',  group: 'element'  },

  // ── Relationship types ─────────────────────────────────────
  { id: 'association',   label: 'Association',      icon: '—',   group: 'relation' },
  { id: 'include',       label: '«include»',        icon: '⤵',   group: 'relation' },
  { id: 'extend',        label: '«extend»',         icon: '⤴',   group: 'relation' },
  { id: 'generalization',label: 'Generalization',   icon: '△',   group: 'relation' }
];

const SEQUENCE_DIAGRAM_TOOLS = [
  // ── Mode controls ──────────────────────────────────────────
  { id: 'select',        label: 'Select',           icon: '↖️',  group: 'mode'     },
  { id: 'delete',        label: 'Delete',            icon: '🗑️', group: 'mode'     },

  // ── Element types ──────────────────────────────────────────
  { id: 'lifeline',      label: 'Lifeline',          icon: '|',   group: 'element'  },
  { id: 'actor',         label: 'Actor',             icon: '🧍',  group: 'element'  },

  // ── Relationship types ─────────────────────────────────────
  { id: 'message',       label: 'Message',           icon: '→',   group: 'relation' },
  { id: 'return',        label: 'Return',            icon: '←',   group: 'relation' },
  { id: 'flow',          label: 'Self Message',      icon: '↩',   group: 'relation' }
];


/**
 * getToolbarItems(diagramId)
 * ─────────────────────────────────────────────────────────────
 * LAYMAN'S: "Given which diagram type is currently selected,
 * what tools should appear in the top palette?"
 *
 * TECHNICAL: Simple switch returning the correct tool array.
 * Falls back to class diagram tools for any unrecognized ID
 * so the palette is never empty.
 *
 * RELATIONSHIP: Called in UMLEditor.jsx:
 *   <ToolPalette toolbarItems={getToolbarItems(selectedDiagram)} ... />
 *
 * @param {string} diagramId - matches diagramTypes[].id
 * @returns {Array<{ id: string, label: string, icon: string }>}
 */
export const getToolbarItems = (diagramId) => {
  switch (diagramId) {
    case 'class':    return CLASS_DIAGRAM_TOOLS;
    case 'usecase':  return USE_CASE_DIAGRAM_TOOLS;
    case 'sequence': return SEQUENCE_DIAGRAM_TOOLS;
    default:         return CLASS_DIAGRAM_TOOLS;
  }
};