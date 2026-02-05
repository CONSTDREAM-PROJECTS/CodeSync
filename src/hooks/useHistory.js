import { useState } from 'react';

export const useHistory = (initialElements = [], initialConnections = []) => {
  const [history, setHistory] = useState([{ elements: initialElements, connections: initialConnections }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveToHistory = (newElements, newConnections) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      elements: JSON.parse(JSON.stringify(newElements)),
      connections: JSON.parse(JSON.stringify(newConnections))
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

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