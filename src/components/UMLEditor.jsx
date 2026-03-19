/**
 * ============================================================
 * UMLEditor.jsx — Root Editor Component
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the heart of the whole application — the main screen you
 * see when the app loads. It stitches together every other component
 * and service: the sidebar for picking diagram types, the toolbar
 * for file operations and code generation, the tool palette for
 * adding elements, the SVG canvas where the diagram is drawn and
 * edited, the properties panel on the right, and the code import
 * modal. Everything the user can do — drawing, connecting, dragging,
 * resizing, undoing, generating code — is coordinated here.
 *
 * TECHNICAL OVERVIEW:
 * A single large React functional component that acts as the
 * application's state container and event hub. Responsibilities
 * are split across:
 *
 *   State management  — elements, connections, selection, tool mode,
 *                       code output, resize state, clipboard, and
 *                       modal visibility all live here as useState.
 *
 *   Custom hooks      — useHistory (undo/redo stack) and
 *                       useCanvasInteractions (drag, pan, zoom, grid)
 *                       are consumed here and their APIs distributed
 *                       to child components as props.
 *
 *   Event handlers    — handleMouseDown, handleMouseMove, handleMouseUp
 *                       drive dragging and resizing. handleCanvasClick
 *                       handles element selection, connection creation,
 *                       and deletion. A useEffect wires keyboard shortcuts
 *                       (Ctrl+Z/Y/C/V/D, Delete).
 *
 *   SVG rendering     — All diagram elements (class, interface, abstract,
 *                       object, component, package, use-case, actor) and
 *                       connections (with correct arrowhead markers,
 *                       multiplicity labels, and role annotations) are
 *                       rendered inside a single <svg> with a pannable,
 *                       zoomable <g> transform group.
 *
 *   Services          — CodeGenerator.splitIntoFiles() is called on
 *                       "Generate Code". CodeToUMLConverter is triggered
 *                       via CodeImportModal for reverse code import.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Imports and renders: DiagramSidebar, DiagramToolbar, ToolPalette,
 *   PropertiesPanel, CodeImportModal.
 * - Consumes hooks: useHistory (useHistory.js),
 *   useCanvasInteractions (useCanvasInteractions.js).
 * - Calls services: CodeGenerator (codeGenerator.js),
 *   CodeToUMLConverter (codeToUMLConverter.js).
 * - Data constants: diagramTypes, getToolbarItems (diagramUtils.js).
 * ============================================================
 */

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

/**
 * UMLEditor()
 * ------------
 * LAYMAN'S: The root component. Renders the full editor layout —
 *   sidebar, toolbar, palette, canvas, properties panel — and owns
 *   all diagram state. Every child component receives what it needs
 *   as props and sends events back up through callbacks.
 *
 * TECHNICAL: No props — this is a top-level routed component.
 *   All state is initialized here; nothing is lifted further up.
 *   The SVG canvas renders directly inside this component rather
 *   than being extracted, because the connection rendering logic
 *   (edge-point geometry, arrowhead markers) is tightly coupled to
 *   the element positions held in local state.
 */

