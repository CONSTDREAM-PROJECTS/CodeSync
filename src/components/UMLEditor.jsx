import React, { useState, useRef, useEffect } from 'react';
import CodeGenerator from '../services/codeGenerator';
import CodeToUMLConverter from '../services/codeToUMLConverter';
import { useHistory } from '../hooks/useHistory';
import { useCanvasInteractions } from '../hooks/useCanvasInteractions';
import { diagramTypes, getToolbarItems } from '../utils/diagramUtils';
import DiagramSidebar from './DiagramSidebar';
import DiagramToolbar from './DiagramToolbar';
import ToolPalette from './ToolPalette';
import PropertiesPanel from './PropertiesPanel';
import CodeImportModal from './CodeImportModal';

const UMLEditor = () => {
  // State Management
  const [selectedDiagram, setSelectedDiagram] = useState('class');
  const [language, setLanguage] = useState('Java');
  const [elements, setElements] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedElements, setSelectedElements] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [originalElement, setOriginalElement] = useState(null);
  const [showCodeImportModal, setShowCodeImportModal] = useState(false);

  // Custom hooks
  const { saveToHistory, undo, redo, resetHistory, canUndo, canRedo } = useHistory();
  const {
    isDragging,
    isPanning,
    panOffset,
    zoom,
    showGrid,
    canvasRef,
    handleZoomIn,
    handleZoomOut,
    toggleGrid,
    startPanning,
    updatePan,
    stopPanning,
    startDragging,
    updateDrag,
    stopDragging,
    getCanvasCoordinates
  } = useCanvasInteractions();

  const elementHeightCache = useRef(new Map());

  // Copy/Paste functionality
  const copyElement = () => {
    if (selectedElements.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(selectedElements)));
    }
  };

  const pasteElement = () => {
    if (clipboard) {
      let newElements = [];
      let offsetX = 20;
      let offsetY = 20;

      if (Array.isArray(clipboard)) {
        // Multiple elements
        newElements = clipboard.map((item, index) => ({
          ...JSON.parse(JSON.stringify(item)),
          id: Date.now() + index,
          x: item.x + offsetX,
          y: item.y + offsetY
        }));
      } else {
        // Single element
        newElements = [{
          ...JSON.parse(JSON.stringify(clipboard)),
          id: Date.now(),
          x: clipboard.x + offsetX,
          y: clipboard.y + offsetY
        }];
      }

      const updatedElements = [...elements, ...newElements];
      setElements(updatedElements);
      saveToHistory(updatedElements, connections);
      setSelectedElements(newElements);
    }
  };

  // Update element function
  const updateElement = (elementId, updates) => {
    const updated = elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );
    setElements(updated);
    setSelectedElements(prev => prev.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    ));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          const result = undo();
          if (result) {
            setElements(result.elements);
            setConnections(result.connections);
            setSelectedElements([]);
            setSelectedConnection(null);
          }
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          const result = redo();
          if (result) {
            setElements(result.elements);
            setConnections(result.connections);
            setSelectedElements([]);
            setSelectedConnection(null);
          }
        } else if (e.key === 'c') {
          e.preventDefault();
          copyElement();
        } else if (e.key === 'v') {
          e.preventDefault();
          pasteElement();
        } else if (e.key === 'd') {
          e.preventDefault();
          if (selectedElements.length > 0) {
            const selectedIds = selectedElements.map(el => el.id);
            const newElements = elements.filter(el => !selectedIds.includes(el.id));
            const newConnections = connections.filter(c => !selectedIds.includes(c.from) && !selectedIds.includes(c.to));
            setElements(newElements);
            setConnections(newConnections);
            saveToHistory(newElements, newConnections);
            setSelectedElements([]);
          }
        }
      } else if (e.key === 'Delete') {
        if (selectedElements.length > 0) {
          const selectedIds = selectedElements.map(el => el.id);
          const newElements = elements.filter(el => !selectedIds.includes(el.id));
          const newConnections = connections.filter(c => !selectedIds.includes(c.from) && !selectedIds.includes(c.to));
          setElements(newElements);
          setConnections(newConnections);
          saveToHistory(newElements, newConnections);
          setSelectedElements([]);
        } else if (selectedConnection) {
          const newConnections = connections.filter(c => c.id !== selectedConnection.id);
          setConnections(newConnections);
          saveToHistory(elements, newConnections);
          setSelectedConnection(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElements, selectedConnection, elements, connections, clipboard]);

  // Auto-calculate element height based on content
  const calculateElementHeight = (element) => {
    const baseHeight = 60;
    const attrCount = element.attributes?.length || 0;
    const methodCount = element.methods?.length || 0;
    const attrHeight = attrCount * 18;
    const methodHeight = methodCount * 18;
    const padding = (attrCount > 0 || methodCount > 0) ? 30 : 0;
    const stereotypeHeight = element.stereotype ? 20 : 0;
    
    return Math.max(100, baseHeight + stereotypeHeight + attrHeight + methodHeight + padding);
  };

  // Update element height when attributes/methods change
  useEffect(() => {
    let hasChanges = false;
    const updatedElements = elements.map(el => {
      if (el.type === 'class' || el.type === 'interface' || el.type === 'abstract') {
        const newHeight = calculateElementHeight(el);
        const cacheKey = `${el.id}-${el.attributes?.length}-${el.methods?.length}-${el.stereotype}`;
        const cachedHeight = elementHeightCache.current.get(cacheKey);
        
        if (cachedHeight !== newHeight) {
          elementHeightCache.current.set(cacheKey, newHeight);
          if (newHeight !== el.height) {
            hasChanges = true;
            return { ...el, height: newHeight };
          }
        }
      }
      return el;
    });
    
    if (hasChanges) {
      setElements(updatedElements);
    }
  }, [elements]);

  // Add element to canvas
  const addElement = (type) => {
    const relationshipTypes = ['association', 'inheritance', 'aggregation', 'composition', 'dependency', 'realization', 'link', 'include', 'extend', 'generalization', 'flow', 'transition', 'message', 'return', 'connector', 'import', 'extension'];
    
    if (relationshipTypes.includes(type)) {
      setSelectedTool(type);
      setConnectionStart(null);
      return;
    }

    const newElement = {
      id: Date.now(),
      type,
      diagramType: selectedDiagram,
      x: 100 + (elements.length * 20),
      y: 100 + (elements.length * 20),
      width: type === 'class' || type === 'component' || type === 'interface' || type === 'abstract' ? 200 : 150,
      height: type === 'class' || type === 'component' || type === 'interface' || type === 'abstract' ? 150 : 100,
      name: `New${type.charAt(0).toUpperCase() + type.slice(1)}`,
      attributes: (type === 'class' || type === 'abstract') ? [] : undefined,
      methods: (type === 'class' || type === 'interface' || type === 'abstract') ? [] : undefined,
      properties: {},
      stereotype: '',
      className: type === 'object' ? '' : undefined,
      state: type === 'object' ? '' : undefined,
      attributeValues: type === 'object' ? {} : undefined
    };
    const newElements = [...elements, newElement];
    setElements(newElements);
    saveToHistory(newElements, connections);
    setSelectedTool('select');
    setSelectedElements([newElement]);
  };

  // Handle canvas click
  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;

    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const { x, y } = coords;

    const relationshipTypes = ['association', 'inheritance', 'aggregation', 'composition', 'dependency', 'realization', 'link', 'include', 'extend', 'generalization', 'flow', 'transition', 'message', 'return', 'connector', 'import', 'extension'];

    if (relationshipTypes.includes(selectedTool)) {
      const clickedElement = elements.find(el =>
        x >= el.x && x <= el.x + el.width &&
        y >= el.y && y <= el.y + el.height
      );

      if (clickedElement) {
        if (!connectionStart) {
          setConnectionStart(clickedElement.id);
        } else {
          if (connectionStart !== clickedElement.id) {
            const newConnection = {
              id: Date.now(),
              type: selectedTool,
              from: connectionStart,
              to: clickedElement.id,
              fromMultiplicity: '',
              toMultiplicity: '',
              label: '',
              fromRole: '',
              toRole: ''
            };
            const newConnections = [...connections, newConnection];
            setConnections(newConnections);
            saveToHistory(elements, newConnections);
          }
          setConnectionStart(null);
          setSelectedTool('select');
        }
      } else {
        // Clicked on empty space - cancel connection
        setConnectionStart(null);
      }
    } else if (selectedTool === 'delete') {
      const clickedElement = elements.find(el =>
        x >= el.x && x <= el.x + el.width &&
        y >= el.y && y <= el.y + el.height
      );

      if (clickedElement) {
        const newElements = elements.filter(el => el.id !== clickedElement.id);
        const newConnections = connections.filter(c => c.from !== clickedElement.id && c.to !== clickedElement.id);
        setElements(newElements);
        setConnections(newConnections);
        saveToHistory(newElements, newConnections);
        setSelectedElements([]);
      }
    } else {
      // Deselect when clicking on empty canvas
      const clickedElement = elements.find(el =>
        x >= el.x && x <= el.x + el.width &&
        y >= el.y && y <= el.y + el.height
      );

      if (!clickedElement) {
        setSelectedElements([]);
        setSelectedConnection(null);
      }
    }
  };

  const handleMouseDown = (e, element) => {
    e.stopPropagation();

    if (e.button === 1 || e.shiftKey) {
      startPanning(e.clientX, e.clientY);
    } else if (selectedTool === 'select') {
      // Multi-select logic
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        setSelectedElements(prev => {
          const isSelected = prev.some(el => el.id === element.id);
          if (isSelected) {
            return prev.filter(el => el.id !== element.id);
          } else {
            return [...prev, element];
          }
        });
      } else {
        // Single selection
        setSelectedElements([element]);
      }
      setSelectedConnection(null);
      
      // Only start dragging if single element is selected
      if (!e.ctrlKey && !e.metaKey) {
        startDragging(element, e.clientX, e.clientY);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isResizing && selectedElements.length === 1 && originalElement) {
      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;
      const zoomFactor = 1 / zoom;

      let newX = originalElement.x;
      let newY = originalElement.y;
      let newWidth = originalElement.width;
      let newHeight = originalElement.height;

      switch (resizeHandle) {
        case 'nw':
          newX = originalElement.x + deltaX * zoomFactor;
          newY = originalElement.y + deltaY * zoomFactor;
          newWidth = originalElement.width - deltaX * zoomFactor;
          newHeight = originalElement.height - deltaY * zoomFactor;
          break;
        case 'ne':
          newY = originalElement.y + deltaY * zoomFactor;
          newWidth = originalElement.width + deltaX * zoomFactor;
          newHeight = originalElement.height - deltaY * zoomFactor;
          break;
        case 'sw':
          newX = originalElement.x + deltaX * zoomFactor;
          newWidth = originalElement.width - deltaX * zoomFactor;
          newHeight = originalElement.height + deltaY * zoomFactor;
          break;
        case 'se':
          newWidth = originalElement.width + deltaX * zoomFactor;
          newHeight = originalElement.height + deltaY * zoomFactor;
          break;
        case 'n':
          newY = originalElement.y + deltaY * zoomFactor;
          newHeight = originalElement.height - deltaY * zoomFactor;
          break;
        case 's':
          newHeight = originalElement.height + deltaY * zoomFactor;
          break;
        case 'w':
          newX = originalElement.x + deltaX * zoomFactor;
          newWidth = originalElement.width - deltaX * zoomFactor;
          break;
        case 'e':
          newWidth = originalElement.width + deltaX * zoomFactor;
          break;
      }

      // Ensure minimum size
      newWidth = Math.max(50, newWidth);
      newHeight = Math.max(30, newHeight);

      updateElement(selectedElements[0].id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });
    } else {
      updatePan(e.clientX, e.clientY);

      const dragResult = updateDrag(selectedElements.length === 1 ? selectedElements[0] : null, e.clientX, e.clientY);
      if (dragResult && selectedElements.length === 1) {
        const updatedElements = elements.map(el =>
          el.id === selectedElements[0].id
            ? { ...el, x: dragResult.x, y: dragResult.y }
            : el
        );
        setElements(updatedElements);
        setSelectedElements([{ ...selectedElements[0], x: dragResult.x, y: dragResult.y }]);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging && selectedElements.length === 1) {
      saveToHistory(elements, connections);
    }
    if (isResizing && selectedElements.length === 1) {
      saveToHistory(elements, connections);
    }
    stopDragging();
    stopPanning();
    setIsResizing(false);
    setResizeHandle(null);
    setOriginalElement(null);
  };

  // Resize handlers
  const handleResizeStart = (e, element, handle) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setOriginalElement({ ...element });
  };

  // Generate code
  const handleGenerateCode = () => {
    // Use new file splitting feature for accurate code generation
    const files = CodeGenerator.splitIntoFiles(elements, connections, language, selectedDiagram);
    setGeneratedFiles(files);
    
    // Keep backward compatibility by setting generatedCode to first file
    if (files.length > 0) {
      setGeneratedCode(files[0].content);
      setSelectedFileIndex(0);
    }
    setShowCodePanel(true);
  };

  // Code to UML conversion
  const handleCodeToUML = () => {
    setShowCodeImportModal(true);
  };

  const handleImportCode = (importedElements, importedConnections) => {
    // Merge or replace the diagram
    if (elements.length === 0 && connections.length === 0) {
      // If empty diagram, just replace
      setElements(importedElements);
      setConnections(importedConnections);
    } else {
      // If diagram exists, offset the new elements to avoid overlap
      const maxX = Math.max(...elements.map(e => e.x + e.width), 0);
      const offsetElements = importedElements.map(el => ({
        ...el,
        x: el.x + maxX + 100 // Add offset to avoid overlap
      }));
      setElements([...elements, ...offsetElements]);
      setConnections([...connections, ...importedConnections]);
    }
    
    // Save to history
    saveToHistory(
      [...elements, ...importedElements],
      [...connections, ...importedConnections]
    );
    
    // Show success message
    alert(`Successfully imported ${importedElements.length} classes from code!`);
  };

  // Export/Import functions
  const handleExport = () => {
    const data = JSON.stringify({ 
      elements, 
      connections,
      diagramType: selectedDiagram, 
      language 
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDiagram}-diagram.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          setElements(data.elements || []);
          setConnections(data.connections || []);
          setSelectedDiagram(data.diagramType || 'class');
          setLanguage(data.language || 'Java');
          setSelectedElements([]);
          setSelectedConnection(null);
          resetHistory(data.elements || [], data.connections || []);
        } catch (error) {
          alert('Error loading file: Invalid JSON format');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleNew = () => {
    setElements([]);
    setConnections([]);
    resetHistory([], []);
    setSelectedElements([]);
    setSelectedConnection(null);
  };

  const handleDiagramSelect = (diagramId) => {
    setSelectedDiagram(diagramId);
    setSelectedTool('select');
    setConnectionStart(null);
  };

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white">
      {/* Left Sidebar - Diagram Types */}
      <DiagramSidebar
        diagramTypes={diagramTypes}
        selectedDiagram={selectedDiagram}
        onDiagramSelect={handleDiagramSelect}
      />

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <DiagramToolbar
          language={language}
          setLanguage={setLanguage}
          onNew={handleNew}
          onImport={handleImport}
          onExport={handleExport}
          onGenerateCode={handleGenerateCode}
          onCodeToUML={handleCodeToUML}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showGrid={showGrid}
          onToggleGrid={toggleGrid}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Tool Palette */}
        <ToolPalette
          toolbarItems={getToolbarItems(selectedDiagram)}
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
          onElementAdd={addElement}
        />

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
          <svg
            ref={canvasRef}
            className="w-full h-full"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              cursor: isPanning ? 'grabbing' : 
                      selectedTool === 'select' ? 'default' : 
                      selectedTool === 'delete' ? 'not-allowed' : 
                      'crosshair'
            }}
          >
            {/* Grid */}
            {showGrid && (
              <>
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2d2d2d" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </>
            )}

            <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
              {/* Arrow markers for connections */}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#cccccc" />
                </marker>
                <marker id="inheritance" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                  <polygon points="0 0, 13 5, 0 10, 0 0" fill="none" stroke="#cccccc" strokeWidth="1.5" />
                </marker>
                <marker id="aggregation" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                  <polygon points="0 5, 6 0, 13 5, 6 10, 0 5" fill="none" stroke="#cccccc" strokeWidth="1.5" />
                </marker>
                <marker id="composition" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                  <polygon points="0 5, 6 0, 13 5, 6 10, 0 5" fill="#cccccc" stroke="#cccccc" strokeWidth="1.5" />
                </marker>
                <marker id="realization" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                  <polygon points="0 0, 13 5, 0 10, 0 0" fill="none" stroke="#cccccc" strokeWidth="1.5" />
                </marker>
              </defs>

              {/* Render Connections/Relationships */}
              {connections.map(conn => {
                const fromEl = elements.find(el => el.id === conn.from);
                const toEl = elements.find(el => el.id === conn.to);
                
                if (!fromEl || !toEl) return null;

                const x1 = fromEl.x + fromEl.width / 2;
                const y1 = fromEl.y + fromEl.height / 2;
                const x2 = toEl.x + toEl.width / 2;
                const y2 = toEl.y + toEl.height / 2;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                let strokeDasharray = 'none';
                let markerEnd = '';
                
                switch (conn.type) {
                  case 'association':
                  case 'link':
                    markerEnd = '';
                    break;
                  case 'inheritance':
                  case 'generalization':
                    markerEnd = 'url(#inheritance)';
                    break;
                  case 'aggregation':
                    markerEnd = 'url(#aggregation)';
                    break;
                  case 'composition':
                    markerEnd = 'url(#composition)';
                    break;
                  case 'dependency':
                  case 'include':
                  case 'extend':
                    strokeDasharray = '5,5';
                    markerEnd = 'url(#arrowhead)';
                    break;
                  case 'realization':
                    strokeDasharray = '5,5';
                    markerEnd = 'url(#realization)';
                    break;
                  default:
                    markerEnd = 'url(#arrowhead)';
                }

                return (
                  <g key={conn.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={selectedConnection?.id === conn.id ? '#007acc' : '#cccccc'}
                      strokeWidth={selectedConnection?.id === conn.id ? 3 : 2}
                      strokeDasharray={strokeDasharray}
                      markerEnd={markerEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnection(conn);
                        setSelectedElements([]);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth="10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnection(conn);
                        setSelectedElements([]);
                      }}
                      style={{ cursor: 'pointer' }}
                    />

                    {conn.fromMultiplicity && (
                      <text x={x1 + (x2 - x1) * 0.15} y={y1 + (y2 - y1) * 0.15 - 5} fill="#00ff00" fontSize="12" fontWeight="bold">
                        {conn.fromMultiplicity}
                      </text>
                    )}
                    {conn.toMultiplicity && (
                      <text x={x1 + (x2 - x1) * 0.85} y={y1 + (y2 - y1) * 0.85 - 5} fill="#00ff00" fontSize="12" fontWeight="bold">
                        {conn.toMultiplicity}
                      </text>
                    )}
                    {conn.label && (
                      <text x={midX} y={midY - 10} fill="#ffff00" fontSize="12" fontWeight="bold" textAnchor="middle">
                        {conn.label}
                      </text>
                    )}
                    {conn.fromRole && (
                      <text x={x1 + (x2 - x1) * 0.15} y={y1 + (y2 - y1) * 0.15 + 15} fill="#ff00ff" fontSize="11" fontStyle="italic">
                        {conn.fromRole}
                      </text>
                    )}
                    {conn.toRole && (
                      <text x={x1 + (x2 - x1) * 0.85} y={y1 + (y2 - y1) * 0.85 + 15} fill="#ff00ff" fontSize="11" fontStyle="italic">
                        {conn.toRole}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Show temporary connection line */}
              {connectionStart && (
                (() => {
                  const startEl = elements.find(el => el.id === connectionStart);
                  if (startEl) {
                    return (
                      <line
                        x1={startEl.x + startEl.width / 2}
                        y1={startEl.y + startEl.height / 2}
                        x2={startEl.x + startEl.width / 2}
                        y2={startEl.y + startEl.height / 2}
                        stroke="#007acc"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                    );
                  }
                  return null;
                })()
              )}

              {/* Render Elements */}
              {elements.map(element => (
                <g
                  key={element.id}
                  onMouseDown={(e) => handleMouseDown(e, element)}
                  style={{ cursor: selectedTool === 'select' ? 'move' : 'pointer' }}
                >
                  {/* Class Diagram Element */}
                  {element.type === 'class' && (
                    <>
                      <rect
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      {element.stereotype && (
                        <text x={element.x + element.width / 2} y={element.y + 15} fill="#888888" fontSize="10" textAnchor="middle">
                          &lt;&lt;{element.stereotype}&gt;&gt;
                        </text>
                      )}
                      <line
                        x1={element.x}
                        y1={element.y + (element.stereotype ? 50 : 40)}
                        x2={element.x + element.width}
                        y2={element.y + (element.stereotype ? 50 : 40)}
                        stroke="#3e3e42"
                      />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + (element.stereotype ? 35 : 25)}
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {element.name}
                      </text>
                      
                      {element.attributes && element.attributes.length > 0 && (
                        <>
                          <line
                            x1={element.x}
                            y1={element.y + (element.stereotype ? 50 : 40) + (element.attributes.length * 18 + 10)}
                            x2={element.x + element.width}
                            y2={element.y + (element.stereotype ? 50 : 40) + (element.attributes.length * 18 + 10)}
                            stroke="#3e3e42"
                          />
                          {element.attributes.map((attr, idx) => (
                            <text
                              key={`attr-${idx}`}
                              x={element.x + 10}
                              y={element.y + (element.stereotype ? 68 : 58) + (idx * 18)}
                              fill="#cccccc"
                              fontSize="11"
                              fontFamily="monospace"
                            >
                              {attr.visibility === 'public' ? '+ ' : attr.visibility === 'protected' ? '# ' : attr.visibility === 'package' ? '~ ' : '- '}{attr.name}: {attr.type || 'String'}
                            </text>
                          ))}
                        </>
                      )}
                      
                      {element.methods && element.methods.length > 0 && (
                        <>
                          {element.methods.map((method, idx) => {
                            const baseY = element.y + (element.stereotype ? 68 : 58) + ((element.attributes?.length || 0) * 18 + 20);
                            return (
                              <text
                                key={`method-${idx}`}
                                x={element.x + 10}
                                y={baseY + (idx * 18)}
                                fill="#dcdcaa"
                                fontSize="11"
                                fontFamily="monospace"
                              >
                                {method.visibility === 'public' ? '+ ' : method.visibility === 'protected' ? '# ' : method.visibility === 'package' ? '~ ' : '- '}{method.name}({method.parameters || ''}): {method.returnType || 'void'}
                              </text>
                            );
                          })}
                        </>
                      )}
                      {/* Resize Handles - only show when element is selected */}
                      {selectedElements.some(el => el.id === element.id) && selectedElements.length === 1 && (
                        <>
                          {/* Corner handles */}
                          <rect
                            x={element.x - 4}
                            y={element.y - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 'nw-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 'nw')}
                          />
                          <rect
                            x={element.x + element.width - 4}
                            y={element.y - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 'ne-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 'ne')}
                          />
                          <rect
                            x={element.x - 4}
                            y={element.y + element.height - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 'sw-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 'sw')}
                          />
                          <rect
                            x={element.x + element.width - 4}
                            y={element.y + element.height - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 'se-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 'se')}
                          />
                          {/* Edge handles */}
                          <rect
                            x={element.x + element.width / 2 - 4}
                            y={element.y - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 'n-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 'n')}
                          />
                          <rect
                            x={element.x + element.width / 2 - 4}
                            y={element.y + element.height - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 's-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 's')}
                          />
                          <rect
                            x={element.x - 4}
                            y={element.y + element.height / 2 - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 'w-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 'w')}
                          />
                          <rect
                            x={element.x + element.width - 4}
                            y={element.y + element.height / 2 - 4}
                            width="8"
                            height="8"
                            fill="#007acc"
                            stroke="#ffffff"
                            strokeWidth="1"
                            style={{ cursor: 'e-resize' }}
                            onMouseDown={(e) => handleResizeStart(e, element, 'e')}
                          />
                        </>
                      )}
                    </>
                  )}

                  {/* Interface Element */}
                  {element.type === 'interface' && (
                    <>
                      <rect
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      <text x={element.x + element.width / 2} y={element.y + 15} fill="#888" fontSize="10" textAnchor="middle" fontStyle="italic">
                        «interface»
                      </text>
                      <line x1={element.x} y1={element.y + 30} x2={element.x + element.width} y2={element.y + 30} stroke="#3e3e42" />
                      <text x={element.x + element.width / 2} y={element.y + 45} fill="white" fontSize="14" fontWeight="bold" textAnchor="middle">
                        {element.name}
                      </text>
                      {element.methods && element.methods.length > 0 && (
                        <>
                          <line x1={element.x} y1={element.y + 55} x2={element.x + element.width} y2={element.y + 55} stroke="#3e3e42" />
                          {element.methods.map((method, idx) => (
                            <text
                              key={`method-${idx}`}
                              x={element.x + 10}
                              y={element.y + 73 + (idx * 18)}
                              fill="#dcdcaa"
                              fontSize="11"
                              fontFamily="monospace"
                              fontStyle="italic"
                            >
                              + {method.name}({method.parameters || ''}): {method.returnType || 'void'}
                            </text>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {/* Abstract Class Element */}
                  {element.type === 'abstract' && (
                    <>
                      <rect
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      <line x1={element.x} y1={element.y + 40} x2={element.x + element.width} y2={element.y + 40} stroke="#3e3e42" />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + 25}
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                        fontStyle="italic"
                        textAnchor="middle"
                      >
                        {element.name}
                      </text>
                      
                      {element.attributes && element.attributes.length > 0 && (
                        <>
                          <line
                            x1={element.x}
                            y1={element.y + 40 + (element.attributes.length * 18 + 10)}
                            x2={element.x + element.width}
                            y2={element.y + 40 + (element.attributes.length * 18 + 10)}
                            stroke="#3e3e42"
                          />
                          {element.attributes.map((attr, idx) => (
                            <text
                              key={`attr-${idx}`}
                              x={element.x + 10}
                              y={element.y + 58 + (idx * 18)}
                              fill="#cccccc"
                              fontSize="11"
                              fontFamily="monospace"
                            >
                              {attr.visibility === 'public' ? '+ ' : attr.visibility === 'protected' ? '# ' : attr.visibility === 'package' ? '~ ' : '- '}{attr.name}: {attr.type || 'String'}
                            </text>
                          ))}
                        </>
                      )}
                      
                      {element.methods && element.methods.length > 0 && (
                        <>
                          {element.methods.map((method, idx) => (
                            <text
                              key={`method-${idx}`}
                              x={element.x + 10}
                              y={element.y + 58 + ((element.attributes?.length || 0) * 18 + 20) + (idx * 18)}
                              fill="#dcdcaa"
                              fontSize="11"
                              fontFamily="monospace"
                              fontStyle="italic"
                            >
                              {method.visibility === 'public' ? '+ ' : method.visibility === 'protected' ? '# ' : method.visibility === 'package' ? '~ ' : '- '}{method.name}({method.parameters || ''}): {method.returnType || 'void'}
                            </text>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {/* Object Element */}
                  {element.type === 'object' && (
                    <>
                      <rect
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      {/* Object name with underline */}
                      <line
                        x1={element.x}
                        y1={element.y + 30}
                        x2={element.x + element.width}
                        y2={element.y + 30}
                        stroke="#3e3e42"
                      />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + 20}
                        fill="white"
                        fontSize="13"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {element.name}{element.className ? ` : ${element.className}` : ''}
                      </text>

                      {/* State line separator */}
                      {element.state && (
                        <>
                          <line
                            x1={element.x}
                            y1={element.y + 45}
                            x2={element.x + element.width}
                            y2={element.y + 45}
                            stroke="#3e3e42"
                          />
                          <text
                            x={element.x + 10}
                            y={element.y + 40}
                            fill="#a8d8ff"
                            fontSize="11"
                            fontStyle="italic"
                          >
                            state = {element.state}
                          </text>
                        </>
                      )}

                      {/* Attribute Values */}
                      {element.attributeValues && Object.keys(element.attributeValues).length > 0 && (
                        <>
                          {Object.entries(element.attributeValues).map(([key, value], idx) => {
                            const baseY = element.y + (element.state ? 55 : 40) + (idx * 18);
                            return (
                              <text
                                key={`attr-val-${idx}`}
                                x={element.x + 10}
                                y={baseY}
                                fill="#cccccc"
                                fontSize="11"
                                fontFamily="monospace"
                              >
                                {key} = {value}
                              </text>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}

                  {/* Component Element */}
                  {element.type === 'component' && (
                    <>
                      <rect
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      <rect x={element.x + 10} y={element.y + 10} width="20" height="15" fill="none" stroke="white" strokeWidth="1.5" />
                      <rect x={element.x + 5} y={element.y + 14} width="8" height="4" fill="white" />
                      <rect x={element.x + 5} y={element.y + 19} width="8" height="4" fill="white" />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + element.height / 2}
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {element.name}
                      </text>
                    </>
                  )}

                  {/* Package Element */}
                  {element.type === 'package' && (
                    <>
                      <path
                        d={`M ${element.x} ${element.y + 20} L ${element.x} ${element.y} L ${element.x + 60} ${element.y} L ${element.x + 60} ${element.y + 20} Z`}
                        fill="#3c3c3c"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                      />
                      <rect
                        x={element.x}
                        y={element.y + 20}
                        width={element.width}
                        height={element.height - 20}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + element.height / 2 + 10}
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {element.name}
                      </text>
                    </>
                  )}

                  {/* Use Case Element */}
                  {element.type === 'usecase' && (
                    <>
                      <ellipse
                        cx={element.x + element.width / 2}
                        cy={element.y + element.height / 2}
                        rx={element.width / 2}
                        ry={element.height / 2}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                      />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + element.height / 2}
                        fill="white"
                        fontSize="12"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {element.name}
                      </text>
                    </>
                  )}

                  {/* Actor Element */}
                  {element.type === 'actor' && (
                    <g>
                      <circle
                        cx={element.x + element.width / 2}
                        cy={element.y + 20}
                        r="15"
                        fill="none"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : 'white'}
                        strokeWidth="2"
                      />
                      <line
                        x1={element.x + element.width / 2}
                        y1={element.y + 35}
                        x2={element.x + element.width / 2}
                        y2={element.y + 65}
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : 'white'}
                        strokeWidth="2"
                      />
                      <line
                        x1={element.x + 20}
                        y1={element.y + 45}
                        x2={element.x + element.width - 20}
                        y2={element.y + 45}
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : 'white'}
                        strokeWidth="2"
                      />
                      <line
                        x1={element.x + element.width / 2}
                        y1={element.y + 65}
                        x2={element.x + 30}
                        y2={element.y + 90}
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : 'white'}
                        strokeWidth="2"
                      />
                      <line
                        x1={element.x + element.width / 2}
                        y1={element.y + 65}
                        x2={element.x + element.width - 30}
                        y2={element.y + 90}
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : 'white'}
                        strokeWidth="2"
                      />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + element.height - 10}
                        fill="white"
                        fontSize="12"
                        textAnchor="middle"
                      >
                        {element.name}
                      </text>
                    </g>
                  )}

                  {/* Generic Rectangle for other types */}
                  {!['class', 'interface', 'abstract', 'component', 'package', 'usecase', 'actor'].includes(element.type) && (
                    <>
                      <rect
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      <text
                        x={element.x + element.width / 2}
                        y={element.y + element.height / 2}
                        fill="white"
                        fontSize="12"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {element.name}
                      </text>
                    </>
                  )}
                </g>
              ))}
            </g>
          </svg>

          {/* Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#007acc] text-white px-4 py-1 text-xs flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <span>Diagram: {diagramTypes.find(d => d.id === selectedDiagram)?.name}</span>
              <span>Elements: {elements.length}</span>
              <span>Connections: {connections.length}</span>
              <span>Language: {language}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>Zoom: {Math.round(zoom * 100)}%</span>
              {connectionStart && <span className="text-yellow-300">• Creating connection...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties & Code */}
      <PropertiesPanel
        showCodePanel={showCodePanel}
        setShowCodePanel={setShowCodePanel}
        selectedElements={selectedElements}
        selectedConnection={selectedConnection}
        elements={elements}
        connections={connections}
        setElements={setElements}
        setSelectedElements={setSelectedElements}
        setConnections={setConnections}
        setSelectedConnection={setSelectedConnection}
        saveToHistory={() => saveToHistory(elements, connections)}
        generatedCode={generatedCode}
        generatedFiles={generatedFiles}
        selectedFileIndex={selectedFileIndex}
        setSelectedFileIndex={setSelectedFileIndex}
      />

      {/* Code Import Modal */}
      {showCodeImportModal && (
        <CodeImportModal
          onImport={handleImportCode}
          onClose={() => setShowCodeImportModal(false)}
        />
      )}
    </div>
  );
};

export default UMLEditor;