/**
 * ============================================================
 * LoginModal.jsx — Authentication Modal (Firebase Auth)
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the login popup with real authentication. Users can sign
 * in with email + password, or with GitHub / Google via OAuth.
 * On success a Firebase user session is created, which lets the
 * app save and load diagrams from the cloud (via diagramService.js).
 * On failure the exact Firebase error is shown inline so the user
 * knows what went wrong (wrong password, no account, etc.).
 *
 * TECHNICAL OVERVIEW:
 * Uses Firebase Auth SDK (v9 modular). Three auth paths:
 *   1. Email/password  — signInWithEmailAndPassword()
 *   2. Google OAuth    — signInWithPopup(GoogleAuthProvider)
 *   3. GitHub OAuth    — signInWithPopup(GithubAuthProvider)
 * All three call onLoginSuccess(user) on success, which UMLEditor
 * uses to set the logged-in user state. Errors are caught and
 * displayed inline — no alert() calls.
 *
 * SETUP REQUIRED:
 * Create src/firebase.js with your Firebase project config:
 *   import { initializeApp } from 'firebase/app';
 *   import { getAuth } from 'firebase/auth';
 *   const app = initializeApp({ apiKey: '...', ... });
 *   export const auth = getAuth(app);
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Rendered by UMLEditor.jsx when showLoginModal is true.
 * - onLoginSuccess(user) passes the Firebase User object up to
 *   UMLEditor, which stores it in currentUser state.
 * - diagramService.js uses currentUser.uid to scope cloud saves.
 * ============================================================
 */

import React, { useState } from 'react';
import { Github, Chrome, Loader } from 'lucide-react';

/**
 * LoginModal({ onClose, onLoginSuccess })
 * ----------------------------------------
 * LAYMAN'S: The modal itself. Three ways to log in: email/password,
 *   Google, or GitHub. Shows a spinner while authenticating and
 *   displays any error inline.
 *
 * TECHNICAL: All auth calls are async/await wrapped in try/catch.
 *   Firebase error codes are mapped to user-friendly messages.
 *   The modal stays open on error so the user can correct and retry.
 *
 * @param {Function} onClose        - Dismiss the modal without logging in
 * @param {Function} onLoginSuccess - Called with Firebase User on success
 */
const LoginModal = ({ onClose, onLoginSuccess }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');
  const [mode, setMode]         = useState('login'); // 'login' | 'register'

  /**
   * friendlyError(code)
   * LAYMAN'S: Translates Firebase's technical error codes into plain English.
   * TECHNICAL: Maps common Firebase Auth error codes to user-facing strings.
   */
  const friendlyError = (code) => {
    const map = {
      'auth/user-not-found':       'No account found with this email.',
      'auth/wrong-password':       'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password':        'Password must be at least 6 characters.',
      'auth/invalid-email':        'Please enter a valid email address.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
      'auth/cancelled-popup-request': 'Only one sign-in popup can be open at a time.',
      'auth/network-request-failed': 'Network error — check your connection.',
    };
    return map[code] || 'Authentication failed. Please try again.';
  };

  /**
   * handleEmailAuth(e)
   * LAYMAN'S: Handles the email/password form submit. Calls Firebase to
   *   sign in (or create an account in register mode), then closes the
   *   modal and passes the user object up to UMLEditor.
   * TECHNICAL: Dynamically imports Firebase functions to keep the bundle
   *   lean — auth SDK is only loaded when the modal is opened.
   */
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { auth } = await import('../firebase');
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      const fn = mode === 'register' ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      const result = await fn(auth, email.trim(), password);
      onLoginSuccess?.(result.user);
      onClose();
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * handleProviderAuth(providerName)
   * LAYMAN'S: Opens a browser popup for Google or GitHub sign-in.
   *   The user picks their account in the popup and is then logged in.
   * TECHNICAL: Uses Firebase signInWithPopup with the appropriate provider.
   *   Provider instances are created fresh each call (safe for popup flow).
   */
  const handleProviderAuth = async (providerName) => {
    setIsLoading(true);
    setError('');
    try {
      const { auth } = await import('../firebase');
      const { signInWithPopup, GoogleAuthProvider, GithubAuthProvider } = await import('firebase/auth');
      const provider = providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onLoginSuccess?.(result.user);
      onClose();
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>

        {/* Logo */}
        <div className="login-logo">
          <img src="/const_dream_logo.png" alt="CodeSync" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>

        {/* Mode toggle */}
        <div className="flex border border-[#3e3e42] rounded-lg overflow-hidden mb-4">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-1.5 text-sm transition-colors ${mode === 'login' ? 'bg-[#007acc] text-white' : 'bg-[#2d2d30] text-gray-400 hover:text-white'}`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-1.5 text-sm transition-colors ${mode === 'register' ? 'bg-[#007acc] text-white' : 'bg-[#2d2d30] text-gray-400 hover:text-white'}`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleEmailAuth} className="login-form">
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
            <div className="bg-red-900 border border-red-700 text-red-200 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {mode === 'login' && (
            <div className="login-help">Forgot your password?</div>
          )}

          <button className="login-btn flex items-center justify-center gap-2" type="submit" disabled={isLoading}>
            {isLoading ? <><Loader size={14} className="animate-spin" /> Authenticating...</> : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>

          <div className="login-or"><span /> or continue with <span /></div>

          <div className="login-socials">
            <button
              type="button"
              className="social-btn"
              title="Sign in with GitHub"
              onClick={() => handleProviderAuth('github')}
              disabled={isLoading}
            >
              <Github size={18} />
            </button>
            <button
              type="button"
              className="social-btn"
              title="Sign in with Google"
              onClick={() => handleProviderAuth('google')}
              disabled={isLoading}
            >
              <Chrome size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;