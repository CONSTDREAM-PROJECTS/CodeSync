/**
 * ============================================================
 * useCanvasInteractions.js — Canvas Interaction Hook
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Think of this as the "mouse and camera controller" for the
 * diagram editor. Any time the user drags an element, pans the
 * canvas, zooms in or out, or needs to know where their mouse
 * click landed in diagram coordinates — this hook handles it.
 * It keeps all the movement logic in one place so the main
 * editor component (UMLEditor.jsx) stays focused on diagram
 * logic rather than pixel math.
 *
 * TECHNICAL OVERVIEW:
 * A React custom hook (useCanvasInteractions) that encapsulates
 * five groups of canvas interaction state and behaviour:
 *   1. Drag state      — tracks whether an element is being dragged
 *                        and computes its new position on each mouse move.
 *   2. Pan state       — tracks middle-mouse or Shift+drag panning of
 *                        the entire canvas viewport.
 *   3. Zoom state      — bounded zoom level (0.5×–2×) with step controls.
 *   4. Grid toggle     — boolean flag for grid overlay visibility.
 *   5. Coordinate math — getCanvasCoordinates() converts browser-space
 *                        (clientX/Y) to diagram-space accounting for
 *                        pan offset and zoom.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - UMLEditor.jsx calls this hook and spreads its return values across
 *   mouse event handlers (handleMouseDown, handleMouseMove, handleMouseUp)
 *   and toolbar controls (zoom buttons, grid toggle).
 * - DiagramToolbar.jsx receives zoom and showGrid as props sourced from
 *   this hook's return values.
 * ============================================================
 */

import { useState, useRef, useCallback } from 'react';

/**
 * useCanvasInteractions()
 * ------------------------
 * LAYMAN'S: The main (and only) export. Call this at the top of a component
 * to get back everything you need to handle dragging, panning, zooming,
 * grid toggle, and coordinate conversion — without writing any of the math
 * yourself.
 *
 * TECHNICAL: Initializes all interaction state with useState/useRef and
 * returns memoized callbacks (useCallback) so consumers only re-render
 * when the relevant piece of state actually changes.
 *
 * RELATIONSHIP: Consumed exclusively by UMLEditor.jsx. All returned
 * functions are wired to SVG mouse events inside that component.
 */
