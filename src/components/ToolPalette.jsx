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

  /**
   * handleClick(item)
   * LAYMAN'S: Routes the click to the right handler — mode tools
   *   (select/delete) change the cursor mode; everything else adds
   *   an element or activates connection drawing.
   * TECHNICAL: Guard on item.id against the two special mode IDs.
   */
  const handleClick = (item) => {
    if (item.id === 'select' || item.id === 'delete') {
      onToolSelect(item.id);
    } else {
      onElementAdd(item.id);
    }
  };

  /**
   * buttonClass(item)
   * LAYMAN'S: Returns the correct CSS classes for a button —
   *   blue if it's the active tool, dark grey otherwise.
   * TECHNICAL: Active state is driven by selectedTool prop.
   */
  const buttonClass = (item) =>
    `px-2 py-1.5 rounded text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${
      selectedTool === item.id
        ? 'bg-[#007acc] text-white'
        : 'bg-[#3c3c3c] hover:bg-[#4e4e4e] text-white'
    }`;

  // Split into two groups: mode+elements on row 1, relationships on row 2
  const row1 = toolbarItems.filter(i => i.group === 'mode' || i.group === 'element');
  const row2 = toolbarItems.filter(i => i.group === 'relation');

  // If no group tags (fallback for old data), render original single row
  if (row2.length === 0 && row1.length === 0) {
    return (
      <div className="bg-[#2d2d30] border-b border-[#3e3e42] px-2 py-1.5 flex items-center gap-1 overflow-x-auto flex-shrink-0">
        {toolbarItems.map(item => (
          <button key={item.id} onClick={() => handleClick(item)} className={buttonClass(item)} title={item.label}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-[#2d2d30] border-b border-[#3e3e42] flex flex-col flex-shrink-0">
      {/* Row 1 — Mode controls + Element types */}
      <div className="px-2 pt-1.5 pb-1 flex items-center gap-1 overflow-x-auto border-b border-[#3e3e42]">
        {row1.map((item, idx) => (
          <>
            {/* Divider between mode and element groups */}
            {idx > 0 && item.group === 'element' && row1[idx - 1]?.group === 'mode' && (
              <div key={`div-${item.id}`} className="w-px h-5 bg-[#4e4e4e] flex-shrink-0 mx-0.5" />
            )}
            <button key={item.id} onClick={() => handleClick(item)} className={buttonClass(item)} title={item.label}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </>
        ))}
      </div>

      {/* Row 2 — Relationship types (only shown if any exist) */}
      {row2.length > 0 && (
        <div className="px-2 pt-1 pb-1.5 flex items-center gap-1 overflow-x-auto">
          <span className="text-xs text-gray-500 mr-1 flex-shrink-0">Relations:</span>
          {row2.map(item => (
            <button key={item.id} onClick={() => handleClick(item)} className={buttonClass(item)} title={item.label}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToolPalette;