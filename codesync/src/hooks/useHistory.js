/**
 * ============================================================
 * useHistory.js — Undo / Redo History Hook
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Gives the editor a full undo/redo system. Every time you add a
 * class, move an element, or draw a connection, a snapshot is saved.
 * Pressing Ctrl+Z steps back through those snapshots one at a time.
 * Ctrl+Y (or Ctrl+Shift+Z) steps forward again.
 *
 * TECHNICAL OVERVIEW:
 * Classic stack-based undo implemented with two parallel arrays:
 *   past[]   — snapshots already applied (undo pops from here)
 *   future[] — snapshots undone (redo pops from here)
 * Each snapshot is { elements, connections }.
 *
 * Fix #15: The hook now accepts initialElements and initialConnections
 * so the very first state is seeded into past[]. This means Ctrl+Z
 * on the first action returns to the initial canvas state rather than
 * an empty canvas.
 *
 * Five public values returned:
 *   saveToHistory(elements, connections) — push a new snapshot
 *   undo(setElements, setConnections)    — restore previous snapshot
 *   redo(setElements, setConnections)    — restore next snapshot
 *   resetHistory(elements, connections)  — wipe stack, seed new baseline
 *   canUndo  — boolean, true when past has entries
 *   canRedo  — boolean, true when future has entries
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Consumed by UMLEditor.jsx.
 * - saveToHistory() is called after every meaningful state change.
 * - undo/redo are wired to Ctrl+Z / Ctrl+Y keyboard shortcuts.
 * - resetHistory() is called after handleImport() and handleNew().
 * ============================================================
 */

import { useState, useCallback } from 'react';

/**
 * useHistory(initialElements, initialConnections)
 * ------------------------------------------------
 * LAYMAN'S: The hook itself. Call it once at the top of UMLEditor.
 *   Pass in the starting elements and connections so the very first
 *   undo step has somewhere to go.
 * TECHNICAL: Fix #15 — seeds past with the initial state snapshot so
 *   undoing the first action doesn't land on an empty canvas.
 *
 * @param {Array} initialElements    - Starting elements (default [])
 * @param {Array} initialConnections - Starting connections (default [])
 */
const useHistory = (initialElements = [], initialConnections = []) => {

  /**
   * past / future stacks
   * LAYMAN'S: past is a list of "breadcrumbs" behind you; future is the
   *   list of breadcrumbs you've stepped back through (for redo).
   * TECHNICAL: Fix #15 — past is seeded with the initial snapshot instead
   *   of starting empty. Each entry: { elements: [...], connections: [...] }.
   */
  const [past, setPast] = useState(
    initialElements.length > 0 || initialConnections.length > 0
      ? [{ elements: initialElements, connections: initialConnections }]
      : []
  );
  const [future, setFuture] = useState([]);

  /**
   * saveToHistory(elements, connections)
   * LAYMAN'S: Takes a snapshot of the current diagram state and saves it
   *   to the undo stack. Any redo history is discarded — once you make a
   *   new change after undoing, the "future" is gone.
   * TECHNICAL: Pushes snapshot onto past, clears future.
   *   Capped at 100 entries to avoid unbounded memory growth.
   */
  const saveToHistory = useCallback((elements, connections) => {
    setPast(prev => {
      const next = [...prev, { elements: [...elements], connections: [...connections] }];
      // Cap stack at 100 snapshots
      return next.length > 100 ? next.slice(next.length - 100) : next;
    });
    setFuture([]);
  }, []);

  /**
   * undo(setElements, setConnections)
   * LAYMAN'S: Steps back one snapshot. The current state becomes the top
   *   of the redo stack, and the previous state is restored.
   * TECHNICAL: Pops the last entry from past, applies it, pushes the
   *   current top (now second-to-last) onto future. Requires setElements
   *   and setConnections from UMLEditor to actually update the canvas.
   *   No-op when past has 0 or 1 entries (nothing to undo to).
   */
  const undo = useCallback((setElements, setConnections) => {
    setPast(prev => {
      if (prev.length <= 1) return prev; // Nothing to undo
      const newPast   = prev.slice(0, prev.length - 1);
      const snapshot  = newPast[newPast.length - 1] || { elements: [], connections: [] };
      setElements([...snapshot.elements]);
      setConnections([...snapshot.connections]);
      setFuture(f => [prev[prev.length - 1], ...f]);
      return newPast;
    });
  }, []);

  /**
   * redo(setElements, setConnections)
   * LAYMAN'S: Steps forward one snapshot (re-applies a change that was undone).
   * TECHNICAL: Pops from future, applies it, pushes it back onto past.
   *   No-op when future is empty.
   */
  const redo = useCallback((setElements, setConnections) => {
    setFuture(prev => {
      if (prev.length === 0) return prev; // Nothing to redo
      const [next, ...remaining] = prev;
      setElements([...next.elements]);
      setConnections([...next.connections]);
      setPast(p => [...p, next]);
      return remaining;
    });
  }, []);

  /**
   * resetHistory(elements, connections)
   * LAYMAN'S: Wipes the entire undo/redo history and starts fresh with the
   *   given state as the new baseline. Called after loading a file or
   *   creating a new diagram so the user can't undo back to the old content.
   * TECHNICAL: Replaces past with a single seed snapshot, clears future.
   */
  const resetHistory = useCallback((elements = [], connections = []) => {
    setPast([{ elements: [...elements], connections: [...connections] }]);
    setFuture([]);
  }, []);

  return {
    saveToHistory,
    undo,
    redo,
    resetHistory,
    canUndo: past.length > 1,
    canRedo: future.length > 0,
  };
};

export { useHistory };