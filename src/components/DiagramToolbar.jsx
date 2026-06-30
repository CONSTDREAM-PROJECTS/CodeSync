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
 * UPDATED FEATURES:
 * - Export sub-menu now includes PDF and JPEG diagram exports
 * - Generate Code button has a dropdown to download code as the specific file type
 * - A "Clear Code" option is added to wipe the generated code panel
 * ============================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, PenSquare, Code, ZoomIn, ZoomOut, Grid, Undo, Redo, FileCode, ChevronDown, Trash2 } from 'lucide-react';

const DiagramToolbar = ({
  language,
  setLanguage,
  onNew,
  onImport,
  onExport,
  onExportSVG,
  onExportPNG,
  onExportPDF,
  onExportJPEG,
  onGenerateCode,
  onDownloadCode,
  onClearCode,
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
  hasGeneratedCode = false,
  // Accepted but intentionally unused
  currentUser,     // eslint-disable-line no-unused-vars
  onLoginClick,    // eslint-disable-line no-unused-vars
  onLogout,        // eslint-disable-line no-unused-vars
}) => {
  const [showGenerateMenu, setShowGenerateMenu] = useState(false);
  const generateMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (generateMenuRef.current && !generateMenuRef.current.contains(e.target)) {
        setShowGenerateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const supportsCodeImport = true;
  const supportsLanguageSelect = true;

  const generateButtonLabel = 'Generate Code';
  const generateButtonTitle = selectedDiagram === 'class'
    ? 'Generate source code from class diagram'
    : selectedDiagram === 'usecase'
    ? 'Generate code from use case diagram'
    : 'Generate code from sequence diagram';

  // Determine the correct file extension for the current language
  const getCodeFileExtension = () => {
    if (language === 'Python') return 'py';
    if (language === 'JavaScript') return 'js';
    return 'java';
  };

  const getCodeFileMime = () => {
    if (language === 'Python') return 'text/x-python';
    if (language === 'JavaScript') return 'text/javascript';
    return 'text/x-java-source';
  };

  return (
    <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 gap-6" style={{ background: 'var(--panel-2)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        {/* Language Selector */}
        {supportsLanguageSelect && (
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none flex-shrink-0 transition-all duration-200 hover:border-[#4e4e52] hover:bg-[#404040]"
          >
            <option>Java</option>
            <option>Python</option>
            <option>JavaScript</option>
          </select>
        )}

        <div className="w-px h-6 flex-shrink-0" style={{ background: 'var(--panel)' }}></div>

        {/* File Operations */}
        <button onClick={onNew} className="p-2.5 hover:bg-[#3e3e42] rounded transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95" title="New Diagram">
          <PenSquare size={18} />
        </button>
        <label className="p-2.5 hover:bg-[#3e3e42] rounded transition-all duration-200 cursor-pointer flex-shrink-0 hover:scale-110 active:scale-95" title="Import JSON">
          <Upload size={18} />
          <input type="file" accept=".json" onChange={onImport} className="hidden" />
        </label>

        {/* Export format group — JSON / SVG / PNG / PDF / JPEG */}
        <div className="relative group flex-shrink-0">
          <button
            className="p-2.5 hover:bg-[#3e3e42] rounded transition-all duration-200 flex items-center gap-1 hover:scale-110 active:scale-95"
            title="Export diagram"
            onClick={onExport}
          >
            <Download size={18} />
          </button>
          {/* Hover dropdown for export formats */}
          <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#2d2d30] border border-[#3e3e42] rounded shadow-xl z-50 min-w-[140px]">
            <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#3e3e42]">
              Diagram Export
            </div>
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
            <button
              onClick={onExportJPEG}
              className="px-3 py-2 text-xs text-left hover:bg-[#3e3e42] text-white whitespace-nowrap"
            >
              📷 Export JPEG
            </button>
            <button
              onClick={onExportPDF}
              className="px-3 py-2 text-xs text-left hover:bg-[#3e3e42] text-white whitespace-nowrap"
            >
              📑 Export PDF
            </button>
          </div>
        </div>

        <div className="w-px h-6 bg-[#3e3e42] flex-shrink-0"></div>

        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2.5 rounded transition-all duration-200 flex-shrink-0 ${canUndo ? 'hover:bg-[#3e3e42] hover:scale-110 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
          title="Undo"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2.5 rounded transition-all duration-200 flex-shrink-0 ${canRedo ? 'hover:bg-[#3e3e42] hover:scale-110 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
          title="Redo"
        >
          <Redo size={18} />
        </button>

        <div className="w-px h-6 bg-[#3e3e42] flex-shrink-0"></div>

        {/* View Controls - Zoom Group */}
        <div className="flex items-center gap-1 bg-[#2d2d2d] rounded px-2 py-1.5">
          <button onClick={onZoomIn} className="p-1.5 hover:bg-[#3e3e42] rounded transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95" title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <span className="text-sm text-gray-400 px-2 flex-shrink-0 tabular-nums min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={onZoomOut} className="p-1.5 hover:bg-[#3e3e42] rounded transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95" title="Zoom Out">
            <ZoomOut size={16} />
          </button>
        </div>

        <button
          onClick={onToggleGrid}
          className={`p-2.5 rounded transition-all duration-200 flex-shrink-0 ${showGrid ? 'btn-primary' : 'hover:bg-[#3e3e42]'} hover:scale-110 active:scale-95`}
          style={showGrid ? { color: '#222' } : {}}
          title="Toggle Grid"
        >
          <Grid size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
        {/* Code to Diagram */}
        {supportsCodeImport && (
          <button
            onClick={onCodeToUML}
            className="btn-primary px-4 py-2 rounded flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
            title="Import source code and convert to UML class diagram"
          >
            <FileCode size={18} />
            <span className="text-sm font-medium">Code to Diagram</span>
          </button>
        )}

        {/* Generate Code — with dropdown for download & clear */}
        <button
          onClick={onGenerateCode}
          className="btn-primary px-4 py-2 rounded flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          title={generateButtonTitle}
        >
          <Code size={18} />
          <span className="text-sm font-medium">{generateButtonLabel}</span>
        </button>
        
        <div className="relative flex-shrink-0" ref={generateMenuRef}>
          {/* Dropdown arrow */}
          <button
            onClick={() => setShowGenerateMenu(v => !v)}
            className="btn-primary px-3 py-2 rounded transition-all duration-200 hover:scale-105 active:scale-95"
            title="Code options"
          >
            <ChevronDown size={14} />
          </button>

          {/* Dropdown menu */}
          {showGenerateMenu && (
            <div className="absolute right-0 top-full mt-1 flex flex-col bg-[#2d2d30] border border-[#3e3e42] rounded shadow-xl z-50 min-w-[200px]">
              <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#3e3e42]">
                Code Actions
              </div>
              <button
                onClick={() => { onDownloadCode(); setShowGenerateMenu(false); }}
                disabled={!hasGeneratedCode}
                className={`px-3 py-2 text-xs text-left whitespace-nowrap flex items-center gap-2 ${hasGeneratedCode ? 'hover:bg-[#3e3e42] text-white' : 'text-gray-600 cursor-not-allowed'}`}
                title={hasGeneratedCode ? `Download as .${getCodeFileExtension()} file` : 'Generate code first'}
              >
                <Download size={13} />
                Download as .{getCodeFileExtension()}
              </button>
              <div className="border-t border-[#3e3e42] my-1" />
              <button
                onClick={() => { onClearCode(); setShowGenerateMenu(false); }}
                disabled={!hasGeneratedCode}
                className={`px-3 py-2 text-xs text-left whitespace-nowrap flex items-center gap-2 ${hasGeneratedCode ? 'hover:bg-[#3e3e42] text-red-400' : 'text-gray-600 cursor-not-allowed'}`}
                title={hasGeneratedCode ? 'Clear generated code panel' : 'No code to clear'}
              >
                <Trash2 size={13} />
                Clear Generated Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagramToolbar;