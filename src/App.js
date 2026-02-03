import React, { useState } from 'react';
import UMLEditor from './components/UMLEditor';
import { Menu, FileCode, Github, Book } from 'lucide-react';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e]">
      {/* Top Navigation Bar */}
      <nav className="bg-[#2d2d30] border-b border-[#3e3e42] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <img 
              src="/codesynch.jpg" 
              alt="CodeSync Logo" 
              className="h-8 w-8"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <span className="text-white font-bold text-xl">CodeSync</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-1">
            <button className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3e3e42] rounded transition-colors">
              About Us
            </button>
            <button className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3e3e42] rounded transition-colors">
              Contact Us
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="hidden md:flex items-center space-x-2 px-4 py-1.5 bg-[#3c3c3c] text-white rounded hover:bg-[#4e4e4e] transition-colors">
            <Book size={16} />
            <span className="text-sm">Documentation</span>
          </button>
          
          <button className="px-4 py-1.5 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors text-sm font-medium">
            Login
          </button>
          
          <button 
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <UMLEditor />
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
            <FileCode size={14} />
            <span>API Docs</span>
          </a>
        </div>
      </footer>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setSidebarOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-64 bg-[#252526] p-4" onClick={(e) => e.stopPropagation()}>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2d2e] rounded">
              About Us
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2d2e] rounded">
              Contact Us
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2d2e] rounded">
              Documentation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;