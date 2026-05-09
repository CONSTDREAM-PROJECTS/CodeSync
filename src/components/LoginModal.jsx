/**
 * ============================================================
 * LoginModal.jsx — Authentication Modal (Email + Google + GitHub)
 * ============================================================
 *
 * Three auth paths, all using your own PHP backend (no Firebase):
 *   1. Email / password  — POST /api/login or /api/register
 *   2. Google OAuth      — opens /api/oauth/google in a popup,
 *                          PHP handles the full OAuth flow,
 *                          redirects to /oauth-callback which
 *                          postMessages the token back here.
 *   3. GitHub OAuth      — same pattern via /api/oauth/github
 *
 * The popup approach means the user never leaves the editor page.
 * ============================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { Loader, Github, Chrome, Check, X } from 'lucide-react';
// TOKEN_KEY lives in diagramService — import first, then re-export below
// so UMLEditor can do: import { TOKEN_KEY } from './LoginModal'
import { TOKEN_KEY } from '../services/diagramService';
export { TOKEN_KEY };

// ─────────────────────────────────────────────────────────────
// Password strength rules
// ─────────────────────────────────────────────────────────────

const PASSWORD_RULES = [
  { id: 'length',  label: 'At least 8 characters',           test: (p) => p.length >= 8 },
  { id: 'number',  label: 'At least one number (0–9)',        test: (p) => /\d/.test(p) },
  { id: 'special', label: 'At least one special character (!@#$%^&* etc.)', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

const validatePassword = (password) => PASSWORD_RULES.every(r => r.test(password));
const getPasswordErrors = (password) => PASSWORD_RULES.filter(r => !r.test(password)).map(r => r.label);

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

// API_BASE_URL — React app and PHP API are on the same Hostinger domain.
// In production:  https://admin.codesynch.tech/api
// In local dev:   http://localhost/api  (adjust if your local path differs)
const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.codesynch.tech'
    : 'https://api.codesynch.tech';

// ─────────────────────────────────────────────────────────────
// Session restore helper (used by UMLEditor on mount)
// ─────────────────────────────────────────────────────────────

export const restoreSession = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) { localStorage.removeItem(TOKEN_KEY); return null; }

    const padded  = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return { uid: String(payload.sub), email: payload.email };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const LoginModal = ({ onClose, onLoginSuccess }) => {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [error,        setError]        = useState('');
  const [mode,         setMode]         = useState('login');
  const [showRules,    setShowRules]    = useState(false);
  const popupRef = useRef(null);

  // ── Restore existing session on open ──────────────────────
  useEffect(() => {
    const user = restoreSession();
    if (user) { onLoginSuccess?.(user); onClose(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for OAuth popup postMessage ────────────────────
  // OAuthCallback.jsx sends window.opener.postMessage() after
  // the PHP callback redirects back with the token.
  useEffect(() => {
    const handleMessage = (event) => {
      // Security: only accept messages from our own origin
      if (event.origin !== window.location.origin) return;

      const { type, token, user, error: oauthError } = event.data || {};

      if (type === 'OAUTH_SUCCESS' && token) {
        // Build user object — uid comes from JWT payload
        try {
          const parts   = token.split('.');
          const payload = JSON.parse(atob(
            parts[1].replace(/-/g, '+').replace(/_/g, '/')
          ));
          const resolvedUser = {
            uid:   String(payload.sub),
            email: payload.email || user?.email || '',
          };
          localStorage.setItem(TOKEN_KEY, token);
          setOauthLoading('');
          onLoginSuccess?.(resolvedUser);
          onClose();
        } catch {
          setError('OAuth login succeeded but token was malformed. Please try again.');
          setOauthLoading('');
        }
      }

      if (type === 'OAUTH_ERROR') {
        setError(oauthError || 'OAuth sign-in failed. Please try again.');
        setOauthLoading('');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess, onClose]);

  // ── Clean up popup if user closes it manually ─────────────
  useEffect(() => {
    if (!oauthLoading) return;
    const interval = setInterval(() => {
      if (popupRef.current?.closed) {
        setOauthLoading('');
        setError('Sign-in popup was closed. Please try again.');
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [oauthLoading]);

  // ── Shared POST helper ────────────────────────────────────
  const _post = async (endpoint, body) => {
    const res  = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Server error (${res.status})`);
    return json;
  };

  // ── Email login ───────────────────────────────────────────
  const handleLogin = async () => {
    const json = await _post('login', { email: email.trim(), password });
    localStorage.setItem(TOKEN_KEY, json.token);
    onLoginSuccess?.(json.user);
    onClose();
  };

  // ── Email register ────────────────────────────────────────
  const handleRegister = async () => {
    const json = await _post('register', { email: email.trim(), password });
    if (json.token) {
      localStorage.setItem(TOKEN_KEY, json.token);
      onLoginSuccess?.(json.user);
      onClose();
    } else {
      await handleLogin();
    }
  };

  // ── Email form submit ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }

    // Gmail-only restriction — check before hitting the server
    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      setError('Only Gmail addresses (@gmail.com) are accepted. Please use your Google email.');
      return;
    }

    if (!password) { setError('Please enter your password.'); return; }

    // Enforce password rules only on registration
    if (mode === 'register' && !validatePassword(password)) {
      setShowRules(true);
      setError('Password does not meet the requirements below.');
      return;
    }

    setIsLoading(true);
    try {
      mode === 'login' ? await handleLogin() : await handleRegister();
    } catch (err) {
      // "Failed to fetch" means the API server is unreachable — give a clear message
      if (err.message === 'Failed to fetch' || err.message.includes('NetworkError') || err.message.includes('fetch')) {
        setError('Cannot reach the server. Please check your internet connection or try again in a moment.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── OAuth popup opener ────────────────────────────────────
  const handleOAuth = (provider) => {
    setError('');
    setOauthLoading(provider);

    // Open the PHP OAuth endpoint in a small centred popup
    const width  = 520;
    const height = 620;
    const left   = Math.round(window.screenX + (window.outerWidth  - width)  / 2);
    const top    = Math.round(window.screenY + (window.outerHeight - height) / 2);

    const oauthUrl = `${API_BASE_URL}/oauth/${provider}`;

    popupRef.current = window.open(
      oauthUrl,
      `codesynch_oauth_${provider}`,
      `width=${width},height=${height},left=${left},top=${top},` +
      `scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no`
    );

    if (!popupRef.current) {
      setOauthLoading('');
      setError(
        'Popup was blocked by your browser. ' +
        'Please allow popups for this site and try again.'
      );
    }
  };

  // ── Render ────────────────────────────────────────────────
  const anyLoading = isLoading || oauthLoading !== '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>

        {/* Logo */}
        <div className="login-logo">
          <img
            src="/const_dream_logo.png"
            alt="CodeSynch"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* Mode toggle */}
        <div className="flex border border-[#3e3e42] rounded-lg overflow-hidden mb-4">
          <button type="button"
            onClick={() => { setMode('login'); setError(''); setShowRules(false); }}
            disabled={anyLoading}
            className={`flex-1 py-1.5 text-sm transition-colors ${
              mode === 'login'
                ? 'bg-[#007acc] text-white'
                : 'bg-[#2d2d30] text-gray-400 hover:text-white'
            }`}
          >Log In</button>
          <button type="button"
            onClick={() => { setMode('register'); setError(''); }}
            disabled={anyLoading}
            className={`flex-1 py-1.5 text-sm transition-colors ${
              mode === 'register'
                ? 'bg-[#007acc] text-white'
                : 'bg-[#2d2d30] text-gray-400 hover:text-white'
            }`}
          >Create Account</button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <input type="email" placeholder="your.email@gmail.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="login-input" autoFocus disabled={anyLoading}
          />
          {mode === 'register' && (
            <p className="text-xs text-gray-500 -mt-1 px-1">
              Only Gmail addresses are accepted.
            </p>
          )}
          <input type="password" placeholder="Password"
            value={password} onChange={(e) => {
              setPassword(e.target.value);
              if (mode === 'register') setShowRules(true);
            }}
            onFocus={() => { if (mode === 'register') setShowRules(true); }}
            className="login-input" disabled={anyLoading}
          />

          {/* Live password requirements — register mode only */}
          {mode === 'register' && showRules && (
            <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg px-3 py-2 space-y-1">
              <p className="text-xs text-gray-400 font-semibold mb-1">Password requirements:</p>
              {PASSWORD_RULES.map(rule => {
                const passed = rule.test(password);
                return (
                  <div key={rule.id} className={`flex items-center gap-2 text-xs ${passed ? 'text-green-400' : 'text-gray-500'}`}>
                    {passed
                      ? <Check size={12} className="flex-shrink-0 text-green-400" />
                      : <X     size={12} className="flex-shrink-0 text-red-500" />
                    }
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inline error */}
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="login-btn flex items-center justify-center gap-2"
            type="submit"
            disabled={anyLoading}
          >
            {isLoading
              ? <><Loader size={14} className="animate-spin" /> Authenticating…</>
              : mode === 'login' ? 'Log In' : 'Create Account'
            }
          </button>

          {/* Divider */}
          <div className="login-or"><span /> or continue with <span /></div>

          {/* Social buttons */}
          <div className="login-socials">
            <button
              type="button"
              className="social-btn flex items-center justify-center gap-2 relative"
              title="Sign in with GitHub"
              onClick={() => handleOAuth('github')}
              disabled={anyLoading}
            >
              {oauthLoading === 'github'
                ? <Loader size={18} className="animate-spin" />
                : <Github size={18} />
              }
            </button>
            <button
              type="button"
              className="social-btn flex items-center justify-center gap-2 relative"
              title="Sign in with Google"
              onClick={() => handleOAuth('google')}
              disabled={anyLoading}
            >
              {oauthLoading === 'google'
                ? <Loader size={18} className="animate-spin" />
                : <Chrome size={18} />
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
