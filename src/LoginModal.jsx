/**
 * ============================================================
 * LoginModal.jsx — Authentication Modal (PHP/MySQL backend)
 * ============================================================
 * Replaces the Firebase version.
 * Calls /api/register.php and /api/login.php instead.
 * The rest of the UI is identical to the original.
 * ============================================================
 */

import React, { useState } from 'react';
import { Loader } from 'lucide-react';
import { login, register } from '../services/diagramService';

const LoginModal = ({ onClose, onLoginSuccess }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');
  const [mode, setMode]         = useState('login'); // 'login' | 'register'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'register') {
        // Register first, then auto-login
        await register(email.trim(), password);
      }

      // Login (runs for both modes)
      const data = await login(email.trim(), password);

      // data.user has shape { uid, email } — same as Firebase User object
      onLoginSuccess?.(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>

        {/* Logo */}
        <div className="login-logo">
          <img
            src="/const_dream_logo.png"
            alt="CodeSync"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* Mode toggle */}
        <div className="flex border border-[#3e3e42] rounded-lg overflow-hidden mb-4">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-1.5 text-sm transition-colors ${
              mode === 'login'
                ? 'bg-[#007acc] text-white'
                : 'bg-[#2d2d30] text-gray-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-1.5 text-sm transition-colors ${
              mode === 'register'
                ? 'bg-[#007acc] text-white'
                : 'bg-[#2d2d30] text-gray-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            autoFocus
            disabled={isLoading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            disabled={isLoading}
          />

          {/* Inline error */}
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 text-xs px-3 py-2 rounded-lg w-full text-left">
              {error}
            </div>
          )}

          <button
            className="login-btn flex items-center justify-center gap-2"
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? <><Loader size={14} className="animate-spin" /> Authenticating...</>
              : mode === 'login' ? 'Log In' : 'Create Account'
            }
          </button>

          <p className="text-gray-400 text-xs mt-2">
            {mode === 'login'
              ? "Don't have an account? Switch to Create Account above."
              : 'Already have an account? Switch to Log In above.'}
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
