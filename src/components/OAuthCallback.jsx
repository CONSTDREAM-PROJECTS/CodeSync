import { useEffect } from 'react';

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

    if (window.opener) {
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
      window.close();
    } else {
      // Opened directly, not as a popup — redirect home
      window.location.href = '/';
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
