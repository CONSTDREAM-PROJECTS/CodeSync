# CodeSynch - UML to Code Generator

A Model-Driven Engineering Framework for Automated UML-to-Web Code Generation.

## Thesis Project

- **Group:** CodeSync
- **Program:** BS Computer Science (Software Engineering)
- **Members:** Christer Vhon Peregrin, Ronin Bernardo, Andrea Ysabelle Rogon, Stephan Bernal
- **Academic Year:** 2025-2026

## Summary

CodeSynch is a small web app for visually editing UML class diagrams and generating web-oriented source code (JavaScript, Python, Java) from the diagram model. It includes a diagram editor UI, hooks for canvas interactions and history, services for mapping types and generating code, and utilities to help manage diagram state.

**This README** contains quick start instructions and a guided explanation of the project source so you can run, extend, or contribute to the tool.

## Requirements

- Node.js (recommended v16 or v18)
- npm (comes with Node.js)

On Windows you can verify your environment with:

```powershell
node --version
npm --version
```

## Install

1. From the project root run:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

3. Open http://localhost:3000 in your browser.

## Scripts

- `npm start` — start dev server (create-react-app dev server)
- `npm run build` — build production bundle into `build/`
- `npm test` — run tests (uses the test runner configured in the project)

## Build / Production

To create an optimized production build:

```bash
npm run build
```

The output will be placed in the `build/` directory. The `public/` folder contains static files used at runtime.

## Project Structure and File Explanations

Top-level:

- `package.json`: npm metadata and scripts.
- `README.md`: (this file) Quickstart and code explanation.
- `public/`: Static files served by the app in development or bundled into production.
- `build/`: Generated production files after `npm run build`.
- `src/`: Application source code.

Inside `src/`:

- `index.js`: React entry point. Renders `App.js` into the DOM and wires up performance reporting (`reportWebVitals.js`).
- `App.js`: Main app component that composes the editor UI and top-level layout.
- `index.css`, `App.css`: Global and app-specific styles.
- `App.test.js`, `setupTests.js`: Test harness and example tests.

Components (`src/components/`): each file is a React component that provides a specific area of the editor UI.

- `UMLEditor.jsx`:
	- Central component composing the editor canvas and sidebars.
	- Coordinates state for the current diagram, selected element, and generated code preview/export actions.
	- Uses hooks (below) for canvas interactions and history.

- `DiagramSidebar.jsx`:
	- Panel for listing classes, navigation, or export controls.

- `DiagramToolbar.jsx`:
	- Top toolbar containing actions like Add Class, Undo/Redo, Save, Generate Code, and export.

- `PropertiesPanel.jsx`:
	- Shows properties for the selected UML element (class, attribute, or method).
	- Allows editing of visibility (+/-/#), types, names, and method parameters.

- `ToolPalette.jsx`:
	- Toolbox for adding diagram elements (class, association, generalization, etc.).

- `CodeImportModal.jsx`:
	- Modal dialog for code-to-UML conversion.
	- Allows users to paste source code or upload files for reverse engineering.

Hooks (`src/hooks/`): reusable logic not tied to a visual component.

- `useCanvasInteractions.js`:
	- Handles mouse/touch interactions on the diagram canvas: selection, dragging, positioning, creating connections.
	- Returns handlers and state the `UMLEditor` attaches to the canvas element.

- `useHistory.js`:
	- Lightweight undo/redo stack for diagram state changes.
	- Exposes `undo()`, `redo()`, `pushState()` to keep user edits reversible.

Services (`src/services/`): pure logic that converts diagrams into code or maps types.

- `typeMapper.js`:
	- Responsible for mapping UML (or generic) types to target language types. For example, mapping `String` to `string` in TypeScript or `str` in Python.
	- Contains a per-language mapping table and helper functions to resolve types used in attributes and method signatures.

- `codeGenerator.js`:
	- Core logic that walks the diagram model and produces source code using templates or string builders.
	- Supports multiple target languages by selecting language-specific templates and invoking `typeMapper` for types.
	- Produces per-class files and optionally a single combined archive for download/export.

- `codeToUMLConverter.js`:
	- Reverse engineering service implementing Rule-Based Model Transformation Algorithm.
	- Parses source code (Java, Python, JavaScript) and converts it to UML diagram elements.
	- Detects classes, attributes, methods, and relationships automatically.

Utils (`src/utils/`): helper functions used across components and services.

- `diagramUtils.js`:
	- Contains helper functions to create, normalize, and serialize diagram elements (classes, attributes, methods, relationships).
	- Also includes functions for validating diagram consistency and preparing a data model for code generation.

How the pieces fit together

1. The user manipulates the diagram UI in `UMLEditor` using the `ToolPalette`, `DiagramToolbar`, and `PropertiesPanel`.
2. UI interactions delegate to `useCanvasInteractions` for low-level pointer events and `useHistory` to record states for undo/redo.
3. Diagram state is stored as a plain JSON model (objects for classes, attributes, methods, relationships). `diagramUtils` helps create and normalize this data.
4. When the user requests code generation, `UMLEditor` calls `codeGenerator.js` with the diagram model and target language.
5. `codeGenerator.js` uses `typeMapper.js` to map UML types to the target language, applies templates or builders, and returns generated source files.
6. The app shows the generated source in a preview and provides an export/download (e.g., zip of sources) via the browser.

Notes about templates and extending languages

- The code generator is template-driven. To add or tailor a language, add/modify the language template mappings inside `codeGenerator.js` and ensure `typeMapper.js` has appropriate type entries.
- Keep templates small and data-driven: accept the class model (name, attributes, methods) and render the file bodies accordingly.

---

## Detailed Code Explanations

### Core Algorithm 1: Rule-Based Model Transformation (Code → UML)

**File:** `src/services/codeToUMLConverter.js`

This service implements the bidirectional synchronization algorithm for converting source code into UML diagrams.

#### Main Conversion Method

```javascript
static convertCodeToUML(sourceCode, language = 'Java') {
  try {
    // Step 1: Parse the source code into a structured model
    // Extracts classes, methods, attributes from raw code text
    const parsedModel = this.parseSourceCode(sourceCode, language);
    
    // Step 2: Validate that we successfully parsed at least one class
    // If parsing failed, return an error response to the user
    if (!parsedModel || !parsedModel.classes || parsedModel.classes.length === 0) {
      return {
        success: false,
        message: `Could not parse ${language} code. Ensure syntax is valid.`,
        elements: [],
        connections: []
      };
    }

    // Step 3: Assign unique IDs to each class for relationship linking
    // Uses timestamp + index to ensure uniqueness across imports
    parsedModel.classes = parsedModel.classes.map((cls, idx) => ({
      ...cls,  // Spread existing class properties
      id: `class_${Date.now()}_${idx}`  // Add unique identifier
    }));

    // Step 4: Apply transformation rules to detect relationships
    // Analyzes class structure to find inheritance, composition, etc.
    const relationships = this.detectRelationships(parsedModel.classes);

    // Step 5: Convert parsed model to UML element format
    // Transforms from internal representation to canvas-ready objects
    const { elements, connections } = this.convertToUML(parsedModel.classes, relationships);

    // Step 6: Return success response with all extracted data
    return {
      success: true,
      message: `Successfully converted ${parsedModel.classes.length} classes to UML`,
      elements,        // UML class boxes with positions
      connections,     // Lines connecting related classes
      metadata: {      // Statistics for user feedback
        totalClasses: parsedModel.classes.length,
        totalMethods: parsedModel.classes.reduce((sum, cls) => sum + (cls.methods?.length || 0), 0),
        totalAttributes: parsedModel.classes.reduce((sum, cls) => sum + (cls.attributes?.length || 0), 0),
        relationships: relationships.length
      }
    };
  } catch (error) {
    // Step 7: Handle any unexpected errors gracefully
    console.error('Conversion error:', error);
    return {
      success: false,
      message: `Error: ${error.message}`,
      elements: [],
      connections: []
    };
  }
}
```

#### Python Parser Implementation

```javascript
static parsePython(sourceCode) {
  // Initialize empty model to store extracted classes
  const model = { classes: [] };
  
  // Step 1: Use regex to find all class definitions in the code
  // Pattern matches: class ClassName: or class ClassName(Parent):
  const classRegex = /class\s+(\w+)(?:\(([^)]*)\))?\s*:/g;
  const classMatches = [];  // Array to store class metadata
  let match;
  
  // Step 2: Execute regex repeatedly to find all classes
  while ((match = classRegex.exec(sourceCode)) !== null) {
    classMatches.push({
      index: match.index,           // Position in source code
      fullMatch: match[0],          // Full matched text "class Name:"
      className: match[1],          // Extracted class name
      parentClasses: match[2] || null  // Parent class if exists
    });
  }
  
  // Step 3: Extract class body for each detected class
  for (let i = 0; i < classMatches.length; i++) {
    const currentClass = classMatches[i];
    const nextClass = classMatches[i + 1];  // For boundary detection
    
    // Calculate start and end positions of class body
    const startIndex = currentClass.index + currentClass.fullMatch.length;
    const endIndex = nextClass ? nextClass.index : sourceCode.length;
    const classBody = sourceCode.substring(startIndex, endIndex);
    
    // Step 4: Extract attributes from class body
    // Looks for self.attribute = value patterns
    const attributes = [];
    const attrRegex = /self\.(\w+)\s*=\s*(.+?)(?:\n|$)/g;
    let attrMatch;
    const seenAttrs = new Set();  // Prevent duplicates
    
    while ((attrMatch = attrRegex.exec(classBody)) !== null) {
      if (!seenAttrs.has(attrMatch[1])) {
        seenAttrs.add(attrMatch[1]);
        attributes.push({
          name: attrMatch[1],         // Attribute name
          type: 'str',                // Default type (could be inferred)
          visibility: 'private'       // Python convention
        });
      }
    }
    
    // Step 5: Extract methods from class body
    // Looks for def method_name(...): patterns
    const methods = [];
    const methodRegex = /def\s+(\w+)\s*\(([^)]*)\)/g;
    let methodMatch;
    const seenMethods = new Set();  // Prevent duplicates
    
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      // Skip __init__ as it's the constructor, not a regular method
      if (methodMatch[1] !== '__init__' && !seenMethods.has(methodMatch[1])) {
        seenMethods.add(methodMatch[1]);
        methods.push({
          name: methodMatch[1],                              // Method name
          returnType: 'None',                                // Default return
          visibility: 'public',                              // Python convention
          parameters: methodMatch[2].replace(/self,?\s*/, '') // Remove 'self'
        });
      }
    }
    
    // Step 6: Build complete class object
    model.classes.push({
      name: currentClass.className,
      extends: currentClass.parentClasses ? 
               currentClass.parentClasses.split(',')[0].trim() : null,
      attributes,
      methods
    });
  }
  
  return model;  // Return parsed model
}
```

#### Relationship Detection

```javascript
static detectRelationships(classes) {
  const relationships = [];  // Array to store detected relationships
  
  // Iterate through each class to analyze its relationships
  classes.forEach((sourceClass) => {
    
    // Rule 1: Detect Inheritance
    // If class has 'extends' property, create inheritance relationship
    if (sourceClass.extends) {
      const targetClass = classes.find(c => c.name === sourceClass.extends);
      if (targetClass) {
        relationships.push({
          sourceId: sourceClass.id,    // Child class ID
          targetId: targetClass.id,     // Parent class ID
          type: 'inheritance'           // Relationship type
        });
      }
    }
    
    // Rule 2: Detect Composition and Aggregation
    // Check if attribute types match other class names
    if (sourceClass.attributes) {
      sourceClass.attributes.forEach(attr => {
        const matchedClass = classes.find(c => 
          attr.type === c.name ||              // Exact type match
          attr.type.includes(c.name) ||        // Type contains class name
          attr.name.includes(c.name.toLowerCase())  // Attribute name hints
        );
        
        if (matchedClass && matchedClass.id !== sourceClass.id) {
          // Determine if it's aggregation (collection) or composition (single)
          const isCollection = /list|array|set|\[\]/i.test(attr.type);
          relationships.push({
            sourceId: sourceClass.id,
            targetId: matchedClass.id,
            type: isCollection ? 'aggregation' : 'composition',
            multiplicity: isCollection ? '0..*' : '1'
          });
        }
      });
    }
  });
  
  return relationships;
}
```

#### UML Model Conversion

```javascript
static convertToUML(classes, relationships) {
  // Step 1: Transform classes to UML element format
  const elements = classes.map((cls, idx) => ({
    id: cls.id,                    // Unique identifier
    type: 'class',                 // Element type
    name: cls.name,                // Class name
    x: 100 + (idx * 300),         // X position (spaced 300px apart)
    y: 100,                        // Y position (fixed)
    width: 200,                    // Box width
    height: Math.max(150,          // Calculate height based on content
      100 + 
      (cls.attributes?.length || 0) * 20 +   // 20px per attribute
      (cls.methods?.length || 0) * 20        // 20px per method
    ),
    attributes: cls.attributes || [],  // Array of attribute objects
    methods: cls.methods || [],        // Array of method objects
    stereotype: ''                     // Optional stereotype label
  }));

  // Step 2: Transform relationships to connection format
  const connections = relationships.map(rel => ({
    id: `conn_${Date.now()}_${Math.random()}`,  // Unique connection ID
    from: rel.sourceId,              // Starting class ID
    to: rel.targetId,                // Target class ID
    type: rel.type,                  // Connection type (inheritance, etc.)
    label: '',                       // Optional label
    multiplicity: rel.multiplicity || '',     // Cardinality
    fromMultiplicity: '',            // Source end multiplicity
    toMultiplicity: rel.multiplicity || '',   // Target end multiplicity
    fromRole: '',                    // Source role name
    toRole: ''                       // Target role name
  }));

  return { elements, connections };  // Return both arrays
}
```

---

### Core Algorithm 2: Bidirectional Model-Code Synchronization (UML → Code)

**File:** `src/services/codeGenerator.js`

This service generates compilable source code from UML diagrams with proper type mapping and formatting.

#### Main Code Generation Entry Point

```javascript
static generateCode(elements, connections = [], language = 'Java', diagramType = 'class') {
  // Step 1: Validate and normalize the input model
  // Ensures all elements have required properties
  const normalizedModel = this.normalizeModel(elements, connections);
  
  // Step 2: Route to appropriate generator based on diagram type
  let code = '';
  switch (diagramType) {
    case 'class':
      // Generate class-based code (Java, Python, JavaScript)
      code = this.generateClassDiagramCode(
        normalizedModel.elements, 
        normalizedModel.connections, 
        language
      );
      break;
    case 'usecase':
      // Generate use case documentation or test templates
      code = this.generateUseCaseDiagramCode(
        normalizedModel.elements, 
        normalizedModel.connections, 
        language
      );
      break;
    case 'sequence':
      // Generate sequence flow documentation or skeleton code
      code = this.generateSequenceDiagramCode(
        normalizedModel.elements, 
        normalizedModel.connections, 
        language
      );
      break;
    default:
      // Default to class diagram generation
      code = this.generateClassDiagramCode(
        normalizedModel.elements, 
        normalizedModel.connections, 
        language
      );
  }
  
  // Step 3: Apply final formatting and optimization
  // Adds proper indentation, line breaks, and code style
  code = this.formatCode(code, language);
  
  return code;  // Return generated source code string
}
```

#### Java Code Generation

```javascript
static generateJavaCode(elements, connections) {
  let code = '';
  
  // Step 1: Count classes to determine approach
  const classElements = elements.filter(el => 
    el.type === 'class' || el.type === 'abstract' || el.type === 'interface'
  );
  
  // Step 2: Handle single vs multiple classes
  if (classElements.length === 1) {
    // Single class: Generate compilable public class
    code += 'package com.example.model;\n\n';
    code += 'import java.util.*;\n';
    code += 'import java.time.*;\n\n';
    code += this.generateJavaClass(classElements[0], connections, elements, true);
    return code;
  }
  
  // Step 3: Multiple classes: Add warning comment
  // Java doesn't allow multiple public classes in one file
  code += '/*\n';
  code += ' * NOTE: Multiple classes generated in one file.\n';
  code += ' * This is for VIEWING ONLY and will NOT compile in Java.\n';
  code += ' * \n';
  code += ' * To get compilable code:\n';
  code += ' * - Each class needs its own .java file\n';
  code += ' * - Use the multi-file generation feature\n';
  code += ' */\n\n';
  
  code += 'package com.example.model;\n\n';
  code += 'import java.util.*;\n';
  code += 'import java.time.*;\n\n';
  
  // Step 4: Generate each class (package-private, not public)
  classElements.forEach((element, index) => {
    code += this.generateJavaClass(element, connections, elements, false);
    if (index < classElements.length - 1) {
      code += '\n\n';
    }
  });
  
  return code;
}
```

#### Single Java Class Generation

```javascript
static generateJavaClass(element, connections, allElements, makePublic = true) {
  let code = '';
  
  // Step 1: Add JavaDoc comment
  code += '/**\n';
  code += ` * Class: ${element.name}\n`;
  code += ` * Generated from UML Class Diagram\n`;
  code += ' */\n';
  
  // Step 2: Find inheritance relationships
  // Search connections array for inheritance type where this class is source
  const extendsConnection = connections.find(c => 
    c.from === element.id && c.type === 'inheritance'
  );
  
  // Step 3: Find interface implementation relationships
  const implementsConnections = connections.filter(c => 
    c.from === element.id && c.type === 'realization'
  );
  
  // Step 4: Build class declaration
  const publicKeyword = makePublic ? 'public ' : '';  // Conditional public
  
  if (element.type === 'interface') {
    // Generate interface declaration
    code += `${publicKeyword}interface ${element.name}`;
  } else {
    // Generate class declaration
    code += `${publicKeyword}${element.type === 'abstract' ? 'abstract ' : ''}class ${element.name}`;
    
    // Add extends clause if parent exists
    if (extendsConnection) {
      const parentClass = allElements.find(e => e.id === extendsConnection.to);
      if (parentClass) {
        code += ` extends ${parentClass.name}`;
      }
    }
    
    // Add implements clause if interfaces exist
    if (implementsConnections.length > 0) {
      const interfaces = implementsConnections
        .map(c => allElements.find(e => e.id === c.to))
        .filter(e => e)
        .map(e => e.name);
      code += ` implements ${interfaces.join(', ')}`;
    }
  }
  
  code += ' {\n\n';
  
  // Step 5: Generate attributes section
  if (element.attributes && element.attributes.length > 0) {
    code += '    // Attributes\n';
    element.attributes.forEach(attr => {
      const visibility = attr.visibility || 'private';
      const type = this.mapType(attr.type, 'Java');  // Map UML type to Java type
      const name = attr.name;
      const isStatic = attr.isStatic ? 'static ' : '';
      const isFinal = attr.isFinal ? 'final ' : '';
      
      code += `    ${visibility} ${isStatic}${isFinal}${type} ${name};\n`;
    });
    code += '\n';
  }
  
  // Step 6: Generate constructor
  code += `    // Constructor\n`;
  code += `    public ${element.name}() {\n`;
  code += '    }\n\n';
  
  // Step 7: Generate methods
  if (element.methods && element.methods.length > 0) {
    code += '    // Methods\n';
    element.methods.forEach(method => {
      const visibility = method.visibility || 'public';
      const returnType = this.mapType(method.returnType, 'Java');
      const name = method.name;
      const params = method.parameters || '';
      
      code += `    ${visibility} ${returnType} ${name}(${params}) {\n`;
      
      // Add return statement for non-void methods
      if (returnType !== 'void') {
        code += `        return ${this.getDefaultValue(returnType, 'Java')};\n`;
      }
      
      code += '    }\n\n';
    });
  }
  
  // Step 8: Generate getters and setters
  if (element.attributes && element.attributes.length > 0) {
    code += '    // Getters and Setters\n';
    element.attributes.forEach(attr => {
      const name = attr.name;
      const type = this.mapType(attr.type, 'Java');
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      
      // Getter
      code += `    public ${type} get${capitalizedName}() {\n`;
      code += `        return this.${name};\n`;
      code += '    }\n\n';
      
      // Setter
      code += `    public void set${capitalizedName}(${type} ${name}) {\n`;
      code += `        this.${name} = ${name};\n`;
      code += '    }\n\n';
    });
  }
  
  code += '}\n';  // Close class
  
  return code;
}
```

#### Type Mapping System

```javascript
static mapType(umlType, targetLanguage) {
  // Define type mappings for each supported language
  const typeMappings = {
    Java: {
      'String': 'String',
      'Integer': 'int',
      'Double': 'double',
      'Boolean': 'boolean',
      'Float': 'float',
      'Long': 'long',
      'List': 'List<Object>',
      'Map': 'Map<String, Object>',
      'Object': 'Object',
      'void': 'void'
    },
    Python: {
      'String': 'str',
      'Integer': 'int',
      'Double': 'float',
      'Boolean': 'bool',
      'List': 'list',
      'Map': 'dict',
      'Object': 'object',
      'void': 'None'
    },
    JavaScript: {
      'String': 'string',
      'Integer': 'number',
      'Double': 'number',
      'Boolean': 'boolean',
      'List': 'Array',
      'Map': 'Object',
      'Object': 'any',
      'void': 'void'
    }
  };

  // Look up mapping for this language
  const languageMap = typeMappings[targetLanguage];
  if (!languageMap) return umlType || 'Object';
  
  // Return mapped type or original if no mapping exists
  return languageMap[umlType] || umlType || 'Object';
}
```

#### Default Value Generation

```javascript
static getDefaultValue(type, language) {
  // Define default values for each language's types
  const defaults = {
    Java: {
      'int': '0',
      'double': '0.0',
      'float': '0.0f',
      'boolean': 'false',
      'long': '0L',
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
      'None': 'None',
      'object': 'None'
    },
    JavaScript: {
      'number': '0',
      'string': '""',
      'boolean': 'false',
      'Array': '[]',
      'Object': '{}',
      'any': 'null',
      'void': ''
    }
  };

  // Get defaults for this language
  const languageDefaults = defaults[language];
  if (!languageDefaults) return 'null';
  
  // Return default value for this type
  return languageDefaults[type] || 'null';
}
```

---

### UI Integration: UMLEditor Component

**File:** `src/components/UMLEditor.jsx`

This is the main component that orchestrates all diagram operations.

#### State Management

```javascript
const UMLEditor = () => {
  // State 1: Diagram elements (classes, interfaces)
  const [elements, setElements] = useState([]);
  
  // State 2: Connections between elements (relationships)
  const [connections, setConnections] = useState([]);
  
  // State 3: Currently selected element for editing
  const [selectedElement, setSelectedElement] = useState(null);
  
  // State 4: Current diagram type (class, usecase, sequence)
  const [selectedDiagram, setSelectedDiagram] = useState('class');
  
  // State 5: Generated code output
  const [generatedCode, setGeneratedCode] = useState('');
  
  // State 6: Target programming language
  const [targetLanguage, setTargetLanguage] = useState('Java');
  
  // State 7: Code import modal visibility
  const [showCodeImportModal, setShowCodeImportModal] = useState(false);
  
  // Hook: Undo/Redo functionality
  const { pushState, undo, redo, canUndo, canRedo } = useHistory();
  
  // Hook: Canvas interaction handlers (drag, select, connect)
  const canvasHandlers = useCanvasInteractions({
    elements,
    setElements,
    connections,
    setConnections,
    selectedElement,
    setSelectedElement,
    pushState
  });
  
  return (
    // JSX rendering...
  );
};
```

#### Code Generation Handler

```javascript
const handleGenerateCode = () => {
  // Step 1: Validate that diagram has elements
  if (elements.length === 0) {
    alert('Please add at least one class to the diagram first.');
    return;
  }
  
  // Step 2: Call code generator with current state
  const code = CodeGenerator.generateCode(
    elements,           // All UML elements
    connections,        // All relationships
    targetLanguage,     // Selected language (Java/Python/JS)
    selectedDiagram     // Diagram type (class/usecase/sequence)
  );
  
  // Step 3: Update state to show generated code
  setGeneratedCode(code);
  
  // Step 4: Show code preview panel
  setShowCodePreview(true);
};
```

#### Code Import Handler

```javascript
const handleCodeToUML = () => {
  // Open the code import modal
  setShowCodeImportModal(true);
};

