import { useEffect } from 'react';
import { OAUTH_ERROR_KEY, TOKEN_KEY } from '../services/diagramService';

/**
 * OAuthCallback
 * -------------
 * Rendered when the popup window lands on /oauth-callback after the
 * PHP OAuth flow. Reads the token or error from the URL, postMessages
 * it back to the opener (the main app window), then closes itself.
 *
 * If window.opener is unavailable (user navigated here directly),
 * redirects to the homepage instead.
 */
const OAuthCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const error  = params.get('error');

    // OAuth providers can sever window.opener via Cross-Origin-Opener-Policy.
    // Persist the result first because localStorage is shared by same-origin
    // windows even when the opener reference is no longer available.
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(OAUTH_ERROR_KEY);
    } else if (error) {
      localStorage.setItem(OAUTH_ERROR_KEY, error);
    }

    if (window.opener && !window.opener.closed) {
      if (token) {
        window.opener.postMessage(
          { type: 'OAUTH_SUCCESS', token },
          window.location.origin
        );
      } else if (error) {
        window.opener.postMessage(
          { type: 'OAUTH_ERROR', error },
          window.location.origin
        );
      } else {
        window.opener.postMessage(
          { type: 'OAUTH_ERROR', error: 'OAuth failed. No token received.' },
          window.location.origin
        );
      }
      setTimeout(() => window.close(), 50);
    } else {
      // Opened directly, not as a popup — redirect home
      window.close();
      setTimeout(() => window.location.replace('/'), 100);
    }
  }, []);

  return (
    <div style={{
      background: '#1e1e1e',
      color: '#d9dccc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: 12,
      fontSize: 14,
    }}>
      <div style={{
        width: 32, height: 32, border: '3px solid #9c9b7f',
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span>Authenticating...</span>
    </div>
  );
};

export default OAuthCallback;
