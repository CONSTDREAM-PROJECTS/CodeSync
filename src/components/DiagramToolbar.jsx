import React from 'react';
import { Download, Upload, Save, Code, ZoomIn, ZoomOut, Grid, Undo, Redo } from 'lucide-react';

const DiagramToolbar = ({
  language,
  setLanguage,
  onNew,
  onImport,
  onExport,
  onGenerateCode,
  zoom,
  onZoomIn,
  onZoomOut,
  showGrid,
  onToggleGrid,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) => {
  return (
    <div className="p-3 flex items-center justify-between" style={{ background: 'var(--panel-2)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="flex items-center space-x-2">
        {/* Language Selector */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none"
        >
          <option>Java</option>
          <option>Python</option>
          <option>JavaScript</option>
        </select>

        <div className="w-px h-6" style={{ background: 'var(--panel)' }}></div>

        {/* File Operations */}
        <button
          onClick={onNew}
          className="p-2 hover:bg-[#3e3e42] rounded transition-colors"
          title="New"
        >
          <Save size={18} />
        </button>
        <label className="p-2 hover:bg-[#3e3e42] rounded transition-colors cursor-pointer" title="Import">
          <Upload size={18} />
          <input type="file" accept=".json" onChange={onImport} className="hidden" />
        </label>
        <button onClick={onExport} className="p-2 hover:bg-[#3e3e42] rounded transition-colors" title="Export">
          <Download size={18} />
        </button>

        <div className="w-px h-6 bg-[#3e3e42]"></div>

        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded transition-colors ${
            canUndo ? 'hover:bg-[#3e3e42]' : 'opacity-50 cursor-not-allowed'
          }`}
          title="Undo"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded transition-colors ${
            canRedo ? 'hover:bg-[#3e3e42]' : 'opacity-50 cursor-not-allowed'
          }`}
          title="Redo"
        >
          <Redo size={18} />
        </button>

        <div className="w-px h-6 bg-[#3e3e42]"></div>

        {/* View Controls */}
        <button onClick={onZoomIn} className="p-2 hover:bg-[#3e3e42] rounded transition-colors" title="Zoom In">
          <ZoomIn size={18} />
        </button>
        <span className="text-sm text-gray-400 px-2">{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomOut} className="p-2 hover:bg-[#3e3e42] rounded transition-colors" title="Zoom Out">
          <ZoomOut size={18} />
        </button>
        <button
          onClick={onToggleGrid}
          className={`p-2 rounded transition-colors ${showGrid ? 'btn-primary' : 'hover:bg-[#3e3e42]'}`}
          style={showGrid ? { color: '#222' } : {}}
          title="Toggle Grid"
        >
          <Grid size={18} />
        </button>
      </div>

      <button
        onClick={onGenerateCode}
        className="btn-primary px-4 py-1.5 rounded flex items-center space-x-2 transition-colors"
      >
        <Code size={18} />
        <span className="text-sm font-medium">Generate Code</span>
      </button>
    </div>
  );
};

export default DiagramToolbar;