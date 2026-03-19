/**
 * ============================================================
 * DiagramSidebar.jsx — Diagram Type Navigation Sidebar
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the left-hand panel in the editor that lists all the
 * available UML diagram types (Class, Use Case, Sequence, etc.)
 * grouped into "Structural" and "Behavioral" categories. Clicking
 * a diagram name switches the canvas to that diagram type. At the
 * bottom it also shows a quick-reference card explaining which
 * algorithms power the two core features of the tool.
 *
 * TECHNICAL OVERVIEW:
 * A stateless React functional component — it receives all data
 * as props and emits selection events upward. No local state.
 * Renders two filtered lists of diagramTypes by category, with
 * active-state styling driven by the selectedDiagram prop.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Rendered inside UMLEditor.jsx as the fixed left sidebar.
 * - diagramTypes array is defined in diagramUtils.js and passed
 *   down via UMLEditor.jsx.
 * - onDiagramSelect bubbles up to UMLEditor.jsx's handleDiagramSelect,
 *   which resets the selected tool and connection state before
 *   switching the active diagram.
 * ============================================================
 */

import React from 'react';

/**
 * DiagramSidebar({ diagramTypes, selectedDiagram, onDiagramSelect })
 * --------------------------------------------------------------------
 * LAYMAN'S: The sidebar component itself. Loops over the diagramTypes
 *   list twice — once for Structural, once for Behavioral — and renders
 *   a clickable button for each. The currently active diagram is
 *   highlighted. A static info card at the bottom describes the two
 *   core algorithms (Rule-Based Transformation and Bidirectional Sync).
 *
 * TECHNICAL: Pure/presentational component. All visual state (which
 *   button is active) is derived from the selectedDiagram prop rather
 *   than local state — the parent owns the selection truth.
 *
 * @param {Array}    diagramTypes     - Array of { id, name, category } objects
 * @param {string}   selectedDiagram  - Currently active diagram id (e.g., "class")
 * @param {Function} onDiagramSelect  - Callback invoked with the selected diagram id
 */

const DiagramSidebar = ({ diagramTypes, selectedDiagram, onDiagramSelect }) => {
  return (
    <div className="w-64 bg-[#252526] border-r border-[#3e3e42] overflow-y-auto">
      <div className="p-4 border-b border-[#3e3e42]">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">UML DIAGRAMS</h2>
      </div>

      {/* Structural Diagrams */}
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1">STRUCTURAL</div>
        {diagramTypes.filter(d => d.category === 'Structural').map(diagram => (
          <button
            key={diagram.id}
            onClick={() => onDiagramSelect(diagram.id)}
            className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
              selectedDiagram === diagram.id
                ? 'bg-[#37373d] text-white'
                : 'text-gray-300 hover:bg-[#2a2d2e]'
            }`}
          >
            {diagram.name}
          </button>
        ))}
      </div>

      {/* Behavioral Diagrams */}
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1 mt-4">BEHAVIORAL</div>
        {diagramTypes.filter(d => d.category === 'Behavioral').map(diagram => (
          <button
            key={diagram.id}
            onClick={() => onDiagramSelect(diagram.id)}
            className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
              selectedDiagram === diagram.id
                ? 'bg-[#37373d] text-white'
                : 'text-gray-300 hover:bg-[#2a2d2e]'
            }`}
          >
            {diagram.name}
          </button>
        ))}
      </div>

      {/* Algorithm Information */}
      <div className="p-4 mt-6 border-t border-[#3e3e42]">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">ALGORITHMS</h3>
        <div className="text-xs text-gray-400 space-y-2">
          <div className="bg-[#1e1e1e] p-2 rounded">
            <div className="font-semibold text-blue-400 mb-1">Rule-Based Model Transformation</div>
            <div>Converts source code to UML using predefined transformation rules</div>
          </div>
          <div className="bg-[#1e1e1e] p-2 rounded">
            <div className="font-semibold text-green-400 mb-1">Bidirectional Model-Code Sync</div>
            <div>Keeps UML diagrams and code synchronized in both directions</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagramSidebar;