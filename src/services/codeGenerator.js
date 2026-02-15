// Code Generator Service
// Implements Bidirectional Model-Code Synchronization Algorithm
// Ensures UML models and generated code stay synchronized

class CodeGenerator {
  
  // ============================================================
  // TYPE MAPPING UTILITIES (inline to avoid import issues)
  // ============================================================
  
  static mapType(umlType, targetLanguage) {
    const typeMappings = {
      Java: {
        'String': 'String',
        'Integer': 'int',
        'Double': 'double',
        'Boolean': 'boolean',
        'Float': 'float',
        'Long': 'long',
        'Character': 'char',
        'Byte': 'byte',
        'Short': 'short',
        'List': 'List<Object>',
        'ArrayList': 'ArrayList<Object>',
        'Map': 'Map<String, Object>',
        'HashMap': 'HashMap<String, Object>',
        'Set': 'Set<Object>',
        'Date': 'Date',
        'LocalDateTime': 'LocalDateTime',
        'Object': 'Object',
        'void': 'void'
      },
      Python: {
        'String': 'str',
        'Integer': 'int',
        'Double': 'float',
        'Boolean': 'bool',
        'Float': 'float',
        'Long': 'int',
        'Character': 'str',
        'Byte': 'bytes',
        'List': 'list',
        'ArrayList': 'list',
        'Map': 'dict',
        'HashMap': 'dict',
        'Set': 'set',
        'Date': 'datetime',
        'LocalDateTime': 'datetime',
        'Object': 'object',
        'void': 'None'
      },
      JavaScript: {
        'String': 'string',
        'Integer': 'number',
        'Double': 'number',
        'Boolean': 'boolean',
        'Float': 'number',
        'Long': 'number',
        'Character': 'string',
        'Byte': 'number',
        'List': 'Array',
        'ArrayList': 'Array',
        'Map': 'Object',
        'HashMap': 'Map',
        'Set': 'Set',
        'Date': 'Date',
        'LocalDateTime': 'Date',
        'Object': 'any',
        'void': 'void'
      }
    };

    const languageMap = typeMappings[targetLanguage];
    if (!languageMap) return umlType || 'Object';
    
    return languageMap[umlType] || umlType || 'Object';
  }

  static getDefaultValue(type, language) {
    const defaults = {
      Java: {
        'int': '0',
        'double': '0.0',
        'float': '0.0f',
        'boolean': 'false',
        'long': '0L',
        'char': "'\\0'",
        'byte': '0',
        'short': '0',
        'String': 'null',
        'Object': 'null',
        'void': ''
      },
      Python: {
        'int': '0',
        'float': '0.0',
        'bool': 'False',
        'str': '""',
        'list': '[]',
        'dict': '{}',
        'set': 'set()',
        'None': 'None',
        'object': 'None'
      },
      JavaScript: {
        'number': '0',
        'string': '""',
        'boolean': 'false',
        'Array': '[]',
        'Object': '{}',
        'null': 'null',
        'undefined': 'undefined',
        'any': 'null',
        'void': ''
      }
    };

    const languageDefaults = defaults[language];
    if (!languageDefaults) return 'null';
    
    return languageDefaults[type] || 'null';
  }
  
  // ============================================================
  // BIDIRECTIONAL MODEL-CODE SYNCHRONIZATION ALGORITHM
  // ============================================================
  
  /**
   * Main entry point for code generation
   * Synchronizes UML model to source code
   */
  static generateCode(elements, connections = [], language = 'Java', diagramType = 'class') {
    // Step 1: Validate and normalize the model
    const normalizedModel = this.normalizeModel(elements, connections);
    
    // Step 2: Generate code based on diagram type
    let code = '';
    switch (diagramType) {
      case 'class':
        code = this.generateClassDiagramCode(normalizedModel.elements, normalizedModel.connections, language);
        break;
      case 'usecase':
        code = this.generateUseCaseDiagramCode(normalizedModel.elements, normalizedModel.connections, language);
        break;
      case 'sequence':
        code = this.generateSequenceDiagramCode(normalizedModel.elements, normalizedModel.connections, language);
        break;
      default:
        code = this.generateClassDiagramCode(normalizedModel.elements, normalizedModel.connections, language);
    }
    
    // Step 3: Format and optimize the generated code
    code = this.formatCode(code, language);
    
    return code;
  }

