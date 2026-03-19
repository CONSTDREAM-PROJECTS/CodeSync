/**
 * ============================================================
 * LoginModal.jsx — Login / Authentication Modal
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the login popup that appears when a user tries to
 * access a feature that requires an account (like saving a
 * diagram to the cloud or uploading files). It presents a
 * clean login form with email/password fields, social login
 * buttons for GitHub and Google, a password reset link, and
 * a "Create An Account" option. Currently it is a UI placeholder
 * — the actual backend authentication is wired up separately.
 *
 * TECHNICAL OVERVIEW:
 * A React functional component with minimal local state:
 *   - email / password: controlled input values (useState).
 *   - handleLogin: form submit handler that logs the attempt
 *     and closes the modal; real auth integration is a TODO.
 * Social login buttons (GitHub, Google) are rendered but not
 * connected — marked with "not connected" in their titles.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Conditionally rendered by UMLEditor.jsx when authentication
 *   is required for a gated action.
 * - onClose is called both on successful login and when the user
 *   clicks outside the modal overlay.
 * - Backend auth (JWT, OAuth) would be added inside handleLogin()
 *   without changing the component's external contract.
 * ============================================================
 */

import React, { useState } from 'react';
import { Github, Chrome } from 'lucide-react';

/**
 * LoginModal({ onClose })
 * ------------------------
 * LAYMAN'S: The modal component itself. Renders an overlay that
 *   dismisses on outside-click and a centered card with the full
 *   login form including email, password, social buttons, and links.
 *
 * TECHNICAL: Controlled form — email and password are held in local
 *   useState. handleLogin prevents the default form submission,
 *   logs the request (placeholder), and calls onClose(). All social
 *   buttons are type="button" to prevent accidental form submission.
 *
 * @param {Function} onClose - Callback to unmount the modal
 */

const LoginModal = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /**
   * handleLogin(e)
   * LAYMAN'S: Called when the user clicks "Log In". Currently just
   *   logs the email and closes the modal — full authentication
   *   (password hashing, JWT tokens, session management) is a
   *   backend integration task marked as TODO.
   * TECHNICAL: e.preventDefault() stops the browser from doing a full
   *   page form POST. The console.log is a deliberate placeholder marker.
   *   Replace the body with an API call to the auth endpoint to complete
   *   the integration.
   */
  const handleLogin = (e) => {
    e.preventDefault();
    // Placeholder: in-app saving/upload requires auth — integrate with backend later
    console.log('Login requested', email);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-logo">
          <img src="/const_dream_logo.png" alt="CodeSync" onError={(e)=>{e.target.style.display='none'}} />
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder=""
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            autoFocus
          />
          <input
            type="password"
            placeholder=""
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />

          <div className="login-help">want to reset your password?</div>

          <button className="login-btn" type="submit">Log In</button>

          <div className="login-or"> <span/> or log in with <span/></div>
          <div className="login-socials">
            <button type="button" className="social-btn" title="GitHub (not connected)"><Github /></button>
            <button type="button" className="social-btn" title="Google (not connected)"><Chrome /></button>
          </div>

          <div className="create-account">Create An Account.</div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;