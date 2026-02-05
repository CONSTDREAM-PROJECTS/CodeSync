import React from 'react';

const DiagramSidebar = ({ diagramTypes, selectedDiagram, onDiagramSelect }) => {
  return (
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
            onClick={() => onDiagramSelect(diagram.id)}
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
            onClick={() => onDiagramSelect(diagram.id)}
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
  );
};

export default DiagramSidebar;