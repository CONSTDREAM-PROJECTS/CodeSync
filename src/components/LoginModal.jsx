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
 *
 * MERGE NOTE (LoginModal UI + real auth logic):
 *   - Animated entry/exit (translateY + scale + rotate spring)
 *     from the UI-only version is merged in.
 *   - All real API logic, JWT handling, password rules, OAuth,
 *     restoreSession, and TOKEN_KEY are preserved from the
 *     uploaded file.
 *
 * BUG FIX — "created account but can't log back in":
 *   Root cause: localStorage still held the JWT after logout
 *   because nothing called localStorage.removeItem(TOKEN_KEY).
 *   restoreSession() then found it on re-open and auto-closed
 *   the modal before the user could type anything.
 *   Fix: export clearSession() so UMLEditor can call it on
 *   logout. Also added a forceShow prop: when true, restoreSession
 *   auto-login is skipped so the modal always stays open (useful
 *   for an explicit "switch account" flow).
 * ============================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Loader, Github, Chrome, Check, X,
  User, Lock, Eye, EyeOff, LogIn, UserPlus,
} from 'lucide-react';
import { TOKEN_KEY } from '../services/diagramService';
export { TOKEN_KEY };

// ─────────────────────────────────────────────────────────────
// Theme colours (matching the pasted UI version)
// ─────────────────────────────────────────────────────────────
const A1 = '#9c9b7f';
const A2 = '#d9dccc';

