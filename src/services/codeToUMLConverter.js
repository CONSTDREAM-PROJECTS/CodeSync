// Code-to-UML Converter Service
// Implements Rule-Based Model Transformation Algorithm
// Converts source code to UML diagrams using predefined transformation rules

class CodeToUMLConverter {
  /**
   * Main entry point: Convert source code to UML diagram model
   * Uses Rule-Based Model Transformation Algorithm
   */
  static convertCodeToUML(sourceCode, language = 'Java') {
    try {
      // Step 1: Parse code and extract structural elements
      const parsedModel = this.parseSourceCode(sourceCode, language);
      
      if (!parsedModel || (!parsedModel.classes || parsedModel.classes.length === 0)) {
        return {
          success: false,
          message: `Could not parse ${language} code. Ensure syntax is valid.`,
          elements: [],
          connections: [],
        };
      }

      // Enhance model with IDs for linking
      parsedModel.classes = parsedModel.classes.map((cls, idx) => ({
        ...cls,
        id: `class_${Date.now()}_${idx}`
      }));

      // Step 2: Apply transformation rules to detect relationships
      const relationships = this.applyTransformationRules(parsedModel.classes, sourceCode);

      // Step 3: Convert to UML model format
      const { elements, connections } = this.transformToUMLModel(parsedModel.classes, relationships);

      return {
        success: true,
        message: `Successfully converted ${parsedModel.classes.length} classes to UML`,
        elements,
        connections,
        metadata: {
          sourceLanguage: language,
          totalClasses: parsedModel.classes.length,
          totalMethods: parsedModel.classes.reduce((sum, cls) => sum + (cls.methods?.length || 0), 0),
          totalAttributes: parsedModel.classes.reduce((sum, cls) => sum + (cls.attributes?.length || 0), 0),
          relationships: relationships.length,
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error parsing code: ${error.message}`,
        error: error.toString(),
        elements: [],
        connections: [],
      };
    }
  }

  // ============================================================
  // SOURCE CODE PARSING - Extract structural elements
  // ============================================================

  static parseSourceCode(sourceCode, language) {
    // Auto-detect if it's PlantUML format
    if (sourceCode.includes('classDiagram') || sourceCode.includes('class ') && sourceCode.includes('{')) {
      return this.parsePlantUML(sourceCode);
    }

    switch(language.toLowerCase()) {
      case 'java':
        return this.parseJava(sourceCode);
      case 'python':
        return this.parsePython(sourceCode);
      case 'javascript':
      case 'js':
        return this.parseJavaScript(sourceCode);
      case 'plantuml':
        return this.parsePlantUML(sourceCode);
      default:
        return this.parseJava(sourceCode);
    }
  }

  static parseJava(sourceCode) {
    const model = {
      classes: [],
      interfaces: [],
      imports: []
    };

    // Extract imports
    const importRegex = /import\s+(.*?);/g;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      model.imports.push(match[1]);
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
      
      model.classes.push(classNode);
    }

    return model;
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

  static parsePython(sourceCode) {
    const model = {
      classes: [],
      imports: []
    };

    // Extract imports
    const importRegex = /^(?:from\s+[\w.]+\s+)?import\s+([\w,\s*]+)/gm;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      model.imports.push(match[1]);
    }

    // Use simple, reliable regex approach
    // Find all class definitions
    const classRegex = /class\s+(\w+)(?:\(([^)]*)\))?\s*:/g;
    const classMatches = [];
    
    while ((match = classRegex.exec(sourceCode)) !== null) {
      classMatches.push({
        index: match.index,
        fullMatch: match[0],
        className: match[1],
        parentClasses: match[2] || null
      });
    }
    
    // Extract body for each class
    for (let i = 0; i < classMatches.length; i++) {
      const currentClass = classMatches[i];
      const nextClass = classMatches[i + 1];
      
      // Get class body - from end of class declaration to start of next class (or end of file)
      const startIndex = currentClass.index + currentClass.fullMatch.length;
      const endIndex = nextClass ? nextClass.index : sourceCode.length;
      const classBody = sourceCode.substring(startIndex, endIndex);
      
      const classNode = {
        name: currentClass.className,
        extends: currentClass.parentClasses ? currentClass.parentClasses.split(',')[0].trim() : null,
        implements: [],
        attributes: this.extractPythonAttributes(classBody),
        methods: this.extractPythonMethods(classBody),
        isAbstract: sourceCode.includes('from abc import') && currentClass.parentClasses?.includes('ABC')
      };
      
      model.classes.push(classNode);
    }

    return model;
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
      
      if (!seen.has(methodName) && methodName !== '__init__') {
        seen.add(methodName);
        methods.push({
          name: methodName,
          returnType: returnType || 'None',
          visibility: methodName.startsWith('_') ? 'private' : 'public',
          parameters: params.replace(/self,?\s*/, ''),
          isStatic: false
        });
      }
    }
    
    return methods;
  }

  static inferPythonType(value) {
    if (value.includes('"') || value.includes("'")) return 'str';
    if (/^\d+$/.test(value.trim())) return 'int';
    if (/^\d+\.\d+$/.test(value.trim())) return 'float';
    if (value.includes('True') || value.includes('False')) return 'bool';
    if (value.includes('[')) return 'list';
    if (value.includes('{')) return 'dict';
    return 'object';
  }

  static parseJavaScript(sourceCode) {
    const model = {
      classes: []
    };

    // Extract ES6 classes
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([\s\S]*?)(?=\n\})/g;
    
    let match;
    while ((match = classRegex.exec(sourceCode)) !== null) {
      const [, className, extendsClass, classBody] = match;
      
      const classNode = {
        name: className,
        extends: extendsClass || null,
        implements: [],
        attributes: this.extractJavaScriptAttributes(classBody),
        methods: this.extractJavaScriptMethods(classBody),
        isAbstract: false
      };
      
      model.classes.push(classNode);
    }

    return model;
  }

  static extractJavaScriptAttributes(classBody) {
    const attributes = [];
    const attrRegex = /this\.(\w+)\s*=\s*([^;]+)/g;
    
    let match;
    const seen = new Set();
    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, name, value] = match;
      
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          type: 'any',
          visibility: 'public',
          isStatic: false
        });
      }
    }
    
    return attributes;
  }

  static extractJavaScriptMethods(classBody) {
    const methods = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g;
    
    let match;
    const seen = new Set();
    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, methodName, params] = match;
      
      if (!seen.has(methodName) && methodName !== 'constructor') {
        seen.add(methodName);
        methods.push({
          name: methodName,
          returnType: 'any',
          visibility: 'public',
          parameters: params,
          isStatic: false
        });
      }
    }
    
    return methods;
  }

  static parsePlantUML(sourceCode) {
    const model = {
      classes: []
    };

    // Extract classes from PlantUML format
    const classRegex = /class\s+(\w+)\s*\{([\s\S]*?)(?=\n\})/g;
    
    let match;
    while ((match = classRegex.exec(sourceCode)) !== null) {
      const [, className, classBody] = match;
      
      const classNode = {
        name: className,
        extends: null,
        implements: [],
        attributes: this.extractPlantUMLAttributes(classBody),
        methods: this.extractPlantUMLMethods(classBody),
        isAbstract: false
      };
      
      model.classes.push(classNode);
    }

    // Extract relationships
    this.extractPlantUMLRelationships(sourceCode, model.classes);

    return model;
  }

  static extractPlantUMLAttributes(classBody) {
    const attributes = [];
    if (!classBody) return attributes;

    const attrRegex = /([+\-#])\s*([\w]+)\s*:\s*(\w+)/g;
    let match;
    const seen = new Set();

    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, visibility, name, type] = match;

      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          type: type || 'Object',
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

    const methodRegex = /([+\-#])\s*([\w]+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?/g;
    let match;
    const seen = new Set();

    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, visibility, methodName, params, returnType] = match;

      if (!seen.has(methodName)) {
        seen.add(methodName);
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
    const relationshipRegex = /(\w+)\s+([<|]*-+[>|*]?)\s+(\w+)\s*:\s*(\w+)?/g;
    let match;

    while ((match = relationshipRegex.exec(sourceCode)) !== null) {
      const [, source, arrow, target, label] = match;
      
      if (arrow.includes('|')) {
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
  // RULE-BASED MODEL TRANSFORMATION - Apply transformation rules
  // ============================================================

  static applyTransformationRules(classes, sourceCode) {
    const relationships = [];

    classes.forEach((sourceClass) => {
      // Rule 1: Inheritance Relationship
      // If class extends another class, create inheritance relationship
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

      // Rule 2: Realization Relationship
      // If class implements interface(s), create realization relationship
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

      // Rule 3: Composition Relationship
      // If attribute type matches another class (non-collection), create composition
      if (sourceClass.attributes?.length > 0) {
        sourceClass.attributes.forEach(attr => {
          const matchedClass = classes.find(c => 
            c.name === attr.type || 
            attr.type.includes(c.name)
          );

          if (matchedClass) {
            const isCollection = /list|array|set|collection|vector/i.test(attr.type);
            
            if (!isCollection) {
              relationships.push({
                sourceId: sourceClass.id,
                targetId: matchedClass.id,
                type: 'composition',
                label: attr.name || '',
                multiplicity: '1'
              });
            }
          }
        });
      }

      // Rule 4: Aggregation Relationship
      // If attribute is a collection of another class, create aggregation
      if (sourceClass.attributes?.length > 0) {
        sourceClass.attributes.forEach(attr => {
          const matchedClass = classes.find(c => 
            attr.type.includes(`<${c.name}>`) ||
            (attr.type.includes(c.name) && /list|array|set|collection|vector/i.test(attr.type))
          );

          if (matchedClass) {
            relationships.push({
              sourceId: sourceClass.id,
              targetId: matchedClass.id,
              type: 'aggregation',
              label: attr.name || '',
              multiplicity: '0..*'
            });
          }
        });
      }

      // Rule 5: Dependency Relationship
      // If method parameter uses another class, create dependency
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

      // Rule 6: Association Relationship
      // If return type of method is another class, create association
      if (sourceClass.methods?.length > 0) {
        sourceClass.methods.forEach(method => {
          const matchedClass = classes.find(c => 
            c.name === method.returnType
          );

          if (matchedClass && matchedClass.id !== sourceClass.id) {
            const alreadyExists = relationships.some(r => 
              r.sourceId === sourceClass.id && 
              r.targetId === matchedClass.id
            );

            if (!alreadyExists) {
              relationships.push({
                sourceId: sourceClass.id,
                targetId: matchedClass.id,
                type: 'association',
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
  // MODEL TRANSFORMATION - Convert to UML format
  // ============================================================

  static transformToUMLModel(classes, relationships) {
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
      from: rel.sourceId,  // Changed from sourceId to from
      to: rel.targetId,    // Changed from targetId to to
      type: rel.type,
      label: rel.label || '',
      multiplicity: rel.multiplicity || '',
      fromMultiplicity: '',
      toMultiplicity: rel.multiplicity || '',
      fromRole: '',
      toRole: ''
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