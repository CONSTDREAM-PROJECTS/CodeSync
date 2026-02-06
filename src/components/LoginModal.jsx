import React, { useState } from 'react';
import { Github, Chrome } from 'lucide-react';

const LoginModal = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