// ─────────────────────────────────────────────────────────────
// Password strength rules
// ─────────────────────────────────────────────────────────────
const PASSWORD_RULES = [
  { id: 'length',  label: 'At least 8 characters',                              test: (p) => p.length >= 8 },
  { id: 'number',  label: 'At least one number (0–9)',                           test: (p) => /\d/.test(p) },
  { id: 'special', label: 'At least one special character (!@#$%^&* etc.)',      test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

const validatePassword  = (p) => PASSWORD_RULES.every(r => r.test(p));

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────
const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.codesynch.tech'
    : 'https://api.codesynch.tech';

// ─────────────────────────────────────────────────────────────
// Session helpers (used by UMLEditor on mount / logout)
// ─────────────────────────────────────────────────────────────

/** Call this on logout so the next modal open doesn't auto-login. */
export const clearSession = () => localStorage.removeItem(TOKEN_KEY);

/** Restore session from JWT in localStorage. Returns user or null. */
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

    // Stale token from before usernames were added — force re-login.
    if (!payload.username || payload.username.trim() === '') {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return { uid: String(payload.sub), email: payload.email, username: payload.username };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Props:
 *   onClose        () => void
 *   onLoginSuccess (user: { uid, email, username }) => void
 *   forceShow?     boolean — when true, skip restoreSession auto-login
 *                            (use for explicit logout / switch-account)
 */
const LoginModal = ({ onClose, onLoginSuccess, forceShow = false }) => {
  // ── Animated entry/exit state (from pasted UI version) ────
  const [isVisible,  setIsVisible]  = useState(false);
  const [isClosing,  setIsClosing]  = useState(false); // kept for future use

  // ── Auth form state ────────────────────────────────────────
  const [email,        setEmail]        = useState('');
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [error,        setError]        = useState('');
  const [mode,         setMode]         = useState('login');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRules,    setShowRules]    = useState(false);

  const popupRef = useRef(null);

  // ── Animate in on mount ────────────────────────────────────
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // ── Animated close ─────────────────────────────────────────
  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  // ── Restore session on open (skipped when forceShow=true) ──
  useEffect(() => {
    if (forceShow) return;           // <── BUG FIX: skip if user explicitly logged out
    const user = restoreSession();
    if (user) { onLoginSuccess?.(user); setTimeout(() => onClose(), 0); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for OAuth popup postMessage ────────────────────
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const { type, token, user, error: oauthError } = event.data || {};

      if (type === 'OAUTH_SUCCESS' && token) {
        try {
          const parts   = token.split('.');
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          const resolvedUser = {
            uid:      String(payload.sub),
            email:    payload.email    || user?.email    || '',
            username: payload.username || user?.username || '',
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
    const res = await fetch(`${API_BASE_URL}/${endpoint}.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Server error (${res.status})`);
    return json;
  };

  // ── JWT decode + resolve user ─────────────────────────────
  const _resolveUser = (token, fallbackUser) => {
    try {
      const parts   = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return {
        uid:      String(payload.sub),
        email:    payload.email    || fallbackUser?.email    || '',
        username: payload.username || fallbackUser?.username || '',
      };
    } catch {
      return fallbackUser;
    }
  };

  // ── Decode user directly from JWT token ─────────────────
  const _userFromToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return {
        uid:      String(payload.sub || ''),
        email:    payload.email    || '',
        username: payload.username || '',
      };
    } catch {
      return null;
    }
  };

  // ── Email login ───────────────────────────────────────────
  const handleLogin = async () => {
    const json = await _post('login', { email: email.trim(), password });
    console.log('[LoginModal] raw login response:', JSON.stringify(json));
    localStorage.setItem(TOKEN_KEY, json.token);
    const user = _userFromToken(json.token);
    console.log('[LoginModal] decoded user:', user);
    // Fallback: build user from json directly if token decode fails
    const finalUser = user || {
      uid:      String(json.user?.uid || json.uid || ''),
      email:    json.user?.email || json.email || email.trim(),
      username: json.user?.username || json.username || '',
    };
    console.log('[LoginModal] finalUser:', finalUser);
    onLoginSuccess?.(finalUser);
    setTimeout(() => onClose(), 0);
  };

  // ── Email register ────────────────────────────────────────
  const handleRegister = async () => {
    const json = await _post('register', { email: email.trim(), username: username.trim(), password });
    console.log('[LoginModal] raw register response:', JSON.stringify(json));
    if (json.token) {
      localStorage.setItem(TOKEN_KEY, json.token);
      const user = _userFromToken(json.token);
      const finalUser = user || {
        uid:      String(json.user?.uid || json.uid || ''),
        email:    json.user?.email || json.email || email.trim(),
        username: json.user?.username || json.username || username.trim(),
      };
      console.log('[LoginModal] finalUser:', finalUser);
      onLoginSuccess?.(finalUser);
      setTimeout(() => onClose(), 0);
    } else {
      await handleLogin();
    }
  };

  // ── Form validation + submit ──────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Please enter your email address.'); return; }

    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      setError('Only Gmail addresses (@gmail.com) are accepted.');
      return;
    }

    if (mode === 'register') {
      if (!username.trim())                      { setError('Please enter a username.'); return; }
      if (username.trim().length < 3)            { setError('Username must be at least 3 characters.'); return; }
      if (!/[0-9_]/.test(username.trim()))       { setError('Username must contain at least one number or underscore.'); return; }
    }

    if (!password) { setError('Please enter your password.'); return; }

    if (mode === 'register' && confirmPassword && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (mode === 'register' && !validatePassword(password)) {
      setShowRules(true);
      setError('Password does not meet the requirements below.');
      return;
    }

    setIsLoading(true);
    try {
      mode === 'login' ? await handleLogin() : await handleRegister();
    } catch (err) {
      const msg = err.message || '';
      if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('fetch')) {
        setError('Cannot reach the server. Please check your internet connection.');
      } else {
        setError(msg || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── OAuth popup opener ────────────────────────────────────
  const handleOAuth = (provider) => {
    setError('');
    setOauthLoading(provider);

    const width  = 520;
    const height = 620;
    const left   = Math.round(window.screenX + (window.outerWidth  - width)  / 2);
    const top    = Math.round(window.screenY + (window.outerHeight - height) / 2);

    popupRef.current = window.open(
      `${API_BASE_URL}/oauth/${provider}.php`,
      `codesynch_oauth_${provider}`,
      `width=${width},height=${height},left=${left},top=${top},` +
      `scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no`
    );

    if (!popupRef.current) {
      setOauthLoading('');
      setError('Popup was blocked. Please allow popups for this site and try again.');
    }
  };

  const anyLoading = isLoading || oauthLoading !== '';

  // ── Shared input style helpers ────────────────────────────
  const inputStyle = {
    width:      '100%',
    padding:    '10px 12px 10px 38px',
    background: '#252526',
    border:     '1px solid #3e3e42',
    borderRadius: 6,
    color:      '#fff',
    fontSize:   14,
    outline:    'none',
    transition: 'border-color 200ms, box-shadow 200ms',
    boxSizing:  'border-box',
  };
  const focusInput  = (e) => { e.target.style.borderColor = A1; e.target.style.boxShadow = `0 0 0 3px ${A1}20`; };
  const blurInput   = (e) => { e.target.style.borderColor = '#3e3e42'; e.target.style.boxShadow = 'none'; };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Kill the browser's native password-reveal eye button (Edge/Chrome)
          so it doesn't overlap our custom Eye/EyeOff toggle. */}
      <style>{`
        .cs-password-input::-ms-reveal,
        .cs-password-input::-ms-clear,
        .cs-password-input::-webkit-credentials-auto-fill-button,
        .cs-password-input::-webkit-textfield-decoration-container { display: none !important; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleClose}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         100,
        opacity:        isVisible ? 1 : 0,
        transition:     'opacity 300ms ease-out',
      }}
    >
      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   '#1e1e1e',
          border:       `1px solid ${A1}44`,
          borderRadius: 12,
          width:        '100%',
          maxWidth:     420,
          margin:       '0 16px',
          transform:    isVisible
            ? 'translateY(0) scale(1) rotate(0deg)'
            : 'translateY(40px) scale(0.9) rotate(-2deg)',
          opacity:      isVisible ? 1 : 0,
          transition:   'transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-out',
          overflow:     'hidden',
          boxShadow:    isVisible ? `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px ${A1}15` : 'none',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background:    '#1a1a1a',
          borderBottom:  '1px solid #2d2d30',
          padding:       '16px 20px',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:'50%',
              background:`${A1}20`, border:`1px solid ${A1}`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {mode === 'register'
                ? <UserPlus size={16} color={A1} />
                : <LogIn    size={16} color={A1} />}
            </div>
            <span style={{ color:A2, fontWeight:600, fontSize:15 }}>
              {mode === 'register' ? 'Create Account' : 'Welcome Back'}
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{ background:'transparent', border:'none', cursor:'pointer', padding:4,
                     display:'flex', alignItems:'center', justifyContent:'center',
                     borderRadius:4, transition:'background 200ms' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3e3e42')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Close"
          >
            <X size={18} color="#888" />
          </button>
        </div>

        {/* ── Mode Toggle ── */}
        <div style={{ padding:'16px 20px 0' }}>
          <div style={{ display:'flex', border:'1px solid #3e3e42', borderRadius:8, overflow:'hidden' }}>
            {['login','register'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); setShowRules(false); setConfirmPassword(''); }}
                disabled={anyLoading}
                style={{
                  flex:1, padding:'7px 0', fontSize:13, border:'none', cursor:'pointer',
                  transition:'background 200ms, color 200ms',
                  background: mode === m ? '#007acc' : '#2d2d30',
                  color:      mode === m ? '#fff'     : '#9ca3af',
                }}
              >
                {m === 'login' ? 'Log In' : 'Create Account'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} style={{ padding:'20px 20px 24px' }}>

          {/* Email */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:A2, fontSize:12, fontWeight:500, marginBottom:6 }}>
              Email
            </label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <span style={{ position:'absolute', left:12, color:'#666', fontSize:14, pointerEvents:'none' }}>@</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                disabled={anyLoading}
                autoFocus
                autoComplete="email"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
            {mode === 'register' && (
              <p style={{ margin:'4px 0 0 2px', fontSize:11, color:'#6b7280' }}>
                Only Gmail addresses are accepted.
              </p>
            )}
          </div>

          {/* Username — visible on both login and register */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:A2, fontSize:12, fontWeight:500, marginBottom:6 }}>
              Username
            </label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <User size={16} color="#666" style={{ position:'absolute', left:12, pointerEvents:'none' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. john67"
                disabled={anyLoading}
                maxLength={30}
                autoComplete="username"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
            {mode === 'register' && (
              <p style={{ margin:'4px 0 0 2px', fontSize:11, color:'#6b7280' }}>
                Must include at least one number or underscore.
              </p>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:A2, fontSize:12, fontWeight:500, marginBottom:6 }}>
              Password
            </label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Lock size={16} color="#666" style={{ position:'absolute', left:12, pointerEvents:'none' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (mode === 'register') setShowRules(true);
                }}
                onFocus={(e) => { if (mode === 'register') setShowRules(true); focusInput(e); }}
                onBlur={blurInput}
                placeholder="Password"
                disabled={anyLoading}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="cs-password-input"
                style={{ ...inputStyle, paddingRight:40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position:'absolute', right:8, background:'transparent', border:'none',
                         cursor:'pointer', padding:4, display:'flex', alignItems:'center',
                         justifyContent:'center', borderRadius:4, transition:'background 200ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#3e3e42')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff size={16} color="#666" />
                  : <Eye    size={16} color="#666" />}
              </button>
            </div>
          </div>

          {/* Live password requirements — register mode only */}
          {mode === 'register' && showRules && (
            <div style={{
              background:'#1a1a1a', border:'1px solid #3e3e42', borderRadius:8,
              padding:'10px 12px', marginBottom:12,
            }}>
              <p style={{ margin:'0 0 6px', fontSize:11, color:'#9ca3af', fontWeight:600 }}>
                Password requirements:
              </p>
              {PASSWORD_RULES.map(rule => {
                const passed = rule.test(password);
                return (
                  <div key={rule.id} style={{
                    display:'flex', alignItems:'center', gap:6, marginBottom:3,
                    fontSize:12, color: passed ? '#4ade80' : '#6b7280',
                  }}>
                    {passed
                      ? <Check size={12} style={{ flexShrink:0, color:'#4ade80' }} />
                      : <X     size={12} style={{ flexShrink:0, color:'#ef4444' }} />}
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirm Password — register only, animated slide */}
          <div style={{
            marginBottom:  14,
            maxHeight:     mode === 'register' ? 80 : 0,
            opacity:       mode === 'register' ? 1 : 0,
            overflow:      'hidden',
            transition:    'max-height 300ms ease, opacity 200ms ease',
          }}>
            <label style={{ display:'block', color:A2, fontSize:12, fontWeight:500, marginBottom:6 }}>
              Confirm Password
            </label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Lock size={16} color="#666" style={{ position:'absolute', left:12, pointerEvents:'none' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={anyLoading}
                autoComplete="new-password"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
          </div>

          {/* Inline error */}
          {error && (
            <div style={{
              background:'#450a0a', border:'1px solid #7f1d1d',
              color:'#fca5a5', fontSize:12, padding:'8px 12px',
              borderRadius:8, marginBottom:12, lineHeight:1.4,
            }}>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={anyLoading}
            style={{
              width:'100%', padding:'11px 16px',
              background: anyLoading ? `${A1}80` : A1,
              border:'none', borderRadius:6,
              color:'#0d0d0c', fontSize:14, fontWeight:600,
              cursor: anyLoading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'transform 150ms, box-shadow 200ms, background 200ms',
            }}
            onMouseEnter={(e) => { if (!anyLoading) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 4px 12px ${A1}40`; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}
            onMouseDown={(e)  => { e.currentTarget.style.transform='scale(0.98)'; }}
            onMouseUp={(e)    => { e.currentTarget.style.transform='translateY(-1px)'; }}
          >
            {isLoading
              ? <><Loader size={14} style={{ animation:'spin 1s linear infinite' }} /> Authenticating…</>
              : mode === 'login'
                ? <><LogIn size={14} /> Log In</>
                : <><UserPlus size={14} /> Create Account</>
            }
          </button>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0', color:'#4b5563', fontSize:12 }}>
            <div style={{ flex:1, height:1, background:'#3e3e42' }} />
            or continue with
            <div style={{ flex:1, height:1, background:'#3e3e42' }} />
          </div>

          {/* Social / OAuth buttons */}
          <div style={{ display:'flex', gap:10 }}>
            {[
              { provider:'github', label:'GitHub', Icon: Github },
              { provider:'google', label:'Google', Icon: Chrome },
            ].map(({ provider, label, Icon }) => (
              <button
                key={provider}
                type="button"
                title={`Sign in with ${label}`}
                onClick={() => handleOAuth(provider)}
                disabled={anyLoading}
                style={{
                  flex:1, padding:'9px 0', background:'#252526',
                  border:'1px solid #3e3e42', borderRadius:8,
                  cursor: anyLoading ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'background 200ms, border-color 200ms',
                }}
                onMouseEnter={(e) => { if (!anyLoading) { e.currentTarget.style.background='#2d2d30'; e.currentTarget.style.borderColor=A1; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background='#252526'; e.currentTarget.style.borderColor='#3e3e42'; }}
              >
                {oauthLoading === provider
                  ? <Loader size={18} color="#9ca3af" style={{ animation:'spin 1s linear infinite' }} />
                  : <Icon size={18} color="#9ca3af" />}
              </button>
            ))}
          </div>

          {/* Toggle mode link */}
          <div style={{ marginTop:16, textAlign:'center', color:'#6b7280', fontSize:13 }}>
            {mode === 'register' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setShowRules(false); setConfirmPassword(''); }}
              style={{ background:'transparent', border:'none', color:A1, cursor:'pointer',
                       fontSize:13, fontWeight:500, padding:0, transition:'color 200ms' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = A2)}
              onMouseLeave={(e) => (e.currentTarget.style.color = A1)}
            >
              {mode === 'register' ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default LoginModal;