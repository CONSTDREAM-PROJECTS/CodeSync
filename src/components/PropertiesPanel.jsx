import React from 'react';
import { Trash2 } from 'lucide-react';

const PropertiesPanel = ({
  showCodePanel,
  setShowCodePanel,
  selectedElements,
  selectedConnection,
  elements,
  connections,
  setElements,
  setSelectedElements,
  setConnections,
  setSelectedConnection,
  saveToHistory,
  generatedCode
}) => {
  const updateElement = (elementId, updates) => {
    const updated = elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );
    setElements(updated);
    setSelectedElements(prev => prev.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    ));
  };

  const updateConnection = (connectionId, updates) => {
    const updated = connections.map(c =>
      c.id === connectionId ? { ...c, ...updates } : c
    );
    setConnections(updated);
    if (selectedConnection?.id === connectionId) {
      setSelectedConnection({ ...selectedConnection, ...updates });
    }
  };

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

  const deleteConnection = () => {
    if (!selectedConnection) return;
    const updated = connections.filter(c => c.id !== selectedConnection.id);
    setConnections(updated);
    saveToHistory(elements, updated);
    setSelectedConnection(null);
  };

  return (
    <div className="w-96 bg-[#252526] border-l border-[#3e3e42] flex flex-col">
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
                saveToHistory={() => saveToHistory(elements, connections)}
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
                saveToHistory={() => saveToHistory(elements, connections)}
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
              {generatedCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCode);
                    alert('Code copied to clipboard!');
                  }}
                  className="text-xs text-[#007acc] hover:text-[#005a9e] transition-colors"
                >
                  Copy Code
                </button>
              )}
            </div>
            {generatedCode ? (
              <pre className="flex-1 bg-[#1e1e1e] p-3 rounded text-xs overflow-auto font-mono">
                <code className="text-green-400">{generatedCode}</code>
              </pre>
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

const ElementProperties = ({ element, onUpdate, onDelete, saveToHistory }) => {
  const updateAttribute = (index, updates) => {
    const newAttrs = [...(element.attributes || [])];
    newAttrs[index] = { ...newAttrs[index], ...updates };
    onUpdate(element.id, { attributes: newAttrs });
  };

  const addAttribute = () => {
    const newAttrs = [...(element.attributes || []), { name: 'newAttribute', type: 'String', visibility: 'private' }];
    onUpdate(element.id, { attributes: newAttrs });
    saveToHistory();
  };

  const removeAttribute = (index) => {
    const newAttrs = (element.attributes || []).filter((_, i) => i !== index);
    onUpdate(element.id, { attributes: newAttrs });
    saveToHistory();
  };

  const updateMethod = (index, updates) => {
    const newMethods = [...(element.methods || [])];
    newMethods[index] = { ...newMethods[index], ...updates };
    onUpdate(element.id, { methods: newMethods });
  };

  const addMethod = () => {
    const newMethods = [...(element.methods || []), { name: 'newMethod', returnType: 'void', parameters: '', visibility: 'public' }];
    onUpdate(element.id, { methods: newMethods });
    saveToHistory();
  };

  const removeMethod = (index) => {
    const newMethods = (element.methods || []).filter((_, i) => i !== index);
    onUpdate(element.id, { methods: newMethods });
    saveToHistory();
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Name</label>
        <input
          type="text"
          value={element.name}
          onChange={(e) => onUpdate(element.id, { name: e.target.value })}
          onBlur={saveToHistory}
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
              saveToHistory();
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Width</label>
          <input
            type="number"
            value={element.width}
            onChange={(e) => onUpdate(element.id, { width: Math.max(50, parseInt(e.target.value) || 100) })}
            onBlur={saveToHistory}
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Height</label>
          <input
            type="number"
            value={element.height}
            onChange={(e) => onUpdate(element.id, { height: Math.max(50, parseInt(e.target.value) || 100) })}
            onBlur={saveToHistory}
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
      </div>

      {(element.type === 'class' || element.type === 'interface' || element.type === 'abstract') && (
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
                    <input
                      type="text"
                      value={attr.type || 'String'}
                      onChange={(e) => updateAttribute(index, { type: e.target.value })}
                      placeholder="type"
                      className="w-20 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
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
                    <input
                      type="text"
                      value={method.returnType || 'void'}
                      onChange={(e) => updateMethod(index, { returnType: e.target.value })}
                      placeholder="return"
                      className="w-16 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
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

const ConnectionProperties = ({ connection, onUpdate, onDelete, saveToHistory }) => {
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
            onBlur={saveToHistory}
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
            onBlur={saveToHistory}
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
          onBlur={saveToHistory}
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
            onBlur={saveToHistory}
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
            onBlur={saveToHistory}
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