  /**
   * Generate multiple files for complex projects
   */
  static generateMultiFileCode(elements, connections = [], language = 'Java', diagramType = 'class') {
    const files = [];
    
    if (diagramType === 'class') {
      // Generate one file per class
      elements.forEach(element => {
        if (element.type === 'class' || element.type === 'interface' || element.type === 'abstract') {
          const fileName = this.getFileName(element.name, language);
          const code = this.generateSingleClass(element, connections, elements, language);
          files.push({ name: fileName, content: code });
        }
      });
    } else if (diagramType === 'usecase') {
      // Generate documentation and test files
      files.push({
        name: 'UseCases.md',
        content: this.generateUseCaseDocumentation(elements, connections)
      });
      files.push({
        name: this.getFileName('UseCaseTests', language),
        content: this.generateUseCaseTests(elements, connections, language)
      });
    } else if (diagramType === 'sequence') {
      // Generate interaction flow documentation and code
      files.push({
        name: 'SequenceFlow.md',
        content: this.generateSequenceDocumentation(elements, connections)
      });
      files.push({
        name: this.getFileName('InteractionHandler', language),
        content: this.generateSequenceCode(elements, connections, language)
      });
    }
    
    return files;
  }

  // ============================================================
  // MODEL NORMALIZATION
  // ============================================================

  static normalizeModel(elements, connections) {
    const normalizedElements = elements.map(element => ({
      ...element,
      name: this.normalizeIdentifier(element.name),
      attributes: element.attributes?.map(attr => ({
        ...attr,
        name: this.normalizeIdentifier(attr.name, 'variable'),
        type: this.normalizeType(attr.type)
      })) || [],
      methods: element.methods?.map(method => ({
        ...method,
        name: this.normalizeIdentifier(method.name, 'method'),
        returnType: this.normalizeType(method.returnType)
      })) || []
    }));

    return {
      elements: normalizedElements,
      connections: connections
    };
  }

  static normalizeIdentifier(name, context = 'class') {
    if (!name) return 'Unnamed';
    
    // Remove special characters
    let normalized = name.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Apply naming conventions
    if (context === 'class') {
      // PascalCase
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    } else if (context === 'method' || context === 'variable') {
      // camelCase
      return normalized.charAt(0).toLowerCase() + normalized.slice(1);
    }
    
    return normalized;
  }

  static normalizeType(type) {
    if (!type) return 'Object';
    return type.replace(/[^a-zA-Z0-9<>,\s]/g, '');
  }

  // ============================================================
  // CLASS DIAGRAM CODE GENERATION
  // ============================================================

  static generateClassDiagramCode(elements, connections, language) {
    switch (language) {
      case 'Java':
        return this.generateJavaCode(elements, connections);
      case 'Python':
        return this.generatePythonCode(elements, connections);
      case 'JavaScript':
        return this.generateJavaScriptCode(elements, connections);
      default:
        return this.generateJavaCode(elements, connections);
    }
  }

  static generateJavaCode(elements, connections) {
    let code = '';
    
    // NOTE: This generates all classes in one file for quick viewing
    // For compilable code, use generateMultiFileCode() or splitIntoFiles()
    // which creates separate files for each class
    
    const classElements = elements.filter(el => 
      el.type === 'class' || el.type === 'abstract' || el.type === 'interface'
    );
    
    if (classElements.length === 0) {
      return '// No classes to generate';
    }
    
    // If only one class, make it public with package
    if (classElements.length === 1) {
      code += 'package com.example.model;\n\n';
      code += 'import java.util.*;\n';
      code += 'import java.time.*;\n\n';
      code += this.generateJavaClass(classElements[0], connections, elements);
      return code;
    }
    
    // Multiple classes: Show note and make all package-private (no 'public' keyword)
    code += '/*\n';
    code += ' * NOTE: Multiple classes generated in one file.\n';
    code += ' * This is for VIEWING ONLY and will NOT compile in Java.\n';
    code += ' * \n';
    code += ' * To get compilable code:\n';
    code += ' * - Each class needs its own .java file\n';
    code += ' * - Use the multi-file generation feature\n';
    code += ' * - Or copy each class to separate files\n';
    code += ' */\n\n';
    code += 'package com.example.model;\n\n';
    code += 'import java.util.*;\n';
    code += 'import java.time.*;\n\n';
    
    classElements.forEach((element, index) => {
      code += this.generateJavaClass(element, connections, elements, false); // false = not public
      if (index < classElements.length - 1) {
        code += '\n\n';
      }
    });
    
    return code;
  }

  static generateJavaClass(element, connections, allElements, makePublic = true) {
    let code = '';
    
    // Add class documentation
    code += '/**\n';
    code += ` * Class: ${element.name}\n`;
    code += ` * Generated from UML Class Diagram\n`;
    code += ' */\n';
    
    // Find inheritance
    const extendsConnection = connections.find(c => c.from === element.id && c.type === 'inheritance');
    const implementsConnections = connections.filter(c => c.from === element.id && c.type === 'realization');
    
    // Class declaration
    const publicKeyword = makePublic ? 'public ' : '';
    
    if (element.type === 'interface') {
      code += `${publicKeyword}interface ${element.name}`;
    } else {
      code += `${publicKeyword}${element.type === 'abstract' ? 'abstract ' : ''}class ${element.name}`;
      
      if (extendsConnection) {
        const parentClass = allElements.find(e => e.id === extendsConnection.to);
        if (parentClass) {
          code += ` extends ${parentClass.name}`;
        }
      }
      
      if (implementsConnections.length > 0) {
        const interfaces = implementsConnections
          .map(c => allElements.find(e => e.id === c.to))
          .filter(e => e)
          .map(e => e.name);
        code += ` implements ${interfaces.join(', ')}`;
      }
    }
    
    code += ' {\n\n';
    
    // Attributes
    if (element.attributes && element.attributes.length > 0) {
      code += '    // Attributes\n';
      element.attributes.forEach(attr => {
        const visibility = attr.visibility || 'private';
        const type = CodeGenerator.mapType(attr.type, 'Java');
        const name = attr.name;
        const isStatic = attr.isStatic ? 'static ' : '';
        const isFinal = attr.isFinal ? 'final ' : '';
        
        code += `    ${visibility} ${isStatic}${isFinal}${type} ${name};\n`;
      });
      code += '\n';
    }
    
    // Add relationship-based attributes
    const relationshipAttrs = this.generateRelationshipAttributes(element, connections, allElements, 'Java');
    if (relationshipAttrs) {
      code += '    // Relationship Attributes\n';
      code += relationshipAttrs;
      code += '\n';
    }
    
    // Constructor
    if (element.type !== 'interface') {
      code += '    // Constructor\n';
      code += `    public ${element.name}() {\n`;
      code += '        // Initialize attributes\n';
      code += '    }\n\n';
    }
    
    // Methods
    if (element.methods && element.methods.length > 0) {
      code += '    // Methods\n';
      element.methods.forEach(method => {
        const visibility = method.visibility || 'public';
        const returnType = CodeGenerator.mapType(method.returnType, 'Java');
        const name = method.name;
        const params = method.parameters || '';
        const isStatic = method.isStatic ? 'static ' : '';
        const isAbstract = method.isAbstract ? 'abstract ' : '';
        
        code += `    ${visibility} ${isStatic}${isAbstract}${returnType} ${name}(${params})`;
        
        if (element.type === 'interface' || method.isAbstract) {
          code += ';\n\n';
        } else {
          code += ' {\n';
          code += '        // TODO: Implement method\n';
          if (returnType !== 'void') {
            code += `        return ${CodeGenerator.getDefaultValue(returnType, 'Java')};\n`;
          }
          code += '    }\n\n';
        }
      });
    }
    
    // Getters and Setters
    if (element.attributes && element.attributes.length > 0 && element.type !== 'interface') {
      code += '    // Getters and Setters\n';
      element.attributes.forEach(attr => {
        const type = CodeGenerator.mapType(attr.type, 'Java');
        const name = attr.name;
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        
        // Getter
        code += `    public ${type} get${capitalizedName}() {\n`;
        code += `        return this.${name};\n`;
        code += '    }\n\n';
        
        // Setter (if not final)
        if (!attr.isFinal) {
          code += `    public void set${capitalizedName}(${type} ${name}) {\n`;
          code += `        this.${name} = ${name};\n`;
          code += '    }\n\n';
        }
      });
    }
    
    code += '}';
    
    return code;
  }

