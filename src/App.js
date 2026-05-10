import React, { useState, useEffect } from 'react';
import UMLEditor from './components/UMLEditor';
import { Menu, Github, Book, ArrowLeft, LogOut, User } from 'lucide-react';
import LoginModal, { restoreSession, clearSession } from './components/LoginModal';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Restore logged-in session on page load
  useEffect(() => {
    const user = restoreSession();
    if (user) setCurrentUser(user);
  }, []);

  const navigateTo = (page) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 300);
  };

  const goBack = () => {
    navigateTo('home');
  };

  // FIX 1: Centralized logout handler — calls clearSession() so the token
  // is actually removed from localStorage. The old inline onClick was calling
  // localStorage.removeItem('codesynch_token') directly, which hardcodes the
  // key and bypasses the TOKEN_KEY constant. If the key ever changes in
  // diagramService.js, the logout would silently stop working.
  // Also opens the login modal, which covers the session-expired case from
  // UMLEditor (FIX 3 below).
  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setShowLogin(true);
  };

  // FIX 2: Close the login modal after a successful login.
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setShowLogin(false);
  };

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
            <button className="hidden md:flex items-center space-x-2 px-4 py-1.5 btn-muted">
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
              {/* FIX 1: Use centralized handleLogout instead of inline localStorage call */}
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
          {/* FIX 3: Pass currentUser, onLoginSuccess, and onLogout to UMLEditor.
              Previously UMLEditor was rendered with no props at all, which meant:
              - autoSave never fired (currentUser was always undefined)
              - the session-expired event had no onLogout to call
              - onLoginSuccess was never wired up */}
          {currentPage === 'home' && (
            <UMLEditor
              currentUser={currentUser}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
            />
          )}
          {currentPage === 'about' && <AboutPage />}
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
            <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2d2e] rounded">
              Documentation
            </button>
          </div>
        </div>
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}

export default App;
