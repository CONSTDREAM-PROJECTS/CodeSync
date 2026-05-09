import React, { useState } from 'react';
import UMLEditor from './components/UMLEditor';
import { Menu, Github, Book, ArrowLeft } from 'lucide-react';
import LoginModal from './components/LoginModal';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'about', 'contact'
  const [isTransitioning, setIsTransitioning] = useState(false);

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

          <button onClick={() => setShowLogin(true)} className="px-4 py-1.5 btn-primary text-sm font-medium">
            Login
          </button>

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
          {currentPage === 'home' && <UMLEditor />}
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

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

export default App;