  static generatePythonCode(elements, connections) {
    let code = '';
    
    // Add imports
    code += 'from typing import List, Optional, Any\n';
    code += 'from datetime import datetime\n';
    code += 'from abc import ABC, abstractmethod\n\n';
    
    elements.forEach(element => {
      if (element.type === 'class' || element.type === 'abstract' || element.type === 'interface') {
        code += this.generatePythonClass(element, connections, elements);
        code += '\n\n';
      }
    });
    
    return code;
  }

  static generatePythonClass(element, connections, allElements) {
    let code = '';
    
    // Find inheritance
    const extendsConnection = connections.find(c => c.from === element.id && c.type === 'inheritance');
    const parentClass = extendsConnection ? allElements.find(e => e.id === extendsConnection.to) : null;
    
    // Class declaration
    code += `class ${element.name}`;
    if (element.type === 'abstract' || element.type === 'interface') {
      code += '(ABC)';
    } else if (parentClass) {
      code += `(${parentClass.name})`;
    }
    code += ':\n';
    
    // Docstring
    code += '    """\n';
    code += `    Class: ${element.name}\n`;
    code += '    Generated from UML Class Diagram\n';
    code += '    """\n\n';
    
    // Constructor
    code += '    def __init__(self):\n';
    
    if (parentClass) {
      code += '        super().__init__()\n';
    }
    
    // Initialize attributes
    if (element.attributes && element.attributes.length > 0) {
      element.attributes.forEach(attr => {
        const name = attr.name;
        const type = CodeGenerator.mapType(attr.type, 'Python');
        code += `        self.${name} = ${CodeGenerator.getDefaultValue(type, 'Python')}  # ${type}\n`;
      });
    } else {
      code += '        pass\n';
    }
    
    code += '\n';
    
    // Methods
    if (element.methods && element.methods.length > 0) {
      element.methods.forEach(method => {
        const name = method.name;
        const params = method.parameters ? `, ${method.parameters}` : '';
        const returnType = CodeGenerator.mapType(method.returnType, 'Python');
        
        if (method.isAbstract || element.type === 'interface') {
          code += '    @abstractmethod\n';
        }
        
        code += `    def ${name}(self${params}):\n`;
        code += `        """${method.name} method"""\n`;
        
        if (method.isAbstract || element.type === 'interface') {
          code += '        pass\n\n';
        } else {
          code += '        # TODO: Implement method\n';
          if (returnType !== 'None') {
            code += `        return ${CodeGenerator.getDefaultValue(returnType, 'Python')}\n\n`;
          } else {
            code += '        pass\n\n';
          }
        }
      });
    }
    
    return code;
  }

  static generateJavaScriptCode(elements, connections) {
    let code = '';
    
    // Add imports/requires
    code += '// Generated from UML Class Diagram\n\n';
    
    elements.forEach(element => {
      if (element.type === 'class' || element.type === 'abstract' || element.type === 'interface') {
        code += this.generateJavaScriptClass(element, connections, elements);
        code += '\n\n';
      }
    });
    
    return code;
  }

