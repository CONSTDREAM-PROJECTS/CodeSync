// Code Generator Service - Implements all 6 algorithms
class CodeGenerator {
  
  // Algorithm 1: Model-to-Model (M2M) Transformation
  static standardizeModel(elements) {
    return elements.map(element => ({
      ...element,
      // Normalize naming
      name: this.normalizeIdentifier(element.name),
      // Standardize properties
      properties: this.standardizeProperties(element.properties || {}),
      // Apply consistent formatting
      attributes: element.attributes?.map(attr => ({
        ...attr,
        name: this.normalizeIdentifier(attr.name),
        type: this.normalizeType(attr.type)
      })),
      methods: element.methods?.map(method => ({
        ...method,
        name: this.normalizeIdentifier(method.name, 'method'),
        returnType: this.normalizeType(method.returnType)
      }))
    }));
  }

  // Algorithm 2: Design Pattern Detection
  static detectPatterns(elements) {
    const patterns = [];
    
    // Detect Singleton Pattern
    elements.forEach(element => {
      if (element.type === 'class') {
        const hasPrivateConstructor = element.methods?.some(m => 
          m.name === 'constructor' && m.visibility === 'private'
        );
        const hasGetInstanceMethod = element.methods?.some(m => 
          m.name.toLowerCase().includes('getinstance')
        );
        if (hasPrivateConstructor && hasGetInstanceMethod) {
          patterns.push({ element: element.name, pattern: 'Singleton' });
        }
      }
    });

    // Detect Factory Pattern
    elements.forEach(element => {
      if (element.type === 'class') {
        const hasCreateMethods = element.methods?.filter(m => 
          m.name.toLowerCase().startsWith('create')
        ).length > 2;
        if (hasCreateMethods) {
          patterns.push({ element: element.name, pattern: 'Factory' });
        }
      }
    });

    // Detect Observer Pattern
    const hasObserver = elements.some(el => el.name.toLowerCase().includes('observer'));
    const hasSubject = elements.some(el => el.name.toLowerCase().includes('subject'));
    if (hasObserver && hasSubject) {
      patterns.push({ pattern: 'Observer' });
    }

    return patterns;
  }

