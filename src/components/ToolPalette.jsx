/**
 * ============================================================
 * ToolPalette.jsx — Diagram Tool Palette Bar
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the horizontal strip of tool buttons that appears just
 * below the main toolbar. It shows all the elements and relationship
 * types available for the currently active diagram — things like
 * "Class", "Interface", "Inheritance", "Composition", etc. Clicking
 * a shape button adds it to the canvas; clicking a relationship type
 * activates connection-drawing mode so the user can draw lines between
 * existing elements. The active tool gets a blue highlight.
 *
 * TECHNICAL OVERVIEW:
 * A stateless React functional component. The toolbarItems array
 * (sourced from diagramUtils.js via UMLEditor.jsx) changes when the
 * user switches diagram types, so the palette always shows only the
 * tools relevant to the current diagram.
 *
 * Routing logic inside the onClick handler:
 *   - "select" and "delete" tools → call onToolSelect(id) to change
 *     the active cursor mode (no element is added).
 *   - All other tools → call onElementAdd(id), which in UMLEditor
 *     either adds a new element or switches to connection-drawing mode
 *     if the id is a relationship type.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Rendered by UMLEditor.jsx between DiagramToolbar and the SVG canvas.
 * - toolbarItems is produced by getToolbarItems(selectedDiagram) in
 *   diagramUtils.js and passed down via UMLEditor.jsx.
 * - onElementAdd triggers UMLEditor's addElement(), which contains the
 *   full logic for distinguishing shape elements from relationship types.
 * ============================================================
 */

import React from 'react';

/**
 * ToolPalette({ toolbarItems, selectedTool, onToolSelect, onElementAdd })
 * -------------------------------------------------------------------------
 * LAYMAN'S: The palette bar component. Loops over toolbarItems and renders
 *   one button per item. The currently selected tool gets a blue background.
 *   Clicking a tool either changes the cursor mode (select/delete) or adds
 *   a new element/relationship to the canvas.
 *
 * TECHNICAL: Pure/presentational — all state is owned by UMLEditor.jsx.
 *   The routing between onToolSelect and onElementAdd happens here to keep
 *   UMLEditor's addElement() free of mode-switching concerns.
 *
 * @param {Array}    toolbarItems  - Array of { id, icon, label } tool descriptors
 * @param {string}   selectedTool  - Id of the currently active tool
 * @param {Function} onToolSelect  - Called with tool id for select/delete modes
 * @param {Function} onElementAdd  - Called with tool id to add elements/relationships
 */

const ToolPalette = ({ toolbarItems, selectedTool, onToolSelect, onElementAdd }) => {
  return (
    <div className="bg-[#2d2d30] border-b border-[#3e3e42] p-2 flex items-center space-x-1 overflow-x-auto">
      {toolbarItems.map(item => (
        <button
          key={item.id}
          onClick={() => {
            if (item.id === 'select' || item.id === 'delete') {
              onToolSelect(item.id);
            } else {
              onElementAdd(item.id);
            }
          }}
          className={`px-3 py-2 rounded text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
            selectedTool === item.id
              ? 'bg-[#007acc] text-white'
              : 'bg-[#3c3c3c] hover:bg-[#4e4e4e] text-white'
          }`}
          title={item.label}
        >
          <span>{item.icon}</span>
          <span className="text-xs">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ToolPalette;