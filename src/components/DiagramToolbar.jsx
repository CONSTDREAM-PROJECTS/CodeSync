/**
 * ============================================================
 * DiagramToolbar.jsx — Top Toolbar Component
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the horizontal toolbar strip at the very top of the editor.
 * It holds the language dropdown, file operations (New, Import, Export),
 * Undo/Redo buttons, zoom controls, grid toggle, and the two primary
 * action buttons — "Code to Diagram" (import source code) and
 * "Generate Code" (export to source code). Some controls are hidden
 * or relabeled automatically depending on which diagram type is active.
 *
 * TECHNICAL OVERVIEW:
 * A stateless React functional component. All toolbar state lives in
 * UMLEditor.jsx and is passed down as props. Three computed values
 * are derived from the selectedDiagram prop at render time:
 *   - supportsCodeImport:    hides "Code to Diagram" for non-class diagrams
 *   - supportsLanguageSelect: hides the language dropdown for non-class diagrams
 *   - generateButtonLabel/Title: adapts the Generate button label/tooltip
 *     ("Generate Code" for class, "Generate Docs" for others)
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Rendered by UMLEditor.jsx directly below the DiagramSidebar.
 * - zoom and showGrid values originate from useCanvasInteractions.js
 *   and flow through UMLEditor.jsx as props.
 * - canUndo / canRedo originate from useHistory.js and disable the
 *   Undo/Redo buttons when the history stack is at its boundaries.
 * - onGenerateCode triggers CodeGenerator.splitIntoFiles() in UMLEditor.
 * - onCodeToUML opens the CodeImportModal.
 * ============================================================
 */

import React from 'react';
import { Download, Upload, Save, Code, ZoomIn, ZoomOut, Grid, Undo, Redo, FileCode } from 'lucide-react';

/**
 * DiagramToolbar({ ...props })
 * -----------------------------
 * LAYMAN'S: The toolbar component itself. Renders two groups of controls
 *   separated by dividers: the left group (language, file ops, undo/redo,
 *   zoom, grid) and the right group (Code to Diagram, Generate Code/Docs).
 *   Certain controls are conditionally shown based on selectedDiagram.
 *
 * TECHNICAL: Pure/presentational. Derives supportsCodeImport,
 *   supportsLanguageSelect, generateButtonLabel, and generateButtonTitle
 *   from selectedDiagram before rendering so all branching is resolved
 *   once per render rather than inline in JSX.
 *
 * @param {string}   language           - Active code language ("Java"|"Python"|"JavaScript")
 * @param {Function} setLanguage        - Setter for language state in UMLEditor
 * @param {Function} onNew              - Clears the canvas
 * @param {Function} onImport           - Handles .json file import
 * @param {Function} onExport           - Exports diagram as .json
 * @param {Function} onGenerateCode     - Triggers code/doc generation
 * @param {Function} onCodeToUML        - Opens CodeImportModal
 * @param {number}   zoom               - Current zoom level (e.g., 1 = 100%)
 * @param {Function} onZoomIn           - Increments zoom
 * @param {Function} onZoomOut          - Decrements zoom
 * @param {boolean}  showGrid           - Whether the grid overlay is visible
 * @param {Function} onToggleGrid       - Toggles grid visibility
 * @param {Function} onUndo             - Steps back in history
 * @param {Function} onRedo             - Steps forward in history
 * @param {boolean}  canUndo            - False when at the start of history
 * @param {boolean}  canRedo            - False when at the end of history
 * @param {string}   selectedDiagram    - Active diagram id (e.g., "class")
 */