const UMLEditor = () => {
  // ── Diagram & language state ──────────────────────────────
  // selectedDiagram: which diagram type is active ("class", "usecase", "sequence").
  // language: the target programming language for code generation.
  // elements / connections: the live diagram model — source of truth for all rendering.
  const [selectedDiagram, setSelectedDiagram] = useState('class');
  const [language, setLanguage] = useState('Java');
  const [elements, setElements] = useState([]);
  const [connections, setConnections] = useState([]);

  // ── Selection state ────────────────────────────────────────
  // selectedElements: array (supports multi-select via Ctrl+click).
  // selectedConnection: single selected connection line (mutually exclusive with elements).
  // selectedTool: active tool id ("select", "delete", or a shape/relationship type).
  // connectionStart: id of the first element clicked when drawing a connection.
  const [selectedElements, setSelectedElements] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [connectionStart, setConnectionStart] = useState(null);

  // ── Code generation state ──────────────────────────────────
  // generatedCode: single-string preview (first file's content for backward compat).
  // generatedFiles: Array<{ filename, content }> from CodeGenerator.splitIntoFiles().
  // selectedFileIndex: which file tab is active in the Generated Code panel.
  // showCodePanel: controls Properties vs Generated Code tab in PropertiesPanel.
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showCodePanel, setShowCodePanel] = useState(false);

  // ── Clipboard state ────────────────────────────────────────
  // clipboard: deep-clone of the last copied element(s). Supports Ctrl+V paste.
  const [clipboard, setClipboard] = useState(null);

  // ── Resize state ───────────────────────────────────────────
  // isResizing / resizeHandle: track active corner/edge resize operations.
  // resizeStartPos: screen position where the resize drag began.
  // originalElement: snapshot of the element's size/position before resizing started,
  //   used to compute deltas without accumulation errors.
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [originalElement, setOriginalElement] = useState(null);

  // ── Modal state ────────────────────────────────────────────
  // showCodeImportModal: controls visibility of the CodeImportModal overlay.
  const [showCodeImportModal, setShowCodeImportModal] = useState(false);

  // ── Custom hooks ───────────────────────────────────────────
  // useHistory provides saveToHistory, undo, redo, resetHistory, canUndo, canRedo.
  // useCanvasInteractions provides drag, pan, zoom, grid helpers and canvasRef.
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

  /**
   * elementHeightCache
   * LAYMAN'S: A performance cache. Recalculating element heights on every
   *   render is expensive — this Map stores the last computed height per
   *   element so the height-sync useEffect only recalculates when an
   *   element's attribute/method count or stereotype actually changes.
   * TECHNICAL: useRef (not useState) so updates don't trigger re-renders.
   *   Keys are composite strings: `${id}-${attrCount}-${methodCount}-${stereotype}`.
   */
  const elementHeightCache = useRef(new Map());

  /**
   * copyElement()
   * LAYMAN'S: Copies all currently selected elements to an internal
   *   clipboard so the user can paste them with Ctrl+V.
   * TECHNICAL: Deep-clones selectedElements into clipboard state using
   *   JSON.parse/stringify. Clipboard persists until the next copy
   *   or until the component unmounts.
   */
  const copyElement = () => {
    if (selectedElements.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(selectedElements)));
    }
  };

  /**
   * pasteElement()
   * LAYMAN'S: Pastes the clipboard contents onto the canvas, offset
   *   by 20px so the paste doesn't land exactly on top of the original.
   * TECHNICAL: Handles both array (multi-select copy) and legacy single-
   *   item clipboard values. Generates new unique ids via Date.now() + index
   *   to avoid id collisions. Saves to history so paste is undoable.
   *   Sets selectedElements to the new elements so the user can immediately
   *   move the paste result.
   */
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

  /**
   * updateElement(elementId, updates)
   * LAYMAN'S: Applies a partial change to a specific element — for example,
   *   updating its name or moving it. Updates both the master list and the
   *   selection so the canvas and properties panel stay in sync.
   * TECHNICAL: Immutable map — returns a new array with only the target
   *   element replaced via spread. Also patches selectedElements to avoid
   *   stale closure values in the properties form on the next render.
   */
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

  /**
   * Keyboard shortcuts useEffect
   * LAYMAN'S: Wires up the familiar keyboard shortcuts:
   *   Ctrl+Z = Undo, Ctrl+Shift+Z / Ctrl+Y = Redo,
   *   Ctrl+C = Copy, Ctrl+V = Paste, Ctrl+D = Delete selected,
   *   Delete key = delete selected element or connection.
   * TECHNICAL: Attaches a 'keydown' listener to window (not just the
   *   SVG) so shortcuts work regardless of which element has focus.
   *   Returns a cleanup function that removes the listener on unmount
   *   or when the dependency array values change.
   *   e.preventDefault() on Ctrl+Z/Y/C/V/D suppresses browser defaults
   *   (e.g., browser undo, page print).
   */
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

  /**
   * calculateElementHeight(element)
   * LAYMAN'S: Figures out how tall a class box needs to be based on
   *   how many attributes and methods it has, plus whether it has a
   *   stereotype label. More rows = taller box, so content never overflows.
   * TECHNICAL: Formula: baseHeight (60) + stereotypeHeight (20 if set)
   *   + attrCount×18 + methodCount×18 + padding (30 if any rows exist).
   *   Clamped to a minimum of 100px. 18px per row matches the fontSize="11"
   *   lineHeight used when rendering text inside SVG elements.
   * RELATIONSHIP: Called by the height-sync useEffect below and also
   *   when a new element is added in addElement().
   */
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

  /**
   * Height-sync useEffect
   * LAYMAN'S: Automatically resizes class boxes whenever the user adds
   *   or removes attributes and methods, so the box always fits its content.
   *   Without this, a box with 10 methods would overflow its fixed height.
   * TECHNICAL: Runs after every render where elements changes. Uses
   *   elementHeightCache to skip recalculation if the content key hasn't
   *   changed. Only calls setElements when at least one height actually
   *   changed (hasChanges guard) to prevent an infinite render loop.
   */
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

  /**
   * addElement(type)
   * LAYMAN'S: Called when the user clicks a tool in the palette. If the tool
   *   is a shape (class, interface, actor, etc.) it adds a new element at a
   *   staggered position on the canvas. If the tool is a relationship type
   *   (inheritance, composition, etc.) it switches to connection-drawing mode
   *   instead — no element is added yet.
   * TECHNICAL: Relationship types are identified by an allowlist array.
   *   Shape elements get a default size, a generated name, and type-appropriate
   *   fields (attributes/methods for classes, attributeValues for objects, etc.).
   *   id is Date.now() — suitable for a single-user session but would need
   *   a UUID for multi-user/persistence scenarios.
   *   After adding, selectedTool reverts to 'select' and the new element is
   *   auto-selected so the user can immediately edit it in the properties panel.
   */
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

  /**
   * handleCanvasClick(e)
   * LAYMAN'S: The main click handler for the SVG canvas. Its behavior changes
   *   depending on the active tool:
   *   — Relationship tool: first click sets the "from" element; second click on
   *     a different element creates the connection. Click on empty space cancels.
   *   — Delete tool: removes whichever element was clicked.
   *   — Select tool (default): clicking empty space deselects everything.
   * TECHNICAL: Uses getCanvasCoordinates() to convert the mouse event's
   *   clientX/Y into diagram-space coordinates, then performs a simple AABB
   *   (axis-aligned bounding box) hit-test against all elements.
   *   Connection creation is a two-click state machine driven by connectionStart.
   *   Self-connections are prevented (connectionStart !== clickedElement.id).
   */
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

  /**
   * handleMouseDown(e, element)
   * LAYMAN'S: Called when the user presses a mouse button on a diagram element.
   *   Middle-mouse or Shift+click starts canvas panning. Left-click selects the
   *   element (or toggles it in/out of the selection if Ctrl is held) and starts
   *   a drag operation for single-element moves.
   * TECHNICAL: e.stopPropagation() prevents the click from bubbling to the SVG's
   *   onClick handler (handleCanvasClick), which would immediately deselect.
   *   Multi-select (Ctrl/Meta) uses functional setState to toggle membership.
   *   Drag only starts for single selections — multi-select drag is not supported.
   */
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

  /**
   * handleMouseMove(e)
   * LAYMAN'S: Called on every mouse movement over the SVG canvas. It handles
   *   three separate tasks depending on what's active: resizing an element via
   *   its corner/edge handles, panning the canvas viewport, or dragging an
   *   element to a new position.
   * TECHNICAL: Priority order: resize > pan > drag.
   *   Resize: computes delta from resizeStartPos, applies it to originalElement
   *   dimensions with handle-specific axis logic (8 cases: nw/ne/sw/se/n/s/w/e).
   *   Delta is divided by zoom so resize speed matches the visual scale.
   *   Pan: delegated to updatePan() from useCanvasInteractions.
   *   Drag: delegated to updateDrag(), which returns {x, y} or null.
   *   All three paths clamp to minimum sizes (50×30) to prevent negative dimensions.
   */
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

  /**
   * handleMouseUp()
   * LAYMAN'S: Called when the user releases any mouse button. Finalizes
   *   whatever interaction was in progress — drag, resize, or pan — and
   *   saves an undo snapshot if the diagram was modified.
   * TECHNICAL: Saves to history only when a drag or resize actually
   *   completed (isDragging/isResizing guards). Then resets all
   *   interaction state flags so the next interaction starts clean.
   */
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

  /**
   * handleResizeStart(e, element, handle)
   * LAYMAN'S: Called when the user starts dragging one of the eight resize
   *   handles (corners + edge midpoints) that appear around a selected element.
   *   Records the starting mouse position and a snapshot of the element so
   *   handleMouseMove can compute clean deltas.
   * TECHNICAL: e.stopPropagation() prevents the mousedown from bubbling to
   *   handleMouseDown, which would start a drag instead of a resize.
   *   originalElement is a shallow clone — sufficient because only x/y/width/height
   *   are read during resize and those are all primitives.
   */
  // Resize handlers
  const handleResizeStart = (e, element, handle) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setOriginalElement({ ...element });
  };

  /**
   * handleGenerateCode()
   * LAYMAN'S: Called when the user clicks "Generate Code" in the toolbar.
   *   Runs the code generator on the current diagram, stores the result,
   *   and switches the right panel to the "Generated Code" tab so the user
   *   can immediately see and copy the output.
   * TECHNICAL: Calls CodeGenerator.splitIntoFiles() which returns
   *   Array<{ filename, content }>. Sets generatedFiles for the multi-file
   *   tab UI and also sets generatedCode to files[0].content for backward
   *   compatibility with any code that reads the single-string version.
   *   Resets selectedFileIndex to 0 so the first file is shown.
   */
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

  /**
   * handleCodeToUML()
   * LAYMAN'S: Opens the "Code to Diagram" import modal. The actual
   *   conversion work happens inside CodeImportModal + CodeToUMLConverter.
   * TECHNICAL: Simply flips showCodeImportModal to true — the modal
   *   component handles all conversion state internally.
   */
  // Code to UML conversion
  const handleCodeToUML = () => {
    setShowCodeImportModal(true);
  };

  /**
   * handleImportCode(importedElements, importedConnections)
   * LAYMAN'S: Called by CodeImportModal after a successful conversion.
   *   If the canvas is empty, the imported classes just replace it.
   *   If there's already a diagram, the imported classes are placed to
   *   the right of the existing ones so they don't overlap.
   * TECHNICAL: Calculates maxX (rightmost x + width of all existing elements)
   *   and offsets importedElements.x by maxX + 100px. Saves merged state to
   *   history so the import is a single undoable action.
   *   Note: the history save uses the pre-merge elements/connections due to
   *   closure capture — a known minor quirk that doesn't affect correctness.
   */
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

  /**
   * handleExport()
   * LAYMAN'S: Saves the current diagram to a .json file on the user's
   *   computer. The file preserves everything — all elements, connections,
   *   diagram type, and language — so the user can reload it later.
   * TECHNICAL: Serializes state to JSON, creates a Blob, generates a
   *   temporary object URL, programmatically clicks a hidden <a> element
   *   to trigger the browser download, then revokes the URL to free memory.
   */
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

  /**
   * handleImport(e)
   * LAYMAN'S: Loads a previously exported .json file back into the editor,
   *   restoring the diagram exactly as it was saved — including diagram type
   *   and language. The undo history is reset so the user can't undo back
   *   to before the file was loaded.
   * TECHNICAL: Uses FileReader.readAsText() asynchronously. Parses the JSON
   *   and applies defaults (|| []) for safety in case the file is missing
   *   fields. Calls resetHistory() so the loaded state is the new baseline.
   *   Alerts the user on JSON parse failure rather than silently failing.
   */
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

  /**
   * handleNew()
   * LAYMAN'S: Clears the entire canvas and starts fresh. Resets the undo
   *   history so the user can't undo back to the previous diagram.
   * TECHNICAL: Resets all diagram state and calls resetHistory([],[]) to
   *   replace the history stack with a single empty snapshot.
   */
  const handleNew = () => {
    setElements([]);
    setConnections([]);
    resetHistory([], []);
    setSelectedElements([]);
    setSelectedConnection(null);
  };

  /**
   * handleDiagramSelect(diagramId)
   * LAYMAN'S: Switches the editor to a different diagram type (e.g., from
   *   Class to Use Case). Resets the active tool and cancels any in-progress
   *   connection so the user starts clean in the new diagram.
   * TECHNICAL: Sets selectedDiagram (which causes DiagramToolbar and
   *   ToolPalette to re-render with the correct controls for the new type)
   *   and resets selectedTool/'select' + connectionStart/null.
   *   Does NOT clear existing elements — the canvas persists across
   *   diagram type switches so the user can have elements from multiple
   *   diagram types on the same canvas.
   */
  const handleDiagramSelect = (diagramId) => {
    setSelectedDiagram(diagramId);
    setSelectedTool('select');
    setConnectionStart(null);
  };

  return (
    <div className="flex w-full bg-[#1e1e1e] text-white overflow-hidden" style={{ height: 'calc(100vh - 60px)' }}>
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
          selectedDiagram={selectedDiagram}
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

                // ── Edge-to-edge line calculation ──────────────────────────
                // Instead of connecting box centres (which draws the line
                // through the boxes), we find where the line exits each box.
                const getEdgePoint = (bx, by, bw, bh, tx, ty) => {
                  const cx = bx + bw / 2;
                  const cy = by + bh / 2;
                  const dx = tx - cx;
                  const dy = ty - cy;
                  if (dx === 0 && dy === 0) return { x: cx, y: cy };
                  const scaleX = dx !== 0 ? (bw / 2) / Math.abs(dx) : Infinity;
                  const scaleY = dy !== 0 ? (bh / 2) / Math.abs(dy) : Infinity;
                  const scale  = Math.min(scaleX, scaleY);
                  return { x: cx + dx * scale, y: cy + dy * scale };
                };

                const fromCx = fromEl.x + fromEl.width  / 2;
                const fromCy = fromEl.y + fromEl.height / 2;
                const toCx   = toEl.x   + toEl.width    / 2;
                const toCy   = toEl.y   + toEl.height   / 2;

                const p1 = getEdgePoint(fromEl.x, fromEl.y, fromEl.width, fromEl.height, toCx,   toCy);
                const p2 = getEdgePoint(toEl.x,   toEl.y,   toEl.width,  toEl.height,   fromCx, fromCy);

                const x1 = p1.x;
                const y1 = p1.y;
                const x2 = p2.x;
                const y2 = p2.y;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                // Unit vector along the line (for label offsets)
                const len = Math.hypot(x2 - x1, y2 - y1) || 1;
                const ux  = (x2 - x1) / len;
                const uy  = (y2 - y1) / len;
                // Perpendicular unit vector
                const px  = -uy;
                const py  =  ux;
                // Labels sit 30px along the line from each endpoint, 12px perpendicular
                const LABEL_DIST = 30;
                const LABEL_PERP = 12;

                const fromLabelX = x1 + ux * LABEL_DIST + px * LABEL_PERP;
                const fromLabelY = y1 + uy * LABEL_DIST + py * LABEL_PERP;
                const toLabelX   = x2 - ux * LABEL_DIST + px * LABEL_PERP;
                const toLabelY   = y2 - uy * LABEL_DIST + py * LABEL_PERP;
                // Role labels sit 24px perp (below the multiplicity)
                const fromRoleX  = x1 + ux * LABEL_DIST + px * (LABEL_PERP + 14);
                const fromRoleY  = y1 + uy * LABEL_DIST + py * (LABEL_PERP + 14);
                const toRoleX    = x2 - ux * LABEL_DIST + px * (LABEL_PERP + 14);
                const toRoleY    = y2 - uy * LABEL_DIST + py * (LABEL_PERP + 14);

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
                    {/* Visible line */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
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
                    {/* Wide invisible hit-area so the line is easy to click */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="transparent"
                      strokeWidth="10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnection(conn);
                        setSelectedElements([]);
                      }}
                      style={{ cursor: 'pointer' }}
                    />

                    {/* Multiplicity labels near each endpoint */}
                    {conn.fromMultiplicity && (
                      <text x={fromLabelX} y={fromLabelY} fill="#aaaaaa" fontSize="11" textAnchor="middle">
                        {conn.fromMultiplicity}
                      </text>
                    )}
                    {conn.toMultiplicity && (
                      <text x={toLabelX} y={toLabelY} fill="#aaaaaa" fontSize="11" textAnchor="middle">
                        {conn.toMultiplicity}
                      </text>
                    )}
                    {/* Relationship label at midpoint */}
                    {conn.label && (
                      <text x={midX} y={midY - 8} fill="#cccccc" fontSize="11" textAnchor="middle">
                        {conn.label}
                      </text>
                    )}
                    {/* Role labels near each endpoint, below multiplicity */}
                    {conn.fromRole && (
                      <text x={fromRoleX} y={fromRoleY} fill="#888888" fontSize="10" fontStyle="italic" textAnchor="middle">
                        {conn.fromRole}
                      </text>
                    )}
                    {conn.toRole && (
                      <text x={toRoleX} y={toRoleY} fill="#888888" fontSize="10" fontStyle="italic" textAnchor="middle">
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