import React, { useState, useRef, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle, FileCode } from 'lucide-react';
import CodeToUMLConverter from '../services/codeToUMLConverter';

const CodeImportModal = ({ onImport, onClose, diagramType = 'class' }) => {
  const [sourceCode,       setSourceCode]       = useState('');
  const [language,         setLanguage]         = useState('Java');
  const [conversionResult, setConversionResult] = useState(null);
  const [isConverting,     setIsConverting]     = useState(false);
  const [isDragging,       setIsDragging]       = useState(false); // drag-over state
  const [droppedFileName,  setDroppedFileName]  = useState('');    // show which file was dropped
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0); // counts enter/leave pairs to avoid flicker

  // ── Language detection from file extension ──────────────────────────────
  const detectLanguage = (fileName) => {
    const f = fileName.toLowerCase();
    if (f.endsWith('.java'))                         return 'Java';
    if (f.endsWith('.py'))                           return 'Python';
    if (f.endsWith('.js') || f.endsWith('.jsx'))    return 'JavaScript';
    if (f.endsWith('.puml') || f.endsWith('.plantuml')) return 'PlantUML';
    return null; // unknown — keep current selection
  };

  // ── Shared file reader ───────────────────────────────────────────────────
  const readFile = useCallback((file) => {
    if (!file) return;
    const detected = detectLanguage(file.name);
    if (detected) setLanguage(detected);
    setDroppedFileName(file.name);
    setConversionResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setSourceCode(e.target.result);
    reader.readAsText(file);
  }, []);

  // ── Click-to-upload handler ──────────────────────────────────────────────
  const handleFileUpload = (event) => {
    readFile(event.target.files[0]);
    // Reset so the same file can be re-uploaded
    event.target.value = '';
  };

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  // dragCounterRef prevents the drop zone from flickering when the cursor
  // moves over a child element (which fires dragLeave then dragEnter).

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Tell the browser to show a "copy" cursor
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Only read the first file if multiple were dropped
      readFile(files[0]);
    }
  }, [readFile]);

  // ── Convert handler ──────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!sourceCode.trim()) {
      setConversionResult({ success: false, message: 'Please paste or drop some source code first.' });
      return;
    }
    setIsConverting(true);
    // Route to sequence parser when on Sequence Diagram and using Java/Python/JS
    const isSequenceMode = diagramType === 'sequence' && language !== 'PlantUML';
    const result = isSequenceMode
      ? CodeToUMLConverter.convertCodeToUMLSequence(sourceCode, language)
      : CodeToUMLConverter.convertCodeToUML(sourceCode, language);
    setConversionResult(result);
    setIsConverting(false);
  };

  const handleImportDiagram = () => {
    if (conversionResult?.success) {
      // FIX: pass the full result so UMLEditor can honour replaceAll and
      // auto-switch the diagram type (e.g. class → sequence) when needed.
      onImport(
        conversionResult.elements,
        conversionResult.connections,
        {
          replaceAll:  conversionResult.replaceAll  || false,
          diagramType: conversionResult.metadata?.sourceLanguage
            ? (diagramType === 'sequence' ? 'sequence' : diagramType)
            : diagramType,
          language:    conversionResult.metadata?.sourceLanguage || language,
        }
      );
      onClose();
    }
  };

  const handleClear = () => {
    setSourceCode('');
    setConversionResult(null);
    setDroppedFileName('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-[#252526] border border-[#3e3e42] rounded-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        // Attach drag events to the whole modal so the user can drop
        // anywhere inside it, not just on the textarea.
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-[#3e3e42]">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Upload size={20} />
            <span>Code to UML Conversion</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Paste, upload, or <span className="text-[#007acc] font-medium">drag & drop</span> a code
            file to automatically generate UML diagrams using Rule-Based Model Transformation.
          </p>
        </div>

        <div className="p-6 space-y-4">

          {/* ── Language Selector ─────────────────────────────────────────── */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Programming Language / Format
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isConverting}
              className="w-full bg-[#3c3c3c] text-white px-3 py-2 rounded border border-[#3e3e42] focus:outline-none focus:border-[#007acc] disabled:opacity-50"
            >
              <option value="Java">Java</option>
              <option value="Python">Python</option>
              <option value="JavaScript">JavaScript</option>
              <option value="PlantUML">PlantUML</option>
            </select>
          </div>

          {/* ── Drag & Drop Zone ─────────────────────────────────────────── */}
          {/* This is the primary drop target with visual feedback.
              The textarea below is a secondary drop target for convenience. */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Source Code or Diagram Definition
            </label>

            {/* Drop zone overlay — shown when a file is being dragged */}
            <div className="relative">
              <textarea
                value={sourceCode}
                onChange={(e) => { setSourceCode(e.target.value); setDroppedFileName(''); }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                placeholder={
                  `Drop a .${language === 'Java' ? 'java' : language === 'Python' ? 'py' : language === 'PlantUML' ? 'puml' : 'js'} file here, or paste your ${language === 'PlantUML' ? 'diagram definition' : 'source code'}...`
                }
                disabled={isConverting}
                className={`w-full h-64 bg-[#1e1e1e] text-white px-3 py-2 rounded border font-mono text-sm
                  focus:outline-none resize-none disabled:opacity-50 transition-colors
                  ${isDragging
                    ? 'border-[#007acc] bg-[#1a2a3a]'
                    : 'border-[#3e3e42] focus:border-[#007acc]'
                  }`}
              />

              {/* Drag overlay — appears on top of textarea while dragging */}
              {isDragging && (
                <div className="absolute inset-0 rounded border-2 border-dashed border-[#007acc] bg-[#1a2a3a] bg-opacity-90 flex flex-col items-center justify-center pointer-events-none">
                  <FileCode size={40} className="text-[#007acc] mb-3" />
                  <p className="text-[#007acc] font-semibold text-lg">Drop your file here</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Supports .java · .py · .js · .jsx · .puml
                  </p>
                </div>
              )}
            </div>

            {/* File name badge — shows after a file is dropped or uploaded */}
            {droppedFileName && (
              <div className="flex items-center gap-2 mt-2 px-2 py-1 bg-[#1e3a1f] border border-green-700 rounded text-xs text-green-300">
                <FileCode size={12} />
                <span className="font-mono">{droppedFileName}</span>
                <span className="text-gray-400">loaded</span>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-1">
              {language === 'PlantUML'
                ? 'PlantUML format: starts with @startuml, ends with @enduml'
                : 'Supported: classes, attributes, methods, inheritance, interfaces, and composition'}
            </p>
          </div>

          {/* ── File Upload Button + Clear ────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white px-4 py-2 rounded border border-[#3e3e42] transition-colors text-center text-sm">
                📁 Choose File (.java, .py, .js, .puml)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".java,.py,.js,.jsx,.ts,.tsx,.puml,.plantuml"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isConverting}
              />
            </label>

            {sourceCode && (
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-[#4a4a4f] hover:bg-[#5a5a5f] text-white rounded transition-colors text-sm"
                title="Clear"
              >
                🗑️ Clear
              </button>
            )}
          </div>

          {/* ── Convert Button ────────────────────────────────────────────── */}
          <button
            onClick={handleConvert}
            disabled={!sourceCode.trim() || isConverting || !!conversionResult?.success}
            className="w-full bg-[#007acc] hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
          >
            {isConverting ? 'Converting...' : 'Convert to UML Diagram'}
          </button>

          {/* ── Conversion Result ─────────────────────────────────────────── */}
          {conversionResult && (
            <div className={`p-4 rounded-lg border-l-4 ${
              conversionResult.success
                ? 'bg-[#1e3a1f] border-green-500 text-green-100'
                : 'bg-[#3a1f1f] border-red-500 text-red-100'
            }`}>
              <div className="flex items-start space-x-3">
                {conversionResult.success
                  ? <CheckCircle size={20} className="flex-shrink-0 mt-0.5 text-green-400" />
                  : <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-red-400" />
                }
                <div className="flex-1">
                  <p className="font-semibold">{conversionResult.message}</p>

                  {conversionResult.metadata && (
                    <div className="text-sm mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Classes: </span>
                        <span className="font-mono">{conversionResult.metadata.totalClasses}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Methods: </span>
                        <span className="font-mono">{conversionResult.metadata.totalMethods}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Attributes: </span>
                        <span className="font-mono">{conversionResult.metadata.totalAttributes}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Relationships: </span>
                        <span className="font-mono">{conversionResult.metadata.relationships}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="p-4 border-t border-[#3e3e42] flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImportDiagram}
            disabled={!conversionResult?.success}
            className="px-4 py-2 bg-[#007acc] hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            Import to Diagram
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeImportModal;