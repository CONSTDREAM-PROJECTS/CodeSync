/**
 * ============================================================
 * PropertiesPanel.jsx — Properties & Generated Code Side Panel
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the right-hand panel in the editor. It has two tabs:
 *
 *   "Properties" tab — shows an editing form for whatever is
 *   currently selected on the canvas. Select a class and you can
 *   rename it, add/remove attributes and methods, change visibility,
 *   mark things static or abstract, and resize it. Select a
 *   connection and you can set multiplicity, labels, and roles.
 *   Select nothing and you see a placeholder prompt.
 *
 *   "Generated Code" tab — shows the source code that was last
 *   generated from the diagram. If the diagram produced multiple
 *   files, file-name tabs let you browse between them. A "Copy Code"
 *   button lets the user grab the code quickly.
 *
 * TECHNICAL OVERVIEW:
 * Three React components are defined in this file:
 *   1. PropertiesPanel   — outer container; owns tab switching and
 *                          the currentCode sync effect; routes to the
 *                          correct sub-component based on selection.
 *   2. ElementProperties — form UI for editing a single element's
 *                          name, stereotype, size, attributes, and methods.
 *                          Inline helpers: updateAttribute, addAttribute,
 *                          removeAttribute, updateMethod, addMethod,
 *                          removeMethod.
 *   3. ConnectionProperties — form UI for editing a connection's
 *                             multiplicity, label, and role annotations.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Rendered by UMLEditor.jsx as the fixed right sidebar.
 * - setElements / setConnections prop calls modify UMLEditor's
 *   live diagram state directly, so canvas rendering stays in sync.
 * - saveToHistory is called after any edit that should be undoable.
 * - generatedFiles / selectedFileIndex / setSelectedFileIndex connect
 *   the Code tab to the output of CodeGenerator.splitIntoFiles() in
 *   UMLEditor.jsx.
 * ============================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Fix #18: Lightweight syntax highlighter — no external library needed.
 * Tokenises Java / Python / JavaScript source into coloured spans.
 * Returns an array of { text, className } tokens.
 */
const KEYWORDS = {
  Java: ['abstract','assert','boolean','break','byte','case','catch','char','class',
         'const','continue','default','do','double','else','enum','extends','final',
         'finally','float','for','goto','if','implements','import','instanceof','int',
         'interface','long','native','new','null','package','private','protected',
         'public','return','short','static','strictfp','super','switch','synchronized',
         'this','throw','throws','transient','try','void','volatile','while','true','false'],
  Python: ['and','as','assert','async','await','break','class','continue','def','del',
           'elif','else','except','finally','for','from','global','if','import','in',
           'is','lambda','None','nonlocal','not','or','pass','raise','return','True',
           'False','try','while','with','yield','self','super'],
  JavaScript: ['async','await','break','case','catch','class','const','continue',
               'debugger','default','delete','do','else','export','extends','finally',
               'for','from','function','if','import','in','instanceof','let','new',
               'null','of','return','static','super','switch','this','throw','true',
               'false','try','typeof','undefined','var','void','while','with','yield'],
};

/**
 * highlightCode(code, language)
 * Returns an array of token objects: { text, type }
 * type: 'keyword' | 'string' | 'comment' | 'number' | 'plain'
 */
function highlightCode(code, language) {
  if (!code) return [];
  const kwSet = new Set(KEYWORDS[language] || KEYWORDS.Java);
  const tokens = [];

  // Simple regex tokeniser — processes code left to right
  const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([^\w\s])/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const [full, comment, str, num, word, _space, _other] = match;
    if (comment)      tokens.push({ text: full, type: 'comment' });
    else if (str)     tokens.push({ text: full, type: 'string' });
    else if (num)     tokens.push({ text: full, type: 'number' });
    else if (word)    tokens.push({ text: full, type: kwSet.has(full) ? 'keyword' : 'plain' });
    else              tokens.push({ text: full, type: 'plain' });
  }
  return tokens;
}

const TOKEN_COLORS = {
  keyword: '#569cd6',   // blue  — keywords
  string:  '#ce9178',   // orange — strings
  comment: '#6a9955',   // green  — comments
  number:  '#b5cea8',   // light green — numbers
  plain:   '#d4d4d4',   // light grey — identifiers/operators
};

/**
 * SyntaxHighlightedCode({ code, language })
 * Renders a <pre> with inline-colored spans for each token.
 */
const SyntaxHighlightedCode = ({ code, language }) => {
  const tokens = useMemo(() => highlightCode(code, language), [code, language]);
  return (
    <pre className="flex-1 bg-[#1e1e1e] p-3 rounded text-xs overflow-auto font-mono leading-relaxed" style={{tabSize: 2}}>
      {tokens.map((tok, i) => (
        <span key={i} style={{ color: TOKEN_COLORS[tok.type] || TOKEN_COLORS.plain }}>
          {tok.text}
        </span>
      ))}
    </pre>
  );
};

/**
 * PropertiesPanel({ ...props })
 * ------------------------------
 * LAYMAN'S: The outer panel component. Manages the Properties / Generated
 *   Code tab toggle and uses a useEffect to keep the displayed code in
 *   sync with the selected file tab or the latest generated output.
 *
 * TECHNICAL: Owns the currentCode local state (derived/synced from
 *   generatedFiles + selectedFileIndex via useEffect). Delegates
 *   rendering to ElementProperties, ConnectionProperties, or placeholder
 *   text depending on what is selected in the diagram.
 *
 * @param {boolean}  showCodePanel          - True when the Code tab is active
 * @param {Function} setShowCodePanel       - Switches between Properties/Code tabs
 * @param {Array}    selectedElements       - Currently selected element objects
 * @param {Object}   selectedConnection     - Currently selected connection object
 * @param {Array}    elements               - Full element list from UMLEditor
 * @param {Array}    connections            - Full connection list from UMLEditor
 * @param {Function} setElements            - Updates the element list in UMLEditor
 * @param {Function} setSelectedElements    - Updates the selection in UMLEditor
 * @param {Function} setConnections         - Updates the connection list in UMLEditor
 * @param {Function} setSelectedConnection  - Updates the selected connection in UMLEditor
 * @param {Function} saveToHistory          - Commits the current state to undo history
 * @param {string}   generatedCode          - Single-string fallback generated code
 * @param {Array}    generatedFiles         - Array of { filename, content } objects
 * @param {number}   selectedFileIndex      - Index of the active file tab
 * @param {Function} setSelectedFileIndex   - Changes the active file tab
 */

const PropertiesPanel = ({
  showCodePanel,
  setShowCodePanel,
  language,
  selectedElements,
  selectedConnection,
  elements,
  connections,
  setElements,
  setSelectedElements,
  setConnections,
  setSelectedConnection,
  saveToHistory,
  onCopySuccess,
  generatedCode,
  generatedFiles = [],
  selectedFileIndex = 0,
  setSelectedFileIndex = () => {}
}) => {
  /**
   * currentCode / useEffect sync
   * LAYMAN'S: Keeps the code display in sync whenever the user clicks a
   *   different file tab or new code is generated. Without this, switching
   *   file tabs would show stale code from the previous generation.
   * TECHNICAL: Derived state pattern — currentCode is a local mirror of
   *   generatedFiles[selectedFileIndex].content. The effect re-runs whenever
   *   selectedFileIndex, generatedFiles, or generatedCode changes, ensuring
   *   the displayed code always reflects the current selection.
   */
  const [currentCode, setCurrentCode] = useState(generatedCode);

  // Update displayed code when file index changes or generatedFiles changes
  useEffect(() => {
    if (generatedFiles.length > 0 && selectedFileIndex < generatedFiles.length) {
      setCurrentCode(generatedFiles[selectedFileIndex].content);
    } else if (generatedCode) {
      setCurrentCode(generatedCode);
    }
  }, [selectedFileIndex, generatedFiles, generatedCode]);

  /**
   * updateElement(elementId, updates)
   * LAYMAN'S: Applies a partial update (like a name change or new attribute)
   *   to an element both in the master elements list and in the current
   *   selection, so the properties form stays in sync with the canvas.
   * TECHNICAL: Immutable update — maps over the elements array returning a
   *   new array with only the matching element replaced via spread. Also
   *   updates selectedElements so the form's controlled inputs reflect
   *   the new values without a re-select.
   */
  const updateElement = (elementId, updates) => {
    const updated = elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );
    setElements(updated);
    setSelectedElements(prev => prev.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    ));
  };

  /**
   * updateConnection(connectionId, updates)
   * LAYMAN'S: Updates a connection's properties (label, multiplicity, roles)
   *   both in the master connections list and in the selectedConnection so
   *   the properties form stays in sync.
   * TECHNICAL: Same immutable map pattern as updateElement. Also patches
   *   selectedConnection directly to avoid a stale-closure issue where
   *   the form would show the old value until the next render.
   */
  const updateConnection = (connectionId, updates) => {
    const updated = connections.map(c =>
      c.id === connectionId ? { ...c, ...updates } : c
    );
    setConnections(updated);
    if (selectedConnection?.id === connectionId) {
      setSelectedConnection({ ...selectedConnection, ...updates });
    }
  };

  /**
   * deleteElement()
   * LAYMAN'S: Removes all currently selected elements from the canvas and
   *   also removes any connections that were attached to them — you can't
   *   leave a dangling arrow pointing to nothing.
   * TECHNICAL: Filters both arrays in one pass each. Calls saveToHistory()
   *   so the deletion is undoable. Clears selectedElements afterward to
   *   prevent the properties form from trying to display a deleted element.
   */
  const deleteElement = () => {
    if (selectedElements.length === 0) return;
    const newElements = elements.filter(el => !selectedElements.some(sel => sel.id === el.id));
    const newConnections = connections.filter(c => 
      !selectedElements.some(sel => sel.id === c.from || sel.id === c.to)
    );
    setElements(newElements);
    setConnections(newConnections);
    saveToHistory(newElements, newConnections);
    setSelectedElements([]);
  };

  /**
   * deleteConnection()
   * LAYMAN'S: Removes the currently selected connection line from the
   *   diagram and saves an undo snapshot.
   * TECHNICAL: Filters connections by id, saves to history, then
   *   sets selectedConnection to null to clear the properties form.
   */
  const deleteConnection = () => {
    if (!selectedConnection) return;
    const updated = connections.filter(c => c.id !== selectedConnection.id);
    setConnections(updated);
    saveToHistory(elements, updated);
    setSelectedConnection(null);
  };

  return (
    <div className="w-96 flex-shrink-0 bg-[#252526] border-l border-[#3e3e42] flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-[#3e3e42]">
        <button
          onClick={() => setShowCodePanel(false)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            !showCodePanel
              ? 'bg-[#1e1e1e] text-white border-b-2 border-[#007acc]'
              : 'text-gray-400 hover:text-white hover:bg-[#2a2d2e]'
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setShowCodePanel(true)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            showCodePanel
              ? 'bg-[#1e1e1e] text-white border-b-2 border-[#007acc]'
              : 'text-gray-400 hover:text-white hover:bg-[#2a2d2e]'
          }`}
        >
          Generated Code
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {!showCodePanel ? (
          // Properties Panel
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">PROPERTIES</h3>
            {selectedElements.length === 1 ? (
              <ElementProperties
                element={selectedElements[0]}
                onUpdate={updateElement}
                onDelete={deleteElement}
                saveToHistory={saveToHistory}
                elements={elements}
                connections={connections}
              />
            ) : selectedElements.length > 1 ? (
              <div className="text-sm text-gray-500">
                <p>{selectedElements.length} elements selected</p>
                <button
                  onClick={deleteElement}
                  className="w-full bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm flex items-center justify-center space-x-2 transition-colors mt-2"
                >
                  <Trash2 size={16} />
                  <span>Delete Selected Elements</span>
                </button>
              </div>
            ) : selectedConnection ? (
              <ConnectionProperties
                connection={selectedConnection}
                onUpdate={updateConnection}
                onDelete={deleteConnection}
                saveToHistory={saveToHistory}
                elements={elements}
                connections={connections}
              />
            ) : (
              <p className="text-sm text-gray-500">Select an element or connection to edit properties</p>
            )}
          </div>
        ) : (
          // Generated Code Panel
          <div className="h-full flex flex-col p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-400">GENERATED CODE</h3>
              {currentCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentCode).then(() => {
                      onCopySuccess?.('Code copied to clipboard!');
                    }).catch(() => {
                      onCopySuccess?.('Failed to copy — please copy manually.', 'error');
                    });
                  }}
                  className="text-xs text-[#007acc] hover:text-[#005a9e] transition-colors"
                >
                  Copy Code
                </button>
              )}
            </div>

            {/* File Tabs - Show when multiple files are generated */}
            {generatedFiles.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto border-b border-[#3e3e42] pb-2">
                {generatedFiles.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedFileIndex(index)}
                    className={`px-3 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                      selectedFileIndex === index
                        ? 'bg-[#007acc] text-white'
                        : 'bg-[#3e3e42] text-gray-300 hover:bg-[#4a4a4f]'
                    }`}
                  >
                    {file.filename}
                  </button>
                ))}
              </div>
            )}

            {currentCode ? (
              <SyntaxHighlightedCode code={currentCode} language={language || 'Java'} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-500 text-center">
                  Click "Generate Code" button<br />to see the generated code
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ElementProperties({ element, onUpdate, onDelete, saveToHistory })
 * -------------------------------------------------------------------
 * LAYMAN'S: The form that appears in the Properties tab when a single
 *   class, interface, abstract class, or object is selected on the canvas.
 *   It lets the user rename the element, pick a stereotype, resize it,
 *   and manage its attributes and methods — adding, removing, and editing
 *   each one with visibility selectors, type dropdowns, and checkboxes
 *   for static/abstract flags. Custom types are supported via a fallback
 *   text input that appears when "Custom..." is chosen from the dropdown.
 *
 * TECHNICAL: Stateless helper — all state lives in the parent elements
 *   array via onUpdate. Local helper functions (updateAttribute,
 *   addAttribute, removeAttribute, updateMethod, addMethod, removeMethod)
 *   are defined inline to avoid prop-drilling and keep the mutation
 *   logic close to the form fields that trigger it.
 *   saveToHistory() is called on blur and on discrete actions (add/remove)
 *   so intermediate keystrokes don't flood the undo stack.
 *
 * @param {Object}   element         - The element data object being edited
 * @param {Function} onUpdate        - Applies partial updates to the element
 * @param {Function} onDelete        - Deletes the element from the diagram
 * @param {Function} saveToHistory   - Commits current state to undo history
 */
const ElementProperties = ({ element, onUpdate, onDelete, saveToHistory, elements, connections }) => {
  // Minimal set of common types
  const commonTypes = ['String', 'int', 'double', 'boolean', 'void', 'Object', 'List'];

  const returnTypes = ['void', 'String', 'int', 'double', 'boolean', 'Object', 'List'];

  const updateAttribute = (index, updates) => {
    const newAttrs = [...(element.attributes || [])];
    newAttrs[index] = { ...newAttrs[index], ...updates };
    onUpdate(element.id, { attributes: newAttrs });
  };

  const addAttribute = () => {
    const newAttrs = [...(element.attributes || []), { name: 'newAttribute', type: 'String', visibility: 'private' }];
    onUpdate(element.id, { attributes: newAttrs });
    saveToHistory(elements, connections);
  };

  const removeAttribute = (index) => {
    const newAttrs = (element.attributes || []).filter((_, i) => i !== index);
    onUpdate(element.id, { attributes: newAttrs });
    saveToHistory(elements, connections);
  };

  const updateMethod = (index, updates) => {
    const newMethods = [...(element.methods || [])];
    newMethods[index] = { ...newMethods[index], ...updates };
    onUpdate(element.id, { methods: newMethods });
  };

  const addMethod = () => {
    const newMethods = [...(element.methods || []), { name: 'newMethod', returnType: 'void', parameters: '', visibility: 'public' }];
    onUpdate(element.id, { methods: newMethods });
    saveToHistory(elements, connections);
  };

  const removeMethod = (index) => {
    const newMethods = (element.methods || []).filter((_, i) => i !== index);
    onUpdate(element.id, { methods: newMethods });
    saveToHistory(elements, connections);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Name</label>
        <input
          type="text"
          value={element.name}
          onChange={(e) => onUpdate(element.id, { name: e.target.value })}
          onBlur={() => saveToHistory(elements, connections)}
          className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
        />
      </div>

      {(element.type === 'class' || element.type === 'interface' || element.type === 'abstract') && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Stereotype</label>
          <select
            value={element.stereotype || ''}
            onChange={(e) => {
              onUpdate(element.id, { stereotype: e.target.value });
              saveToHistory(elements, connections);
            }}
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          >
            <option value="">None</option>
            <option value="singleton">singleton</option>
            <option value="utility">utility</option>
            <option value="entity">entity</option>
            <option value="control">control</option>
            <option value="boundary">boundary</option>
            <option value="service">service</option>
            <option value="repository">repository</option>
            <option value="controller">controller</option>
          </select>
        </div>
      )}

      {element.type === 'object' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Class Name</label>
            <input
              type="text"
              value={element.className || ''}
              onChange={(e) => onUpdate(element.id, { className: e.target.value })}
              onBlur={() => saveToHistory(elements, connections)}
              placeholder="Class this object is an instance of"
              className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Object State</label>
            <input
              type="text"
              value={element.state || ''}
              onChange={(e) => onUpdate(element.id, { state: e.target.value })}
              onBlur={() => saveToHistory(elements, connections)}
              placeholder="e.g., active, pending, completed"
              className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Attribute Values</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {element.attributeValues && Object.keys(element.attributeValues).length > 0 ? (
                Object.entries(element.attributeValues).map(([key, value], idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newValues = { ...element.attributeValues };
                        delete newValues[key];
                        newValues[e.target.value] = value;
                        onUpdate(element.id, { attributeValues: newValues });
                        saveToHistory(elements, connections);
                      }}
                      onBlur={() => saveToHistory(elements, connections)}
                      placeholder="attribute"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <span className="text-xs text-gray-500">=</span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const newValues = { ...element.attributeValues };
                        newValues[key] = e.target.value;
                        onUpdate(element.id, { attributeValues: newValues });
                      }}
                      onBlur={() => saveToHistory(elements, connections)}
                      placeholder="value"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <button
                      onClick={() => {
                        const newValues = { ...element.attributeValues };
                        delete newValues[key];
                        onUpdate(element.id, { attributeValues: newValues });
                        saveToHistory(elements, connections);
                      }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 italic">No attribute values yet</p>
              )}
            </div>
            <button
              onClick={() => {
                const newValues = element.attributeValues || {};
                const keyCount = Object.keys(newValues).length + 1;
                newValues[`attribute${keyCount}`] = '';
                onUpdate(element.id, { attributeValues: newValues });
                saveToHistory(elements, connections);
              }}
              className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors mt-2"
            >
              + Add Attribute Value
            </button>
          </div>
        </div>
      )}

      {(element.type === 'class' || element.type === 'interface' || element.type === 'abstract') && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Width</label>
              <input
                type="number"
                value={element.width}
                onChange={(e) => onUpdate(element.id, { width: Math.max(50, parseInt(e.target.value) || 100) })}
                onBlur={() => saveToHistory(elements, connections)}
                className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Height</label>
              <input
                type="number"
                value={element.height}
                onChange={(e) => onUpdate(element.id, { height: Math.max(50, parseInt(e.target.value) || 100) })}
                onBlur={() => saveToHistory(elements, connections)}
                className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
              />
            </div>
          </div>
        <div className="space-y-3">
          {(element.type === 'class' || element.type === 'abstract') && (
            <div>
              <label className="text-xs text-gray-500 block mb-2">Attributes</label>
              <div className="space-y-2 mb-2">
                {(element.attributes || []).map((attr, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={attr.visibility || 'private'}
                      onChange={(e) => updateAttribute(index, { visibility: e.target.value })}
                      className="w-12 bg-[#3c3c3c] text-white px-1 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      <option value="public">+</option>
                      <option value="private">-</option>
                      <option value="protected">#</option>
                      <option value="package">~</option>
                    </select>
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttribute(index, { name: e.target.value })}
                      placeholder="name"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <select
                      value={commonTypes.includes(attr.type) ? attr.type : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          updateAttribute(index, { type: '' });
                        } else {
                          updateAttribute(index, { type: e.target.value });
                          saveToHistory(elements, connections);
                        }
                      }}
                      className="w-24 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      {commonTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                    {!commonTypes.includes(attr.type) && (
                      <input
                        type="text"
                        value={attr.type || ''}
                        onChange={(e) => updateAttribute(index, { type: e.target.value })}
                        onBlur={() => saveToHistory(elements, connections)}
                        placeholder="custom type"
                        className="w-20 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#007acc] text-xs focus:outline-none"
                      />
                    )}
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={attr.isStatic || false}
                        onChange={(e) => updateAttribute(index, { isStatic: e.target.checked })}
                        className="w-3 h-3"
                      />
                      static
                    </label>
                    <button
                      onClick={() => removeAttribute(index)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addAttribute}
                className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors"
              >
                + Add Attribute
              </button>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-2">Methods</label>
            <div className="space-y-2 mb-2">
              {(element.methods || []).map((method, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex gap-2">
                    <select
                      value={method.visibility || 'public'}
                      onChange={(e) => updateMethod(index, { visibility: e.target.value })}
                      className="w-12 bg-[#3c3c3c] text-white px-1 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      <option value="public">+</option>
                      <option value="private">-</option>
                      <option value="protected">#</option>
                      <option value="package">~</option>
                    </select>
                    <input
                      type="text"
                      value={method.name}
                      onChange={(e) => updateMethod(index, { name: e.target.value })}
                      placeholder="method name"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <select
                      value={returnTypes.includes(method.returnType) ? method.returnType : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          updateMethod(index, { returnType: '' });
                        } else {
                          updateMethod(index, { returnType: e.target.value });
                          saveToHistory(elements, connections);
                        }
                      }}
                      className="w-20 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      {returnTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                    {!returnTypes.includes(method.returnType) && (
                      <input
                        type="text"
                        value={method.returnType || ''}
                        onChange={(e) => updateMethod(index, { returnType: e.target.value })}
                        onBlur={() => saveToHistory(elements, connections)}
                        placeholder="custom"
                        className="w-16 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#007acc] text-xs focus:outline-none"
                      />
                    )}
                    <button
                      onClick={() => removeMethod(index)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={method.parameters || ''}
                    onChange={(e) => updateMethod(index, { parameters: e.target.value })}
                    placeholder="parameters (e.g., name: String, age: int)"
                    className="w-full bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                  />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={method.isStatic || false}
                        onChange={(e) => updateMethod(index, { isStatic: e.target.checked })}
                        className="w-3 h-3"
                      />
                      static
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={method.isAbstract || false}
                        onChange={(e) => updateMethod(index, { isAbstract: e.target.checked })}
                        className="w-3 h-3"
                      />
                      abstract
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addMethod}
              className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors"
            >
              + Add Method
            </button>
          </div>
        </div>
        </>
      )}

      <button
        onClick={onDelete}
        className="w-full bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
      >
        <Trash2 size={16} />
        <span>Delete Element</span>
      </button>
    </div>
  );
};

/**
 * ConnectionProperties({ connection, onUpdate, onDelete, saveToHistory })
 * -------------------------------------------------------------------------
 * LAYMAN'S: The form that appears in the Properties tab when a connection
 *   line is selected on the canvas. It shows the connection type (read-only),
 *   and lets the user set "From Multiplicity" (e.g., "1"), "To Multiplicity"
 *   (e.g., "*"), a relationship label (e.g., "owns"), and role names at
 *   each end. All of these appear as annotations on the line in the diagram.
 *
 * TECHNICAL: Stateless helper component. The connection type field is
 *   intentionally disabled — type is set when the line is drawn and is
 *   not editable after the fact (it would require re-routing the arrow).
 *   onUpdate patches only the changed field so unedited fields are preserved.
 *   saveToHistory() is called on blur so each discrete edit is undoable.
 *
 * @param {Object}   connection     - The connection data object being edited
 * @param {Function} onUpdate       - Applies partial updates to the connection
 * @param {Function} onDelete       - Removes the connection from the diagram
 * @param {Function} saveToHistory  - Commits current state to undo history
 */
const ConnectionProperties = ({ connection, onUpdate, onDelete, saveToHistory, elements, connections }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Connection Type</label>
        <input
          type="text"
          value={connection.type}
          disabled
          className="w-full bg-[#3c3c3c] text-gray-400 px-3 py-1.5 rounded border border-[#3e3e42] text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From Multiplicity</label>
          <input
            type="text"
            value={connection.fromMultiplicity || ''}
            onChange={(e) => onUpdate(connection.id, { fromMultiplicity: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="1, *, 0..1, 1..*"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To Multiplicity</label>
          <input
            type="text"
            value={connection.toMultiplicity || ''}
            onChange={(e) => onUpdate(connection.id, { toMultiplicity: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="1, *, 0..1, 1..*"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Label</label>
        <input
          type="text"
          value={connection.label || ''}
          onChange={(e) => onUpdate(connection.id, { label: e.target.value })}
          onBlur={() => saveToHistory(elements, connections)}
          placeholder="e.g., owns, uses, manages"
          className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From Role</label>
          <input
            type="text"
            value={connection.fromRole || ''}
            onChange={(e) => onUpdate(connection.id, { fromRole: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="role name"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To Role</label>
          <input
            type="text"
            value={connection.toRole || ''}
            onChange={(e) => onUpdate(connection.id, { toRole: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="role name"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
      </div>

      <button
        onClick={onDelete}
        className="w-full bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
      >
        <Trash2 size={16} />
        <span>Delete Connection</span>
      </button>
    </div>
  );
};

export default PropertiesPanel;