import { useState, useRef, useCallback } from 'react';

export const useCanvasInteractions = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);

  const canvasRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const toggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);

  const startPanning = useCallback((clientX, clientY) => {
    setIsPanning(true);
    dragStartPos.current = { x: clientX - panOffset.x, y: clientY - panOffset.y };
  }, [panOffset]);

  const updatePan = useCallback((clientX, clientY) => {
    if (isPanning) {
      setPanOffset({
        x: clientX - dragStartPos.current.x,
        y: clientY - dragStartPos.current.y
      });
    }
  }, [isPanning]);

  const stopPanning = useCallback(() => {
    setIsPanning(false);
  }, []);

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

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

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
    zoom,
    showGrid,
    canvasRef,

    // Actions
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
  };
};