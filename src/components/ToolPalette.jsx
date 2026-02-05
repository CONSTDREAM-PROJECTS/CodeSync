import React from 'react';

const ToolPalette = ({ toolbarItems, selectedTool, onToolSelect, onElementAdd }) => {
  return (
    <div className="bg-[#2d2d30] border-b border-[#3e3e42] p-2 flex items-center space-x-1 overflow-x-auto">
      {toolbarItems.map(item => (
        <button
          key={item.id}
          onClick={() => {
            if (item.id === 'select' || item.id === 'delete') {
              onToolSelect(item.id);
            } else {
              onElementAdd(item.id);
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
  );
};

export default ToolPalette;