  // Algorithm 3: Naming Convention Optimization
  static optimizeNaming(name, context = 'class') {
    // Expand common abbreviations
    const abbreviations = {
      'usr': 'user',
      'pwd': 'password',
      'pws': 'password',
      'addr': 'address',
      'num': 'number',
      'btn': 'button',
      'txt': 'text',
      'img': 'image',
      'doc': 'document',
      'db': 'database',
      'id': 'identifier',
      'qty': 'quantity',
      'amt': 'amount',
      'msg': 'message',
      'cmd': 'command',
      'cfg': 'configuration',
      'tmp': 'temporary',
      'val': 'value',
      'str': 'string',
      'int': 'integer'
    };

    let optimized = name.toLowerCase();
    
    // Replace abbreviations
    Object.keys(abbreviations).forEach(abbr => {
      optimized = optimized.replace(new RegExp('\\b' + abbr + '\\b', 'g'), abbreviations[abbr]);
    });

    // Apply proper case convention
    if (context === 'class') {
      // PascalCase for classes
      return optimized.split(/[\s_-]+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('');
    } else if (context === 'method' || context === 'variable') {
      // camelCase for methods and variables
      const words = optimized.split(/[\s_-]+/);
      return words[0] + words.slice(1).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('');
    }

    return optimized;
  }

  // Algorithm 4: Model-to-Text (M2T) Code Generation
  static generateCode(elements, language = 'Java', diagramType = 'class') {
    // First standardize the model (M2M)
    const standardizedElements = this.standardizeModel(elements);
    
    // Detect patterns
    const patterns = this.detectPatterns(standardizedElements);
    
    let code = '';
    
    switch (language) {
      case 'Java':
        code = this.generateJavaCode(standardizedElements, diagramType, patterns);
        break;
      case 'Python':
        code = this.generatePythonCode(standardizedElements, diagramType, patterns);
        break;
      case 'JavaScript':
        code = this.generateJavaScriptCode(standardizedElements, diagramType, patterns);
        break;
      case 'C++':
        code = this.generateCppCode(standardizedElements, diagramType, patterns);
        break;
      case 'C#':
        code = this.generateCSharpCode(standardizedElements, diagramType, patterns);
        break;
      default:
        code = this.generateJavaCode(standardizedElements, diagramType, patterns);
    }

    // Apply optimization
    code = this.optimizeCode(code, language);
    
    return code;
  }

  // Algorithm 5: Code Optimization
  static optimizeCode(code, language) {
    let optimized = code;

    // Remove duplicate empty lines
    optimized = optimized.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Remove trailing whitespace
    optimized = optimized.split('\n').map(line => line.trimEnd()).join('\n');

    // Optimize imports (remove duplicates)
    if (language === 'Java' || language === 'C#') {
      const lines = optimized.split('\n');
      const imports = new Set();
      const nonImports = [];
      
      lines.forEach(line => {
        if (line.trim().startsWith('import ') || line.trim().startsWith('using ')) {
          imports.add(line);
        } else {
          nonImports.push(line);
        }
      });
      
      optimized = [...Array.from(imports).sort(), '', ...nonImports].join('\n');
    }

    // Remove unnecessary spaces
    optimized = optimized.replace(/ +/g, ' ');

    return optimized;
  }

  // Algorithm 6: Code Quality Analysis
  static analyzeCodeQuality(code, language) {
    const metrics = {
      lines: code.split('\n').length,
      complexity: this.calculateComplexity(code),
      maintainability: 0,
      duplications: this.findDuplicateLines(code),
      namingScore: 0,
      issues: []
    };

    // Check naming conventions
    const classPattern = language === 'Python' ? /class\s+([a-z_][a-z0-9_]*)/gi : /class\s+([A-Z][a-zA-Z0-9]*)/g;
    const classMatches = code.match(classPattern) || [];
    const properNaming = classMatches.every(match => {
      const name = match.split(/\s+/)[1];
      return language === 'Python' ? /^[A-Z]/.test(name) : /^[A-Z]/.test(name);
    });

    metrics.namingScore = properNaming ? 100 : 70;

    // Calculate maintainability index (simplified)
    const avgLineLength = code.split('\n').reduce((sum, line) => sum + line.length, 0) / metrics.lines;
    metrics.maintainability = Math.max(0, 100 - (metrics.complexity * 2) - (avgLineLength / 2));

    // Check for common issues
    if (code.includes('TODO') || code.includes('FIXME')) {
      metrics.issues.push('Contains TODO/FIXME comments');
    }
    if (metrics.duplications.length > 0) {
      metrics.issues.push(`Found ${metrics.duplications.length} duplicate code blocks`);
    }
    if (metrics.complexity > 20) {
      metrics.issues.push('High cyclomatic complexity detected');
    }

    return metrics;
  }

  // Helper Methods
  static normalizeIdentifier(name, context = 'class') {
    if (!name) return 'Unnamed';
    return this.optimizeNaming(name, context);
  }

  static normalizeType(type) {
    const typeMap = {
      'str': 'String',
      'int': 'Integer',
      'bool': 'Boolean',
      'float': 'Double',
      'list': 'List',
      'dict': 'Map'
    };
    return typeMap[type?.toLowerCase()] || type || 'Object';
  }

  static standardizeProperties(properties) {
    return Object.keys(properties).reduce((acc, key) => {
      acc[this.normalizeIdentifier(key, 'variable')] = properties[key];
      return acc;
    }, {});
  }

  static calculateComplexity(code) {
    // Simplified cyclomatic complexity
    const controlFlowKeywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||'];
    let complexity = 1;
    
    controlFlowKeywords.forEach(keyword => {
      const regex = new RegExp('\\b' + keyword + '\\b', 'g');
      const matches = code.match(regex);
      if (matches) complexity += matches.length;
    });

    return complexity;
  }

  static findDuplicateLines(code) {
    const lines = code.split('\n').filter(line => line.trim().length > 10);
    const duplicates = [];
    const seen = new Set();

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (seen.has(trimmed)) {
        duplicates.push({ line: index + 1, content: trimmed });
      }
      seen.add(trimmed);
    });

