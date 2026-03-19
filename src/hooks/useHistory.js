/**
 * ============================================================
 * useHistory.js — Undo/Redo History Hook
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Think of this as the "Ctrl+Z / Ctrl+Y" engine for the diagram
 * editor. Every time the user makes a change — adding a class,
 * moving an element, deleting a connection — this hook saves a
 * snapshot. Pressing Undo steps back to the previous snapshot;
 * Redo steps forward again. It works exactly like the undo
 * history in any document editor, just applied to diagram data.
 *
 * TECHNICAL OVERVIEW:
 * A React custom hook that maintains a linear history stack using
 * a JavaScript array and a cursor index:
 *   - history[]:       Array of { elements, connections } snapshots.
 *   - historyIndex:    Integer pointing to the "current" snapshot.
 *   - saveToHistory(): Slices off any future (redo) entries and appends
 *                      a deep-cloned new snapshot at the cursor.
 *   - undo():          Decrements historyIndex and returns the snapshot.
 *   - redo():          Increments historyIndex and returns the snapshot.
 *   - resetHistory():  Wipes the stack and restarts from a given state.
 *
 * Deep cloning (JSON.parse/JSON.stringify) is used throughout to ensure
 * snapshots are fully independent — mutating the current diagram never
 * corrupts a saved history entry.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - UMLEditor.jsx calls saveToHistory() after every user action that
 *   modifies elements or connections.
 * - UMLEditor.jsx also wires keyboard shortcuts (Ctrl+Z/Y) and the
 *   toolbar Undo/Redo buttons directly to undo() and redo().
 * - canUndo / canRedo booleans are passed to DiagramToolbar.jsx to
 *   disable the buttons when there is nothing to undo/redo.
 * ============================================================
 */

import { useState } from 'react';

/**
 * useHistory(initialElements, initialConnections)
 * -------------------------------------------------
 * LAYMAN'S: The main export. Call this once inside UMLEditor to get
 * back all the undo/redo functions and the canUndo/canRedo flags.
 *
 * TECHNICAL: Seeds the history array with one initial snapshot built
 * from the optional arguments. Returns five values: saveToHistory,
 * undo, redo, resetHistory, canUndo, canRedo.
 *
 * @param {Array} initialElements   - Starting element array (default: [])
 * @param {Array} initialConnections - Starting connection array (default: [])
 */
export const useHistory = (initialElements = [], initialConnections = []) => {
  /**
   * history / historyIndex
   * LAYMAN'S: The history array is like a stack of "save states" from a
   *   video game. historyIndex is a bookmark pointing to whichever save
   *   state is currently active.
   * TECHNICAL: history is an array of deep-cloned {elements, connections}
   *   pairs. historyIndex starts at 0 (the initial state) and moves
   *   within [0, history.length - 1].
   */
  const [history, setHistory] = useState([{ elements: initialElements, connections: initialConnections }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  /**
   * saveToHistory(newElements, newConnections)
   * LAYMAN'S: Takes a snapshot of the current diagram state and adds it
   *   to the undo stack. Any "future" states (from previous undos) are
   *   discarded — just like in any text editor.
   * TECHNICAL: Slices history up to (and including) historyIndex to
   *   remove any redo tail, deep-clones the new state with
   *   JSON.parse/stringify, and appends it. Updates historyIndex to
   *   point to the new tip of the stack.
   */
  const saveToHistory = (newElements, newConnections) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      elements: JSON.parse(JSON.stringify(newElements)),
      connections: JSON.parse(JSON.stringify(newConnections))
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  /**
   * undo()
   * LAYMAN'S: Steps back one change. Returns the previous diagram state
   *   so the caller can restore elements and connections. Returns null
   *   if already at the beginning of history.
   * TECHNICAL: Decrements historyIndex (guarded by > 0) and returns a
   *   deep-clone of history[newIndex] so the caller receives independent
   *   copies that won't be affected by future mutations.
   */
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      return {
        elements: JSON.parse(JSON.stringify(history[newIndex].elements)),
        connections: JSON.parse(JSON.stringify(history[newIndex].connections))
      };
    }
    return null;
  };

  /**
   * redo()
   * LAYMAN'S: Steps forward one change (only available after an undo).
   *   Returns the next diagram state, or null if already at the latest
   *   point in history.
   * TECHNICAL: Increments historyIndex (guarded by < history.length - 1)
   *   and returns a deep-clone of history[newIndex].
   */
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      return {
        elements: JSON.parse(JSON.stringify(history[newIndex].elements)),
        connections: JSON.parse(JSON.stringify(history[newIndex].connections))
      };
    }
    return null;
  };

  /**
   * resetHistory(elements, connections)
   * LAYMAN'S: Wipes the entire undo/redo history and starts fresh from
   *   the provided state. Used when the user loads a file or clears the
   *   canvas — you don't want to be able to undo back to the old diagram.
   * TECHNICAL: Replaces the history array with a single-entry array
   *   containing a deep-clone of the provided state and resets
   *   historyIndex to 0.
   */
  const resetHistory = (elements = [], connections = []) => {
    setHistory([{ elements: JSON.parse(JSON.stringify(elements)), connections: JSON.parse(JSON.stringify(connections)) }]);
    setHistoryIndex(0);
  };

  return {
    saveToHistory,
    undo,
    redo,
    resetHistory,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
};