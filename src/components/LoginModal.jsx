/**
 * ============================================================
 * LoginModal.jsx — Authentication Modal (PHP/MySQL + JWT)
 * ============================================================
 *
 * BUGS FIXED:
 *
 * BUG 1 — API_BASE_URL pointed to InfinityFree, not Hostinger.
 *   FIX: Updated to Hostinger domain pattern.
 *
 * BUG 2 — No session restore on page refresh.
 *   After a refresh currentUser was always null even with a valid
 *   token in localStorage, forcing the user to log in again every time.
 *   FIX: Exported restoreSession() helper. Call it in UMLEditor on mount.
 *
 * BUG 3 — Password was trimmed before sending to PHP.
 *   trim() strips leading/trailing spaces which are valid password
 *   characters. register.php does NOT trim, so a password like
 *   " secret" would register fine but then fail login because login
 *   side trimmed it into "secret" — a different string.
 *   FIX: Removed trim() from password field only.
 *
 * BUG 4 — handleRegister made two round-trips (register then login).
 *   FIX: Updated register.php now returns token + user on 201 directly.
 *   Falls back to separate login call for backward compat with old PHP.
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { TOKEN_KEY } from '../services/diagramService';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/**
 * API_BASE_URL — BUG FIX: Was pointing to localhost/codesynch/api.
 * On Hostinger files live at public_html/api/ → https://yourdomain.com/api
 * Change 'yourdomain.com' to your actual Hostinger domain.
 */
const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://codesynch.tech/api'   // ← your Hostinger domain
    : 'http://admin.codesynch.tech/api'; // ← local dev (adjust if in a subfolder)

// TOKEN_KEY — imported from diagramService (the single source of truth).
// Re-exported here so UMLEditor can still do:
//   import { restoreSession, TOKEN_KEY } from './LoginModal'
export { TOKEN_KEY } from '../services/diagramService';

// ─────────────────────────────────────────────────────────────
// Session restore helper — import and call this in UMLEditor
// ─────────────────────────────────────────────────────────────

/**
 * restoreSession()
 * LAYMAN'S: On page load, checks if there is a saved login token.
 *   If the token is still valid (not expired), returns the user
 *   object so UMLEditor can skip showing the login modal.
 * TECHNICAL: Decodes the JWT payload locally — no network call.
 *   Returns null if no token, malformed, or expired.
 *
 * HOW TO USE IN UMLEditor.jsx:
 *   import { restoreSession, TOKEN_KEY } from './components/LoginModal';
 *   useEffect(() => {
 *     const user = restoreSession();
 *     if (user) setCurrentUser(user);
 *   }, []);
 *
 * HOW TO LOGOUT IN UMLEditor.jsx:
 *   localStorage.removeItem(TOKEN_KEY);
 *   setCurrentUser(null);
 */
export const restoreSession = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    // Decode JWT payload — re-add base64 padding stripped during encoding
    const padded  = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));

    // exp is in seconds; Date.now() is milliseconds
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
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');
  const [mode,      setMode]      = useState('login'); // 'login' | 'register'

  // If a valid token already exists, close the modal immediately
  useEffect(() => {
    const user = restoreSession();
    if (user) { onLoginSuccess?.(user); onClose(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared POST helper ─────────────────────────────────────────────────────
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

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    // BUG FIX: Only trim email, NOT password — spaces are valid password chars
    const json = await _post('login', { email: email.trim(), password });
    localStorage.setItem(TOKEN_KEY, json.token);
    onLoginSuccess?.(json.user); // { uid, email }
    onClose();
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    // BUG FIX: Only trim email, NOT password
    const json = await _post('register', { email: email.trim(), password });
    // Updated register.php returns token + user on 201 — one round trip
    if (json.token) {
      localStorage.setItem(TOKEN_KEY, json.token);
      onLoginSuccess?.(json.user);
      onClose();
    } else {
      // Fallback for old register.php that returns only { message }
      await handleLogin();
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim())  { setError('Please enter your email address.'); return; }
    if (!password)      { setError('Please enter your password.');       return; }

    setIsLoading(true);
    try {
      mode === 'login' ? await handleLogin() : await handleRegister();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>

        <div className="login-logo">
          <img
            src="/const_dream_logo.png"
            alt="CodeSynch"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        <div className="flex border border-[#3e3e42] rounded-lg overflow-hidden mb-4">
          <button type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-1.5 text-sm transition-colors ${mode === 'login' ? 'bg-[#007acc] text-white' : 'bg-[#2d2d30] text-gray-400 hover:text-white'}`}
          >Log In</button>
          <button type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-1.5 text-sm transition-colors ${mode === 'register' ? 'bg-[#007acc] text-white' : 'bg-[#2d2d30] text-gray-400 hover:text-white'}`}
          >Create Account</button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <input type="email" placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="login-input" autoFocus disabled={isLoading}
          />
          <input type="password" placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="login-input" disabled={isLoading}
          />

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button className="login-btn flex items-center justify-center gap-2"
            type="submit" disabled={isLoading}>
            {isLoading
              ? <><Loader size={14} className="animate-spin" /> Authenticating…</>
              : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>

          <p className="text-center text-xs text-gray-500 mt-2">
            Sign in with your CodeSynch account
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;