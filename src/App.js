import React, { useState, useEffect } from 'react';
import UMLEditor from './components/UMLEditor';
import { Menu, Github, Book, ArrowLeft, LogOut, User } from 'lucide-react';
import LoginModal, { restoreSession, clearSession } from './components/LoginModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import OAuthCallback from './components/OAuthCallback';
import DocumentationModal from './components/DocumentationModal';
import './App.css';

// ─────────────────────────────────────────────────────────────
// Read the reset token ONCE at module load time, before any
// React state or effects can race.  Works whether the link is:
//   https://yoursite.com/?token=abc
//   https://yoursite.com/reset-password?token=abc
// ─────────────────────────────────────────────────────────────
const _initialParams = new URLSearchParams(window.location.search);
const _initialToken  = _initialParams.get('token') || null;

// Immediately clean the token from the address bar so a hard
// refresh after a successful reset doesn't re-open the modal.
if (_initialToken) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function App() {
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [showLogin,       setShowLogin]       = useState(false);
  const [showDocs,        setShowDocs]        = useState(false);
  const [currentUser,     setCurrentUser]     = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Initialise from the value we grabbed at module load time.
  // This is always set before the first render, so the modal
  // will appear on the very first paint.
  const [resetToken, setResetToken] = useState(_initialToken);

  // ── Page routing ─────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(() => {
    if (window.location.pathname === '/oauth-callback') return 'oauth-callback';
    return 'home';
  });

  // Restore logged-in session on page load (skip if a reset
  // token is present — the user is not trying to log in yet).
  useEffect(() => {
    if (currentPage === 'oauth-callback') return;
    if (resetToken) return; // don't auto-login over a reset flow
    const user = restoreSession();
    if (user) setCurrentUser(user);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = (page) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  };

  const goBack = () => navigateTo('home');

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setShowLogin(true);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setShowLogin(false);
  };

  // After a successful reset the modal calls onClose — dismiss
  // the modal and open the login modal so the user can sign in.
  const handleResetClose = () => {
    setResetToken(null);
    setShowLogin(true);
  };

  if (currentPage === 'oauth-callback') {
    return <OAuthCallback />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e]">
      {/* Top Navigation Bar */}
      <nav className="top-nav px-4 flex items-center justify-between">
        <div className="flex items-center">
          {currentPage !== 'home' && (
            <button
              onClick={goBack}
              className="mr-3 p-2 text-gray-300 hover:text-white hover:bg-[#3e3e42] rounded transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <img
            src="/const_dream_logo.png"
            alt="CodeSync Logo"
            className="hidden md:block h-10 mr-4"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {currentPage === 'home' && (
            <div className="hidden md:flex items-center space-x-1">
              <button onClick={() => navigateTo('about')} className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3e3e42] rounded transition-colors">
                About Us
              </button>
              <button onClick={() => navigateTo('contact')} className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3e3e42] rounded transition-colors">
                Contact Us
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {currentPage === 'home' && (
            <button className="hidden md:flex items-center space-x-2 px-4 py-1.5 btn-muted" onClick={() => setShowDocs(true)}>
              <Book size={16} />
              <span className="text-sm">Documentation</span>
            </button>
          )}

          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#2d2d30] border border-[#3e3e42]">
                <User size={14} className="text-[#9c9b7f]" />
                <span className="text-sm text-[#d9dccc] font-medium">
                  {currentUser.username || currentUser.email.split('@')[0]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors"
                title="Log out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} className="px-4 py-1.5 btn-primary text-sm font-medium">
              Login
            </button>
          )}

          {currentPage === 'home' && (
            <button
              className="md:hidden p-2 text-gray-300 hover:text-white"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area with Transitions */}
      <main className="flex-1 overflow-hidden relative">
        <div
          className={`absolute inset-0 transition-all duration-300 ease-out ${
            isTransitioning
              ? 'opacity-0 transform translate-y-4'
              : 'opacity-100 transform translate-y-0'
          }`}
        >
          {currentPage === 'home' && (
            <UMLEditor
              currentUser={currentUser}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
            />
          )}
          {currentPage === 'about'   && <AboutPage />}
          {currentPage === 'contact' && <ContactPage />}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2d2d30] border-t border-[#3e3e42] px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span>© 2025 CodeSync - UML to Code Generator</span>
          <span>•</span>
          <span>Powered by Model-Driven Engineering</span>
        </div>
        <div className="flex items-center space-x-3">
          <a href="#" className="hover:text-white transition-colors flex items-center space-x-1">
            <Github size={14} />
            <span>GitHub</span>
          </a>
          <span>•</span>
          <a href="#" className="hover:text-white transition-colors flex items-center space-x-1">
            <span className="text-sm">&lt;/&gt;</span>
            <span>API Docs</span>
          </a>
        </div>
      </footer>

      {/* Mobile Sidebar */}
      {sidebarOpen && currentPage === 'home' && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setSidebarOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-64 bg-[#252526] p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { navigateTo('about'); setSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2d2e] rounded">
              About Us
            </button>
            <button onClick={() => { navigateTo('contact'); setSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2d2e] rounded">
              Contact Us
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2d2e] rounded" onClick={() => { setShowDocs(true); setSidebarOpen(false); }}>
              Documentation
            </button>
          </div>
        </div>
      )}

      {/* Documentation Modal */}
      {showDocs && (
        <DocumentationModal onClose={() => setShowDocs(false)} />
      )}

      {/* Login Modal — never shown while a reset token is active */}
      {showLogin && !resetToken && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Reset Password Modal — shown automatically when the
          user opens the reset link from their email */}
      {resetToken && (
        <ResetPasswordModal
          token={resetToken}
          onClose={handleResetClose}
        />
      )}
    </div>
  );
}

export default App;