const DiagramToolbar = ({
  language,
  setLanguage,
  onNew,
  onImport,
  onExport,
  onExportSVG,
  onExportPNG,
  onGenerateCode,
  onCodeToUML,
  zoom,
  onZoomIn,
  onZoomOut,
  showGrid,
  onToggleGrid,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedDiagram = 'class',
  // Accepted but intentionally unused — login is handled by the top navbar only
  currentUser,     // eslint-disable-line no-unused-vars
  onLoginClick,    // eslint-disable-line no-unused-vars
  onLogout,        // eslint-disable-line no-unused-vars
}) => {
  /**
   * supportsCodeImport / supportsLanguageSelect
   * LAYMAN'S: Some toolbar controls only make sense for class diagrams.
   *   "Code to Diagram" lets you import source code — that only applies
   *   to class diagrams. The language dropdown only applies to class
   *   diagrams too, since use-case and sequence diagrams produce
   *   language-agnostic Markdown documentation.
   * TECHNICAL: Boolean flags derived once per render from selectedDiagram.
   *   Used to conditionally render JSX blocks further down.
   */
  // "Code to Diagram" import — supported for all 3 diagram types
  const supportsCodeImport = true;

  // Language selector — shown for all diagram types
  const supportsLanguageSelect = true;

  /**
   * generateButtonLabel / generateButtonTitle
   * LAYMAN'S: All three diagram types now say "Generate Code" since
   *   all of them produce code output (class → source code,
   *   use case / sequence → structured code/docs).
   * TECHNICAL: Unified label across all diagram types.
   */
  // Button label + tooltip — same for all diagram types
  const generateButtonLabel = 'Generate Code';

  const generateButtonTitle = selectedDiagram === 'class'
    ? 'Generate source code from class diagram'
    : selectedDiagram === 'usecase'
    ? 'Generate code from use case diagram'
    : 'Generate code from sequence diagram';

  return (
    <div className="px-3 py-2 flex items-center justify-between flex-shrink-0" style={{ background: 'var(--panel-2)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
        {/* Language Selector — class diagram only */}
        {supportsLanguageSelect && (
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none flex-shrink-0"
          >
            <option>Java</option>
            <option>Python</option>
            <option>JavaScript</option>
          </select>
        )}

        <div className="w-px h-6 flex-shrink-0" style={{ background: 'var(--panel)' }}></div>

        {/* File Operations */}
        <button onClick={onNew} className="p-2 hover:bg-[#3e3e42] rounded transition-colors flex-shrink-0" title="New Diagram">
          <Save size={18} />
        </button>
        <label className="p-2 hover:bg-[#3e3e42] rounded transition-colors cursor-pointer flex-shrink-0" title="Import JSON">
          <Upload size={18} />
          <input type="file" accept=".json" onChange={onImport} className="hidden" />
        </label>
        {/* Fix #6: Export format group — JSON / SVG / PNG */}
        <div className="relative group flex-shrink-0">
          <button
            className="p-2 hover:bg-[#3e3e42] rounded transition-colors flex items-center gap-1"
            title="Export diagram"
            onClick={onExport}
          >
            <Download size={18} />
          </button>
          {/* Hover dropdown for export formats */}
          <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#2d2d30] border border-[#3e3e42] rounded shadow-xl z-50 min-w-[110px]">
            <button
              onClick={onExport}
              className="px-3 py-2 text-xs text-left hover:bg-[#3e3e42] text-white whitespace-nowrap"
            >
              📄 Export JSON
            </button>
            <button
              onClick={onExportSVG}
              className="px-3 py-2 text-xs text-left hover:bg-[#3e3e42] text-white whitespace-nowrap"
            >
              🖼️ Export SVG
            </button>
            <button
              onClick={onExportPNG}
              className="px-3 py-2 text-xs text-left hover:bg-[#3e3e42] text-white whitespace-nowrap"
            >
              🖼️ Export PNG
            </button>
          </div>
        </div>

        <div className="w-px h-6 bg-[#3e3e42] flex-shrink-0"></div>

        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded transition-colors flex-shrink-0 ${canUndo ? 'hover:bg-[#3e3e42]' : 'opacity-50 cursor-not-allowed'}`}
          title="Undo"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded transition-colors flex-shrink-0 ${canRedo ? 'hover:bg-[#3e3e42]' : 'opacity-50 cursor-not-allowed'}`}
          title="Redo"
        >
          <Redo size={18} />
        </button>

        <div className="w-px h-6 bg-[#3e3e42] flex-shrink-0"></div>

        {/* View Controls */}
        <button onClick={onZoomIn} className="p-2 hover:bg-[#3e3e42] rounded transition-colors flex-shrink-0" title="Zoom In">
          <ZoomIn size={18} />
        </button>
        <span className="text-sm text-gray-400 px-2 flex-shrink-0">{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomOut} className="p-2 hover:bg-[#3e3e42] rounded transition-colors flex-shrink-0" title="Zoom Out">
          <ZoomOut size={18} />
        </button>
        <button
          onClick={onToggleGrid}
          className={`p-2 rounded transition-colors flex-shrink-0 ${showGrid ? 'btn-primary' : 'hover:bg-[#3e3e42]'}`}
          style={showGrid ? { color: '#222' } : {}}
          title="Toggle Grid"
        >
          <Grid size={18} />
        </button>
      </div>

      <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
        {/* Code to Diagram — Class Diagram only */}
        {supportsCodeImport && (
          <button
            onClick={onCodeToUML}
            className="btn-primary px-4 py-1.5 rounded flex items-center space-x-2 transition-colors"
            title="Import source code and convert to UML class diagram"
          >
            <FileCode size={18} />
            <span className="text-sm font-medium">Code to Diagram</span>
          </button>
        )}

        {/* Generate Code / Docs — all diagram types */}
        <button
          onClick={onGenerateCode}
          className="btn-primary px-4 py-1.5 rounded flex items-center space-x-2 transition-colors"
          title={generateButtonTitle}
        >
          <Code size={18} />
          <span className="text-sm font-medium">{generateButtonLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default DiagramToolbar;