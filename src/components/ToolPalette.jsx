/**
 * ============================================================
 * ToolPalette.jsx — Diagram Tool Palette Bar
 * ============================================================
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const TOOL_DESCRIPTIONS = {
  select:         'Select and move canvas elements.',
  delete:         'Remove an element or connection.',
  class:          'Add a class with attributes and methods.',
  interface:      'Add an interface with required methods.',
  abstract:       'Add an abstract class to be extended.',
  enum:           'Add an enum of fixed named constants.',
  association:    'General link. A references or uses B.',
  inheritance:    'Child class extends the parent class.',
  realization:    'Class implements an interface contract.',
  aggregation:    'Has-a link. Parts exist without the whole.',
  composition:    'Strong has-a. Parts need the whole to exist.',
  dependency:     'Temporary use, such as a method parameter.',
  actor:          'Add a person or system that interacts.',
  usecase:        'Add a use case the system performs.',
  systemboundary: 'Box showing inside vs outside the system.',
  include:        'UC always triggers another UC.',
  extend:         'Optional flow that may occur in a UC.',
  generalization: 'One actor or UC specialises another.',
  lifeline:       'Add a named participant in the sequence.',
  activationbar:  'Shows when a participant is active.',
  message:        'Synchronous call. Sender waits for response.',
  return:         'Response sent back to the caller.',
  selfcall:       'A participant calling its own method.',
  package:        'Add a system boundary. Groups use cases inside the system.',
  connector:      'Async message. Sender does not wait for a response.',
  object:         'Add an object instance on the canvas.',
  link:           'Draw a link between two objects.',
  component:      'Add a component representing a system module.',
  import:         'Draw an import dependency between packages.',
};

/**
 * PortalTooltip — receives pre-computed fixed coords, renders via portal onto body.
 * Now with improved positioning control and smooth animations.
 */
const PortalTooltip = ({ text, x, y }) => {
  // Tooltip positioning offsets (adjust these easily!)
  const OFFSET_X = 0;      // Horizontal offset from button center
  const OFFSET_Y = -12;    // Vertical offset from button top (negative = above)
  const ARROW_SIZE = 5;
  
  return createPortal(
    <>
      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        @keyframes tooltipBounce {
          0%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          50% {
            transform: translateX(-50%) translateY(-2px);
          }
        }
      `}</style>
      <div style={{
        position:      'fixed',
        left:          x + OFFSET_X,
        top:           y + OFFSET_Y,
        background:    '#1a1a1c',
        border:        '1px solid #9c9b7f',
        color:         '#d4d4d4',
        fontSize:      '12px',
        fontWeight:    '500',
        lineHeight:    '1.4',
        padding:       '6px 12px',
        borderRadius:  '8px',
        maxWidth:      'none',
        textAlign:     'center',
        pointerEvents: 'none',
        zIndex:        99999,
        boxShadow:     '0 8px 24px rgba(156, 155, 127, 0.25), 0 2px 8px rgba(0,0,0,0.4)',
        animation:     'tooltipFadeIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        whiteSpace:    'nowrap',
        letterSpacing: '0.3px',
        backdropFilter: 'blur(4px)',
      }}>
        {text}
        {/* Arrow pointer */}
        <div style={{
          position:    'absolute',
          bottom:      -ARROW_SIZE,
          left:        '50%',
          transform:   'translateX(-50%)',
          width:       0,
          height:      0,
          borderLeft:  `${ARROW_SIZE}px solid transparent`,
          borderRight: `${ARROW_SIZE}px solid transparent`,
          borderTop:   `${ARROW_SIZE}px solid #9c9b7f`,
        }} />
      </div>
    </>,
    document.body
  );
};

/**
 * TooltipButton — measures its own rect on mouseenter and passes coords to PortalTooltip.
 */
const TooltipButton = ({ item, isActive, onClick }) => {
  const [tip, setTip] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const desc = TOOL_DESCRIPTIONS[item.id] || null;

  const handleMouseEnter = (e) => {
    if (!desc) return;
    setIsHovering(true);
    // Capture rect immediately — e.currentTarget becomes null inside setTimeout
    const rect = e.currentTarget.getBoundingClientRect();
    setTimeout(() => {
      setTip({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    }, 80);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTip(null);
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`px-2 py-1.5 rounded text-xs flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 flex-shrink-0 group ${
        isActive
          ? 'bg-[#007acc] text-white shadow-lg shadow-[#007acc]/20'
          : 'bg-[#3c3c3c] hover:bg-[#4e4e4e] text-white hover:shadow-md hover:shadow-[#9c9b7f]/15'
      }`}
      style={{
        transform: isHovering ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span className={isHovering ? 'group-hover:scale-110 transition-transform duration-200' : ''}>{item.icon}</span>
      <span>{item.label}</span>
      {tip && desc && <PortalTooltip text={desc} x={tip.x} y={tip.y} />}
    </button>
  );
};

/**
 * ToolPalette
 */
const ToolPalette = ({ toolbarItems, selectedTool, onToolSelect, onElementAdd }) => {

  const handleClick = (item) => {
    if (item.id === 'select' || item.id === 'delete') {
      onToolSelect(item.id);
    } else {
      onElementAdd(item.id);
    }
  };

  const row1 = toolbarItems.filter(i => i.group === 'mode' || i.group === 'element');
  const row2 = toolbarItems.filter(i => i.group === 'relation');

  if (row2.length === 0 && row1.length === 0) {
    return (
      <div className="bg-[#2d2d30] border-b border-[#3e3e42] px-2 py-1.5 flex items-center gap-1 overflow-x-auto flex-shrink-0">
        {toolbarItems.map(item => (
          <TooltipButton
            key={item.id}
            item={item}
            isActive={selectedTool === item.id}
            onClick={() => handleClick(item)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-[#2d2d30] border-b border-[#3e3e42] flex flex-col flex-shrink-0">

      {/* Row 1 — Mode + Elements */}
      <div className="px-2 pt-1.5 pb-1 flex items-center gap-1 overflow-x-auto border-b border-[#3e3e42]">
        {row1.map((item, idx) => (
          <React.Fragment key={item.id}>
            {idx > 0 && item.group === 'element' && row1[idx - 1]?.group === 'mode' && (
              <div className="w-px h-5 bg-[#4e4e4e] flex-shrink-0 mx-0.5" />
            )}
            <TooltipButton
              item={item}
              isActive={selectedTool === item.id}
              onClick={() => handleClick(item)}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Row 2 — Relations */}
      {row2.length > 0 && (
        <div className="px-2 pt-1 pb-1.5 flex items-center gap-1 overflow-x-auto">
          <span className="text-xs text-gray-500 mr-1 flex-shrink-0">Relations:</span>
          {row2.map(item => (
            <TooltipButton
              key={item.id}
              item={item}
              isActive={selectedTool === item.id}
              onClick={() => handleClick(item)}
            />
          ))}
        </div>
      )}

    </div>
  );
};

export default ToolPalette;