import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';

// ============================================================
// ResetPasswordModal.jsx
// Shown when the user visits /?token=... (reset link from email)
// Props:
//   token       — the reset token from the URL
//   onClose     — called after success or manual dismiss
// ============================================================

const API_BASE = process.env.REACT_APP_API_URL || '/api';

export default function ResetPasswordModal({ token, onClose }) {
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(false);

  // ── live validation helpers ──────────────────────────────
  const rules = {
    length:  password.length >= 8,
    number:  /\d/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  const allRulesPass  = Object.values(rules).every(Boolean);
  const passwordsMatch = password === confirm && confirm !== '';

  // ── submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');

    if (!allRulesPass) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/reset_password.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── rule badge ───────────────────────────────────────────
  const Rule = ({ met, label }) => (
    <div className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${met ? 'text-[#9c9b7f]' : 'text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200 ${met ? 'bg-[#9c9b7f]' : 'bg-gray-600'}`} />
      {label}
    </div>
  );

  // ── success screen ───────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-[#252526] border border-[#3e3e42] rounded-xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[#2d2d30] border border-[#9c9b7f]/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-[#9c9b7f]" />
            </div>
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">Password Reset!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Your password has been updated successfully. You can now log in with your new password.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-[#9c9b7f] hover:bg-[#b0af93] text-[#1e1e1e] font-semibold text-sm transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ── main modal ───────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#252526] border border-[#3e3e42] rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#3e3e42]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2d2d30] border border-[#3e3e42] flex items-center justify-center">
              <Lock size={15} className="text-[#9c9b7f]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm leading-tight">Set New Password</h2>
              <p className="text-gray-500 text-xs">CodeSynch account recovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#3e3e42] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* New password */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">New Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter new password"
                className="w-full bg-[#1e1e1e] border border-[#3e3e42] focus:border-[#9c9b7f] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Rules — only show once user starts typing */}
            {password.length > 0 && (
              <div className="grid grid-cols-3 gap-1 pt-1">
                <Rule met={rules.length}  label="8+ chars"    />
                <Rule met={rules.number}  label="One number"  />
                <Rule met={rules.special} label="One symbol"  />
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                placeholder="Re-enter new password"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className={`w-full bg-[#1e1e1e] border rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-600 outline-none transition-colors ${
                  confirm.length > 0
                    ? passwordsMatch
                      ? 'border-[#9c9b7f]/50 focus:border-[#9c9b7f]'
                      : 'border-red-500/50 focus:border-red-500'
                    : 'border-[#3e3e42] focus:border-[#9c9b7f]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirm.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-400">Passwords do not match.</p>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !allRulesPass || !passwordsMatch}
            className="w-full py-2.5 rounded-lg bg-[#9c9b7f] hover:bg-[#b0af93] disabled:opacity-40 disabled:cursor-not-allowed text-[#1e1e1e] font-semibold text-sm transition-colors flex items-center justify-center gap-2 mt-1"
          >
            {loading ? (
              <>
                <Loader size={15} className="animate-spin" />
                Resetting…
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
