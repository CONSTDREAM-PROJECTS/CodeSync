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
import TokenizationService from '../services/TokenizationService';
import ValidationService from '../services/ValidationService';
import DiagramService from '../services/diagramService';
import { useHistory } from '../hooks/useHistory';
import { useCanvasInteractions } from '../hooks/useCanvasInteractions';
import { diagramTypes, getToolbarItems } from '../utils/diagramUtils';
import DiagramSidebar from './DiagramSidebar';
import DiagramToolbar from './DiagramToolbar';
import ToolPalette from './ToolPalette';
import PropertiesPanel from './PropertiesPanel';
import CodeImportModal from './CodeImportModal';
import ValidationPanel from './ValidationPanel';
import LoginModal, { restoreSession, clearSession, TOKEN_KEY } from './LoginModal';
// NOTE: LoginModal is no longer rendered here — it lives in App.js.
// restoreSession / clearSession / TOKEN_KEY are kept exported for App.js to use.
import { ToastContainer, useToast } from './Toast';

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

// BUG M4 FIX: Monotonically-incrementing ID counter so rapid element creation
// never produces duplicate IDs (Date.now() collides within the same millisecond).
let _nextId = Date.now();
const nextId = () => ++_nextId;

const UMLEditor = ({ currentUser, onLoginSuccess, onLogout }) => {
  // ── Diagram & language state ──────────────────────────────
  // selectedDiagram: which diagram type is active ("class", "usecase", "sequence").
  // language: the target programming language for code generation.
  // elements / connections: the live diagram model — source of truth for all rendering.
  const [selectedDiagram, setSelectedDiagram] = useState('class');
  const [language, setLanguage] = useState('Java');
  const [elements, setElements] = useState([]);
  const [connections, setConnections] = useState([]);

  // Live refs — always point to the current elements/connections so callbacks
  // that close over these never read stale values (e.g. onCodeEdit saveToHistory).
  const elementsRef    = useRef([]);
  const connectionsRef = useRef([]);
  useEffect(() => { elementsRef.current    = elements;    }, [elements]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);

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

  // ── Properties panel width state ───────────────────────────
  // panelWidth: user-draggable width for the right Properties/Code panel.
  // Min 280 px (readable), max 700 px (still leaves room for the canvas).
  const [panelWidth, setPanelWidth] = useState(384); // default = w-96

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

  // ── Inline rename state (Fix #19) ─────────────────────────
  // inlineEditId: id of the element currently being renamed inline on the canvas.
  // inlineEditValue: current text in the inline input box.
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const inlineInputRef = useRef(null);

  // ── Mouse position for live connection line (Fix #11) ──────
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // ── Toast notifications (Fix #12) ─────────────────────────
  const { toasts, showToast, removeToast } = useToast();

  // ── Auth + persistence state ───────────────────────────────
  // currentUser, onLoginSuccess, onLogout are passed in as props from App.js.
  // diagramId: stable id for this diagram session used as the DB key.
  const [diagramId] = useState(() => `diagram_${Date.now()}`);

  // ── Session-expiry listener ────────────────────────────────
  // diagramService.js dispatches 'codesynch:session-expired' on a 401.
  // We bubble it up via onLogout so App.js can open the login modal.
  useEffect(() => {
    const onExpired = () => {
      showToast('Your session expired. Please log in again.', 'error');
      onLogout?.();
    };
    window.addEventListener('codesynch:session-expired', onExpired);
    return () => window.removeEventListener('codesynch:session-expired', onExpired);
  }, [onLogout]); // eslint-disable-line react-hooks/exhaustive-deps

  // validationResult: the result object from ValidationService.validate().
  // showValidationPanel: controls visibility of the inline error panel.
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);

  // ── Custom hooks ───────────────────────────────────────────
  // useHistory provides saveToHistory, undo, redo, resetHistory, canUndo, canRedo.
  // useCanvasInteractions provides drag, pan, zoom, grid helpers and canvasRef.
  // Fix #15: seed useHistory with initial state so first Ctrl+Z doesn't go to empty canvas
  const { saveToHistory, undo, redo, resetHistory, canUndo, canRedo } = useHistory(elements, connections);
  const {
    isDragging,
    isPanning,
    panOffset,
    zoom,
    showGrid,
    canvasRef,
    handleZoomIn,
    handleZoomOut,
    handleWheelZoom,
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
   * dragStartPositions
   * LAYMAN'S: When dragging multiple selected elements, we need to remember
   *   where each one started so they all move together as a group.
   * TECHNICAL: Map of elementId -> { x, y } snapshot taken at mousedown.
   *   Cleared on mouseup. Only populated when selectedElements.length > 1.
   */
  const dragStartPositions = useRef({});
  const dragStartMouse = useRef({ x: 0, y: 0 });

  /**
   * autoSave useEffect
   * LAYMAN'S: Automatically saves the diagram to the cloud 2 seconds
   *   after any change, but only when the user is logged in. If not
   *   logged in, changes are only kept in browser memory (lost on refresh).
   * TECHNICAL: Calls DiagramService.autoSave() which is debounced — rapid
   *   changes are collapsed into one save. Depends on elements, connections,
   *   selectedDiagram, language, and currentUser.
   */
  // BUG M6 FIX (revised): include all values read inside the effect so the
  // saved payload always reflects the current diagram type and language.
  // Previously selectedDiagram, language, and diagramId were omitted, causing
  // the effect to close over stale values whenever those changed.
  useEffect(() => {
    if (!currentUser) return;
    if (elements.length === 0 && connections.length === 0) return;
    DiagramService.autoSave(currentUser, diagramId, {
      name:        `${diagramTypes.find(d => d.id === selectedDiagram)?.name || 'Diagram'}`,
      diagramType: selectedDiagram,
      language,
      elements,
      connections
    });
  }, [elements, connections, selectedDiagram, language, diagramId, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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
          id: nextId(),
          x: item.x + offsetX,
          y: item.y + offsetY
        }));
      } else {
        // Single element
        newElements = [{
          ...JSON.parse(JSON.stringify(clipboard)),
          id: nextId(),
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
      // BUG C3 FIX: Do not intercept shortcuts while the user is typing
      // in any input, textarea, or the inline canvas rename field.
      const tag = document.activeElement?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        document.activeElement?.isContentEditable ||
        inlineEditId !== null;
      if (isTyping) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo(setElements, setConnections);
          setSelectedElements([]);
          setSelectedConnection(null);
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          redo(setElements, setConnections);
          setSelectedElements([]);
          setSelectedConnection(null);
        } else if (e.key === 'c') {
          e.preventDefault();
          copyElement();
        } else if (e.key === 'v') {
          e.preventDefault();
          pasteElement();
        } else if (e.key === 'd') {
          // Ctrl+D = Duplicate (not delete — Delete key already handles deletion)
          e.preventDefault();
          if (selectedElements.length > 0) {
            const duplicated = selectedElements.map((el, index) => ({
              ...JSON.parse(JSON.stringify(el)),
              id: nextId(),
              x: el.x + 20,
              y: el.y + 20,
            }));
            const updatedElements = [...elements, ...duplicated];
            setElements(updatedElements);
            saveToHistory(updatedElements, connections);
            setSelectedElements(duplicated);
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
  }, [selectedElements, selectedConnection, elements, connections, clipboard, inlineEditId]);

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
      // BUG H4 + BUG L4 FIX: include 'enum' in the type guard
      if (['class', 'interface', 'abstract', 'enum'].includes(el.type)) {
        const newHeight = calculateElementHeight(el);
        const cacheKey = `${el.id}-${el.attributes?.length}-${el.methods?.length}-${el.stereotype}`;
        const cachedHeight = elementHeightCache.current.get(cacheKey);

        if (cachedHeight !== newHeight) {
          elementHeightCache.current.set(cacheKey, newHeight);
          // BUG H4 FIX: Only update when the difference exceeds 1px to absorb
          // floating-point noise that would otherwise cause an infinite render loop.
          if (Math.abs(newHeight - (el.height || 0)) > 1) {
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
  }, [elements]); // eslint-disable-line react-hooks/exhaustive-deps

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
      id: nextId(),
      type,
      diagramType: selectedDiagram,
      x: 100 + (elements.length * 20),
      y: 100 + (elements.length * 20),
      width: type === 'class' || type === 'component' || type === 'interface' || type === 'abstract' || type === 'enum' ? 200 : 150,
      height: type === 'class' || type === 'component' || type === 'interface' || type === 'abstract' || type === 'enum' ? 150 : 100,
      name: `New${type.charAt(0).toUpperCase() + type.slice(1)}`,
      // enum gets attributes (used as enum value list), no methods
      attributes: (type === 'class' || type === 'abstract' || type === 'enum') ? [] : undefined,
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
              id: nextId(),
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
        setSelectedElements(prev => {
          const isSelected = prev.some(el => el.id === element.id);
          if (isSelected) return prev.filter(el => el.id !== element.id);
          return [...prev, element];
        });
      } else {
        // If clicking an already-selected element in a multi-selection, keep selection
        setSelectedElements(prev => {
          const alreadySelected = prev.some(el => el.id === element.id);
          return alreadySelected && prev.length > 1 ? prev : [element];
        });
      }
      setSelectedConnection(null);

      // Start drag — works for single OR multi-select (Fix #10)
      if (!e.ctrlKey && !e.metaKey) {
        const svgCoords = getCanvasCoordinates(e.clientX, e.clientY);
        dragStartMouse.current = svgCoords;
        // Snapshot positions of all currently selected elements
        setSelectedElements(prev => {
          dragStartPositions.current = {};
          prev.forEach(el => {
            dragStartPositions.current[el.id] = { x: el.x, y: el.y };
          });
          // Also include the clicked element itself
          dragStartPositions.current[element.id] = { x: element.x, y: element.y };
          return prev.length > 0 ? prev : [element];
        });
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
    // Fix #11: track mouse in SVG space for the live connection preview line
    if (connectionStart) {
      const svgCoords = getCanvasCoordinates(e.clientX, e.clientY);
      setMousePos(svgCoords);
    }

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
        default:
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

      const dragResult = updateDrag(selectedElements.length >= 1 ? selectedElements[0] : null, e.clientX, e.clientY);
      if (dragResult && selectedElements.length === 1) {
        // Single element drag (original path)
        const updatedElements = elements.map(el =>
          el.id === selectedElements[0].id
            ? { ...el, x: dragResult.x, y: dragResult.y }
            : el
        );
        setElements(updatedElements);
        setSelectedElements([{ ...selectedElements[0], x: dragResult.x, y: dragResult.y }]);
      } else if (dragResult && selectedElements.length > 1) {
        // Fix #10: Group drag — move ALL selected elements by the same delta
        const svgCurrent = getCanvasCoordinates(e.clientX, e.clientY);
        const dx = svgCurrent.x - dragStartMouse.current.x;
        const dy = svgCurrent.y - dragStartMouse.current.y;
        const updatedElements = elements.map(el => {
          const startPos = dragStartPositions.current[el.id];
          if (startPos) {
            return { ...el, x: startPos.x + dx, y: startPos.y + dy };
          }
          return el;
        });
        setElements(updatedElements);
        setSelectedElements(prev => prev.map(el => {
          const startPos = dragStartPositions.current[el.id];
          if (startPos) return { ...el, x: startPos.x + dx, y: startPos.y + dy };
          return el;
        }));
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
    // BUG FIX: Use functional setState pattern to guarantee we read the
    // latest elements/connections snapshot — the closure values may be
    // one render behind after a drag/resize update.
    if (isDragging && selectedElements.length >= 1) {
      setElements(latestEls => {
        setConnections(latestConns => {
          saveToHistory(latestEls, latestConns);
          return latestConns;
        });
        return latestEls;
      });
    }
    if (isResizing && selectedElements.length === 1) {
      setElements(latestEls => {
        setConnections(latestConns => {
          saveToHistory(latestEls, latestConns);
          return latestConns;
        });
        return latestEls;
      });
    }
    dragStartPositions.current = {};
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
   * handleDoubleClick(e, element)
   * LAYMAN'S: When the user double-clicks an element on the canvas,
   *   a small text input appears right on top of the element's name
   *   so they can rename it without opening the properties panel.
   * TECHNICAL: Records the element id and current name into inlineEditId
   *   and inlineEditValue. A foreignObject overlay is rendered in the SVG
   *   at the element's position. Focus is set via a useEffect on inlineEditId.
   */
  const handleDoubleClick = (e, element) => {
    e.stopPropagation();
    setInlineEditId(element.id);
    setInlineEditValue(element.name);
    setTimeout(() => inlineInputRef.current?.focus(), 50);
  };

  /**
   * commitInlineRename()
   * LAYMAN'S: Saves the new name when the user presses Enter or clicks away.
   * TECHNICAL: Calls updateElement then saveToHistory, then clears inlineEditId.
   */
  const commitInlineRename = () => {
    if (inlineEditId && inlineEditValue.trim()) {
      updateElement(inlineEditId, { name: inlineEditValue.trim() });
      saveToHistory(
        elements.map(el => el.id === inlineEditId ? { ...el, name: inlineEditValue.trim() } : el),
        connections
      );
    }
    setInlineEditId(null);
    setInlineEditValue('');
  };

  /**
   * handleGenerateCode()
   * LAYMAN'S: Called when the user clicks "Generate Code" in the toolbar.
   *   Now runs the full pipeline: Tokenize → Validate → Generate.
   *   If the diagram has errors, the ValidationPanel opens showing exactly
   *   what is wrong and how to fix it. Code is only generated when the
   *   diagram passes structural validation (canProceed is true).
   * TECHNICAL: Calls TokenizationService.tokenize() first to produce the
   *   token stream and symbol table. Then passes those to
   *   ValidationService.validate(). If canProceed is true, calls
   *   CodeGenerator.splitIntoFiles(). If not, opens the ValidationPanel
   *   and returns early so the user sees the errors instead of broken code.
   */
  // Generate code
  const handleGenerateCode = () => {
    // ── Step 1: Tokenize ──────────────────────────────────
    const tokenizationResult = TokenizationService.tokenize(
      { elements, connections },
      selectedDiagram
    );

    if (!tokenizationResult.success) {
      setValidationResult({
        isValid: false,
        canProceed: false,
        allIssues: [{
          severity: 'ERROR',
          code: 'TOKENIZATION_FAILED',
          elementRef: 'diagram',
          title: 'Tokenization failed',
          description: tokenizationResult.error,
          recommendedAction: 'Check the diagram for unsupported element types.'
        }],
        stage1Errors: [],
        stage2Warnings: [],
        stage3Infos: [],
        todoAnnotations: [],
        summary: `Tokenization failed: ${tokenizationResult.error}`
      });
      setShowValidationPanel(true);
      return;
    }

    // ── Step 2: Validate ──────────────────────────────────
    const validation = ValidationService.validate(tokenizationResult, selectedDiagram);
    setValidationResult(validation);

    // Always show validation panel if there are any issues
    if (validation.allIssues.length > 0) {
      setShowValidationPanel(true);
    }

    // Hard stop on structural errors
    if (!validation.canProceed) {
      return;
    }

    // ── Step 3: Generate ──────────────────────────────────
    const files = CodeGenerator.splitIntoFiles(elements, connections, language, selectedDiagram);
    setGeneratedFiles(files);

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
  const handleImportCode = (importedElements, importedConnections, options = {}) => {
    let mergedElements;
    let mergedConnections;

    // replaceAll: true is set by CodeToUMLConverter when importing fresh code
    // so stale placeholder elements don't remain alongside newly-imported ones.
    if (options.replaceAll || elements.length === 0 && connections.length === 0) {
      mergedElements    = importedElements;
      mergedConnections = importedConnections;
    } else {
      // Offset imported elements so they don't overlap existing ones
      const maxX = Math.max(...elements.map(e => e.x + e.width), 0);
      mergedElements = [
        ...elements,
        ...importedElements.map(el => ({ ...el, x: el.x + maxX + 100 }))
      ];
      mergedConnections = [...connections, ...importedConnections];
    }

    // Switch the active diagram type when the converter tells us to
    // (e.g. use-case annotations -> 'usecase', sequence code -> 'sequence').
    // This ensures Generate Code runs the correct generator path afterwards.
    if (options.diagramType && options.diagramType !== selectedDiagram) {
      setSelectedDiagram(options.diagramType);
    }

    // BUG C4 FIX: set state AND save history with identical arrays so
    // Ctrl+Z restores the correctly-positioned (offset) elements.
    setElements(mergedElements);
    setConnections(mergedConnections);
    saveToHistory(mergedElements, mergedConnections);

    const typeLabel = options.diagramType === 'usecase'  ? 'use case'
                    : options.diagramType === 'sequence' ? 'sequence'
                    : 'class';
    showToast(`Successfully imported ${importedElements.length} ${typeLabel} elements from code!`, 'success');
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
  /**
   * handleExportSVG()
   * Fix #6: Export the diagram canvas as a downloadable SVG file by
   * serializing the SVG DOM element directly — no external library needed.
   */
  const handleExportSVG = () => {
    const svgEl = canvasRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDiagram}-diagram.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Diagram exported as SVG', 'success');
  };

  /**
   * handleExportPNG()
   * Fix #6: Renders the SVG into an off-screen <canvas> via an Image element,
   * then exports that canvas as a PNG. No html2canvas dependency needed.
   */
  const handleExportPNG = () => {
    const svgEl = canvasRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // 2× for retina-quality output
      canvas.width  = svgEl.clientWidth  * scale;
      canvas.height = svgEl.clientHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${selectedDiagram}-diagram.png`;
      a.click();
      showToast('Diagram exported as PNG', 'success');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast('PNG export failed — try SVG instead', 'error');
    };
    img.src = url;
  };

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
          showToast('Diagram imported successfully!', 'success');
        } catch (error) {
          showToast('Error loading file: Invalid JSON format', 'error');
        }
      };
      reader.readAsText(file);
    }
    // Fix: reset the input so the same file can be re-imported
    e.target.value = '';
  };

  /**
   * handleNew()
   * LAYMAN'S: Clears the entire canvas and starts fresh. Resets the undo
   *   history so the user can't undo back to the previous diagram.
   * TECHNICAL: Resets all diagram state and calls resetHistory([],[]) to
   *   replace the history stack with a single empty snapshot.
   */
  const handleNew = () => {
    if (elements.length > 0 || connections.length > 0) {
      if (!window.confirm('Clear the canvas and start a new diagram? Unsaved changes will be lost.')) return;
    }
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
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Toolbar */}
        <DiagramToolbar
          language={language}
          setLanguage={setLanguage}
          onNew={handleNew}
          onImport={handleImport}
          onExport={handleExport}
          onExportSVG={handleExportSVG}
          onExportPNG={handleExportPNG}
          onGenerateCode={handleGenerateCode}
          onCodeToUML={handleCodeToUML}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showGrid={showGrid}
          onToggleGrid={toggleGrid}
          onUndo={() => { undo(setElements, setConnections); setSelectedElements([]); setSelectedConnection(null); }}
          onRedo={() => { redo(setElements, setConnections); setSelectedElements([]); setSelectedConnection(null); }}
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
            onMouseDown={(e) => {
              // Left-click on empty canvas space starts panning
              if (e.button === 0) {
                e.preventDefault();
                startPanning(e.clientX, e.clientY);
              }
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheelZoom}
            style={{
              cursor: isPanning ? 'grabbing' : 
                      selectedTool === 'select' ? 'grab' : 
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

            {/* Empty state guidance — only shown when canvas has no elements */}
            {elements.length === 0 && (
              <g style={{ pointerEvents: 'none' }}>
                <text
                  x="50%"
                  y="44%"
                  textAnchor="middle"
                  fill="#3e3e42"
                  fontSize="48"
                  fontWeight="bold"
                >
                  ✦
                </text>
                <text
                  x="50%"
                  y="51%"
                  textAnchor="middle"
                  fill="#5a5a5f"
                  fontSize="16"
                  fontWeight="500"
                >
                  Your canvas is empty
                </text>
                <text
                  x="50%"
                  y="56%"
                  textAnchor="middle"
                  fill="#3e3e42"
                  fontSize="13"
                >
                  Click a tool in the palette above to add your first element
                </text>
                <text
                  x="50%"
                  y="60%"
                  textAnchor="middle"
                  fill="#3e3e42"
                  fontSize="12"
                >
                  Tip: Use Ctrl+Z to undo, Ctrl+D to duplicate, Delete to remove
                </text>
              </g>
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
                {/* Sequence diagram arrow markers */}
                <marker id="seq-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#e0a030" />
                </marker>
                <marker id="seq-return" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#888888" />
                </marker>
              </defs>

              {/* ── Sequence Diagram Layer: stems, activation boxes, ordered arrows ── */}
              {selectedDiagram === 'sequence' && (() => {
                const lifelines = elements.filter(e => e.type === 'lifeline' || e.type === 'actor');
                if (lifelines.length === 0) return null;
                const HEADER_H = 60;
                const HEADER_W = 150;
                const MSG_START_Y = 200;
                const MSG_GAP = 60;
                const STEM_EXTRA = 80;
                const ACT_W = 14;
                const ACT_HALF = ACT_W / 2;
                const seqConns = connections.filter(c => {
                  const f = elements.find(e => e.id === c.from);
                  const t = elements.find(e => e.id === c.to);
                  return f && t && (f.type === 'lifeline' || f.type === 'actor') && (t.type === 'lifeline' || t.type === 'actor');
                });
                const totalMsgs = seqConns.length;
                const stemBottom = MSG_START_Y + totalMsgs * MSG_GAP + STEM_EXTRA;
                const centreX = {};
                lifelines.forEach(ll => { centreX[ll.id] = ll.x + (ll.width || HEADER_W) / 2; });
                const activeIds = new Set();
                seqConns.forEach(c => { activeIds.add(c.from); activeIds.add(c.to); });
                const activationRange = {};
                seqConns.forEach((c, i) => {
                  const y = MSG_START_Y + i * MSG_GAP;
                  [c.from, c.to].forEach(id => {
                    if (!activationRange[id]) activationRange[id] = { min: y, max: y };
                    else { activationRange[id].min = Math.min(activationRange[id].min, y); activationRange[id].max = Math.max(activationRange[id].max, y); }
                  });
                });
                return (
                  <g key="seq-layer">
                    {lifelines.map(ll => {
                      const cx = centreX[ll.id] || (ll.x + HEADER_W / 2);
                      return (
                        <line key={"stem-" + ll.id}
                          x1={cx} y1={ll.y + HEADER_H} x2={cx} y2={stemBottom}
                          stroke="#4a6080" strokeWidth="1.5" strokeDasharray="6,4" />
                      );
                    })}
                    {lifelines.map(ll => {
                      if (!activeIds.has(ll.id)) return null;
                      const cx = centreX[ll.id] || (ll.x + HEADER_W / 2);
                      const rng = activationRange[ll.id];
                      if (!rng) return null;
                      return (
                        <rect key={"act-" + ll.id}
                          x={cx - ACT_HALF} y={rng.min - 10}
                          width={ACT_W} height={(rng.max - rng.min) + 20}
                          fill="#e0a030" fillOpacity="0.85" stroke="#c07010" strokeWidth="1" rx="2" />
                      );
                    })}
                    {seqConns.map((conn, i) => {
                      const fromEl = elements.find(e => e.id === conn.from);
                      const toEl   = elements.find(e => e.id === conn.to);
                      if (!fromEl || !toEl) return null;
                      const isReturn   = conn.type === 'return';
                      const arrowY     = MSG_START_Y + i * MSG_GAP;
                      const x1         = centreX[conn.from] || (fromEl.x + fromEl.width / 2);
                      const x2         = centreX[conn.to]   || (toEl.x   + toEl.width   / 2);
                      const isSelected = selectedConnection && selectedConnection.id === conn.id;
                      const xDir = x2 > x1 ? 1 : -1;
                      const ax1  = x1 + xDir * ACT_HALF;
                      const ax2  = x2 - xDir * ACT_HALF;
                      const stroke    = isReturn ? '#888888' : (isSelected ? '#007acc' : '#e0e0e0');
                      const dashArray = isReturn ? '6,4' : 'none';
                      const markerEnd = isReturn ? 'url(#seq-return)' : 'url(#seq-arrow)';
                      return (
                        <g key={conn.id}>
                          <line x1={ax1} y1={arrowY} x2={ax2} y2={arrowY}
                            stroke={stroke} strokeWidth={isSelected ? 3 : 1.5}
                            strokeDasharray={dashArray} markerEnd={markerEnd}
                            onClick={(e) => { e.stopPropagation(); setSelectedConnection(conn); setSelectedElements([]); }}
                            style={{ cursor: 'pointer' }} />
                          <line x1={ax1} y1={arrowY} x2={ax2} y2={arrowY}
                            stroke="transparent" strokeWidth="12"
                            onClick={(e) => { e.stopPropagation(); setSelectedConnection(conn); setSelectedElements([]); }}
                            style={{ cursor: 'pointer' }} />
                          <text x={(ax1 + ax2) / 2} y={arrowY - 8}
                            fill={isReturn ? '#888888' : '#e0e0e0'} fontSize="11" textAnchor="middle"
                            fontStyle={isReturn ? 'italic' : 'normal'}>
                            {conn.label}
                          </text>
                          <text x={Math.min(ax1, ax2) + 8} y={arrowY - 8}
                            fill="#607090" fontSize="9" textAnchor="start">
                            {i + 1}.
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

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
              {/* Fix #11: Live connection preview line follows the mouse cursor */}
              {connectionStart && (
                (() => {
                  const startEl = elements.find(el => el.id === connectionStart);
                  if (startEl) {
                    return (
                      <line
                        x1={startEl.x + startEl.width / 2}
                        y1={startEl.y + startEl.height / 2}
                        x2={mousePos.x}
                        y2={mousePos.y}
                        stroke="#007acc"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                        pointerEvents="none"
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
                  onDoubleClick={(e) => handleDoubleClick(e, element)}
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

                  {/* Enum Element */}
                  {element.type === 'enum' && (
                    <>
                      <rect
                        x={element.x} y={element.y}
                        width={element.width} height={element.height}
                        fill="#2d2d30"
                        stroke={selectedElements.some(el => el.id === element.id) ? '#007acc' : '#3e3e42'}
                        strokeWidth={selectedElements.some(el => el.id === element.id) ? 2 : 1}
                        rx="4"
                      />
                      <text x={element.x + element.width / 2} y={element.y + 16}
                        fill="#888" fontSize="10" textAnchor="middle" fontStyle="italic">
                        «enum»
                      </text>
                      <line x1={element.x} y1={element.y + 28} x2={element.x + element.width} y2={element.y + 28} stroke="#3e3e42" />
                      <text x={element.x + element.width / 2} y={element.y + 44}
                        fill="white" fontSize="14" fontWeight="bold" textAnchor="middle">
                        {element.name}
                      </text>
                      {(element.attributes || []).length > 0 && (
                        <line x1={element.x} y1={element.y + 54} x2={element.x + element.width} y2={element.y + 54} stroke="#3e3e42" />
                      )}
                      {(element.attributes || []).map((val, idx) => (
                        <text key={`enum-val-${idx}`}
                          x={element.x + 10} y={element.y + 70 + idx * 18}
                          fill="#cccccc" fontSize="11" fontFamily="monospace">
                          {val.name}
                        </text>
                      ))}
                    </>
                  )}

                  {/* Sequence Diagram: Lifeline header box (stem + activation rendered in seq-layer above) */}
                  {element.type === 'lifeline' && (() => {
                    const isSelected = selectedElements.some(el => el.id === element.id);
                    const cx = element.x + (element.width || 150) / 2;
                    const BOX_W = element.width || 150;
                    const BOX_H = 60;
                    return (
                      <>
                        {/* Header box */}
                        <rect
                          x={element.x} y={element.y}
                          width={BOX_W} height={BOX_H}
                          fill="#1a3a5c"
                          stroke={isSelected ? '#007acc' : '#2a5a8c'}
                          strokeWidth={isSelected ? 2 : 1.5}
                          rx="4"
                        />
                        {/* Name label — word-wrapped via two lines if needed */}
                        <text x={cx} y={element.y + BOX_H / 2 - 2}
                          fill="white" fontSize="13" fontWeight="bold"
                          textAnchor="middle" dominantBaseline="middle">
                          {element.name}
                        </text>
                      </>
                    );
                  })()}

                  {/* Generic Rectangle for other types */}
                  {!['class', 'interface', 'abstract', 'enum', 'object', 'component', 'package', 'usecase', 'actor', 'lifeline'].includes(element.type) && (
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

                  {/* Fix #14: Resize handles for ALL element types */}
                  {selectedElements.some(el => el.id === element.id) && selectedElements.length === 1 && (
                    <>
                      {[
                        { pos: 'nw', x: element.x - 4,                      y: element.y - 4,                       cursor: 'nw-resize' },
                        { pos: 'ne', x: element.x + element.width - 4,       y: element.y - 4,                       cursor: 'ne-resize' },
                        { pos: 'sw', x: element.x - 4,                      y: element.y + element.height - 4,       cursor: 'sw-resize' },
                        { pos: 'se', x: element.x + element.width - 4,       y: element.y + element.height - 4,      cursor: 'se-resize' },
                        { pos: 'n',  x: element.x + element.width / 2 - 4,   y: element.y - 4,                       cursor: 'n-resize'  },
                        { pos: 's',  x: element.x + element.width / 2 - 4,   y: element.y + element.height - 4,      cursor: 's-resize'  },
                        { pos: 'w',  x: element.x - 4,                      y: element.y + element.height / 2 - 4,  cursor: 'w-resize'  },
                        { pos: 'e',  x: element.x + element.width - 4,       y: element.y + element.height / 2 - 4, cursor: 'e-resize'  },
                      ].map(h => (
                        <rect
                          key={h.pos}
                          x={h.x} y={h.y}
                          width="8" height="8"
                          fill="#007acc" stroke="#ffffff" strokeWidth="1"
                          style={{ cursor: h.cursor }}
                          onMouseDown={(e) => handleResizeStart(e, element, h.pos)}
                        />
                      ))}
                    </>
                  )}
                  {/* Fix #19: Inline rename overlay — shown on double-click */}
                  {inlineEditId === element.id && (
                    <foreignObject
                      x={element.x + element.width / 2 - 80}
                      y={element.y + (element.stereotype ? 28 : 18)}
                      width="160"
                      height="30"
                    >
                      <input
                        ref={inlineInputRef}
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onBlur={commitInlineRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitInlineRename();
                          if (e.key === 'Escape') { setInlineEditId(null); setInlineEditValue(''); }
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          background: '#1e1e1e',
                          color: 'white',
                          border: '2px solid #007acc',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          outline: 'none',
                          padding: '2px 6px',
                        }}
                      />
                    </foreignObject>
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
        saveToHistory={saveToHistory}
        onCopySuccess={(msg, type = 'success') => showToast(msg, type)}
        onCodeEdit={(importedElements, importedConnections, options = {}) => {
          const currentEls   = elementsRef.current;
          const currentConns = connectionsRef.current;

          let mergedElements    = importedElements;
          let mergedConnections = importedConnections;

          if (options.diagramType && options.diagramType !== selectedDiagram) {
            setSelectedDiagram(options.diagramType);
          }

          // ── SEQUENCE DIAGRAM LIVE SYNC ─────────────────────────────────
          if (options.replaceAll && selectedDiagram === 'sequence') {
            if (options.fromCodeUndo) {
              setElements(importedElements);
              setConnections(importedConnections);
              return;
            }
            saveToHistory(currentEls, currentConns);
            setElements(importedElements);
            setConnections(importedConnections);
            return;
          }

          // ── CLASS DIAGRAM LIVE SYNC ────────────────────────────────────
          if (options.replaceAll && selectedDiagram === 'class') {
            if (options.fromCodeUndo) {
              setElements(importedElements);
              setConnections(importedConnections);
              return;
            }
            saveToHistory(currentEls, currentConns);
            setElements(importedElements);
            setConnections(importedConnections);
            return;
          }

          // ── USE-CASE LIVE SYNC: position-preserving merge ──────────────────
          // For use-case diagrams with replaceAll, the converter re-parses the
          // entire code file and returns the correct set of elements+connections.
          // Instead of blindly replacing everything, we:
          //   1. Keep ALL existing canvas elements exactly where they are (positions
          //      preserved — actors, use cases, system boundaries).
          //   2. Add any NEW elements the code introduced (new actors/use cases).
          //   3. Replace connections entirely with what the code says — this is the
          //      surgical part: a deleted method removes its arrow, an added method
          //      adds its arrow, nothing else changes.
          // This makes the bidirectional sync behave exactly as expected:
          // delete a method → only that connection disappears.
          // Ctrl+Z in code → connection reappears. Diagram layout never moves.
          if (options.replaceAll && selectedDiagram === 'usecase') {
            // Build a name→element map of what the canvas currently has
            const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const currentByName = new Map(currentEls.map(el => [norm(el.name), el]));

            const idMap = new Map();

            // For each element the converter produced, reuse the existing canvas
            // node if one with the same name exists (keeps id + position), otherwise
            // accept the new node (it's genuinely new). Track imported->final IDs
            // so regenerated connections still point at the preserved canvas nodes.
            mergedElements = importedElements.map(imported => {
              const existing = currentByName.get(norm(imported.name));
              const finalElement = existing ? { ...existing } : imported;
              idMap.set(imported.id, finalElement.id);
              return finalElement;
            });

            // Connections come entirely from the code parse, but their endpoints
            // may still reference freshly-parsed IDs. Rewrite them to the final
            // preserved element IDs so use-case live sync stays bidirectional.
            mergedConnections = importedConnections.map(conn => ({
              ...conn,
              from: idMap.get(conn.from) || conn.from,
              to: idMap.get(conn.to) || conn.to,
              source: idMap.get(conn.source) || conn.source,
              target: idMap.get(conn.target) || conn.target,
            }));

            if (options.fromCodeUndo) {
              setElements(mergedElements);
              setConnections(mergedConnections);
              return;
            }
            saveToHistory(currentEls, currentConns);
            setElements(mergedElements);
            setConnections(mergedConnections);
            return;
          }

          // ── ALL OTHER CASES (class diagram live sync, manual imports) ───────
          if (!options.replaceAll && (currentEls.length > 0 || currentConns.length > 0)) {
            const maxX = Math.max(...currentEls.map(e => e.x + e.width), 0);
            mergedElements = [
              ...currentEls,
              ...importedElements.map(el => ({ ...el, x: el.x + maxX + 100 }))
            ];
            mergedConnections = [...currentConns, ...importedConnections];
          }

          if (options.fromCodeUndo) {
            setElements(mergedElements);
            setConnections(mergedConnections);
            return;
          }

          if (options.replaceAll) {
            saveToHistory(currentEls, currentConns);
          } else {
            saveToHistory(currentEls, currentConns);
            saveToHistory(mergedElements, mergedConnections);
          }
          setElements(mergedElements);
          setConnections(mergedConnections);
        }}
        selectedDiagram={selectedDiagram}
        language={language}
        generatedCode={generatedCode}
        generatedFiles={generatedFiles}
        selectedFileIndex={selectedFileIndex}
        setSelectedFileIndex={setSelectedFileIndex}
        panelWidth={panelWidth}
        setPanelWidth={setPanelWidth}
      />

      {/* Validation Panel — inline error display */}
      {showValidationPanel && validationResult && (
        <ValidationPanel
          validationResult={validationResult}
          onClose={() => setShowValidationPanel(false)}
        />
      )}

      {/* Code Import Modal */}
      {showCodeImportModal && (
        <CodeImportModal
          onImport={handleImportCode}
          onClose={() => setShowCodeImportModal(false)}
          diagramType={selectedDiagram}
        />
      )}

      {/* Fix #12: Toast notifications replace all alert() calls */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default UMLEditor;
