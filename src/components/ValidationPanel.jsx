/**
 * ============================================================
 * ValidationPanel.jsx — Inline Validation Error Panel
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the popup panel that appears when the user clicks
 * "Generate Code" and the diagram has problems. Instead of
 * silently producing broken code, the app now shows exactly
 * what is wrong — the element name, a plain-English description
 * of the violation, and a recommended action to fix it.
 * Errors (hard stops) are shown in red, warnings in yellow,
 * and completeness notes in blue.
 *
 * TECHNICAL OVERVIEW:
 * A React functional component that renders a fixed overlay panel
 * anchored to the bottom of the canvas. Receives the ValidationResult
 * object produced by ValidationService.validate() and displays its
 * allIssues array grouped by severity. Provides a summary line,
 * per-issue cards with elementRef / description / recommendedAction,
 * and a close button.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Rendered by UMLEditor.jsx when showValidationPanel is true.
 * - Receives validationResult from ValidationService.validate().
 * - onClose sets showValidationPanel to false in UMLEditor.
 * ============================================================
 */

import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, X, ChevronDown, ChevronUp } from 'lucide-react';
import { SEVERITY } from '../services/ValidationService';

const ValidationPanel = ({ validationResult, onClose }) => {
  const [expandedIssue, setExpandedIssue] = useState(null);

  if (!validationResult) return null;

  const { allIssues, summary, canProceed, stage1Errors, stage2Warnings, stage3Infos } = validationResult;

  const severityConfig = {
    [SEVERITY.ERROR]: {
      icon:     <AlertCircle size={15} className="flex-shrink-0" />,
      color:    'text-red-400',
      bg:       'bg-red-950 border-red-800',
      headerBg: 'bg-red-900',
      badge:    'bg-red-600',
      label:    'Error'
    },
    [SEVERITY.WARNING]: {
      icon:     <AlertTriangle size={15} className="flex-shrink-0" />,
      color:    'text-yellow-400',
      bg:       'bg-yellow-950 border-yellow-800',
      headerBg: 'bg-yellow-900',
      badge:    'bg-yellow-600',
      label:    'Warning'
    },
    [SEVERITY.INFO]: {
      icon:     <Info size={15} className="flex-shrink-0" />,
      color:    'text-blue-400',
      bg:       'bg-blue-950 border-blue-800',
      headerBg: 'bg-blue-900',
      badge:    'bg-blue-600',
      label:    'Note'
    }
  };

  const IssueCard = ({ issue, index }) => {
    const cfg = severityConfig[issue.severity] || severityConfig[SEVERITY.INFO];
    const isExpanded = expandedIssue === index;
    return (
      <div className={`border rounded-lg overflow-hidden mb-2 ${cfg.bg}`}>
        <button
          className={`w-full px-3 py-2 flex items-center gap-2 text-left ${cfg.headerBg} hover:opacity-90 transition-opacity`}
          onClick={() => setExpandedIssue(isExpanded ? null : index)}
        >
          <span className={cfg.color}>{cfg.icon}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.badge} text-white flex-shrink-0`}>{cfg.label}</span>
          <span className="text-white text-xs font-medium flex-1 truncate">{issue.title}</span>
          {issue.elementRef && (
            <span className="text-gray-400 text-xs font-mono flex-shrink-0 truncate max-w-[100px]">{issue.elementRef}</span>
          )}
          <span className={`${cfg.color} flex-shrink-0`}>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </button>
        {isExpanded && (
          <div className="px-3 py-2 space-y-2">
            <p className="text-gray-300 text-xs leading-relaxed">{issue.description}</p>
            {issue.recommendedAction && (
              <div className="flex items-start gap-2 bg-black bg-opacity-30 rounded px-2 py-1.5">
                <span className="text-green-400 text-xs font-semibold flex-shrink-0">Fix:</span>
                <p className="text-green-300 text-xs leading-relaxed">{issue.recommendedAction}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[560px] max-w-[90vw] z-50 shadow-2xl rounded-xl border border-[#3e3e42] bg-[#1e1e1e] flex flex-col max-h-[55vh]">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl flex-shrink-0 ${!canProceed ? 'bg-red-900' : stage2Warnings.length > 0 ? 'bg-yellow-900' : 'bg-blue-900'}`}>
        {!canProceed ? <AlertCircle size={16} className="text-red-300 flex-shrink-0" /> : <AlertTriangle size={16} className="text-yellow-300 flex-shrink-0" />}
        <span className="text-white text-sm font-semibold flex-1">Validation Results</span>
        <div className="flex items-center gap-1.5">
          {stage1Errors.length > 0 && <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stage1Errors.length} error{stage1Errors.length > 1 ? 's' : ''}</span>}
          {stage2Warnings.length > 0 && <span className="bg-yellow-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stage2Warnings.length} warning{stage2Warnings.length > 1 ? 's' : ''}</span>}
          {stage3Infos.length > 0 && <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stage3Infos.length} note{stage3Infos.length > 1 ? 's' : ''}</span>}
        </div>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors flex-shrink-0" title="Dismiss">
          <X size={16} className="text-white" />
        </button>
      </div>
      <div className="px-4 py-2 bg-[#252526] border-b border-[#3e3e42] flex-shrink-0">
        <p className={`text-xs ${!canProceed ? 'text-red-300' : 'text-yellow-300'}`}>{summary}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {allIssues.length === 0 ? (
          <div className="flex items-center gap-2 text-green-400 text-sm py-2"><Info size={16} /><span>Diagram is valid and ready for code generation.</span></div>
        ) : (
          allIssues.map((issue, idx) => <IssueCard key={idx} issue={issue} index={idx} />)
        )}
      </div>
      <div className="px-4 py-2 border-t border-[#3e3e42] flex justify-end gap-2 flex-shrink-0 bg-[#252526] rounded-b-xl">
        {!canProceed && <p className="text-red-400 text-xs flex-1 self-center">Fix all errors before generating code.</p>}
        <button onClick={onClose} className="px-4 py-1.5 text-sm rounded bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white transition-colors">
          {canProceed ? 'Dismiss' : 'Close & Fix'}
        </button>
      </div>
    </div>
  );
};

export default ValidationPanel;