export const useCanvasInteractions = () => {
  // ── Drag state ────────────────────────────────────────────
  // isDragging: true while an element is being moved by the user.
  // dragStartPos: ref stores the offset from the element's origin to the
  //   mouse-press point — prevents the element from "snapping" to the
  //   cursor tip at the start of a drag.
  const [isDragging, setIsDragging] = useState(false);

  // ── Pan state ─────────────────────────────────────────────
  // isPanning: true while the user is panning the canvas viewport.
  // panOffset: accumulated {x, y} translation applied to the SVG <g>
  //   wrapper that contains all diagram elements.
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // ── Zoom / grid state ─────────────────────────────────────
  // zoom: current scale factor (1 = 100%). Clamped to [0.5, 2].
  // showGrid: controls whether the dot-grid overlay renders.
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);

  // canvasRef: attached to the SVG element so coordinate math can read
  //   its bounding rect without querying the DOM on every mouse event.
  const canvasRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  /**
   * handleZoomIn / handleZoomOut
   * LAYMAN'S: Zoom the canvas in or out one step at a time from the toolbar buttons.
   *   Centers zoom on the middle of the canvas viewport.
   * TECHNICAL: Adjusts panOffset so the canvas center stays fixed during zoom.
   */
  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const next = Math.min(prev + 0.1, 2);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        setPanOffset(p => ({
          x: cx - (cx - p.x) * (next / prev),
          y: cy - (cy - p.y) * (next / prev),
        }));
      }
      return next;
    });
  }, [canvasRef]);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(prev - 0.1, 0.5);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        setPanOffset(p => ({
          x: cx - (cx - p.x) * (next / prev),
          y: cy - (cy - p.y) * (next / prev),
        }));
      }
      return next;
    });
  }, [canvasRef]);

  /**
   * handleWheelZoom(e)
   * LAYMAN'S: Zoom with the scroll wheel, centered exactly on the mouse cursor —
   *   just like Google Maps. Scrolling up zooms in, down zooms out.
   * TECHNICAL: Computes the cursor position in diagram-space, adjusts panOffset
   *   so that point stays fixed under the cursor as zoom changes.
   */
  const handleWheelZoom = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => {
      const next = Math.min(2, Math.max(0.5, prev + delta));
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setPanOffset(p => ({
        x: mx - (mx - p.x) * (next / prev),
        y: my - (my - p.y) * (next / prev),
      }));
      return next;
    });
  }, [canvasRef]);

  /**
   * toggleGrid
   * LAYMAN'S: Flips the background grid on or off.
   * TECHNICAL: Simple boolean toggle via functional setState.
   *   No deps — updater receives previous value directly.
   */
  const toggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);

  /**
   * startPanning(clientX, clientY)
   * LAYMAN'S: Called when the user starts dragging the canvas background
   *   (middle-mouse or Shift+drag). Records where the pan started so
   *   subsequent mouse moves can calculate how far to shift the view.
   * TECHNICAL: Stores the "anchor" in dragStartPos by subtracting the
   *   current panOffset, so updatePan() can recover the new offset with
   *   simple subtraction on every mousemove.
   */
  const startPanning = useCallback((clientX, clientY) => {
    setIsPanning(true);
    dragStartPos.current = { x: clientX - panOffset.x, y: clientY - panOffset.y };
  }, [panOffset]);

  /**
   * updatePan(clientX, clientY)
   * LAYMAN'S: Called on every mouse-move while panning. Shifts the
   *   canvas in the direction the user is dragging.
   * TECHNICAL: Recovers new panOffset by subtracting the stored anchor
   *   from current clientX/Y. Guard on isPanning prevents accidental
   *   canvas shifts during element drags.
   */
  const updatePan = useCallback((clientX, clientY) => {
    if (isPanning) {
      setPanOffset({
        x: clientX - dragStartPos.current.x,
        y: clientY - dragStartPos.current.y
      });
    }
  }, [isPanning]);

  /**
   * stopPanning
   * LAYMAN'S: Called on mouseup — tells the system the user is done
   *   panning the canvas.
   * TECHNICAL: Resets isPanning to false. Downstream, this causes
   *   updatePan() to no-op on any stray mousemove events.
   */
  const stopPanning = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * startDragging(element, clientX, clientY)
   * LAYMAN'S: Called when the user starts dragging a diagram element.
   *   Records the offset between the element's top-left corner and the
   *   mouse pointer so the element doesn't "jump" to center on the cursor.
   * TECHNICAL: Converts clientX/Y to diagram-space (accounting for
   *   panOffset and zoom) then subtracts element.x/y to get the
   *   intra-element click offset, stored in dragStartPos ref.
   */
  const startDragging = useCallback((element, clientX, clientY) => {
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartPos.current = {
        x: (clientX - rect.left - panOffset.x) / zoom - element.x,
        y: (clientY - rect.top - panOffset.y) / zoom - element.y
      };
    }
  }, [panOffset, zoom]);

  /**
   * updateDrag(selectedElement, clientX, clientY)
   * LAYMAN'S: Called on every mousemove while dragging an element.
   *   Returns the new {x, y} position for the element, or null if
   *   no drag is active.
   * TECHNICAL: Converts current clientX/Y to diagram-space and
   *   subtracts the stored intra-element offset to compute the
   *   element's new top-left corner. Returns null (not a position
   *   update) if isDragging is false or no element is selected.
   */
  const updateDrag = useCallback((selectedElement, clientX, clientY) => {
    if (isDragging && selectedElement) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = (clientX - rect.left - panOffset.x) / zoom - dragStartPos.current.x;
        const newY = (clientY - rect.top - panOffset.y) / zoom - dragStartPos.current.y;
        return { x: newX, y: newY };
      }
    }
    return null;
  }, [isDragging, panOffset, zoom]);

  /**
   * stopDragging
   * LAYMAN'S: Called on mouseup — signals that the element drag is done.
   * TECHNICAL: Resets isDragging to false. UMLEditor.jsx listens for
   *   this transition to commit the final position to history.
   */
  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * getCanvasCoordinates(clientX, clientY)
   * LAYMAN'S: Converts a raw browser mouse position into the matching
   *   position inside the diagram, taking zoom and pan into account.
   *   Used for click-to-add-element and connection hit-testing.
   * TECHNICAL: Reads the SVG bounding rect (via canvasRef), subtracts
   *   the element's page offset and panOffset, then divides by zoom.
   *   Returns {x:0, y:0} as a safe fallback if the ref isn't mounted.
   */
  const getCanvasCoordinates = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      return {
        x: (clientX - rect.left - panOffset.x) / zoom,
        y: (clientY - rect.top - panOffset.y) / zoom
      };
    }
    return { x: 0, y: 0 };
  }, [panOffset, zoom]);

  return {
    // State
    isDragging,
    isPanning,
    panOffset,
    setPanOffset,
    zoom,
    showGrid,
    canvasRef,

    // Actions
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
  };
};