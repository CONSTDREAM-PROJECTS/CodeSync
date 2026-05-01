import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import CodeToUMLConverter from '../services/codeToUMLConverter';

const CodeImportModal = ({ onImport, onClose }) => {
  const [sourceCode, setSourceCode] = useState('');
  const [language, setLanguage] = useState('Java');
  const [conversionResult, setConversionResult] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Auto-detect language from file extension
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.java')) {
      setLanguage('Java');
    } else if (fileName.endsWith('.py')) {
      setLanguage('Python');
    } else if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
      setLanguage('JavaScript');
    } else if (fileName.endsWith('.puml') || fileName.endsWith('.plantuml')) {
      setLanguage('PlantUML');
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceCode(e.target.result);
      setConversionResult(null); // Reset previous results
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    if (!sourceCode.trim()) {
      setConversionResult({
        success: false,
        message: 'Please paste some source code first'
      });
      return;
    }

    setIsConverting(true);
    
    // Call Rule-Based Model Transformation
    const result = CodeToUMLConverter.convertCodeToUML(sourceCode, language);
    setConversionResult(result);
    
    setIsConverting(false);
  };

  const handleImportDiagram = () => {
    if (conversionResult?.success) {
      onImport(conversionResult.elements, conversionResult.connections);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-[#252526] border border-[#3e3e42] rounded-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#3e3e42]">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Upload size={20} />
            <span>Code to UML Conversion</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Paste source code to automatically generate UML class diagrams using Rule-Based Model Transformation
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Language Selector */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Programming Language / Format
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isConverting}
              className="w-full bg-[#3c3c3c] text-white px-3 py-2 rounded border border-[#3e3e42] focus:outline-none focus:border-[#007acc] disabled:opacity-50"
            >
              <option value="Java">Java</option>
              <option value="Python">Python</option>
              <option value="JavaScript">JavaScript</option>
              <option value="PlantUML">PlantUML</option>
            </select>
          </div>

          {/* File Upload Section */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Upload Code File (Optional)
            </label>
            <div className="flex items-center space-x-3">
              <label className="flex-1 cursor-pointer">
                <div className="bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white px-4 py-2 rounded border border-[#3e3e42] transition-colors text-center">
                  📁 Choose File (.java, .py, .js, .puml)
                </div>
                <input
                  type="file"
                  accept=".java,.py,.js,.jsx,.ts,.tsx,.puml,.plantuml"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isConverting}
                />
              </label>
              {sourceCode && (
                <button
                  onClick={() => {
                    setSourceCode('');
                    setConversionResult(null);
                  }}
                  className="px-4 py-2 bg-[#4a4a4f] hover:bg-[#5a5a5f] text-white rounded transition-colors"
                  title="Clear"
                >
                  🗑️ Clear
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Upload a file or paste code below
            </p>
          </div>

          {/* Code Input */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Source Code or Diagram Definition
            </label>
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder={`Paste your ${language} ${language === 'PlantUML' ? 'diagram definition' : 'source code'} here...`}
              disabled={isConverting}
              className="w-full h-64 bg-[#1e1e1e] text-white px-3 py-2 rounded border border-[#3e3e42] font-mono text-sm focus:outline-none focus:border-[#007acc] resize-none disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 mt-1">
              {language === 'PlantUML' 
                ? 'PlantUML format: Pass spacing for proper parsing' 
                : 'Supported: Classes, attributes, methods, inheritance, and composition'}
            </p>
          </div>

          {/* Convert Button */}
          <button
            onClick={handleConvert}
            disabled={!sourceCode.trim() || isConverting || (conversionResult?.success)}
            className="w-full bg-[#007acc] hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
          >
            {isConverting ? 'Converting...' : 'Convert to UML Diagram'}
          </button>

          {/* Conversion Result */}
          {conversionResult && (
            <div className={`p-4 rounded-lg border-l-4 ${
              conversionResult.success
                ? 'bg-[#1e3a1f] border-green-500 text-green-100'
                : 'bg-[#3a1f1f] border-red-500 text-red-100'
            }`}>
              <div className="flex items-start space-x-3">
                {conversionResult.success ? (
                  <CheckCircle size={20} className="flex-shrink-0 mt-0.5 text-green-400" />
                ) : (
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-red-400" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{conversionResult.message}</p>
                  
                  {/* Metadata */}
                  {conversionResult.metadata && (
                    <div className="text-sm mt-3 space-y-1 grid grid-cols-2 gap-2">
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Classes: </span>
                        <span className="font-mono">{conversionResult.metadata.totalClasses}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Methods: </span>
                        <span className="font-mono">{conversionResult.metadata.totalMethods}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Attributes: </span>
                        <span className="font-mono">{conversionResult.metadata.totalAttributes}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Relationships: </span>
                        <span className="font-mono">{conversionResult.metadata.relationships}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3e3e42] flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImportDiagram}
            disabled={!conversionResult?.success}
            className="px-4 py-2 bg-[#007acc] hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors font-medium"
          >
            Import to Diagram
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeImportModal;