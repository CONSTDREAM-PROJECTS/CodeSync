// Code-to-UML Converter Service
// Implements 3-Algorithm Pipeline:
// Algorithm A: AST Parser - Extract classes, methods, attributes
// Algorithm B: Relationship Detector - Find inheritance, composition, dependencies
// Algorithm C: Pattern Detector - Recognize design patterns

class CodeToUMLConverter {
  /**
   * Main entry point: Convert source code to UML diagram model
   * Pipeline: AST Parse → Relationship Detection → Pattern Detection → Convert to CodeSync format
   */
  static convertCodeToUML(sourceCode, language = 'Java') {
    try {
      // Step 1: Parse code using Algorithm A (AST Parser)
      const ast = this.parseSourceCode(sourceCode, language);
      
      if (!ast || (!ast.classes || ast.classes.length === 0)) {
        return {
          success: false,
          message: `Could not parse ${language} code. Ensure syntax is valid.`,
          elements: [],
          connections: [],
          patterns: []
        };
      }

      // Enhance AST with IDs for linking
      ast.classes = ast.classes.map((cls, idx) => ({
        ...cls,
        id: `class_${Date.now()}_${idx}`
      }));

      // Step 2: Detect relationships using Algorithm B
      const relationships = this.detectRelationships(ast.classes, sourceCode, language);
      
      // Step 3: Detect design patterns using Algorithm C
      const patterns = this.detectPatterns(ast.classes, sourceCode);

      // Step 4: Convert to CodeSync UML model
      const { elements, connections } = this.convertToUMLModel(ast.classes, relationships);

      return {
        success: true,
        message: `Successfully converted ${ast.classes.length} classes to UML`,
        elements,
        connections,
        patterns,
        ast,
        metadata: {
          sourceLanguage: language,
          totalClasses: ast.classes.length,
          totalMethods: ast.classes.reduce((sum, cls) => sum + (cls.methods?.length || 0), 0),
          totalAttributes: ast.classes.reduce((sum, cls) => sum + (cls.attributes?.length || 0), 0),
          relationships: relationships.length,
          patternsDetected: patterns.length
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error parsing code: ${error.message}`,
        error: error.toString(),
        elements: [],
        connections: [],
        patterns: []
      };
    }
  }

  // ============================================================
  // ALGORITHM A: AST PARSER - Extract structural elements from source code
  // ============================================================

  static parseSourceCode(sourceCode, language) {
    // Auto-detect if it's PlantUML format
    if (sourceCode.includes('classDiagram') || sourceCode.includes('class ') && sourceCode.includes('{')) {
      return this.parsePlantUMLAST(sourceCode);
    }

    switch(language.toLowerCase()) {
      case 'java':
        return this.parseJavaAST(sourceCode);
      case 'python':
        return this.parsePythonAST(sourceCode);
      case 'javascript':
      case 'js':
        return this.parseJavaScriptAST(sourceCode);
      case 'plantuml':
        return this.parsePlantUMLAST(sourceCode);
      default:
        return this.parseJavaAST(sourceCode);
    }
  }

  static parseJavaAST(sourceCode) {
    const ast = {
      classes: [],
      interfaces: [],
      imports: []
    };

    // Extract imports
    const importRegex = /import\s+(.*?);/g;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      ast.imports.push(match[1]);
    }

    // Extract classes with modifiers and inheritance
    const classRegex = /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*\{([\s\S]*?)(?=\n\}(?:\s|$)|\Z)/g;
    
    while ((match = classRegex.exec(sourceCode)) !== null) {
      const [, className, extendsClass, implementsClasses, classBody] = match;
      
      const classNode = {
        name: className,
        extends: extendsClass || null,
        implements: implementsClasses ? implementsClasses.split(',').map(s => s.trim()) : [],
        attributes: this.extractJavaAttributes(classBody),
        methods: this.extractJavaMethods(classBody),
        isAbstract: /\babstract\s+class\b/.test(match[0]),
        isFinal: /\bfinal\s+class\b/.test(match[0])
      };
      
      ast.classes.push(classNode);
    }

    return ast;
  }

  static extractJavaAttributes(classBody) {
    const attributes = [];
    const attrRegex = /(public|private|protected)?\s+(static\s+)?(final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
    
    let match;
    const seen = new Set();
    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, visibility = 'private', isStatic, isFinal, type, name] = match;
      
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          type: type.replace(/<[^>]+>/, ''),
          visibility: visibility || 'private',
          isStatic: !!isStatic,
          isFinal: !!isFinal
        });
      }
    }
    
    return attributes;
  }

  static extractJavaMethods(classBody) {
    const methods = [];
    const methodRegex = /(public|private|protected)?\s+(static\s+)?(abstract\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)(?:\s+throws\s+[\w\s,]+)?\s*(?:\{|;)/g;
    
    let match;
    const seen = new Set();
    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, visibility = 'public', isStatic, isAbstract, returnType, methodName, params] = match;
      
      if (!seen.has(methodName)) {
        seen.add(methodName);
        methods.push({
          name: methodName,
          returnType: returnType.replace(/<[^>]+>/, ''),
          visibility: visibility || 'public',
          parameters: params,
          isStatic: !!isStatic,
          isAbstract: !!isAbstract
        });
      }
    }
    
    return methods;
  }

  static parsePythonAST(sourceCode) {
    const ast = {
      classes: [],
      imports: []
    };

    // Extract imports
    const importRegex = /^(?:from\s+[\w.]+\s+)?import\s+([\w,\s*]+)/gm;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      ast.imports.push(match[1]);
    }

    // Extract classes
    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?\s*:\n((?:(?:    |\t).*\n?)*)/gm;
    
    while ((match = classRegex.exec(sourceCode)) !== null) {
      const [, className, parentClasses, classBody] = match;
      
      const classNode = {
        name: className,
        extends: parentClasses ? parentClasses.split(',')[0].trim() : null,
        implements: [],
        attributes: this.extractPythonAttributes(classBody),
        methods: this.extractPythonMethods(classBody),
        isAbstract: sourceCode.includes('from abc import') && /class\s+\w+\(ABC\)/.test(match[0])
      };
      
      ast.classes.push(classNode);
    }

    return ast;
  }

  static extractPythonAttributes(classBody) {
    const attributes = [];
    const attrRegex = /self\.(\w+)\s*=\s*(.+?)(?:\n|$)/g;
    
    let match;
    const seen = new Set();
    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, name, value] = match;
      
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          type: this.inferPythonType(value),
          visibility: 'private',
          isStatic: false
        });
      }
    }
    
    return attributes;
  }

  static extractPythonMethods(classBody) {
    const methods = [];
    const methodRegex = /^\s{0,}def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+))?\s*:/gm;
    
    let match;
    const seen = new Set();
    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, methodName, params, returnType] = match;
      
      if (methodName !== '__init__' && !seen.has(methodName)) {
        seen.add(methodName);
        
        const paramList = params
          .split(',')
          .filter(p => p.trim() !== 'self')
          .map(p => p.trim())
          .join(', ');
        
        methods.push({
          name: methodName,
          returnType: returnType || 'None',
          visibility: methodName.startsWith('_') ? 'private' : 'public',
          parameters: paramList,
          isStatic: methodName === '__new__'
        });
      }
    }
    
    return methods;
  }

  static inferPythonType(value) {
    if (/\[\]|\{\}/.test(value)) return 'list';
    if (/^\d+$/.test(value)) return 'int';
    if (/^\d+\.\d+$/.test(value)) return 'float';
    if (/^['"]/.test(value)) return 'str';
    if (/^(True|False)$/.test(value)) return 'bool';
    return 'object';
  }

  static parseJavaScriptAST(sourceCode) {
    const ast = {
      classes: [],
      imports: []
    };

    // Extract ES6 imports
    const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      ast.imports.push(match[3]);
    }

    // Extract classes
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([\s\S]*?)\n\}/g;
    
    while ((match = classRegex.exec(sourceCode)) !== null) {
      const [, className, extendsClass, classBody] = match;
      
      const classNode = {
        name: className,
        extends: extendsClass || null,
        implements: [],
        attributes: this.extractJSAttributes(classBody),
        methods: this.extractJSMethods(classBody),
        isAbstract: false
      };
      
      ast.classes.push(classNode);
    }

    return ast;
  }

  static extractJSAttributes(classBody) {
    const attributes = [];
    const attrRegex = /(?:this\.)?(\w+)\s*=\s*[^;]+;?/g;
    
    let match;
    const seen = new Set();
    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, name] = match;
      
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          type: 'any',
          visibility: name.startsWith('#') ? 'private' : 'public',
          isStatic: false
        });
      }
    }
    
    return attributes;
  }

  static extractJSMethods(classBody) {
    const methods = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;
    
    let match;
    const seen = new Set();
    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, methodName, params, returnType] = match;
      
      if (methodName !== 'constructor' && !seen.has(methodName)) {
        seen.add(methodName);
        
        methods.push({
          name: methodName,
          returnType: returnType || 'any',
          visibility: methodName.startsWith('_') ? 'private' : 'public',
          parameters: params,
          isStatic: /\bstatic\s+\w+\s*\(/.test(match[0])
        });
      }
    }
    
    return methods;
  }

  // ============================================================
  // PlantUML Parser - Parse PlantUML class diagram syntax
  // ============================================================

  static parsePlantUMLAST(sourceCode) {
    const ast = {
      classes: [],
      imports: []
    };

    // Remove classDiagram keyword and extra whitespace
    const cleanCode = sourceCode.replace(/classDiagram\s*/i, '').trim();

    // Extract classes: class ClassName { ... }
    const classRegex = /class\s+(\w+)\s*(\{[^}]*\})?/g;
    let match;

    while ((match = classRegex.exec(cleanCode)) !== null) {
      const [, className, classBody] = match;

      const classNode = {
        name: className,
        extends: null,
        implements: [],
        attributes: this.extractPlantUMLAttributes(classBody || ''),
        methods: this.extractPlantUMLMethods(classBody || ''),
        isAbstract: false
      };

      ast.classes.push(classNode);
    }

    // Extract relationships and inheritance
    this.extractPlantUMLRelationships(cleanCode, ast.classes);

    return ast;
  }

  static extractPlantUMLAttributes(classBody) {
    const attributes = [];
    if (!classBody) return attributes;

    // Match lines like: +String name, -int age, #List books
    const attrRegex = /([+\-#])(\w+)\s+(\w+)/g;
    let match;
    const seen = new Set();

    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, visibility, type, name] = match;
      
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          type,
          visibility: visibility === '+' ? 'public' : visibility === '-' ? 'private' : 'protected',
          isStatic: false
        });
      }
    }

    return attributes;
  }

  static extractPlantUMLMethods(classBody) {
    const methods = [];
    if (!classBody) return methods;

    // Match lines like: +addBook(Book book), -checkout(), #getName(): String
    const methodRegex = /([+\-#])\s*([\w]+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?/g;
    let match;
    const seen = new Set();

    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, visibility, methodName, params, returnType] = match;

      if (!seen.has(methodName)) {
        seen.add(methodName);
        
        // Skip attributes (properties without parentheses)
        methods.push({
          name: methodName,
          returnType: returnType || 'void',
          visibility: visibility === '+' ? 'public' : visibility === '-' ? 'private' : 'protected',
          parameters: params,
          isStatic: false
        });
      }
    }

    return methods;
  }

  static extractPlantUMLRelationships(sourceCode, classes) {
    // Extract relationships like: Library "1" --* "many" Book : contains
    // Patterns: --> (inheritance), <|-- (realization), --* (aggregation), -- (association)
    
    const relationshipRegex = /(\w+)\s+([<|]*-+[>|*]?)\s+(\w+)\s*:\s*(\w+)?/g;
    let match;

    while ((match = relationshipRegex.exec(sourceCode)) !== null) {
      const [, source, arrow, target, label] = match;
      
      if (arrow.includes('|')) {
        // Inheritance or realization
        const sourceClass = classes.find(c => c.name === source);
        if (sourceClass) {
          if (arrow.includes('<')) {
            sourceClass.extends = target;
          } else {
            sourceClass.implements = [target];
          }
        }
      }
    }
  }

  // ============================================================
  // ALGORITHM B: RELATIONSHIP DETECTOR - Detect inheritance, composition, dependencies
  // ============================================================

  static detectRelationships(classes, sourceCode, language) {
    const relationships = [];

    classes.forEach((sourceClass) => {
      // 1. INHERITANCE (extends)
      if (sourceClass.extends) {
        const targetClass = classes.find(c => c.name === sourceClass.extends);
        if (targetClass) {
          relationships.push({
            sourceId: sourceClass.id,
            targetId: targetClass.id,
            type: 'inheritance',
            label: 'extends'
          });
        }
      }

      // 2. IMPLEMENTATION (implements)
      if (sourceClass.implements?.length > 0) {
        sourceClass.implements.forEach(iface => {
          const targetClass = classes.find(c => c.name === iface);
          if (targetClass) {
            relationships.push({
              sourceId: sourceClass.id,
              targetId: targetClass.id,
              type: 'realization',
              label: 'implements'
            });
          }
        });
      }

      // 3. COMPOSITION/AGGREGATION (attributes showing other classes)
      if (sourceClass.attributes?.length > 0) {
        sourceClass.attributes.forEach(attr => {
          const matchedClass = classes.find(c => 
            c.name === attr.type || 
            attr.type.includes(c.name) ||
            attr.type.includes(`<${c.name}>`)
          );

          if (matchedClass) {
            const isCollection = /list|array|set|collection|vector/i.test(attr.type);
            
            relationships.push({
              sourceId: sourceClass.id,
              targetId: matchedClass.id,
              type: isCollection ? 'aggregation' : 'composition',
              label: attr.name || '',
              multiplicity: isCollection ? '0..*' : '1'
            });
          }
        });
      }

      // 4. DEPENDENCY (method parameters using other classes)
      if (sourceClass.methods?.length > 0) {
        sourceClass.methods.forEach(method => {
          const paramRegex = /(\w+)/g;
          let paramMatch;
          const seenParams = new Set();
          
          while ((paramMatch = paramRegex.exec(method.parameters)) !== null) {
            const paramType = paramMatch[1];
            const matchedClass = classes.find(c => c.name === paramType);
            const key = `${sourceClass.id}_${matchedClass?.id}`;
            
            if (matchedClass && !seenParams.has(key) && matchedClass.id !== sourceClass.id) {
              seenParams.add(key);
              relationships.push({
                sourceId: sourceClass.id,
                targetId: matchedClass.id,
                type: 'dependency',
                label: method.name || ''
              });
            }
          }
        });
      }
    });

    return relationships;
  }

  // ============================================================
  // ALGORITHM C: PATTERN DETECTOR - Recognize design patterns
  // ============================================================

  static detectPatterns(classes, sourceCode) {
    const patterns = [];

    classes.forEach(cls => {
      // 1. SINGLETON PATTERN
      const hasPrivateConstructor = sourceCode.includes(`private ${cls.name}()`) || sourceCode.includes(`__init__`);
      const hasGetInstanceMethod = cls.methods?.some(m => 
        m.name.toLowerCase().includes('getinstance') || m.name.toLowerCase().includes('get_instance')
      );
      const hasStaticInstance = cls.attributes?.some(attr => attr.isStatic && attr.name.toLowerCase().includes('instance'));

      if (hasStaticInstance && hasGetInstanceMethod) {
        patterns.push({
          type: 'Singleton',
          class: cls.name,
          confidence: 0.95
        });
      }

      // 2. FACTORY PATTERN
      const createMethods = cls.methods?.filter(m => 
        m.name.toLowerCase().startsWith('create') || m.name.toLowerCase().startsWith('build')
      ) || [];

      if (createMethods.length >= 1) {
        patterns.push({
          type: 'Factory',
          class: cls.name,
          methods: createMethods.map(m => m.name),
          confidence: 0.80
        });
      }

      // 3. OBSERVER PATTERN
      const hasUpdate = cls.methods?.some(m => m.name === 'update' || m.name === 'notify');
      if (hasUpdate) {
        patterns.push({
          type: 'Observer/Observable',
          class: cls.name,
          confidence: 0.70
        });
      }

      // 4. STRATEGY PATTERN
      if (cls.implements?.length > 0 && cls.methods?.length > 0 && !cls.isAbstract) {
        patterns.push({
          type: 'Strategy',
          class: cls.name,
          interface: cls.implements[0],
          confidence: 0.75
        });
      }
    });

    return patterns;
  }

  // ============================================================
  // Convert parsed AST to CodeSync UML Model
  // ============================================================

  static convertToUMLModel(classes, relationships) {
    const elements = classes.map((cls, idx) => ({
      id: cls.id,
      type: cls.isAbstract ? 'abstract' : 'class',
      name: cls.name,
      x: 100 + (idx * 300),
      y: 100,
      width: 200,
      height: this.calculateHeight(cls),
      attributes: cls.attributes || [],
      methods: cls.methods || [],
      stereotype: cls.isAbstract ? 'abstract' : ''
    }));

    const connections = relationships.map(rel => ({
      id: `conn_${Date.now()}_${Math.random()}`,
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      type: rel.type,
      label: rel.label || '',
      multiplicity: rel.multiplicity || ''
    }));

    return { elements, connections };
  }

  static calculateHeight(cls) {
    const baseHeight = 60;
    const attrHeight = (cls.attributes?.length || 0) * 18;
    const methodHeight = (cls.methods?.length || 0) * 18;
    return Math.max(100, baseHeight + attrHeight + methodHeight + 30);
  }
}

export default CodeToUMLConverter;