const handleImportCode = (importedElements, importedConnections) => {
  // Step 1: Check if canvas is empty
  if (elements.length === 0 && connections.length === 0) {
    // Canvas empty: Replace with imported content
    setElements(importedElements);
    setConnections(importedConnections);
  } else {
    // Step 2: Canvas has content: Offset imported elements to avoid overlap
    const maxX = Math.max(...elements.map(e => e.x + e.width), 0);
    const offsetElements = importedElements.map(el => ({
      ...el,
      x: el.x + maxX + 100  // Add 100px spacing after last element
    }));
    
    // Step 3: Merge imported with existing
    setElements([...elements, ...offsetElements]);
    setConnections([...connections, ...importedConnections]);
  }
  
  // Step 4: Save to history for undo capability
  saveToHistory(
    [...elements, ...importedElements],
    [...connections, ...importedConnections]
  );
  
  // Step 5: Provide user feedback
  alert(`Successfully imported ${importedElements.length} classes from code!`);
};
```

---

### Utility Functions: Diagram Management

**File:** `src/utils/diagramUtils.js`

Helper functions for diagram data manipulation.

#### Create New Class Element

```javascript
export const createClassElement = (x, y, name = 'NewClass') => {
  return {
    id: `class_${Date.now()}_${Math.random()}`,  // Unique ID
    type: 'class',                                 // Element type
    name: name,                                    // Class name
    x: x,                                          // X coordinate
    y: y,                                          // Y coordinate
    width: 200,                                    // Default width
    height: 150,                                   // Default height
    attributes: [],                                // Empty attributes array
    methods: [],                                   // Empty methods array
    stereotype: ''                                 // Optional stereotype
  };
};
```

#### Validate Diagram Consistency

```javascript
export const validateDiagram = (elements, connections) => {
  const errors = [];
  
  // Check 1: Validate all connections reference existing elements
  connections.forEach(conn => {
    const fromExists = elements.find(e => e.id === conn.from);
    const toExists = elements.find(e => e.id === conn.to);
    
    if (!fromExists) {
      errors.push(`Connection ${conn.id} references non-existent source element`);
    }
    if (!toExists) {
      errors.push(`Connection ${conn.id} references non-existent target element`);
    }
  });
  
  // Check 2: Validate class names are unique
  const names = elements.map(e => e.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate class names found: ${duplicates.join(', ')}`);
  }
  
  // Check 3: Validate attributes have required fields
  elements.forEach(element => {
    if (element.attributes) {
      element.attributes.forEach((attr, idx) => {
        if (!attr.name) {
          errors.push(`Attribute ${idx} in ${element.name} is missing a name`);
        }
        if (!attr.type) {
          errors.push(`Attribute ${attr.name} in ${element.name} is missing a type`);
        }
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};
```

---

## How the system works

This section gives a concise technical walkthrough of runtime architecture, data flow, and extension points.

- Architecture overview:
	- Frontend-only single-page React app. The UI components under `src/components/` manage presentation; hooks in `src/hooks/` encapsulate behavior; services in `src/services/` contain domain logic (type mapping and code generation); utilities in `src/utils/` handle data normalization and validation.

- Data model (diagram state):
	- The diagram is represented as a JSON model containing collections such as `classes`, `relationships`, and `metadata`.
	- A `class` object typically looks like: `{ id, name, x, y, attributes: [{id, name, type, visibility}], methods: [{id, name, returnType, params: [{name,type}]}] }`.
	- Relationships reference classes by `id` and include type information (association, aggregation, inheritance) and anchor points for rendering.

- UI interaction flow:
	1. User events (click, drag, type) are captured by `UMLEditor` and delegated to `useCanvasInteractions`.
	2. `useCanvasInteractions` updates the model (adds/moves/selects elements) and returns new state snapshots.
	3. Each change is pushed to `useHistory` which stores snapshots for undo/redo.
	4. Components re-render from the model; `PropertiesPanel` shows editable fields for the selected element.

- State persistence and export:
	- The app serializes the diagram JSON for download or local persistence (browser localStorage or file export).
	- Exported JSON can be re-imported to restore the diagram.

- Code generation pipeline:
	1. `UMLEditor` calls `codeGenerator.generate(model, language, options)` when the user requests code output.
	2. `codeGenerator` normalizes the model (via `diagramUtils`) to ensure consistent shape and valid names.
	3. For each class, the generator invokes language-specific templates and uses `typeMapper` to convert UML types to target language types.
	4. Generated file strings are returned as an array of `{ path, contents }` which the UI can preview or package into a zip for download.

- Code-to-UML reverse pipeline:
	1. `UMLEditor` opens `CodeImportModal` when user clicks "Code to Diagram" button.
	2. User selects language (Java, Python, JavaScript) and pastes source code or uploads file.
	3. `codeToUMLConverter.convertCodeToUML()` executes transformation:
		- Parses code into structured model (classes, methods, attributes)
		- Detects relationships (inheritance, composition, aggregation)
		- Converts to UML element format with positioning
	4. Converted elements and connections merged into canvas with offset positioning to avoid overlap.
	5. User can undo the import via history stack.

- Templates and language support:
	- Templates are small string builders or template functions inside `codeGenerator.js`. To add a language, add a new template set and update the language switch in the generator.
	- `typeMapper` keeps a map of type translations per language and exposes a `mapType(umlType, language)` helper.

- Undo/Redo behavior:
	- `useHistory` stores a bounded array of model snapshots and an index pointer. Calls to `pushState()` append snapshots and advance the pointer; `undo()` and `redo()` move the pointer and return the snapshot to apply.

- Performance considerations:
	- Model updates are small immutable changes; prefer shallow cloning of arrays/objects to trigger React updates while avoiding deep copies for large diagrams.
	- Heavy operations (packaging zip, large template rendering) should run asynchronously (e.g., `setTimeout` or worker) to keep the UI responsive.

- Extension points / where to modify behavior:
	- Add new code templates in `src/services/codeGenerator.js`.
	- Extend type mappings in `src/services/typeMapper.js`.
	- Add new element types or validation rules in `src/utils/diagramUtils.js` and adjust canvas rendering in `UMLEditor.jsx`.
	- Extend code-to-UML support by adding new language parsers in `src/services/codeToUMLConverter.js`.

- Deployment notes:
	- This is a static React app; build with `npm run build` and serve the `build/` folder with any static server (Netlify, Vercel, GitHub Pages, or a simple nginx/http-server).

---

## Testing

- Run unit tests with:

```bash
npm test
```

## Contributing and Development Notes

- Follow the React component patterns already used: small, focused components and hooks for shared behavior.
- Keep domain logic (diagram model transformations, code templates) inside `services/` and `utils/` — this keeps UI code simple and testable.

## Where to look first when extending

### Forward Path (UML → Code)

- `src/services/codeGenerator.js` — main place for language templates and generation logic.
  - `generateCode()` — Main entry point for code generation
  - `generateJavaCode()`, `generatePythonCode()`, `generateJavaScriptCode()` — Language-specific generators
  - `mapType()` — Type mapping from UML to target language
  - `getDefaultValue()` — Default value generation for types

- `src/services/typeMapper.js` — add mappings for new types or languages here.

- `src/utils/diagramUtils.js` — adjust model normalization or serialization here.

### Reverse Path (Code → UML)

- `src/services/codeToUMLConverter.js` — code-to-diagram conversion logic.
  - `convertCodeToUML()` — Main pipeline orchestrator
  - `parseSourceCode()` — Auto-detects language and routes to parser
  - `parsePython()`, `parseJava()`, `parseJavaScript()` — Language parsers
  - `detectRelationships()` — Relationship detection algorithm
  - `convertToUML()` — Transform parsed model to UML format

- `src/components/CodeImportModal.jsx` — modal UI for code input and conversion results.

- `src/components/UMLEditor.jsx` — integration point for reverse engineering.
  - `handleCodeToUML()` — Opens code import modal
  - `handleImportCode()` — Merges converted diagram with existing elements