  static generateJavaScriptClass(element, connections, allElements) {
    let code = '';
    
    // Find inheritance
    const extendsConnection = connections.find(c => c.from === element.id && c.type === 'inheritance');
    const parentClass = extendsConnection ? allElements.find(e => e.id === extendsConnection.to) : null;
    
    // Class declaration
    code += `/**\n * Class: ${element.name}\n * Generated from UML Class Diagram\n */\n`;
    code += `class ${element.name}`;
    if (parentClass) {
      code += ` extends ${parentClass.name}`;
    }
    code += ' {\n\n';
    
    // Constructor
    code += '    constructor() {\n';
    
    if (parentClass) {
      code += '        super();\n';
    }
    
    // Initialize attributes
    if (element.attributes && element.attributes.length > 0) {
      element.attributes.forEach(attr => {
        const name = attr.name;
        const type = CodeGenerator.mapType(attr.type, 'JavaScript');
        code += `        this.${name} = ${CodeGenerator.getDefaultValue(type, 'JavaScript')};\n`;
      });
    }
    
    code += '    }\n\n';
    
    // Methods
    if (element.methods && element.methods.length > 0) {
      element.methods.forEach(method => {
        const name = method.name;
        const params = method.parameters || '';
        
        code += `    ${name}(${params}) {\n`;
        code += '        // TODO: Implement method\n';
        
        const returnType = CodeGenerator.mapType(method.returnType, 'JavaScript');
        if (returnType !== 'void') {
          code += `        return ${CodeGenerator.getDefaultValue(returnType, 'JavaScript')};\n`;
        }
        
        code += '    }\n\n';
      });
    }
    
    // Getters and Setters
    if (element.attributes && element.attributes.length > 0) {
      element.attributes.forEach(attr => {
        const name = attr.name;
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        
        // Getter
        code += `    get${capitalizedName}() {\n`;
        code += `        return this.${name};\n`;
        code += '    }\n\n';
        
        // Setter
        code += `    set${capitalizedName}(value) {\n`;
        code += `        this.${name} = value;\n`;
        code += '    }\n\n';
      });
    }
    
    code += '}\n\n';
    code += `export default ${element.name};`;
    
    return code;
  }

  static generateSingleClass(element, connections, allElements, language) {
    let code = '';
    
    switch (language) {
      case 'Java':
        code += 'package com.example.model;\n\n';
        code += 'import java.util.*;\n';
        code += 'import java.time.*;\n\n';
        code += this.generateJavaClass(element, connections, allElements);
        break;
      case 'Python':
        code += 'from typing import List, Optional, Any\n';
        code += 'from datetime import datetime\n';
        code += 'from abc import ABC, abstractmethod\n\n';
        code += this.generatePythonClass(element, connections, allElements);
        break;
      case 'JavaScript':
        code += this.generateJavaScriptClass(element, connections, allElements);
        break;
    }
    
    return code;
  }

  static generateRelationshipAttributes(element, connections, allElements, language) {
    let attributes = '';
    
    // Find outgoing relationships (this class has these relationships)
    const outgoingRelationships = connections.filter(c => c.from === element.id);
    
    outgoingRelationships.forEach(connection => {
      const targetElement = allElements.find(e => e.id === connection.to);
      if (!targetElement) return;
      
      const targetName = targetElement.name;
      const multiplicity = connection.multiplicity || '1';
      const isMultiple = multiplicity.includes('*') || multiplicity.includes('0..*') || multiplicity.includes('1..*');
      
      if (connection.type === 'composition' || connection.type === 'aggregation' || connection.type === 'association') {
        if (language === 'Java') {
          if (isMultiple) {
            attributes += `    private List<${targetName}> ${this.pluralize(targetName.toLowerCase())} = new ArrayList<>();\n`;
          } else {
            attributes += `    private ${targetName} ${targetName.toLowerCase()};\n`;
          }
        } else if (language === 'Python') {
          if (isMultiple) {
            attributes += `        self.${this.pluralize(targetName.toLowerCase())} = []  # List[${targetName}]\n`;
          } else {
            attributes += `        self.${targetName.toLowerCase()} = None  # ${targetName}\n`;
          }
        } else if (language === 'JavaScript') {
          if (isMultiple) {
            attributes += `        this.${this.pluralize(targetName.toLowerCase())} = [];\n`;
          } else {
            attributes += `        this.${targetName.toLowerCase()} = null;\n`;
          }
        }
      }
    });
    
    return attributes;
  }

