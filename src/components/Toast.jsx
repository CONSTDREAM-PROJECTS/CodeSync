/**
 * ============================================================
 * Toast.jsx — Toast Notification System
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Replaces all browser alert() calls with non-blocking, auto-dismissing
 * toast notifications that slide in from the top-right corner.
 * Three severity levels: success (green), error (red), info (blue).
 *
 * TECHNICAL OVERVIEW:
 * Two exports:
 *   ToastContainer — renders the live toast stack; place once in UMLEditor.
 *   useToast       — hook returning showToast(message, type, duration).
 *
 * Usage in UMLEditor:
 *   const { showToast, toasts, removeToast } = useToast();
 *   showToast('Imported 3 classes!', 'success');
 *   <ToastContainer toasts={toasts} onRemove={removeToast} />
 * ============================================================
 */

import React, { useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

/**
 * useToast()
 * ----------
 * Returns { toasts, showToast, removeToast }.
 * showToast(message, type='success', duration=3000)
 *   type: 'success' | 'error' | 'info'
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};

const ICONS = {
  success: <CheckCircle size={16} className="flex-shrink-0 text-green-400" />,
  error:   <AlertCircle size={16} className="flex-shrink-0 text-red-400" />,
  info:    <Info        size={16} className="flex-shrink-0 text-blue-400" />,
};

const BG = {
  success: 'bg-[#1e3a1f] border-green-700',
  error:   'bg-[#3a1f1f] border-red-700',
  info:    'bg-[#1f2e3a] border-blue-700',
};

/**
 * ToastContainer({ toasts, onRemove })
 * -------------------------------------
 * Fixed overlay in top-right corner. Renders one Toast card per entry.
 */
export const ToastContainer = ({ toasts, onRemove }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: '360px' }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl pointer-events-auto
            ${BG[toast.type] || BG.info}
            animate-[slideInRight_0.2s_ease-out]`}
          style={{
            animation: 'slideInRight 0.2s ease-out',
          }}
        >
          {ICONS[toast.type] || ICONS.info}
          <span className="text-white text-sm flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Inline keyframe — no extra CSS file needed */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default ToastContainer;
