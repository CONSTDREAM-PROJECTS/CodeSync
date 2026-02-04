import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Trash2, Save, Code, Settings, ZoomIn, ZoomOut, Grid, Move } from 'lucide-react';
import CodeGenerator from '../services/codeGenerator';
import TypeMapper from '../services/typeMapper';

const UMLEditor = () => {
  // State Management
  const [selectedDiagram, setSelectedDiagram] = useState('class');
  const [language, setLanguage] = useState('Java');
  const [elements, setElements] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [generatedCode, setGeneratedCode] = useState('');
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  
  const canvasRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // All 14 UML Diagram Types
  const diagramTypes = [
    { id: 'class', name: 'Class Diagram', category: 'Structural' },
    { id: 'object', name: 'Object Diagram', category: 'Structural' },
    { id: 'component', name: 'Component Diagram', category: 'Structural' },
    { id: 'deployment', name: 'Deployment Diagram', category: 'Structural' },
    { id: 'package', name: 'Package Diagram', category: 'Structural' },
    { id: 'composite', name: 'Composite Structure Diagram', category: 'Structural' },
    { id: 'profile', name: 'Profile Diagram', category: 'Structural' },
    { id: 'usecase', name: 'Use Case Diagram', category: 'Behavioral' },
    { id: 'activity', name: 'Activity Diagram', category: 'Behavioral' },
    { id: 'state', name: 'State Machine Diagram', category: 'Behavioral' },
    { id: 'sequence', name: 'Sequence Diagram', category: 'Behavioral' },
    { id: 'communication', name: 'Communication Diagram', category: 'Behavioral' },
    { id: 'interaction', name: 'Interaction Overview Diagram', category: 'Behavioral' },
    { id: 'timing', name: 'Timing Diagram', category: 'Behavioral' }
  ];

  // Toolbar items for each diagram type
  const getToolbarItems = (diagramType) => {
    const commonItems = [
      { id: 'select', icon: '⬚', label: 'Select' },
      { id: 'delete', icon: '🗑', label: 'Delete' }
    ];

    const typeSpecificItems = {
      class: [
        { id: 'class', icon: '📦', label: 'Class' },
        { id: 'interface', icon: '🔌', label: 'Interface' },
        { id: 'abstract', icon: '📋', label: 'Abstract Class' },
        { id: 'association', icon: '—', label: 'Association' },
        { id: 'inheritance', icon: '△', label: 'Inheritance' },
        { id: 'aggregation', icon: '◇', label: 'Aggregation' },
        { id: 'composition', icon: '◆', label: 'Composition' },
        { id: 'dependency', icon: '⟶', label: 'Dependency' }
      ],
      object: [
        { id: 'object', icon: '📄', label: 'Object' },
        { id: 'link', icon: '—', label: 'Link' }
      ],
      component: [
        { id: 'component', icon: '⚙️', label: 'Component' },
        { id: 'interface', icon: '🔌', label: 'Interface' },
        { id: 'dependency', icon: '⟶', label: 'Dependency' }
      ],
      deployment: [
        { id: 'node', icon: '🖥', label: 'Node' },
        { id: 'artifact', icon: '📦', label: 'Artifact' },
        { id: 'connection', icon: '—', label: 'Connection' }
      ],
      package: [
        { id: 'package', icon: '📁', label: 'Package' },
        { id: 'dependency', icon: '⟶', label: 'Dependency' },
        { id: 'import', icon: '↓', label: 'Import' }
      ],
      composite: [
        { id: 'class', icon: '📦', label: 'Class' },
        { id: 'part', icon: '⬚', label: 'Part' },
        { id: 'port', icon: '⬜', label: 'Port' },
        { id: 'connector', icon: '—', label: 'Connector' }
      ],
      profile: [
        { id: 'stereotype', icon: '《》', label: 'Stereotype' },
        { id: 'extension', icon: '⟶', label: 'Extension' }
      ],
      usecase: [
        { id: 'actor', icon: '👤', label: 'Actor' },
        { id: 'usecase', icon: '⭕', label: 'Use Case' },
        { id: 'association', icon: '—', label: 'Association' },
        { id: 'include', icon: '«inc»', label: 'Include' },
        { id: 'extend', icon: '«ext»', label: 'Extend' },
        { id: 'generalization', icon: '△', label: 'Generalization' }
      ],
      activity: [
        { id: 'initial', icon: '●', label: 'Initial Node' },
        { id: 'action', icon: '▭', label: 'Action' },
        { id: 'decision', icon: '◇', label: 'Decision' },
        { id: 'merge', icon: '◇', label: 'Merge' },
        { id: 'fork', icon: '▬', label: 'Fork' },
        { id: 'join', icon: '▬', label: 'Join' },
        { id: 'final', icon: '◉', label: 'Final Node' },
        { id: 'flow', icon: '→', label: 'Control Flow' }
      ],
      state: [
        { id: 'initial', icon: '●', label: 'Initial State' },
        { id: 'state', icon: '▭', label: 'State' },
        { id: 'final', icon: '◉', label: 'Final State' },
        { id: 'transition', icon: '→', label: 'Transition' },
        { id: 'choice', icon: '◇', label: 'Choice' }
      ],
      sequence: [
        { id: 'lifeline', icon: '│', label: 'Lifeline' },
        { id: 'message', icon: '→', label: 'Message' },
        { id: 'return', icon: '⟵', label: 'Return Message' },
        { id: 'activation', icon: '▮', label: 'Activation' },
        { id: 'fragment', icon: '▭', label: 'Fragment' }
      ],
      communication: [
        { id: 'object', icon: '📄', label: 'Object' },
        { id: 'message', icon: '→', label: 'Message' },
        { id: 'link', icon: '—', label: 'Link' }
      ],
      interaction: [
        { id: 'interaction', icon: '⬚', label: 'Interaction' },
        { id: 'flow', icon: '→', label: 'Flow' },
        { id: 'decision', icon: '◇', label: 'Decision' }
      ],
      timing: [
        { id: 'lifeline', icon: '│', label: 'Lifeline' },
        { id: 'state', icon: '▭', label: 'State' },
        { id: 'constraint', icon: '{  }', label: 'Time Constraint' }
      ]
    };

    return [...commonItems, ...(typeSpecificItems[diagramType] || [])];
  };

  // Add element to canvas
  const addElement = (type) => {
    // If it's a relationship tool, set the tool mode
    const relationshipTypes = ['association', 'inheritance', 'aggregation', 'composition', 'dependency', 'interface'];
    if (relationshipTypes.includes(type)) {
      setSelectedTool(type);
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
      properties: {}
    };
    setElements([...elements, newElement]);
    setSelectedTool('select');
    setSelectedElement(newElement);
  };

  // Add connection between elements
  const addConnection = (fromId, toId, connectionType) => {
    const newConnection = {
      id: Date.now(),
      from: fromId,
      to: toId,
      type: connectionType
    };
    setConnections([...connections, newConnection]);
    setConnectionStart(null);
    setSelectedTool('select');
  };

  // Handle element click for connections
  const handleElementClickForConnection = (element, e) => {
    e.stopPropagation();
    
    const relationshipTypes = ['association', 'inheritance', 'aggregation', 'composition', 'dependency'];
    if (relationshipTypes.includes(selectedTool)) {
      if (!connectionStart) {
        setConnectionStart(element.id);
      } else {
        if (connectionStart !== element.id) {
          addConnection(connectionStart, element.id, selectedTool);
        }
        setConnectionStart(null);
      }
    }
  };

  // Handle mouse events for dragging and connections
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;

    // Check if connection tool is selected
    if (['association', 'inheritance', 'aggregation', 'composition', 'dependency', 'realization', 'link'].includes(selectedTool)) {
      // Find clicked element
      const clickedElement = elements.find(el =>
        x >= el.x && x <= el.x + el.width &&
        y >= el.y && y <= el.y + el.height
      );

      if (clickedElement) {
        if (!connectionStart) {
          // Start connection
          setConnectionStart(clickedElement.id);
        } else {
          // Complete connection
          if (connectionStart !== clickedElement.id) {
            const newConnection = {
              id: Date.now(),
              type: selectedTool,
              from: connectionStart,
              to: clickedElement.id
            };
            setConnections([...connections, newConnection]);
          }
          setConnectionStart(null);
          setSelectedTool('select');
        }
      }
    } else if (selectedTool === 'delete') {
      // Delete clicked element
      const clickedElement = elements.find(el =>
        x >= el.x && x <= el.x + el.width &&
        y >= el.y && y <= el.y + el.height
      );
      if (clickedElement) {
        setElements(elements.filter(el => el.id !== clickedElement.id));
        setConnections(connections.filter(c => c.from !== clickedElement.id && c.to !== clickedElement.id));
        setSelectedElement(null);
      }
    }
  };

  const handleMouseDown = (e, element) => {
    if (e.button === 1 || e.shiftKey) { // Middle mouse or shift+click for panning
      setIsPanning(true);
      dragStartPos.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    } else if (selectedTool === 'select') {
      setSelectedElement(element);
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX - element.x, y: e.clientY - element.y };
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    } else if (isDragging && selectedElement) {
      const updatedElements = elements.map(el =>
        el.id === selectedElement.id
          ? { ...el, x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y }
          : el
      );
      setElements(updatedElements);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
  };

  // Generate code
  const handleGenerateCode = () => {
    const code = CodeGenerator.generateCode(elements, language, selectedDiagram);
    setGeneratedCode(code);
    setShowCodePanel(true);
  };

  // Export/Import functions
  const handleExport = () => {
    const data = JSON.stringify({ elements, diagramType: selectedDiagram, language }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDiagram}-diagram.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          setElements(data.elements || []);
          setSelectedDiagram(data.diagramType || 'class');
          setLanguage(data.language || 'Java');
        } catch (error) {
          alert('Error loading file');
        }
      };
      reader.readAsText(file);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(Math.min(zoom + 0.1, 2));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.1, 0.5));

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white">
      {/* Left Sidebar - Diagram Types */}
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
              onClick={() => setSelectedDiagram(diagram.id)}
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
              onClick={() => setSelectedDiagram(diagram.id)}
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
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-[#2d2d30] border-b border-[#3e3e42] p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
            >
              <option>Java</option>
              <option>Python</option>
              <option>JavaScript</option>
            </select>

            <div className="w-px h-6 bg-[#3e3e42]"></div>

            {/* File Operations */}
            <button className="p-2 hover:bg-[#3e3e42] rounded transition-colors" title="New">
              <Save size={18} />
            </button>
            <label className="p-2 hover:bg-[#3e3e42] rounded transition-colors cursor-pointer" title="Import">
              <Upload size={18} />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button onClick={handleExport} className="p-2 hover:bg-[#3e3e42] rounded transition-colors" title="Export">
              <Download size={18} />
            </button>

            <div className="w-px h-6 bg-[#3e3e42]"></div>

            {/* View Controls */}
            <button onClick={handleZoomIn} className="p-2 hover:bg-[#3e3e42] rounded transition-colors" title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <span className="text-sm text-gray-400 px-2">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomOut} className="p-2 hover:bg-[#3e3e42] rounded transition-colors" title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <button 
              onClick={() => setShowGrid(!showGrid)} 
              className={`p-2 rounded transition-colors ${showGrid ? 'bg-[#007acc]' : 'hover:bg-[#3e3e42]'}`}
              title="Toggle Grid"
            >
              <Grid size={18} />
            </button>
          </div>

          <button
            onClick={handleGenerateCode}
            className="bg-[#007acc] hover:bg-[#005a9e] px-4 py-1.5 rounded flex items-center space-x-2 transition-colors"
          >
            <Code size={18} />
            <span className="text-sm font-medium">Generate Code</span>
          </button>
        </div>

        {/* Tool Palette */}
        <div className="bg-[#2d2d30] border-b border-[#3e3e42] p-2 flex items-center space-x-1 overflow-x-auto">
          {getToolbarItems(selectedDiagram).map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'select' || item.id === 'delete') {
                  setSelectedTool(item.id);
                } else if (['association', 'inheritance', 'aggregation', 'composition', 'dependency', 'realization', 'link'].includes(item.id)) {
                  // Connection tools
                  setSelectedTool(item.id);
                  setConnectionStart(null);
                } else {
                  // Shape tools
                  setSelectedTool(item.id);
                  addElement(item.id);
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
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              cursor: selectedTool === 'select' ? 'default' : selectedTool === 'delete' ? 'not-allowed' : 'crosshair'
            }}
          >
            {/* Grid */}
            {showGrid && (
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2d2d2d" strokeWidth="0.5" />
                </pattern>
              </defs>
            )}
            {showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}

            {/* Arrow markers for connections */}
            <defs>
              {/* Regular arrow */}
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#cccccc" />
              </marker>
              {/* Inheritance/Generalization triangle */}
              <marker id="inheritance" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                <polygon points="0 0, 13 5, 0 10, 0 0" fill="none" stroke="#cccccc" strokeWidth="1.5" />
              </marker>
              {/* Aggregation diamond */}
              <marker id="aggregation" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                <polygon points="0 5, 6 0, 13 5, 6 10, 0 5" fill="none" stroke="#cccccc" strokeWidth="1.5" />
              </marker>
              {/* Composition diamond (filled) */}
              <marker id="composition" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                <polygon points="0 5, 6 0, 13 5, 6 10, 0 5" fill="#cccccc" stroke="#cccccc" strokeWidth="1.5" />
              </marker>
              {/* Realization dashed arrow */}
              <marker id="realization" markerWidth="15" markerHeight="15" refX="13" refY="5" orient="auto">
                <polygon points="0 0, 13 5, 0 10, 0 0" fill="none" stroke="#cccccc" strokeWidth="1.5" />
              </marker>
            </defs>

            {/* Render Connections/Relationships */}
            {connections.map(conn => {
              const fromEl = elements.find(el => el.id === conn.from);
              const toEl = elements.find(el => el.id === conn.to);
              
              if (!fromEl || !toEl) return null;

              // Calculate connection points (center of elements)
              const x1 = fromEl.x + fromEl.width / 2;
              const y1 = fromEl.y + fromEl.height / 2;
              const x2 = toEl.x + toEl.width / 2;
              const y2 = toEl.y + toEl.height / 2;

              // Determine line style and marker based on connection type
              let strokeDasharray = 'none';
              let markerEnd = '';
              
              switch (conn.type) {
                case 'association':
                  // Simple line, no arrow (different from composition)
                  markerEnd = '';
                  break;
                case 'inheritance':
                  markerEnd = 'url(#inheritance)';
                  break;
                case 'aggregation':
                  markerEnd = 'url(#aggregation)';
                  break;
                case 'composition':
                  markerEnd = 'url(#composition)';
                  break;
                case 'dependency':
                  strokeDasharray = '5,5';
                  markerEnd = 'url(#arrowhead)';
                  break;
                case 'realization':
                  strokeDasharray = '5,5';
                  markerEnd = 'url(#realization)';
                  break;
                case 'link':
                  // Simple line, no arrow
                  break;
                default:
                  markerEnd = 'url(#arrowhead)';
              }

              return (
                <line
                  key={conn.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#cccccc"
                  strokeWidth="2"
                  strokeDasharray={strokeDasharray}
                  markerEnd={markerEnd}
                />
              );
            })}

            {/* Show temporary connection line while creating */}
            {connectionStart && selectedTool !== 'select' && (
              <line
                x1={elements.find(el => el.id === connectionStart)?.x + elements.find(el => el.id === connectionStart)?.width / 2 || 0}
                y1={elements.find(el => el.id === connectionStart)?.y + elements.find(el => el.id === connectionStart)?.height / 2 || 0}
                x2={elements.find(el => el.id === connectionStart)?.x + elements.find(el => el.id === connectionStart)?.width / 2 || 0}
                y2={elements.find(el => el.id === connectionStart)?.y + elements.find(el => el.id === connectionStart)?.height / 2 || 0}
                stroke="#007acc"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            )}

            {/* Render Elements */}
            {elements.map(element => (
              <g
                key={element.id}
                onMouseDown={(e) => handleMouseDown(e, element)}
                className="cursor-pointer"
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
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
                      rx="4"
                    />
                    {/* Class name section */}
                    <line
                      x1={element.x}
                      y1={element.y + 40}
                      x2={element.x + element.width}
                      y2={element.y + 40}
                      stroke="#3e3e42"
                    />
                    <text
                      x={element.x + element.width / 2}
                      y={element.y + 25}
                      fill="white"
                      fontSize="14"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {element.name}
                    </text>
                    
                    {/* Attributes section */}
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
                    
                    {/* Methods section */}
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
                          >
                            {method.visibility === 'public' ? '+ ' : method.visibility === 'protected' ? '# ' : method.visibility === 'package' ? '~ ' : '- '}{method.name}({method.parameters || ''}): {method.returnType || 'void'}
                          </text>
                        ))}
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
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
                      rx="4"
                    />
                    <text
                      x={element.x + element.width / 2}
                      y={element.y + 15}
                      fill="#888"
                      fontSize="10"
                      textAnchor="middle"
                      fontStyle="italic"
                    >
                      «interface»
                    </text>
                    <line
                      x1={element.x}
                      y1={element.y + 30}
                      x2={element.x + element.width}
                      y2={element.y + 30}
                      stroke="#3e3e42"
                    />
                    <text
                      x={element.x + element.width / 2}
                      y={element.y + 45}
                      fill="white"
                      fontSize="14"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {element.name}
                    </text>
                    {element.methods && element.methods.length > 0 && (
                      <>
                        <line
                          x1={element.x}
                          y1={element.y + 55}
                          x2={element.x + element.width}
                          y2={element.y + 55}
                          stroke="#3e3e42"
                        />
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
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
                      rx="4"
                    />
                    {/* Class name section */}
                    <line
                      x1={element.x}
                      y1={element.y + 40}
                      x2={element.x + element.width}
                      y2={element.y + 40}
                      stroke="#3e3e42"
                    />
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
                    
                    {/* Attributes section */}
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
                            {attr.visibility || '-'} {attr.name}: {attr.type || 'String'}
                          </text>
                        ))}
                      </>
                    )}
                    
                    {/* Methods section */}
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
                            {method.visibility || '+'} {method.name}({method.parameters || ''}): {method.returnType || 'void'}
                          </text>
                        ))}
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
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
                      rx="4"
                    />
                    {/* Component icon */}
                    <rect
                      x={element.x + 10}
                      y={element.y + 10}
                      width="20"
                      height="15"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={element.x + 5}
                      y={element.y + 14}
                      width="8"
                      height="4"
                      fill="white"
                    />
                    <rect
                      x={element.x + 5}
                      y={element.y + 19}
                      width="8"
                      height="4"
                      fill="white"
                    />
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
                    {/* Package tab */}
                    <path
                      d={`M ${element.x} ${element.y + 20} L ${element.x} ${element.y} L ${element.x + 60} ${element.y} L ${element.x + 60} ${element.y + 20} Z`}
                      fill="#3c3c3c"
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
                    />
                    {/* Package body */}
                    <rect
                      x={element.x}
                      y={element.y + 20}
                      width={element.width}
                      height={element.height - 20}
                      fill="#2d2d30"
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
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
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
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
                      stroke={selectedElement?.id === element.id ? '#007acc' : 'white'}
                      strokeWidth="2"
                    />
                    <line
                      x1={element.x + element.width / 2}
                      y1={element.y + 35}
                      x2={element.x + element.width / 2}
                      y2={element.y + 65}
                      stroke={selectedElement?.id === element.id ? '#007acc' : 'white'}
                      strokeWidth="2"
                    />
                    <line
                      x1={element.x + 20}
                      y1={element.y + 45}
                      x2={element.x + element.width - 20}
                      y2={element.y + 45}
                      stroke={selectedElement?.id === element.id ? '#007acc' : 'white'}
                      strokeWidth="2"
                    />
                    <line
                      x1={element.x + element.width / 2}
                      y1={element.y + 65}
                      x2={element.x + 30}
                      y2={element.y + 90}
                      stroke={selectedElement?.id === element.id ? '#007acc' : 'white'}
                      strokeWidth="2"
                    />
                    <line
                      x1={element.x + element.width / 2}
                      y1={element.y + 65}
                      x2={element.x + element.width - 30}
                      y2={element.y + 90}
                      stroke={selectedElement?.id === element.id ? '#007acc' : 'white'}
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
                {!['class', 'usecase', 'actor'].includes(element.type) && (
                  <>
                    <rect
                      x={element.x}
                      y={element.y}
                      width={element.width}
                      height={element.height}
                      fill="#2d2d30"
                      stroke={selectedElement?.id === element.id ? '#007acc' : '#3e3e42'}
                      strokeWidth={selectedElement?.id === element.id ? 2 : 1}
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
          </svg>

          {/* Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#007acc] text-white px-4 py-1 text-xs flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <span>Diagram: {diagramTypes.find(d => d.id === selectedDiagram)?.name}</span>
              <span>Elements: {elements.length}</span>
              <span>Language: {language}</span>
            </div>
            <div>
              <span>Zoom: {Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties & Code */}
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
        <div className="flex-1 overflow-hidden">
          {!showCodePanel ? (
            // Properties Panel
            <div className="h-full overflow-y-auto p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">PROPERTIES</h3>
          {selectedElement ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(e) => {
                    const updated = elements.map(el =>
                      el.id === selectedElement.id ? { ...el, name: e.target.value } : el
                    );
                    setElements(updated);
                    setSelectedElement({ ...selectedElement, name: e.target.value });
                  }}
                  className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Width</label>
                  <input
                    type="number"
                    value={selectedElement.width}
                    onChange={(e) => {
                      const newWidth = e.target.value === '' ? '' : parseInt(e.target.value);
                      const updated = elements.map(el =>
                        el.id === selectedElement.id ? { ...el, width: newWidth || 100 } : el
                      );
                      setElements(updated);
                      setSelectedElement({ ...selectedElement, width: newWidth || 100 });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || parseInt(e.target.value) < 50) {
                        const updated = elements.map(el =>
                          el.id === selectedElement.id ? { ...el, width: 100 } : el
                        );
                        setElements(updated);
                        setSelectedElement({ ...selectedElement, width: 100 });
                      }
                    }}
                    placeholder="Width"
                    className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Height</label>
                  <input
                    type="number"
                    value={selectedElement.height}
                    onChange={(e) => {
                      const newHeight = e.target.value === '' ? '' : parseInt(e.target.value);
                      const updated = elements.map(el =>
                        el.id === selectedElement.id ? { ...el, height: newHeight || 100 } : el
                      );
                      setElements(updated);
                      setSelectedElement({ ...selectedElement, height: newHeight || 100 });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || parseInt(e.target.value) < 50) {
                        const updated = elements.map(el =>
                          el.id === selectedElement.id ? { ...el, height: 100 } : el
                        );
                        setElements(updated);
                        setSelectedElement({ ...selectedElement, height: 100 });
                      }
                    }}
                    placeholder="Height"
                    className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
                  />
                </div>
              </div>
              
              {(selectedElement.type === 'class' || selectedElement.type === 'interface' || selectedElement.type === 'abstract') && (
                <div className="space-y-3">
                  {/* Attributes Section - Only for class and abstract */}
                  {(selectedElement.type === 'class' || selectedElement.type === 'abstract') && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-2">Attributes</label>
                    <div className="space-y-2 mb-2">
                      {(selectedElement.attributes || []).map((attr, index) => (
                        <div key={index} className="flex gap-2">
                          <select
                            value={attr.visibility || 'private'}
                            onChange={(e) => {
                              const newAttrs = [...(selectedElement.attributes || [])];
                              newAttrs[index] = { ...newAttrs[index], visibility: e.target.value };
                              const updated = elements.map(el =>
                                el.id === selectedElement.id ? { ...el, attributes: newAttrs } : el
                              );
                              setElements(updated);
                              setSelectedElement({ ...selectedElement, attributes: newAttrs });
                            }}
                            className="w-12 bg-[#3c3c3c] text-white px-1 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                            title="Visibility"
                          >
                            <option value="public">+</option>
                            <option value="private">-</option>
                            <option value="protected">#</option>
                            <option value="package">~</option>
                          </select>
                          <input
                            type="text"
                            value={attr.name}
                            onChange={(e) => {
                              const newAttrs = [...(selectedElement.attributes || [])];
                              newAttrs[index] = { ...newAttrs[index], name: e.target.value };
                              const updated = elements.map(el =>
                                el.id === selectedElement.id ? { ...el, attributes: newAttrs } : el
                              );
                              setElements(updated);
                              setSelectedElement({ ...selectedElement, attributes: newAttrs });
                            }}
                            placeholder="name"
                            className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                          />
                          <input
                            type="text"
                            value={attr.type || 'String'}
                            onChange={(e) => {
                              const newAttrs = [...(selectedElement.attributes || [])];
                              newAttrs[index] = { ...newAttrs[index], type: e.target.value };
                              const updated = elements.map(el =>
                                el.id === selectedElement.id ? { ...el, attributes: newAttrs } : el
                              );
                              setElements(updated);
                              setSelectedElement({ ...selectedElement, attributes: newAttrs });
                            }}
                            placeholder="type"
                            className="w-20 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                          />
                          <button
                            onClick={() => {
                              const newAttrs = (selectedElement.attributes || []).filter((_, i) => i !== index);
                              const updated = elements.map(el =>
                                el.id === selectedElement.id ? { ...el, attributes: newAttrs } : el
                              );
                              setElements(updated);
                              setSelectedElement({ ...selectedElement, attributes: newAttrs });
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        const newAttrs = [...(selectedElement.attributes || []), { name: 'newAttribute', type: 'String', visibility: 'private' }];
                        const updated = elements.map(el =>
                          el.id === selectedElement.id ? { ...el, attributes: newAttrs } : el
                        );
                        setElements(updated);
                        setSelectedElement({ ...selectedElement, attributes: newAttrs });
                      }}
                      className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors"
                    >
                      + Add Attribute
                    </button>
                  </div>
                  )}

                  {/* Methods Section - For all three types */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-2">Methods</label>
                    <div className="space-y-2 mb-2">
                      {(selectedElement.methods || []).map((method, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex gap-2">
                            <select
                              value={method.visibility || 'public'}
                              onChange={(e) => {
                                const newMethods = [...(selectedElement.methods || [])];
                                newMethods[index] = { ...newMethods[index], visibility: e.target.value };
                                const updated = elements.map(el =>
                                  el.id === selectedElement.id ? { ...el, methods: newMethods } : el
                                );
                                setElements(updated);
                                setSelectedElement({ ...selectedElement, methods: newMethods });
                              }}
                              className="w-12 bg-[#3c3c3c] text-white px-1 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                              title="Visibility"
                            >
                              <option value="public">+</option>
                              <option value="private">-</option>
                              <option value="protected">#</option>
                              <option value="package">~</option>
                            </select>
                            <input
                              type="text"
                              value={method.name}
                              onChange={(e) => {
                                const newMethods = [...(selectedElement.methods || [])];
                                newMethods[index] = { ...newMethods[index], name: e.target.value };
                                const updated = elements.map(el =>
                                  el.id === selectedElement.id ? { ...el, methods: newMethods } : el
                                );
                                setElements(updated);
                                setSelectedElement({ ...selectedElement, methods: newMethods });
                              }}
                              placeholder="method name"
                              className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                            />
                            <input
                              type="text"
                              value={method.returnType || 'void'}
                              onChange={(e) => {
                                const newMethods = [...(selectedElement.methods || [])];
                                newMethods[index] = { ...newMethods[index], returnType: e.target.value };
                                const updated = elements.map(el =>
                                  el.id === selectedElement.id ? { ...el, methods: newMethods } : el
                                );
                                setElements(updated);
                                setSelectedElement({ ...selectedElement, methods: newMethods });
                              }}
                              placeholder="return"
                              className="w-16 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                            />
                            <button
                              onClick={() => {
                                const newMethods = (selectedElement.methods || []).filter((_, i) => i !== index);
                                const updated = elements.map(el =>
                                  el.id === selectedElement.id ? { ...el, methods: newMethods } : el
                                );
                                setElements(updated);
                                setSelectedElement({ ...selectedElement, methods: newMethods });
                              }}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                            >
                              ✕
                            </button>
                          </div>
                          {/* Parameters input */}
                          <input
                            type="text"
                            value={method.parameters || ''}
                            onChange={(e) => {
                              const newMethods = [...(selectedElement.methods || [])];
                              newMethods[index] = { ...newMethods[index], parameters: e.target.value };
                              const updated = elements.map(el =>
                                el.id === selectedElement.id ? { ...el, methods: newMethods } : el
                              );
                              setElements(updated);
                              setSelectedElement({ ...selectedElement, methods: newMethods });
                            }}
                            placeholder="parameters (e.g., newEmail: String, count: int)"
                            className="w-full bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                          />
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        const newMethods = [...(selectedElement.methods || []), { name: 'newMethod', returnType: 'void', parameters: '', visibility: 'public' }];
                        const updated = elements.map(el =>
                          el.id === selectedElement.id ? { ...el, methods: newMethods } : el
                        );
                        setElements(updated);
                        setSelectedElement({ ...selectedElement, methods: newMethods });
                      }}
                      className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors"
                    >
                      + Add Method
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setElements(elements.filter(el => el.id !== selectedElement.id));
                  setSelectedElement(null);
                }}
                className="w-full bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
              >
                <Trash2 size={16} />
                <span>Delete Element</span>
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select an element to edit properties</p>
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
    </div>
  );
};

export default UMLEditor;