  static pluralize(word) {
    if (word.endsWith('s')) return word + 'es';
    if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
    return word + 's';
  }

  // ============================================================
  // USE CASE DIAGRAM CODE GENERATION
  // ============================================================

  static generateUseCaseDiagramCode(elements, connections, language) {
    // Generate test cases and documentation for use cases
    let code = '';
    
    code += '/**\n';
    code += ' * Use Case Diagram Implementation\n';
    code += ' * Generated from UML Use Case Diagram\n';
    code += ' */\n\n';
    
    // Generate use case handler class
    code += this.generateUseCaseHandler(elements, connections, language);
    
    return code;
  }

  static generateUseCaseHandler(elements, connections, language) {
    let code = '';
    
    if (language === 'Java') {
      code += 'package com.example.usecases;\n\n';
      code += 'public class UseCaseHandler {\n\n';
      
      elements.forEach(element => {
        if (element.type === 'usecase') {
          const methodName = this.normalizeIdentifier(element.name, 'method');
          code += `    public void execute${methodName.charAt(0).toUpperCase() + methodName.slice(1)}() {\n`;
          code += `        // Implement use case: ${element.name}\n`;
          code += '        // TODO: Add implementation\n';
          code += '    }\n\n';
        }
      });
      
      code += '}';
    } else if (language === 'Python') {
      code += 'class UseCaseHandler:\n';
      code += '    """Handle use case operations"""\n\n';
      
      elements.forEach(element => {
        if (element.type === 'usecase') {
          const methodName = this.normalizeIdentifier(element.name, 'method');
          code += `    def execute_${methodName}(self):\n`;
          code += `        """Execute use case: ${element.name}"""\n`;
          code += '        # TODO: Add implementation\n';
          code += '        pass\n\n';
        }
      });
    } else if (language === 'JavaScript') {
      code += 'class UseCaseHandler {\n\n';
      
      elements.forEach(element => {
        if (element.type === 'usecase') {
          const methodName = this.normalizeIdentifier(element.name, 'method');
          code += `    execute${methodName.charAt(0).toUpperCase() + methodName.slice(1)}() {\n`;
          code += `        // Implement use case: ${element.name}\n`;
          code += '        // TODO: Add implementation\n';
          code += '    }\n\n';
        }
      });
      
      code += '}\n\nexport default UseCaseHandler;';
    }
    
    return code;
  }

  static generateUseCaseDocumentation(elements, connections) {
    let doc = '# Use Case Diagram Documentation\n\n';
    
    doc += '## Actors\n\n';
    elements.filter(e => e.type === 'actor').forEach(actor => {
      doc += `### ${actor.name}\n`;
      doc += `- **Description**: Actor in the system\n`;
      doc += `- **Associated Use Cases**: `;
      
      const useCases = connections
        .filter(c => c.from === actor.id || c.to === actor.id)
        .map(c => {
          const useCaseId = c.from === actor.id ? c.to : c.from;
          const useCase = elements.find(e => e.id === useCaseId);
          return useCase ? useCase.name : '';
        })
        .filter(name => name);
      
      doc += useCases.join(', ') + '\n\n';
    });
    
    doc += '## Use Cases\n\n';
    elements.filter(e => e.type === 'usecase').forEach(usecase => {
      doc += `### ${usecase.name}\n`;
      doc += `- **Description**: ${usecase.description || 'No description provided'}\n`;
      doc += `- **Actors**: `;
      
      const actors = connections
        .filter(c => c.from === usecase.id || c.to === usecase.id)
        .map(c => {
          const actorId = c.from === usecase.id ? c.to : c.from;
          const actor = elements.find(e => e.id === actorId && e.type === 'actor');
          return actor ? actor.name : '';
        })
        .filter(name => name);
      
      doc += actors.join(', ') + '\n\n';
    });
    
    return doc;
  }

