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
  static generateCode(elements, connections = [], language = 'Java', diagramType = 'class') {
    // First standardize the model (M2M)
    const standardizedElements = this.standardizeModel(elements);
    
    // Detect patterns
    const patterns = this.detectPatterns(standardizedElements);
    
    let code = '';
    
    // Route based on diagram type
    if (diagramType === 'object') {
      code = this.generateObjectDiagramCode(standardizedElements, connections, language, patterns);
    } else {
      switch (language) {
        case 'Java':
          code = this.generateJavaCode(standardizedElements, connections, diagramType, patterns);
          break;
        case 'Python':
          code = this.generatePythonCode(standardizedElements, connections, diagramType, patterns);
          break;
        case 'JavaScript':
          code = this.generateJavaScriptCode(standardizedElements, connections, diagramType, patterns);
          break;
        default:
          code = this.generateJavaCode(standardizedElements, connections, diagramType, patterns);
      }
    }

    // Apply optimization
    code = this.optimizeCode(code, language);
    
    return code;
  }

  // Algorithm 6: Relationship-based Code Generation
  static generateRelationshipImports(connections, elements, language) {
    const imports = new Set();

    connections.forEach(connection => {
      const sourceElement = elements.find(el => el.id === connection.sourceId);
      const targetElement = elements.find(el => el.id === connection.targetId);

      if (!sourceElement || !targetElement) return;

      switch (connection.type) {
        case 'composition':
        case 'aggregation':
          // Add imports for collection types if needed
          if (language === 'Java') {
            if (connection.multiplicity?.includes('*') || connection.multiplicity?.includes('0..*')) {
              imports.add('import java.util.List;');
              imports.add('import java.util.ArrayList;');
            }
          }
          break;
        case 'association':
          // Add imports for related classes
          if (language === 'Java' && connection.multiplicity?.includes('*')) {
            imports.add('import java.util.List;');
            imports.add('import java.util.ArrayList;');
          }
          break;
      }
    });

    return Array.from(imports).join('\n');
  }

  static generateRelationshipAttributes(element, connections, elements, language) {
    let attributes = '';

    // Find all relationships where this element is the target
    const incomingRelationships = connections.filter(conn => conn.targetId === element.id);

    incomingRelationships.forEach(connection => {
      const sourceElement = elements.find(el => el.id === connection.sourceId);
      if (!sourceElement) return;

      const sourceName = sourceElement.name;
      const multiplicity = connection.multiplicity || '1';
      const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');

      switch (connection.type) {
        case 'composition':
          if (isMultiple) {
            attributes += `    private List<${sourceName}> ${sourceName.toLowerCase()}s = new ArrayList<>();\n`;
          } else {
            attributes += `    private ${sourceName} ${sourceName.toLowerCase()};\n`;
          }
          break;
        case 'aggregation':
          if (isMultiple) {
            attributes += `    private List<${sourceName}> ${sourceName.toLowerCase()}s = new ArrayList<>();\n`;
          } else {
            attributes += `    private ${sourceName} ${sourceName.toLowerCase()};\n`;
          }
          break;
        case 'association':
          if (isMultiple) {
            attributes += `    private List<${sourceName}> ${sourceName.toLowerCase()}s = new ArrayList<>();\n`;
          } else {
            attributes += `    private ${sourceName} ${sourceName.toLowerCase()};\n`;
          }
          break;
      }
    });

    return attributes;
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

  static parseParameters(paramString, language) {
    // Parse parameters like "newEmail: String, count: int" 
    if (!paramString || paramString.trim() === '') return '';
    
    const params = paramString.split(',').map(p => p.trim());
    
    if (language === 'Java') {
      return params.map(param => {
        const parts = param.split(':').map(p => p.trim());
        if (parts.length === 2) {
          return `${parts[1]} ${parts[0]}`;
        }
        return param;
      }).join(', ');
    } else if (language === 'Python') {
      return params.map(param => {
        const parts = param.split(':').map(p => p.trim());
        return parts[0]; // Python doesn't need type in signature
      }).join(', ');
    } else if (language === 'JavaScript') {
      return params.map(param => {
        const parts = param.split(':').map(p => p.trim());
        return parts[0]; // JavaScript doesn't use types
      }).join(', ');
    }
    
    return paramString;
  }

  static generateImplementationSuggestion(method, language) {
    const methodName = method.name.toLowerCase();
    const params = method.parameters || '';
    const returnType = method.returnType || 'void';
    let suggestion = '';

    // Extract parameter names
    const paramNames = params.split(',').map(p => {
      const parts = p.split(':').map(x => x.trim());
      return parts[0];
    }).filter(Boolean);

    // Smart suggestions based on method name patterns
    if (methodName.includes('login') || methodName.includes('authenticate')) {
      suggestion += '        // Validate credentials\n';
      suggestion += '        // Check username and password against database\n';
      if (paramNames.length >= 2) {
        suggestion += `        // Authenticate ${paramNames[0]} with ${paramNames[1]}\n`;
      }
      suggestion += '        // Return true if valid, false otherwise\n';
    } 
    else if (methodName.includes('update')) {
      suggestion += '        // Validate input parameters\n';
      if (paramNames.length > 0) {
        suggestion += `        // Update with new value: ${paramNames[0]}\n`;
      }
      suggestion += '        // Save changes to database\n';
      suggestion += '        // Return success status\n';
    }
    else if (methodName.includes('delete') || methodName.includes('remove')) {
      suggestion += '        // Check if item exists\n';
      suggestion += '        // Delete from database\n';
      suggestion += '        // Return success status\n';
    }
    else if (methodName.includes('create') || methodName.includes('add')) {
      suggestion += '        // Validate input data\n';
      if (paramNames.length > 0) {
        suggestion += `        // Create new entity with: ${paramNames.join(', ')}\n`;
      }
      suggestion += '        // Save to database\n';
      suggestion += '        // Return created object or success status\n';
    }
    else if (methodName.includes('get') || methodName.includes('find') || methodName.includes('fetch')) {
      suggestion += '        // Query database\n';
      if (paramNames.length > 0) {
        suggestion += `        // Find by: ${paramNames.join(', ')}\n`;
      }
      suggestion += '        // Return the requested data\n';
    }
    else if (methodName.includes('save')) {
      suggestion += '        // Validate data\n';
      suggestion += '        // Persist to database\n';
      suggestion += '        // Return success status\n';
    }
    else if (methodName.includes('calculate') || methodName.includes('compute')) {
      suggestion += '        // Perform calculation\n';
      if (paramNames.length > 0) {
        suggestion += `        // Use parameters: ${paramNames.join(', ')}\n`;
      }
      suggestion += '        // Return computed result\n';
    }
    else if (methodName.includes('validate') || methodName.includes('check') || methodName.includes('verify')) {
      suggestion += '        // Validate the input\n';
      if (paramNames.length > 0) {
        suggestion += `        // Check ${paramNames.join(', ')} against rules\n`;
      }
      suggestion += '        // Return validation result\n';
    }
    else if (methodName.includes('send') || methodName.includes('notify')) {
      suggestion += '        // Prepare message/notification\n';
      if (paramNames.length > 0) {
        suggestion += `        // Send to: ${paramNames[0]}\n`;
      }
      suggestion += '        // Execute send operation\n';
      suggestion += '        // Return success status\n';
    }
    else if (methodName.includes('reset') || methodName.includes('clear')) {
      suggestion += '        // Reset/clear the data\n';
      if (paramNames.length > 0) {
        suggestion += `        // Set new value: ${paramNames.join(', ')}\n`;
      }
      suggestion += '        // Update state\n';
    }
    else if (methodName.includes('load') || methodName.includes('initialize') || methodName.includes('init')) {
      suggestion += '        // Initialize components\n';
      suggestion += '        // Load necessary data\n';
      suggestion += '        // Set up initial state\n';
    }
    else if (methodName.startsWith('is') || methodName.startsWith('has') || methodName.startsWith('can')) {
      suggestion += '        // Check condition\n';
      if (paramNames.length > 0) {
        suggestion += `        // Evaluate: ${paramNames.join(', ')}\n`;
      }
      suggestion += '        // Return boolean result\n';
    }
    else {
      // Generic suggestion
      suggestion += '        // TODO: Implement method logic\n';
      if (paramNames.length > 0) {
        suggestion += `        // Process parameters: ${paramNames.join(', ')}\n`;
      }
      if (returnType !== 'void') {
        suggestion += '        // Return appropriate value\n';
      }
    }

    return suggestion;
  }

  static getDefaultReturnValue(returnType, language) {
    const type = returnType.toLowerCase();
    
    if (type === 'boolean' || type === 'bool') {
      return 'false';
    } else if (type === 'int' || type === 'integer' || type === 'long' || type === 'short' || type === 'byte') {
      return '0';
    } else if (type === 'double' || type === 'float') {
      return '0.0';
    } else if (type === 'char' || type === 'character') {
      return "'\\0'";
    } else if (type === 'string') {
      return '""';
    } else {
      return 'null';
    }
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
  static generateJavaCode(elements, connections = [], diagramType, patterns) {
    let code = '// Generated Java Code\n';
    code += '// Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';

    // Process relationships for imports and dependencies
    const relationshipImports = this.generateRelationshipImports(connections, elements, 'Java');
    if (relationshipImports) {
      code += relationshipImports + '\n';
    }

    if (diagramType === 'class') {
      elements.filter(el => el.type === 'class').forEach(element => {
        // Check for inheritance
        const inheritance = connections.find(conn =>
          conn.type === 'inheritance' && conn.targetId === element.id
        );
        const parentClass = inheritance ? elements.find(el => el.id === inheritance.sourceId)?.name : null;

        // Check for interfaces
        const interfaces = connections
          .filter(conn => conn.type === 'implementation' && conn.targetId === element.id)
          .map(conn => elements.find(el => el.id === conn.sourceId)?.name)
          .filter(name => name);

        // Generate class declaration with inheritance/interfaces
        let classDeclaration = 'public ';
        if (element.type === 'abstract') {
          classDeclaration += 'abstract ';
        }
        classDeclaration += `class ${element.name}`;
        if (parentClass) {
          classDeclaration += ` extends ${parentClass}`;
        }
        if (interfaces.length > 0) {
          classDeclaration += ` implements ${interfaces.join(', ')}`;
        }
        code += `${classDeclaration} {\n`;
        
        // Attributes from relationships
        const relationshipAttributes = this.generateRelationshipAttributes(element, connections, elements, 'Java');
        if (relationshipAttributes) {
          code += '\n    // Relationship Attributes\n';
          code += relationshipAttributes;
        }

        // Regular Attributes
        if (element.attributes && element.attributes.length > 0) {
          code += '\n    // Attributes\n';
          element.attributes.forEach(attr => {
            const modifier = attr.isStatic ? 'static ' : '';
            code += `    private ${modifier}${attr.type || 'String'} ${attr.name};\n`;
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
            const modifier = method.isAbstract ? 'abstract ' : method.isStatic ? 'static ' : '';
            const params = method.parameters ? this.parseParameters(method.parameters, 'Java') : '';
            code += `    public ${modifier}${method.returnType || 'void'} ${method.name}(${params})`;

            if (method.isAbstract) {
              code += ';\n\n';
            } else {
              code += ' {\n';

              // Smart implementation suggestion
              const suggestion = this.generateImplementationSuggestion(method, 'Java');
              code += suggestion;

              if (method.returnType && method.returnType !== 'void') {
                const defaultReturn = this.getDefaultReturnValue(method.returnType, 'Java');
                code += `        return ${defaultReturn};\n`;
              }
              code += '    }\n\n';
            }
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

  static generatePythonCode(elements, connections = [], diagramType, patterns) {
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
            const params = method.parameters ? this.parseParameters(method.parameters, 'Python') : '';
            const paramStr = params ? `self, ${params}` : 'self';
            code += `    def ${method.name}(${paramStr}):\n`;
            
            // Smart implementation suggestion
            const suggestion = this.generateImplementationSuggestion(method, 'Python');
            code += suggestion.replace(/\/\//g, '#'); // Convert // to # for Python
            
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

  static generateJavaScriptCode(elements, connections = [], diagramType, patterns) {
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
            const params = method.parameters ? this.parseParameters(method.parameters, 'JavaScript') : '';
            code += `    ${method.name}(${params}) {\n`;
            
            // Smart implementation suggestion
            const suggestion = this.generateImplementationSuggestion(method, 'JavaScript');
            code += suggestion;
            
            if (method.returnType && method.returnType !== 'void') {
              const defaultReturn = this.getDefaultReturnValue(method.returnType, 'JavaScript');
              code += `        return ${defaultReturn};\n`;
            }
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

  // Algorithm 7: Object Diagram Code Generation
  static generateObjectDiagramCode(elements, connections = [], language = 'Java', patterns) {
    let code = '';
    
    switch (language) {
      case 'Java':
        code += this.generateJavaObjectDiagram(elements, connections, patterns);
        break;
      case 'Python':
        code += this.generatePythonObjectDiagram(elements, connections, patterns);
        break;
      case 'JavaScript':
        code += this.generateJavaScriptObjectDiagram(elements, connections, patterns);
        break;
      default:
        code += '// Object Diagram - Language not supported\n';
    }
    
    return code;
  }

  static generateJavaObjectDiagram(elements, connections = [], patterns) {
    let code = '// Generated Java Object Diagram (Runtime Snapshot with Interactions)\n';
    code += '// Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';
    code += 'public class ObjectDiagramSnapshot {\n\n';
    code += '    public static void main(String[] args) {\n';

    const objects = elements.filter(el => el.type === 'object');
    
    // Create object instances
    code += '        // Step 1: Initialize Objects\n';
    objects.forEach(obj => {
      const className = obj.className || 'Object';
      code += `        ${className} ${obj.name} = new ${className}();\n`;
    });
    code += '\n';

    // Set attribute values and initial state
    code += '        // Step 2: Set Initial State & Attributes\n';
    objects.forEach(obj => {
      if (obj.attributeValues && Object.keys(obj.attributeValues).length > 0) {
        Object.entries(obj.attributeValues).forEach(([attrName, value]) => {
          code += `        ${obj.name}.${attrName} = ${this.formatValue(value)};\n`;
        });
      }
      if (obj.state) {
        code += `        ${obj.name}.setState("${obj.state}");  // Object state\n`;
      }
    });
    code += '\n';

    // Create links and show relationships
    if (connections.length > 0) {
      code += '        // Step 3: Establish Links (Object Relationships)\n';
      connections.forEach((conn, idx) => {
        const source = objects.find(o => o.id === conn.sourceId);
        const target = objects.find(o => o.id === conn.targetId);
        if (source && target) {
          const roleLabel = conn.label || 'references';
          const multiplicity = conn.multiplicity || '1';
          code += `        // Link ${idx + 1}: ${source.name} --[${roleLabel}]--> ${target.name} (${multiplicity})\n`;
          code += `        ${source.name}.${this.toCamelCase(target.name)} = ${target.name};\n`;
        }
      });
      code += '\n';
    }

    // Interaction sequence - method calls and state transitions
    code += '        // Step 4: Execute Interactions & Method Calls\n';
    objects.forEach(obj => {
      if (obj.methods && obj.methods.length > 0) {
        const calcMethod = obj.methods.find(m => m.name.toLowerCase().includes('calculate') || m.name.toLowerCase().includes('process'));
        if (calcMethod) {
          code += `        ${obj.name}.${this.toCamelCase(calcMethod.name)}();  // Execute behavior\n`;
        }
      }
    });

    // Validate constraints
    code += '\n        // Step 5: Validation & Constraints\n';
    objects.forEach(obj => {
      if (obj.attributeValues) {
        code += `        // Validate ${obj.name} constraints\n`;
        code += `        assert ${obj.name} != null : "${obj.name} must not be null";\n`;
      }
    });

    code += '\n        System.out.println("Object Diagram Snapshot Complete");\n';
    code += '    }\n';
    code += '}\n';
    return code;
  }

  static generatePythonObjectDiagram(elements, connections = [], patterns) {
    let code = '# Generated Python Object Diagram (Runtime Snapshot with Interactions)\n';
    code += '# Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';

    const objects = elements.filter(el => el.type === 'object');
    
    code += 'class ObjectDiagramSnapshot:\n';
    code += '    def __init__(self):\n';
    code += '        """Initialize object diagram snapshot with interactions"""\n';
    code += '\n';
    code += '        # Step 1: Initialize Objects\n';
    
    if (objects.length === 0) {
      code += '        pass\n';
    } else {
      objects.forEach(obj => {
        const className = obj.className || 'Object';
        code += `        self.${obj.name} = ${className}()\n`;
      });
    }

    code += '\n        # Step 2: Set Initial State & Attributes\n';
    objects.forEach(obj => {
      if (obj.attributeValues && Object.keys(obj.attributeValues).length > 0) {
        Object.entries(obj.attributeValues).forEach(([attrName, value]) => {
          code += `        self.${obj.name}.${attrName} = ${this.formatPythonValue(value)}\n`;
        });
      }
      if (obj.state) {
        code += `        self.${obj.name}.state = "${obj.state}"  # Object state\n`;
      }
    });

    code += '\n        # Step 3: Establish Links (Object Relationships)\n';
    if (connections.length > 0) {
      connections.forEach((conn, idx) => {
        const source = objects.find(o => o.id === conn.sourceId);
        const target = objects.find(o => o.id === conn.targetId);
        if (source && target) {
          const roleLabel = conn.label || 'references';
          const multiplicity = conn.multiplicity || '1';
          code += `        # Link ${idx + 1}: ${source.name} --[${roleLabel}]--> ${target.name} (${multiplicity})\n`;
          code += `        self.${source.name}.${this.toSnakeCase(target.name)} = self.${target.name}\n`;
        }
      });
    }

    code += '\n        # Step 4: Execute Interactions & Method Calls\n';
    objects.forEach(obj => {
      if (obj.methods && obj.methods.length > 0) {
        const calcMethod = obj.methods.find(m => m.name.toLowerCase().includes('calculate') || m.name.toLowerCase().includes('process'));
        if (calcMethod) {
          code += `        self.${obj.name}.${this.toSnakeCase(calcMethod.name)}()  # Execute behavior\n`;
        }
      }
    });

    code += '\n        # Step 5: Validation & Constraints\n';
    objects.forEach(obj => {
      if (obj.attributeValues) {
        code += `        # Validate ${obj.name} constraints\n`;
        code += `        assert self.${obj.name} is not None, "${obj.name} must not be None"\n`;
      }
    });

    code += '\n\n    def display_snapshot(self):\n';
    code += '        """Display the current state of all objects"""\n';
    objects.forEach(obj => {
      code += `        print(f"${obj.name}: {self.${obj.name}}")\n`;
    });

    code += '\n\nif __name__ == "__main__":\n';
    code += '    snapshot = ObjectDiagramSnapshot()\n';
    code += '    snapshot.display_snapshot()\n';
    code += '    print("Object diagram snapshot created")\n';
    
    return code;
  }

  static generateJavaScriptObjectDiagram(elements, connections = [], patterns) {
    let code = '// Generated JavaScript Object Diagram (Runtime Snapshot with Interactions)\n';
    code += '// Detected Patterns: ' + (patterns.length > 0 ? patterns.map(p => p.pattern).join(', ') : 'None') + '\n\n';

    const objects = elements.filter(el => el.type === 'object');
    
    code += 'class ObjectDiagramSnapshot {\n';
    code += '    constructor() {\n';
    code += '        console.log("Step 1: Initialize Objects");\n';
    
    objects.forEach(obj => {
      const className = obj.className || 'Object';
      code += `        this.${obj.name} = new ${className}();\n`;
    });

    code += '\n        console.log("Step 2: Set Initial State & Attributes");\n';
    objects.forEach(obj => {
      if (obj.attributeValues && Object.keys(obj.attributeValues).length > 0) {
        Object.entries(obj.attributeValues).forEach(([attrName, value]) => {
          code += `        this.${obj.name}.${attrName} = ${this.formatJSValue(value)};\n`;
        });
      }
      if (obj.state) {
        code += `        this.${obj.name}.state = "${obj.state}";  // Object state\n`;
      }
    });

    code += '\n        this.setupLinks();\n';
    code += '        this.executeInteractions();\n';
    code += '        this.validateConstraints();\n';
    code += '    }\n\n';
    
    code += '    setupLinks() {\n';
    code += '        console.log("Step 3: Establish Links (Object Relationships)");\n';
    if (connections.length > 0) {
      connections.forEach((conn, idx) => {
        const source = objects.find(o => o.id === conn.sourceId);
        const target = objects.find(o => o.id === conn.targetId);
        if (source && target) {
          const roleLabel = conn.label || 'references';
          const multiplicity = conn.multiplicity || '1';
          code += `        // Link ${idx + 1}: ${source.name} --[${roleLabel}]--> ${target.name} (${multiplicity})\n`;
          code += `        this.${source.name}.${this.toCamelCase(target.name)} = this.${target.name};\n`;
        }
      });
    }
    code += '    }\n\n';

    code += '    executeInteractions() {\n';
    code += '        console.log("Step 4: Execute Interactions & Method Calls");\n';
    objects.forEach(obj => {
      if (obj.methods && obj.methods.length > 0) {
        const calcMethod = obj.methods.find(m => m.name.toLowerCase().includes('calculate') || m.name.toLowerCase().includes('process'));
        if (calcMethod) {
          code += `        if (typeof this.${obj.name}.${this.toCamelCase(calcMethod.name)} === 'function') {\n`;
          code += `            this.${obj.name}.${this.toCamelCase(calcMethod.name)}();  // Execute behavior\n`;
          code += `        }\n`;
        }
      }
    });
    code += '    }\n\n';

    code += '    validateConstraints() {\n';
    code += '        console.log("Step 5: Validation & Constraints");\n';
    objects.forEach(obj => {
      if (obj.attributeValues) {
        code += `        // Validate ${obj.name} constraints\n`;
        code += `        console.assert(this.${obj.name} !== null, "${obj.name} must not be null");\n`;
      }
    });
    code += '    }\n\n';

    code += '    displaySnapshot() {\n';
    code += '        console.log("=== Object Diagram Snapshot ===");\n';
    objects.forEach(obj => {
      code += `        console.log("${obj.name}:", this.${obj.name});\n`;
    });
    code += '    }\n';
    code += '}\n\n';

    code += '// Create and initialize snapshot\n';
    code += 'const snapshot = new ObjectDiagramSnapshot();\n';
    code += 'snapshot.displaySnapshot();\n\n';
    code += 'export { ObjectDiagramSnapshot };\n';
    
    return code;
  }

  static formatValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  static formatPythonValue(value) {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    return String(value);
  }

  static formatJSValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  // ============================================================
  // ADVANCED FEATURES: File Splitting, Import Injection, Field Injection
  // ============================================================

  // Algorithm 8: File Splitting - Generate multiple files per class
  static splitIntoFiles(elements, connections = [], language = 'Java', diagramType = 'class') {
    const files = [];
    
    if (diagramType === 'class') {
      // Generate one file per class element
      elements.filter(el => el.type === 'class' || el.type === 'interface').forEach(element => {
        const fileName = this.getFileName(element.name, language);
        const fileContent = this.generateSingleClassFile(element, elements, connections, language);
        files.push({ filename: fileName, content: fileContent, type: 'class' });
      });

      // Generate index/main file + consolidated file
      if (language === 'JavaScript' || language === 'Python') {
        const indexFile = this.generateIndexFile(elements, language);
        const indexName = language === 'JavaScript' ? 'index.js' : '__init__.py';
        files.push({ filename: indexName, content: indexFile, type: 'index' });
      }
      
      // Generate consolidated/main file for runnable code
      const classCount = elements.filter(el => el.type === 'class' || el.type === 'interface').length;
      if (classCount > 0) {
        const consolidatedFile = this.generateConsolidatedFile(elements, connections, language);
        const consolidatedName = language === 'Java' ? 'Main.java' : 
                                 language === 'Python' ? 'main.py' : 
                                 'main.js';
        files.push({ filename: consolidatedName, content: consolidatedFile, type: 'main' });
      }
    } else if (diagramType === 'object') {
      // For object diagrams, generate a single snapshot file
      const fileName = language === 'Java' ? 'ObjectDiagramSnapshot.java' : 
                       language === 'Python' ? 'object_diagram_snapshot.py' : 
                       'ObjectDiagramSnapshot.js';
      const fileContent = this.generateObjectDiagramCode(elements, connections, language, []);
      files.push({ filename: fileName, content: fileContent, type: 'object' });
    }

    return files.length > 0 ? files : [{ filename: 'Generated.txt', content: 'No classes to generate', type: 'text' }];
  }

  // Algorithm 9: Import Injection - Auto-detect and inject dependencies
  static injectImports(element, elements, language, connections = []) {
    const imports = new Set();
    const standardLibraries = this.getStandardLibraries(language);

    // Add ArrayList import for Java if there are any one-to-many relationships
    if (language === 'Java') {
      const hasMultipleRelationships = connections && connections.some(conn => {
        const multiplicity = conn.multiplicity || '1';
        return (conn.sourceId === element.id) && 
               (multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*'));
      });
      if (hasMultipleRelationships) {
        imports.add('import java.util.ArrayList;');
        imports.add('import java.util.List;');
      }
    }

    // Analyze attribute types to inject imports
    if (element.attributes && Array.isArray(element.attributes)) {
      element.attributes.forEach(attr => {
        const type = attr.type || 'Object';
        const importClass = this.getImportForType(type, elements, language);
        if (importClass && !standardLibraries.has(type)) {
          imports.add(importClass);
        }
      });
    }

    // Analyze method return types and parameters
    if (element.methods && Array.isArray(element.methods)) {
      element.methods.forEach(method => {
        const returnType = method.returnType || 'void';
        const importClass = this.getImportForType(returnType, elements, language);
        if (importClass && !standardLibraries.has(returnType)) {
          imports.add(importClass);
        }

        // Check method parameters - parse them as "name: type" format
        if (method.parameters && typeof method.parameters === 'string') {
          const paramList = method.parameters.split(',').map(p => p.trim()).filter(p => p);
          paramList.forEach(paramStr => {
            // Parse "name: type" format
            const parts = paramStr.split(':').map(p => p.trim());
            if (parts.length >= 2) {
              const paramType = parts[parts.length - 1]; // Get the type part
              const paramImport = this.getImportForType(paramType, elements, language);
              if (paramImport && !standardLibraries.has(paramType)) {
                imports.add(paramImport);
              }
            }
          });
        }
      });
    }

    // Analyze connections/relationships and add target class imports
    if (connections && element.id) {
      const outgoingRelationships = connections.filter(conn => conn.sourceId === element.id);
      outgoingRelationships.forEach(conn => {
        const targetEl = elements.find(el => el.id === conn.targetId);
        if (targetEl && targetEl.id !== element.id) {
          const importClass = this.getImportForType(targetEl.name, elements, language);
          if (importClass && !standardLibraries.has(targetEl.name)) {
            imports.add(importClass);
          }
        }
      });
    }

    return this.formatImports(Array.from(imports), language);
  }

  // Algorithm 10: Field Injection - Generate constructor with dependency injection
  static injectFields(element, elements, connections, language) {
    let code = '';
    const injectedFields = [];

    // Find dependencies from relationships
    const dependencies = connections.filter(conn => 
      conn.sourceId === element.id && (conn.type === 'association' || conn.type === 'dependency')
    );

    if (dependencies.length === 0) return code;

    const indent = '    ';
    
    if (language === 'Java') {
      code += `${indent}// Constructor with dependency injection\n`;
      const params = dependencies.map(dep => {
        const targetEl = elements.find(e => e.id === dep.targetId);
        const multiplicity = dep.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        const type = isMultiple ? `List<${targetEl?.name || 'Object'}>` : (targetEl?.name || 'Object');
        return `${type} ${this.toCamelCase(targetEl?.name || 'obj')}${isMultiple ? 's' : ''}`;
      }).join(', ');
      
      code += `${indent}public ${element.name}(${params}) {\n`;
      dependencies.forEach(dep => {
        const targetEl = elements.find(e => e.id === dep.targetId);
        const multiplicity = dep.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        const fieldName = this.toCamelCase(targetEl?.name || 'obj') + (isMultiple ? 's' : '');
        code += `${indent}    this.${fieldName} = ${fieldName};\n`;
      });
      code += `${indent}}\n\n`;
    } else if (language === 'Python') {
      code += `${indent}# Constructor with dependency injection\n`;
      const params = ['self', ...dependencies.map(dep => {
        const targetEl = elements.find(e => e.id === dep.targetId);
        const multiplicity = dep.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        return this.toSnakeCase(targetEl?.name || 'obj') + (isMultiple ? 's' : '');
      })].join(', ');
      
      code += `${indent}def __init__(${params}):\n`;
      dependencies.forEach(dep => {
        const targetEl = elements.find(e => e.id === dep.targetId);
        const multiplicity = dep.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        const fieldName = this.toSnakeCase(targetEl?.name || 'obj') + (isMultiple ? 's' : '');
        code += `${indent}    self.${fieldName} = ${fieldName}\n`;
      });
      code += '\n';
    } else if (language === 'JavaScript') {
      code += `${indent}// Constructor with dependency injection\n`;
      const params = dependencies.map(dep => {
        const targetEl = elements.find(e => e.id === dep.targetId);
        const multiplicity = dep.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        return this.toCamelCase(targetEl?.name || 'obj') + (isMultiple ? 's' : '');
      }).join(', ');
      
      code += `${indent}constructor(${params}) {\n`;
      dependencies.forEach(dep => {
        const targetEl = elements.find(e => e.id === dep.targetId);
        const multiplicity = dep.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        const fieldName = this.toCamelCase(targetEl?.name || 'obj') + (isMultiple ? 's' : '');
        code += `${indent}    this.${fieldName} = ${fieldName};\n`;
      });
      code += `${indent}}\n\n`;
    }

    return code;
  }

  // Algorithm 11: CamelCase Fix - Apply proper naming conventions per language
  static fixNamingConventions(code, language) {
    if (language === 'Java') {
      // ClassNamePascalCase, methodNameCamelCase, CONSTANT_SNAKE_CASE
      return this.applyJavaNamingConventions(code);
    } else if (language === 'Python') {
      // class_name_snake_case, method_name_snake_case, CONSTANT_UPPER_SNAKE_CASE
      return this.applyPythonNamingConventions(code);
    } else if (language === 'JavaScript') {
      // ClassName PascalCase for classes, methodName camelCase for methods
      return this.applyJavaScriptNamingConventions(code);
    }
    return code;
  }

  // Helper: Convert to camelCase (first letter lowercase)
  static toCamelCase(str) {
    if (!str) return 'obj';
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, (s) => s.toLowerCase());
  }

  // Helper: Convert to PascalCase (first letter uppercase)
  static toPascalCase(str) {
    if (!str) return 'Object';
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, (s) => s.toUpperCase());
  }

  // Helper: Convert to UPPER_SNAKE_CASE
  static toUpperSnakeCase(str) {
    if (!str) return 'CONSTANT';
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[-\s]+/g, '_')
      .toUpperCase();
  }

  // Helper: Convert to snake_case (lowercase with underscores)
  static toSnakeCase(str) {
    if (!str) return 'obj';
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  }

  // Get standard libraries that shouldn't be imported
  static getStandardLibraries(language) {
    const stdlib = {
      Java: new Set(['String', 'int', 'double', 'boolean', 'float', 'long', 'char', 'byte', 'short', 'void', 'Object', 'List', 'Map', 'Set', 'Date']),
      Python: new Set(['str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'datetime', 'None']),
      JavaScript: new Set(['String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'undefined', 'null'])
    };
    return stdlib[language] || new Set();
  }

  // Generate state transition code
  static generateStateTransition(object, fromState, toState, language) {
    if (language === 'Java') {
      return `${object}.setState("${toState}");  // Transition: ${fromState} → ${toState}`;
    } else if (language === 'Python') {
      return `${object}.state = "${toState}"  # Transition: ${fromState} → ${toState}`;
    } else if (language === 'JavaScript') {
      return `${object}.state = "${toState}";  // Transition: ${fromState} → ${toState}`;
    }
  }

  // Generate message call between objects
  static generateMessageCall(sourceObj, targetObj, methodName, language, sequence = 1) {
    if (language === 'Java') {
      return `        // Message ${sequence}: ${sourceObj} → ${targetObj}.${methodName}()\n        ${targetObj}.${methodName}();\n`;
    } else if (language === 'Python') {
      return `        # Message ${sequence}: ${sourceObj} → ${targetObj}.${methodName}()\n        ${targetObj}.${methodName}()\n`;
    } else if (language === 'JavaScript') {
      return `        // Message ${sequence}: ${sourceObj} → ${targetObj}.${methodName}()\n        ${targetObj}.${methodName}();\n`;
    }
  }

  // Validate object constraints
  static validateObjectConstraints(object, attributes, language) {
    const constraints = [];
    
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (language === 'Java') {
            constraints.push(`        assert ${object}.${key} != null : "${object}.${key} must be set";`);
          } else if (language === 'Python') {
            constraints.push(`        assert ${object}.${key} is not None, "${object}.${key} must be set"`);
          } else if (language === 'JavaScript') {
            constraints.push(`        console.assert(${object}.${key} !== null, "${object}.${key} must be set");`);
          }
        }
      });
    }
    
    return constraints.join('\n');
  }

  // Determine import statement for a type
  static getImportForType(type, elements, language) {
    if (!type) return null;
    const classElement = elements.find(el => el.name === type);
    if (!classElement) return null;
    
    if (language === 'Java') {
      return `import ${type};`;
    } else if (language === 'Python') {
      return `from .${this.toSnakeCase(type)} import ${type}`;
    } else if (language === 'JavaScript') {
      return `import { ${type} } from './${this.toSnakeCase(type)}';`;
    }
    return null;
  }

  // Format imports into language-specific syntax
  static formatImports(imports, language) {
    if (imports.length === 0) return '';
    
    let code = '';
    if (language === 'Java') {
      code = imports.join('\n') + '\n\n';
    } else if (language === 'Python') {
      code = imports.join('\n') + '\n\n';
    } else if (language === 'JavaScript') {
      code = imports.join('\n') + '\n\n';
    }
    return code;
  }

  // Find relationships for an element
  static findRelationshipsForElement(elementId, elements) {
    // Placeholder - would need connections passed in
    return [];
  }

  // Generate a single class file with proper structure
  static generateSingleClassFile(element, allElements, connections, language) {
    let code = '';
    const className = this.toPascalCase(element.name);

    if (language === 'Java') {
      code += this.injectImports(element, allElements, language, connections);
      code += `public class ${className} {\n\n`;
      code += this.generateJavaClassFields(element, connections, allElements);
      code += this.injectFields(element, allElements, connections, language);
      code += this.generateJavaClassMethods(element);
      code += '}\n';
    } else if (language === 'Python') {
      code += this.injectImports(element, allElements, language, connections);
      code += `class ${className}:\n`;
      code += this.generatePythonClassInit(element, allElements, connections);
      code += this.generatePythonClassMethods(element);
    } else if (language === 'JavaScript') {
      code += this.injectImports(element, allElements, language, connections);
      code += `class ${className} {\n`;
      code += this.injectFields(element, allElements, connections, language);
      code += this.generateJSClassMethods(element);
      code += '}\n\n';
      code += `export default ${className};\n`;
    }

    return code;
  }

  // Helper methods for generating class members
  static generateJavaClassFields(element, connections, allElements) {
    let code = '    // Fields\n';
    
    // Add direct attributes
    if (element.attributes && element.attributes.length > 0) {
      element.attributes.forEach(attr => {
        const fieldName = this.toCamelCase(attr.name);
        const visibility = attr.visibility === '+' ? 'public' : attr.visibility === '-' ? 'private' : 'protected';
        code += `    ${visibility} ${attr.type || 'Object'} ${fieldName};\n`;
      });
    }
    
    // Add relationship attributes (outgoing associations)
    if (connections && connections.length > 0) {
      const outgoingRelationships = connections.filter(conn => conn.sourceId === element.id);
      outgoingRelationships.forEach(connection => {
        const targetEl = allElements.find(el => el.id === connection.targetId);
        if (!targetEl) return;
        
        const multiplicity = connection.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        const fieldName = this.toCamelCase(targetEl.name) + (isMultiple ? 's' : '');
        const type = isMultiple ? `List<${targetEl.name}>` : targetEl.name;
        const initialization = isMultiple ? ' = new ArrayList<>()' : '';
        
        code += `    private ${type} ${fieldName}${initialization};\n`;
      });
    }
    
    if (!element.attributes || element.attributes.length === 0) {
      if (!connections || connections.filter(conn => conn.sourceId === element.id).length === 0) {
        code += '    // No fields defined\n';
      }
    }
    code += '\n';
    return code;
  }

  static generateJavaClassMethods(element) {
    let code = '    // Methods\n';
    if (element.methods && element.methods.length > 0) {
      element.methods.forEach(method => {
        const methodName = this.toCamelCase(method.name);
        const returnType = method.returnType || 'void';
        const visibility = method.visibility === '+' ? 'public' : method.visibility === '-' ? 'private' : 'protected';
        code += `    ${visibility} ${returnType} ${methodName}() {\n`;
        const implementation = this.generateSmartImplementation(method.name, returnType, 'Java', element);
        code += implementation;
        code += `    }\n\n`;
      });
    } else {
      code += '    // No methods defined\n';
    }
    code += '\n';
    return code;
  }

  static generatePythonClassInit(element, allElements, connections) {
    let code = '    def __init__(self):\n';
    let hasContent = false;
    
    // Add direct attributes
    if (element.attributes && element.attributes.length > 0) {
      element.attributes.forEach(attr => {
        const fieldName = this.toSnakeCase(attr.name);
        const defaultVal = 'None';
        code += `        self.${fieldName} = ${defaultVal}\n`;
        hasContent = true;
      });
    }
    
    // Add relationship attributes (outgoing associations)
    if (connections && connections.length > 0) {
      const outgoingRelationships = connections.filter(conn => conn.sourceId === element.id);
      outgoingRelationships.forEach(connection => {
        const targetEl = allElements.find(el => el.id === connection.targetId);
        if (!targetEl) return;
        
        const multiplicity = connection.multiplicity || '1';
        const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
        const fieldName = this.toSnakeCase(targetEl.name) + (isMultiple ? 's' : '');
        const defaultVal = isMultiple ? '[]' : 'None';
        
        code += `        self.${fieldName} = ${defaultVal}\n`;
        hasContent = true;
      });
    }
    
    if (!hasContent) {
      code += '        pass\n';
    }
    code += '\n';
    return code;
  }

  static generatePythonClassMethods(element) {
    let code = '';
    if (element.methods && element.methods.length > 0) {
      element.methods.forEach(method => {
        const methodName = this.toSnakeCase(method.name);
        code += `    def ${methodName}(self):\n`;
        const implementation = this.generateSmartImplementation(method.name, method.returnType || 'None', 'Python', element);
        code += implementation;
        code += `\n`;
      });
    }
    return code;
  }

  static generateJSClassMethods(element) {
    let code = '';
    if (element.methods && element.methods.length > 0) {
      element.methods.forEach(method => {
        const methodName = this.toCamelCase(method.name);
        code += `    ${methodName}() {\n`;
        const implementation = this.generateSmartImplementation(method.name, method.returnType || 'undefined', 'JavaScript', element);
        code += implementation;
        code += `    }\n\n`;
      });
    }
    return code;
  }

  // Generate index file for module exports
  static generateIndexFile(elements, language) {
    let code = '';
    const classElements = elements.filter(el => el.type === 'class');
    
    if (language === 'JavaScript') {
      code = '// Auto-generated index file\n\n';
      classElements.forEach(el => {
        const className = this.toPascalCase(el.name);
        const fileName = this.toSnakeCase(el.name);
        code += `export { default as ${className} } from './${fileName}';\n`;
      });
    } else if (language === 'Python') {
      code = '# Auto-generated __init__ file\n\n';
      classElements.forEach(el => {
        const className = this.toPascalCase(el.name);
        const fileName = this.toSnakeCase(el.name);
        code += `from .${fileName} import ${className}\n`;
      });
      code += '\n__all__ = [' + classElements.map(el => `'${this.toPascalCase(el.name)}'`).join(', ') + ']\n';
    }
    
    return code;
  }

  // Generate smart implementations based on method name keywords
  static generateSmartImplementation(methodName, returnType, language, element) {
    const name = methodName.toLowerCase();
    const indent = language === 'Python' ? '        ' : '        ';
    
    // Calculate methods
    if (name.includes('calculate') || name.includes('compute') || name.includes('sum') || name.includes('total')) {
      if (language === 'Java') {
        return `        // Calculate based on attributes\\n        int result = 0;\\n        // TODO: Implement calculation logic\\n        return result;\\n`;
      } else if (language === 'Python') {
        return `        result = 0\\n        # TODO: Implement calculation logic\\n        return result\\n`;
      } else if (language === 'JavaScript') {
        return `        let result = 0;\\n        // TODO: Implement calculation logic\\n        return result;\\n`;
      }
    }
    
    // Validation methods
    if (name.includes('validate') || name.includes('check') || name.includes('verify') || name.includes('is')) {
      if (language === 'Java') {
        return `        // Validate object state\\n        if (/* TODO: add condition */) {\\n            return true;\\n        }\\n        return false;\\n`;
      } else if (language === 'Python') {
        return `        # Validate object state\\n        if False:  # TODO: add condition\\n            return True\\n        return False\\n`;
      } else if (language === 'JavaScript') {
        return `        // Validate object state\\n        if (/* TODO: add condition */) {\\n            return true;\\n        }\\n        return false;\\n`;
      }
    }
    
    // Get methods
    if (name.startsWith('get') && returnType && returnType !== 'void') {
      const attrName = element.attributes ? element.attributes[0]?.name : 'value';
      if (language === 'Java') {
        return `        return this.${this.toCamelCase(attrName)};\\n`;
      } else if (language === 'Python') {
        return `        return self.${this.toSnakeCase(attrName)}\\n`;
      } else if (language === 'JavaScript') {
        return `        return this.${this.toCamelCase(attrName)};\\n`;
      }
    }
    
    // Set methods
    if (name.startsWith('set')) {
      const attrName = element.attributes ? element.attributes[0]?.name : 'value';
      if (language === 'Java') {
        return `        this.${this.toCamelCase(attrName)} = value;\\n`;
      } else if (language === 'Python') {
        return `        self.${this.toSnakeCase(attrName)} = value\\n`;
      } else if (language === 'JavaScript') {
        return `        this.${this.toCamelCase(attrName)} = value;\\n`;
      }
    }
    
    // toString/str methods
    if (name === 'tostring' || name === 'str' || name === '__str__') {
      if (language === 'Java') {
        return `        return "${element.name}{}";
`;
      } else if (language === 'Python') {
        return `        return f"${element.name}{}"
`;
      } else if (language === 'JavaScript') {
        return `        return \`${element.name}{}\`;
`;
      }
    }
    
    // equals/== methods
    if (name === 'equals' || name === 'compare') {
      if (language === 'Java') {
        return `        if (!(obj instanceof ${element.name})) return false;
        ${element.name} other = (${element.name}) obj;
        return true; // TODO: compare fields
`;
      } else if (language === 'Python') {
        return `        if not isinstance(other, ${element.name}):
            return False
        return True  # TODO: compare fields
`;
      } else if (language === 'JavaScript') {
        return `        if (!(other instanceof ${element.name})) return false;
        return true; // TODO: compare fields
`;
      }
    }
    
    // Default: TODO comment
    if (language === 'Java') {
      return `        // TODO: Implement ${methodName}\\n`;
    } else if (language === 'Python') {
      return `        pass  # TODO: Implement ${methodName}\\n`;
    } else if (language === 'JavaScript') {
      return `        // TODO: Implement ${methodName}\\n`;
    }
  }

  // Generate consolidated/main file that combines all classes
  static generateConsolidatedFile(elements, connections, language) {
    let code = '';
    const classElements = elements.filter(el => el.type === 'class');
    
    // Track variable names to avoid duplicates
    const varNames = {};
    classElements.forEach((el, index) => {
      let baseName = this.toCamelCase(el.name);
      let varName = baseName;
      let counter = 1;
      
      // If name already exists, append index
      while (varNames[varName]) {
        varName = baseName + counter;
        counter++;
      }
      varNames[el.id] = varName;
    });
    
    if (language === 'Java') {
      code += '// Auto-generated Main class - Consolidated execution file\n';
      code += '// This file demonstrates how all generated classes work together\n\n';
      code += 'public class Main {\n\n';
      code += '    public static void main(String[] args) {\n';
      code += '        // Initialize classes\n';
      
      // Create instances
      classElements.forEach(el => {
        const className = this.toPascalCase(el.name);
        const varName = varNames[el.id];
        code += `        ${className} ${varName} = new ${className}();\n`;
      });
      
      // Generate logic based on relationships
      code += '\n        // Connect objects and run logic\n';
      if (connections && connections.length > 0) {
        connections.forEach(conn => {
          const sourceEl = classElements.find(el => el.id === conn.sourceId);
          const targetEl = classElements.find(el => el.id === conn.targetId);
          
          if (sourceEl && targetEl) {
            const sourceVar = varNames[sourceEl.id];
            const targetVar = varNames[targetEl.id];
            
            // Generate method calls based on relationship type
            if (conn.type === 'association' || conn.type === 'dependency') {
              // Look for calculate or process methods
              if (sourceEl.methods) {
                const calcMethod = sourceEl.methods.find(m => m.name.toLowerCase().includes('calculate') || m.name.toLowerCase().includes('process'));
                if (calcMethod) {
                  code += `        ${sourceVar}.${this.toCamelCase(calcMethod.name)}();\n`;
                }
              }
            }
          }
        });
      }
      
      // Add example logic
      code += '        // TODO: Add your business logic here\n';
      code += '    }\n';
      code += '}\n';
    } else if (language === 'Python') {
      code += '# Auto-generated main module - Consolidated execution file\n';
      code += '# This file demonstrates how all generated classes work together\n\n';
      
      classElements.forEach(el => {
        const className = this.toPascalCase(el.name);
        code += `from .${this.toSnakeCase(el.name)} import ${className}\n`;
      });
      
      code += '\nif __name__ == "__main__":\n';
      
      // Create instances with unique names
      classElements.forEach(el => {
        const className = this.toPascalCase(el.name);
        const varName = varNames[el.id];
        code += `    ${varName} = ${className}()\n`;
      });
      
      // Generate logic based on relationships
      code += '\n    # Connect objects and run logic\n';
      if (connections && connections.length > 0) {
        connections.forEach(conn => {
          const sourceEl = classElements.find(el => el.id === conn.sourceId);
          const targetEl = classElements.find(el => el.id === conn.targetId);
          
          if (sourceEl && targetEl) {
            const sourceVar = varNames[sourceEl.id];
            
            // Look for calculate or process methods
            if (sourceEl.methods) {
              const calcMethod = sourceEl.methods.find(m => m.name.toLowerCase().includes('calculate') || m.name.toLowerCase().includes('process'));
              if (calcMethod) {
                code += `    ${sourceVar}.${this.toSnakeCase(calcMethod.name)}()\n`;
              }
            }
          }
        });
      }
      
      code += '\n    # TODO: Add your business logic here\n';
    } else if (language === 'JavaScript') {
      code += '// Auto-generated main module - Consolidated execution file\n';
      code += '// This file demonstrates how all generated classes work together\n\n';
      
      classElements.forEach(el => {
        const className = this.toPascalCase(el.name);
        code += `import ${className} from './${this.toSnakeCase(el.name)}';\n`;
      });
      
      code += '\n// Initialize classes\n';
      classElements.forEach(el => {
        const className = this.toPascalCase(el.name);
        const varName = varNames[el.id];
        code += `const ${varName} = new ${className}();\n`;
      });
      
      // Generate logic based on relationships
      code += '\n// Connect objects and run logic\n';
      if (connections && connections.length > 0) {
        connections.forEach(conn => {
          const sourceEl = classElements.find(el => el.id === conn.sourceId);
          const targetEl = classElements.find(el => el.id === conn.targetId);
          
          if (sourceEl && targetEl) {
            const sourceVar = varNames[sourceEl.id];
            
            // Look for calculate or process methods
            if (sourceEl.methods) {
              const calcMethod = sourceEl.methods.find(m => m.name.toLowerCase().includes('calculate') || m.name.toLowerCase().includes('process'));
              if (calcMethod) {
                code += `${sourceVar}.${this.toCamelCase(calcMethod.name)}();\n`;
              }
            }
          }
        });
      }
      
      code += '\n// TODO: Add your business logic here\n';
      code += `\nexport { ${classElements.map(el => this.toPascalCase(el.name)).join(', ')} };\n`;
    }
    
    return code;
  }

  // Get proper file name based on language convention
  static getFileName(className, language) {
    if (language === 'Java') {
      return `${this.toPascalCase(className)}.java`;
    } else if (language === 'Python') {
      return `${this.toSnakeCase(className)}.py`;
    } else if (language === 'JavaScript') {
      return `${this.toSnakeCase(className)}.js`;
    }
    return `${className}.txt`;
  }

  // Apply Java naming conventions
  static applyJavaNamingConventions(code) {
    // Classes: PascalCase
    // Methods: camelCase
    // Constants: UPPER_SNAKE_CASE
    // Variables: camelCase
    return code.replace(/\bclass\s+([a-zA-Z_]\w*)/g, (match, name) => 
      `class ${this.toPascalCase(name)}`
    );
  }

  // Apply Python naming conventions
  static applyPythonNamingConventions(code) {
    // Classes: PascalCase
    // Methods: snake_case
    // Constants: UPPER_SNAKE_CASE
    // Variables: snake_case
    return code.replace(/\bdef\s+([a-zA-Z_]\w*)/g, (match, name) =>
      `def ${this.toSnakeCase(name)}`
    );
  }

  // Apply JavaScript naming conventions
  static applyJavaScriptNamingConventions(code) {
    // Classes: PascalCase
    // Methods: camelCase
    // Variables: camelCase
    return code.replace(/\bclass\s+([a-zA-Z_]\w*)/g, (match, name) =>
      `class ${this.toPascalCase(name)}`
    );
  }

}

export default CodeGenerator;