    return duplicates;
  }

  // Language-specific code generators
  static generateJavaCode(elements, diagramType, patterns) {
    let code = '// Generated Java Code\n';
    code += '// Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';

    if (diagramType === 'class') {
      elements.filter(el => el.type === 'class').forEach(element => {
        code += `public class ${element.name} {\n`;
        
        // Attributes
        if (element.attributes && element.attributes.length > 0) {
          code += '\n    // Attributes\n';
          element.attributes.forEach(attr => {
            code += `    private ${attr.type || 'String'} ${attr.name};\n`;
          });
        }

        // Constructor
        code += '\n    // Constructor\n';
        code += `    public ${element.name}() {\n`;
        code += '        // Initialize attributes\n';
        code += '    }\n';

        // Getters and Setters
        if (element.attributes && element.attributes.length > 0) {
          code += '\n    // Getters and Setters\n';
          element.attributes.forEach(attr => {
            const capitalized = attr.name.charAt(0).toUpperCase() + attr.name.slice(1);
            code += `    public ${attr.type || 'String'} get${capitalized}() {\n`;
            code += `        return ${attr.name};\n`;
            code += '    }\n\n';
            code += `    public void set${capitalized}(${attr.type || 'String'} ${attr.name}) {\n`;
            code += `        this.${attr.name} = ${attr.name};\n`;
            code += '    }\n\n';
          });
        }

        // Methods
        if (element.methods && element.methods.length > 0) {
          code += '    // Methods\n';
          element.methods.forEach(method => {
            code += `    public ${method.returnType || 'void'} ${method.name}() {\n`;
            code += '        // TODO: Implement method\n';
            code += '    }\n\n';
          });
        }

        code += '}\n\n';
      });
    } else if (diagramType === 'usecase') {
      code += '// Use Case Implementation\n';
      elements.filter(el => el.type === 'usecase').forEach(element => {
        code += `public interface ${element.name}UseCase {\n`;
        code += `    void execute();\n`;
        code += '}\n\n';
      });
    } else if (diagramType === 'sequence') {
      code += '// Sequence Diagram - API Implementation\n';
      elements.filter(el => el.type === 'lifeline').forEach(element => {
        code += `public class ${element.name}Service {\n`;
        code += '    public void processRequest() {\n';
        code += '        // Handle request\n';
        code += '    }\n';
        code += '}\n\n';
      });
    }

    return code;
  }

  static generatePythonCode(elements, diagramType, patterns) {
    let code = '# Generated Python Code\n';
    code += '# Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';

    if (diagramType === 'class') {
      elements.filter(el => el.type === 'class').forEach(element => {
        code += `class ${element.name}:\n`;
        code += '    """Class generated from UML diagram"""\n\n';
        
        // Constructor
        code += '    def __init__(self):\n';
        if (element.attributes && element.attributes.length > 0) {
          element.attributes.forEach(attr => {
            code += `        self.${attr.name} = None\n`;
          });
        } else {
          code += '        pass\n';
        }

        // Methods
        if (element.methods && element.methods.length > 0) {
          code += '\n';
          element.methods.forEach(method => {
            code += `    def ${method.name}(self):\n`;
            code += '        """TODO: Implement method"""\n';
            code += '        pass\n\n';
          });
        }

        code += '\n';
      });
    } else if (diagramType === 'usecase') {
      code += '# Use Case Implementation\n';
      elements.filter(el => el.type === 'usecase').forEach(element => {
        code += `class ${element.name}UseCase:\n`;
        code += '    def execute(self):\n';
        code += '        """Execute use case"""\n';
        code += '        pass\n\n';
      });
    }

    return code;
  }

  static generateJavaScriptCode(elements, diagramType, patterns) {
    let code = '// Generated JavaScript Code\n';
    code += '// Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';

    if (diagramType === 'class') {
      elements.filter(el => el.type === 'class').forEach(element => {
        code += `class ${element.name} {\n`;
        
        // Constructor
        code += '    constructor() {\n';
        if (element.attributes && element.attributes.length > 0) {
          element.attributes.forEach(attr => {
            code += `        this.${attr.name} = null;\n`;
          });
        }
        code += '    }\n\n';

        // Methods
        if (element.methods && element.methods.length > 0) {
          element.methods.forEach(method => {
            code += `    ${method.name}() {\n`;
            code += '        // TODO: Implement method\n';
            code += '    }\n\n';
          });
        }

        code += '}\n\n';
      });
    } else if (diagramType === 'usecase') {
      code += '// Use Case Implementation\n';
      elements.filter(el => el.type === 'usecase').forEach(element => {
        code += `class ${element.name}UseCase {\n`;
        code += '    execute() {\n';
        code += '        // Execute use case\n';
        code += '    }\n';
        code += '}\n\n';
      });
    }

    return code;
  }

  static generateCppCode(elements, diagramType, patterns) {
    let code = '// Generated C++ Code\n';
    code += '// Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';
    code += '#include <iostream>\n';
    code += '#include <string>\n\n';

    if (diagramType === 'class') {
      elements.filter(el => el.type === 'class').forEach(element => {
        code += `class ${element.name} {\n`;
        code += 'private:\n';
        
        // Attributes
        if (element.attributes && element.attributes.length > 0) {
          element.attributes.forEach(attr => {
            code += `    ${attr.type || 'std::string'} ${attr.name};\n`;
          });
        }

        code += '\npublic:\n';
        // Constructor
        code += `    ${element.name}() {}\n\n`;

        // Methods
        if (element.methods && element.methods.length > 0) {
          element.methods.forEach(method => {
            code += `    ${method.returnType || 'void'} ${method.name}() {\n`;
            code += '        // TODO: Implement method\n';
            code += '    }\n\n';
          });
        }

        code += '};\n\n';
      });
    }

    return code;
  }

  static generateCSharpCode(elements, diagramType, patterns) {
    let code = '// Generated C# Code\n';
    code += '// Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';
    code += 'using System;\n\n';

    if (diagramType === 'class') {
      elements.filter(el => el.type === 'class').forEach(element => {
        code += `public class ${element.name}\n{\n`;
        
        // Attributes
        if (element.attributes && element.attributes.length > 0) {
          element.attributes.forEach(attr => {
            code += `    private ${attr.type || 'string'} ${attr.name};\n`;
          });
          code += '\n';
        }

        // Properties
        if (element.attributes && element.attributes.length > 0) {
          element.attributes.forEach(attr => {
            const capitalized = attr.name.charAt(0).toUpperCase() + attr.name.slice(1);
            code += `    public ${attr.type || 'string'} ${capitalized}\n`;
            code += '    {\n';
            code += `        get { return ${attr.name}; }\n`;
            code += `        set { ${attr.name} = value; }\n`;
            code += '    }\n\n';
          });
        }

        // Constructor
        code += `    public ${element.name}()\n    {\n`;
        code += '        // Initialize\n';
        code += '    }\n\n';

        // Methods
        if (element.methods && element.methods.length > 0) {
          element.methods.forEach(method => {
            code += `    public ${method.returnType || 'void'} ${method.name}()\n    {\n`;
            code += '        // TODO: Implement method\n';
            code += '    }\n\n';
          });
        }

        code += '}\n\n';
      });
    }

    return code;
  }
}

export default CodeGenerator;