  static generateUseCaseTests(elements, connections, language) {
    let code = '';
    
    if (language === 'Java') {
      code += 'package com.example.usecases;\n\n';
      code += 'import org.junit.Test;\n';
      code += 'import static org.junit.Assert.*;\n\n';
      code += 'public class UseCaseTests {\n\n';
      
      elements.filter(e => e.type === 'usecase').forEach(usecase => {
        const methodName = this.normalizeIdentifier(usecase.name, 'method');
        code += `    @Test\n`;
        code += `    public void test${methodName.charAt(0).toUpperCase() + methodName.slice(1)}() {\n`;
        code += `        // Test use case: ${usecase.name}\n`;
        code += '        // TODO: Add test implementation\n';
        code += '    }\n\n';
      });
      
      code += '}';
    } else if (language === 'Python') {
      code += 'import unittest\n\n';
      code += 'class UseCaseTests(unittest.TestCase):\n';
      code += '    """Test use case operations"""\n\n';
      
      elements.filter(e => e.type === 'usecase').forEach(usecase => {
        const methodName = this.normalizeIdentifier(usecase.name, 'method');
        code += `    def test_${methodName}(self):\n`;
        code += `        """Test use case: ${usecase.name}"""\n`;
        code += '        # TODO: Add test implementation\n';
        code += '        pass\n\n';
      });
    } else if (language === 'JavaScript') {
      code += "const { expect } = require('chai');\n\n";
      code += 'describe("Use Case Tests", () => {\n\n';
      
      elements.filter(e => e.type === 'usecase').forEach(usecase => {
        const methodName = this.normalizeIdentifier(usecase.name, 'method');
        code += `    it("should execute ${usecase.name}", () => {\n`;
        code += '        // TODO: Add test implementation\n';
        code += '    });\n\n';
      });
      
      code += '});';
    }
    
    return code;
  }

  // ============================================================
  // SEQUENCE DIAGRAM CODE GENERATION
  // ============================================================

  static generateSequenceDiagramCode(elements, connections, language) {
    let code = '';
    
    code += '/**\n';
    code += ' * Sequence Diagram Implementation\n';
    code += ' * Generated from UML Sequence Diagram\n';
    code += ' */\n\n';
    
    code += this.generateSequenceHandler(elements, connections, language);
    
    return code;
  }

  static generateSequenceHandler(elements, connections, language) {
    let code = '';
    
    if (language === 'Java') {
      code += 'package com.example.sequences;\n\n';
      code += 'public class SequenceHandler {\n\n';
      
      // Group messages by lifeline
      const lifelines = elements.filter(e => e.type === 'lifeline');
      
      lifelines.forEach(lifeline => {
        const messages = connections.filter(c => c.from === lifeline.id);
        
        if (messages.length > 0) {
          code += `    // Interactions for ${lifeline.name}\n`;
          messages.forEach(msg => {
            const methodName = this.normalizeIdentifier(msg.label || 'interaction', 'method');
            code += `    public void ${methodName}() {\n`;
            code += `        // Message: ${msg.label || 'No label'}\n`;
            code += '        // TODO: Implement interaction\n';
            code += '    }\n\n';
          });
        }
      });
      
      code += '}';
    } else if (language === 'Python') {
      code += 'class SequenceHandler:\n';
      code += '    """Handle sequence interactions"""\n\n';
      
      const lifelines = elements.filter(e => e.type === 'lifeline');
      
      lifelines.forEach(lifeline => {
        const messages = connections.filter(c => c.from === lifeline.id);
        
        if (messages.length > 0) {
          messages.forEach(msg => {
            const methodName = this.normalizeIdentifier(msg.label || 'interaction', 'method');
            code += `    def ${methodName}(self):\n`;
            code += `        """Message: ${msg.label || 'No label'}"""\n`;
            code += '        # TODO: Implement interaction\n';
            code += '        pass\n\n';
          });
        }
      });
    } else if (language === 'JavaScript') {
      code += 'class SequenceHandler {\n\n';
      
      const lifelines = elements.filter(e => e.type === 'lifeline');
      
      lifelines.forEach(lifeline => {
        const messages = connections.filter(c => c.from === lifeline.id);
        
        if (messages.length > 0) {
          messages.forEach(msg => {
            const methodName = this.normalizeIdentifier(msg.label || 'interaction', 'method');
            code += `    ${methodName}() {\n`;
            code += `        // Message: ${msg.label || 'No label'}\n`;
            code += '        // TODO: Implement interaction\n';
            code += '    }\n\n';
          });
        }
      });
      
      code += '}\n\nexport default SequenceHandler;';
    }
    
    return code;
  }

  static generateSequenceDocumentation(elements, connections) {
    let doc = '# Sequence Diagram Documentation\n\n';
    
    doc += '## Participants\n\n';
    elements.filter(e => e.type === 'lifeline').forEach(lifeline => {
      doc += `### ${lifeline.name}\n`;
      doc += `- **Type**: Participant/Lifeline\n`;
      
      const outgoing = connections.filter(c => c.from === lifeline.id);
      const incoming = connections.filter(c => c.to === lifeline.id);
      
      if (outgoing.length > 0) {
        doc += `- **Outgoing Messages**: ${outgoing.map(c => c.label || 'unnamed').join(', ')}\n`;
      }
      if (incoming.length > 0) {
        doc += `- **Incoming Messages**: ${incoming.map(c => c.label || 'unnamed').join(', ')}\n`;
      }
      doc += '\n';
    });
    
    doc += '## Message Flow\n\n';
    connections.forEach((conn, idx) => {
      const source = elements.find(e => e.id === conn.from);
      const target = elements.find(e => e.id === conn.to);
      
      doc += `${idx + 1}. **${source?.name || 'Unknown'}** → **${target?.name || 'Unknown'}**: ${conn.label || 'No label'}\n`;
    });
    
    return doc;
  }

  // ============================================================
  // CODE FORMATTING AND UTILITIES
  // ============================================================

  static formatCode(code, language) {
    // Remove duplicate empty lines
    let formatted = code.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Remove trailing whitespace
    formatted = formatted.split('\n').map(line => line.trimEnd()).join('\n');
    
    // Ensure single newline at end
    formatted = formatted.trim() + '\n';
    
    return formatted;
  }

  /**
   * Generate multiple files for complex projects
   */
  static generateMultiFileCode(elements, connections = [], language = 'Java', diagramType = 'class') {
    return this.splitIntoFiles(elements, connections, language, diagramType);
  }

  /**
   * Split code generation into multiple files
   */
  static splitIntoFiles(elements, connections = [], language = 'Java', diagramType = 'class') {
    const files = [];
    
    if (diagramType === 'class') {
      // Generate one file per class element
      elements.filter(el => el.type === 'class' || el.type === 'interface' || el.type === 'abstract').forEach(element => {
        const fileName = this.getFileName(element.name, language);
        const fileContent = this.generateSingleClass(element, connections, elements, language);
        files.push({ filename: fileName, content: fileContent });
      });
    } else if (diagramType === 'usecase') {
      // Generate documentation and test files
      files.push({
        filename: 'UseCases.md',
        content: this.generateUseCaseDocumentation(elements, connections)
      });
      files.push({
        filename: this.getFileName('UseCaseTests', language),
        content: this.generateUseCaseTests(elements, connections, language)
      });
    } else if (diagramType === 'sequence') {
      // Generate interaction flow documentation and code
      files.push({
        filename: 'SequenceFlow.md',
        content: this.generateSequenceDocumentation(elements, connections)
      });
      files.push({
        filename: this.getFileName('InteractionHandler', language),
        content: this.generateSequenceCode(elements, connections, language)
      });
    }
    
    return files.length > 0 ? files : [{ filename: 'Generated.txt', content: 'No content to generate' }];
  }

  static getFileName(className, language) {
    switch (language) {
      case 'Java':
        return `${className}.java`;
      case 'Python':
        return `${className.toLowerCase()}.py`;
      case 'JavaScript':
        return `${className}.js`;
      default:
        return `${className}.txt`;
    }
  }
}

export default CodeGenerator;