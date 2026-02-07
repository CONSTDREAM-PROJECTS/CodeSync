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
	- Reverse engineering service implementing 3-algorithm pipeline for Code-to-Diagram conversion.
	- Algorithm A: AST Parser - extracts classes, methods, attributes from Java, Python, JavaScript, or PlantUML source code.
	- Algorithm B: Relationship Detector - identifies inheritance, composition, aggregation, dependency connections.
	- Algorithm C: Pattern Detector - recognizes Singleton, Factory, Observer, Strategy design patterns.

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
	2. User selects language (Java, Python, JavaScript, PlantUML) and pastes source code.
	3. `codeToUMLConverter.convertCodeToUML()` executes 3-algorithm pipeline:
		- Algorithm A parses code into AST (abstract syntax tree) with classes, methods, attributes
		- Algorithm B detects relationships (inheritance, composition, etc.)
		- Algorithm C identifies design patterns (confidence scores included)
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

If you want, I can also add a small JSON example of the diagram model, an example generator template for one language, or inline comments inside `src/services/codeGenerator.js` explaining each step. Tell me which you'd prefer next.

## Advanced Code Generation (Algorithms 8-11)

CodeSynch includes sophisticated code generation with four advanced algorithms for production-ready output:

### Algorithm 8: File Splitting
The generator automatically splits classes into separate files following language conventions.

- **Java**: Generates one `.java` file per class in the named package
- **Python**: Generates one `.py` file per class using snake_case filenames, plus `__init__.py` index
- **JavaScript**: Generates one `.js` file per class using camelCase filenames, plus `index.js` for exports

**Example:** A diagram with `Customer` and `Account` classes generates:
- Java: `Customer.java`, `Account.java`
- Python: `customer.py`, `account.py`, `__init__.py`
- JavaScript: `customer.js`, `account.js`, `index.js`

Switch between files using the file tabs in the "Generated Code" panel.

### Algorithm 9: Import Injection
Automatically detects dependencies and generates accurate import statements.

- Analyzes attribute types and injects corresponding class imports
- Scans method return types and parameter types to find dependencies
- Follows language-specific import syntax:
  - **Java**: `import ClassName;`
  - **Python**: `from .module_name import ClassName`
  - **JavaScript**: `import { ClassName } from './module_name';`
- Excludes standard library types (String, int, boolean, etc.) from imports

**Example:** A `Customer` class with an `Account` attribute automatically injects the Account import.

### Algorithm 10: Field Injection (Dependency Injection)
Generates constructor-based dependency injection for associated classes.

- Detects associations and dependency relationships from the diagram
- Generates constructor parameters for each dependency
- Auto-initializes fields in the constructor bodies
- Applies language-specific constructor patterns

**Example Generated Code (Java):**
```java
public class Order {
    private Customer customer;
    private Shipment shipment;
    
    public Order(Customer customer, Shipment shipment) {
        this.customer = customer;
        this.shipment = shipment;
    }
}
```

**Example Generated Code (Python):**
```python
class Order:
    def __init__(self, customer, shipment):
        self.customer = customer
        self.shipment = shipment
```

### Algorithm 11: CamelCase Fix (Naming Conventions)
Applies strict, language-specific naming conventions automatically.

- **Java**: PascalCase for classes (`CustomerOrder`), camelCase for methods and variables (`getCustomerName()`, `orderTotal`)
- **Python**: snake_case for classes, methods, and variables (`customer_order`, `get_customer_name()`, `order_total`)
- **JavaScript**: PascalCase for classes (`CustomerOrder`), camelCase for methods and variables (`getCustomerName()`, `orderTotal`)
- Converts abbreviations: `usr` → `user`, `pwd` → `password`, `addr` → `address`, etc.

**Conversion Examples:**
| Input | Java Output | Python Output | JavaScript Output |
|-------|-------------|---------------|--------------------|
| UserProfile | UserProfile | user_profile | UserProfile |
| getUSERName | getUserName | get_user_name | getUserName |
| customer_id | customerId | customer_id | customerId |
| btn_submit | btnSubmit | btn_submit | btnSubmit |

## Reverse Engineering (Code to Diagram)

CodeSynch now supports **bidirectional** code generation with sophisticated code-to-UML conversion.

### Algorithm A: AST Parser

Extracts structural elements (classes, methods, attributes) from source code using regex-based parsing.

**Supported Languages:**
- **Java**: Full support for classes, visibility modifiers, inheritance, interfaces, type generics
- **Python**: Full support with indentation-aware parsing, type inference from values
- **JavaScript**: ES6 class syntax with property detection
- **PlantUML**: Diagram definition syntax with auto-detection

**Features:**
- Detects visibility modifiers (`public`, `private`, `protected`, `+`, `-`, `#`)
- Extracts method signatures with return types and parameters
- Identifies inheritance (`extends`) and interfaces (`implements`)
- Supports abstract classes and static members
- Infers types from default values (Python-specific)

### Algorithm B: Relationship Detector

Analyzes code structure to identify UML relationships:

- **Inheritance**: Classes extending parent classes via `extends` keyword
- **Realization**: Class implementing interfaces via `implements` keyword
- **Composition/Aggregation**: Attribute types matching other classes in diagram
  - Collection types (List, Array, Set) → Aggregation (0..*)
  - Single object types → Composition (1)
- **Dependency**: Method parameters using other classes

**Multiplicity Detection:**
- Single references: `1:1`
- Collections: `0..*` or `1..*`
- Extracted from type declarations and parameter lists

### Algorithm C: Pattern Detector

Recognizes common design patterns with confidence scoring:

- **Singleton**: Static instance field + getInstance() method (95% confidence)
- **Factory**: Create/Build methods (80% confidence)
- **Observer/Observable**: update/notify methods (70% confidence)
- **Strategy**: Class implementing interface with multiple implementations (75% confidence)

**Output:** Pattern list with class names and confidence percentages displayed in conversion results.

### Usage

1. Click **"Code to Diagram"** button in toolbar
2. Select language: Java, Python, JavaScript, or PlantUML
3. Paste source code or PlantUML diagram definition
4. Click **"Convert to UML Diagram"**
5. Review detected classes, relationships, and patterns
6. Click **"Import to Diagram"** to add to canvas

**Automatic Features:**
- Offset positioning prevents element overlap
- Duplicate detection prevents reimporting
- Full undo/redo support
- Design patterns highlighted with metadata

## How Accurate Code Generation Works

The complete pipeline (forward and reverse):

**Forward Path (UML → Code):**
1. **Standardize** the UML model (normalize names, types)
2. **Detect Patterns** (Singleton, Factory, Observer)
3. **Apply Naming Optimizations** (expand abbreviations, fix conventions)
4. **Split into Files** → generate per-class files, not one monolithic output
5. **Inject Imports** → analyze dependencies, add proper language-specific imports
6. **Inject Fields** → detect relationships, create constructor parameters and field assignments
7. **Fix Naming** → apply language conventions to every identifier
8. **Generate Code** → output clean, idiomatic, production-ready code

**Reverse Path (Code → UML):**
1. **Parse Source Code** (Algorithm A: AST extraction)
2. **Detect Relationships** (Algorithm B: Connection inference)
3. **Recognize Patterns** (Algorithm C: Design pattern analysis)
4. **Convert to UML Model** → create elements and connections
5. **Merge with Diagram** → integrate into canvas with positioning

When you generate code, the output is displayed with file tabs if multiple files were created. Each file is fully self-contained with proper imports, constructors, and naming conventions. When you import code, all detected classes, relationships, and patterns are displayed with confidence scores.

## Testing

- Run unit tests with:

```bash
npm test
```

## Contributing and Development Notes

- Follow the React component patterns already used: small, focused components and hooks for shared behavior.
- Keep domain logic (diagram model transformations, code templates) inside `services/` and `utils/` — this keeps UI code simple and testable.

## Where to look first when extending code generation

### Forward Path (UML → Code)

- `src/services/codeGenerator.js` — main place for language templates and generation logic.
  - `generateCode()` — Main entry point for code generation
  - `splitIntoFiles()` — Algorithm 8: File Splitting
  - `injectImports()` — Algorithm 9: Import Injection
  - `injectFields()` — Algorithm 10: Field Injection
  - `fixNamingConventions()` — Algorithm 11: CamelCase Fix
  - `toCamelCase()`, `toPascalCase()`, `toSnakeCase()`, `toUpperSnakeCase()` — Naming helpers
  - `generateSingleClassFile()` — Generate individual class files
  - `generateObjectDiagramCode()` — Object diagram generation

- `src/services/typeMapper.js` — add mappings for new types or languages here.

- `src/utils/diagramUtils.js` — adjust model normalization or serialization here.

### Reverse Path (Code → UML)

- `src/services/codeToUMLConverter.js` — code-to-diagram conversion logic.
  - `convertCodeToUML()` — Main pipeline orchestrator (returns elements, connections, patterns)
  - `parseSourceCode()` — Auto-detects language and routes to correct parser
  - `parseJavaAST()` — Java code extraction
  - `parsePythonAST()` — Python code extraction
  - `parseJavaScriptAST()` — JavaScript code extraction
  - `parsePlantUMLAST()` — PlantUML diagram parsing
  - `detectRelationships()` — Algorithm B: Relationship detection
  - `detectPatterns()` — Algorithm C: Design pattern recognition
  - `convertToUMLModel()` — Transform AST to CodeSync element format

- `src/components/CodeImportModal.jsx` — modal UI for code input and conversion results.

- `src/components/UMLEditor.jsx` — integration point for reverse engineering.
  - `handleCodeToUML()` — Opens code import modal
  - `handleImportCode()` — Merges converted diagram with existing elements
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
	- Reverse engineering service implementing 3-algorithm pipeline for Code-to-Diagram conversion.
	- Algorithm A: AST Parser - extracts classes, methods, attributes from Java, Python, JavaScript, or PlantUML source code.
	- Algorithm B: Relationship Detector - identifies inheritance, composition, aggregation, dependency connections.
	- Algorithm C: Pattern Detector - recognizes Singleton, Factory, Observer, Strategy design patterns.

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
	2. User selects language (Java, Python, JavaScript, PlantUML) and pastes source code.
	3. `codeToUMLConverter.convertCodeToUML()` executes 3-algorithm pipeline:
		- Algorithm A parses code into AST (abstract syntax tree) with classes, methods, attributes
		- Algorithm B detects relationships (inheritance, composition, etc.)
		- Algorithm C identifies design patterns (confidence scores included)
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

If you want, I can also add a small JSON example of the diagram model, an example generator template for one language, or inline comments inside `src/services/codeGenerator.js` explaining each step. Tell me which you'd prefer next.

## Advanced Code Generation (Algorithms 8-11)

CodeSynch includes sophisticated code generation with four advanced algorithms for production-ready output:

### Algorithm 8: File Splitting
The generator automatically splits classes into separate files following language conventions.

- **Java**: Generates one `.java` file per class in the named package
- **Python**: Generates one `.py` file per class using snake_case filenames, plus `__init__.py` index
- **JavaScript**: Generates one `.js` file per class using camelCase filenames, plus `index.js` for exports

**Example:** A diagram with `Customer` and `Account` classes generates:
- Java: `Customer.java`, `Account.java`
- Python: `customer.py`, `account.py`, `__init__.py`
- JavaScript: `customer.js`, `account.js`, `index.js`

Switch between files using the file tabs in the "Generated Code" panel.

### Algorithm 9: Import Injection
Automatically detects dependencies and generates accurate import statements.

- Analyzes attribute types and injects corresponding class imports
- Scans method return types and parameter types to find dependencies
- Follows language-specific import syntax:
  - **Java**: `import ClassName;`
  - **Python**: `from .module_name import ClassName`
  - **JavaScript**: `import { ClassName } from './module_name';`
- Excludes standard library types (String, int, boolean, etc.) from imports

**Example:** A `Customer` class with an `Account` attribute automatically injects the Account import.

### Algorithm 10: Field Injection (Dependency Injection)
Generates constructor-based dependency injection for associated classes.

- Detects associations and dependency relationships from the diagram
- Generates constructor parameters for each dependency
- Auto-initializes fields in the constructor bodies
- Applies language-specific constructor patterns

**Example Generated Code (Java):**
```java
public class Order {
    private Customer customer;
    private Shipment shipment;
    
    public Order(Customer customer, Shipment shipment) {
        this.customer = customer;
        this.shipment = shipment;
    }
}
```

**Example Generated Code (Python):**
```python
class Order:
    def __init__(self, customer, shipment):
        self.customer = customer
        self.shipment = shipment
```

### Algorithm 11: CamelCase Fix (Naming Conventions)
Applies strict, language-specific naming conventions automatically.

- **Java**: PascalCase for classes (`CustomerOrder`), camelCase for methods and variables (`getCustomerName()`, `orderTotal`)
- **Python**: snake_case for classes, methods, and variables (`customer_order`, `get_customer_name()`, `order_total`)
- **JavaScript**: PascalCase for classes (`CustomerOrder`), camelCase for methods and variables (`getCustomerName()`, `orderTotal`)
- Converts abbreviations: `usr` → `user`, `pwd` → `password`, `addr` → `address`, etc.

**Conversion Examples:**
| Input | Java Output | Python Output | JavaScript Output |
|-------|-------------|---------------|--------------------|
| UserProfile | UserProfile | user_profile | UserProfile |
| getUSERName | getUserName | get_user_name | getUserName |
| customer_id | customerId | customer_id | customerId |
| btn_submit | btnSubmit | btn_submit | btnSubmit |

## Reverse Engineering (Code to Diagram)

CodeSynch now supports **bidirectional** code generation with sophisticated code-to-UML conversion.

### Algorithm A: AST Parser

Extracts structural elements (classes, methods, attributes) from source code using regex-based parsing.

**Supported Languages:**
- **Java**: Full support for classes, visibility modifiers, inheritance, interfaces, type generics
- **Python**: Full support with indentation-aware parsing, type inference from values
- **JavaScript**: ES6 class syntax with property detection
- **PlantUML**: Diagram definition syntax with auto-detection

**Features:**
- Detects visibility modifiers (`public`, `private`, `protected`, `+`, `-`, `#`)
- Extracts method signatures with return types and parameters
- Identifies inheritance (`extends`) and interfaces (`implements`)
- Supports abstract classes and static members
- Infers types from default values (Python-specific)

### Algorithm B: Relationship Detector

Analyzes code structure to identify UML relationships:

- **Inheritance**: Classes extending parent classes via `extends` keyword
- **Realization**: Class implementing interfaces via `implements` keyword
- **Composition/Aggregation**: Attribute types matching other classes in diagram
  - Collection types (List, Array, Set) → Aggregation (0..*)
  - Single object types → Composition (1)
- **Dependency**: Method parameters using other classes

**Multiplicity Detection:**
- Single references: `1:1`
- Collections: `0..*` or `1..*`
- Extracted from type declarations and parameter lists

### Algorithm C: Pattern Detector

Recognizes common design patterns with confidence scoring:

- **Singleton**: Static instance field + getInstance() method (95% confidence)
- **Factory**: Create/Build methods (80% confidence)
- **Observer/Observable**: update/notify methods (70% confidence)
- **Strategy**: Class implementing interface with multiple implementations (75% confidence)

**Output:** Pattern list with class names and confidence percentages displayed in conversion results.

### Usage

1. Click **"Code to Diagram"** button in toolbar
2. Select language: Java, Python, JavaScript, or PlantUML
3. Paste source code or PlantUML diagram definition
4. Click **"Convert to UML Diagram"**
5. Review detected classes, relationships, and patterns
6. Click **"Import to Diagram"** to add to canvas

**Automatic Features:**
- Offset positioning prevents element overlap
- Duplicate detection prevents reimporting
- Full undo/redo support
- Design patterns highlighted with metadata

## How Accurate Code Generation Works

The complete pipeline (forward and reverse):

**Forward Path (UML → Code):**
1. **Standardize** the UML model (normalize names, types)
2. **Detect Patterns** (Singleton, Factory, Observer)
3. **Apply Naming Optimizations** (expand abbreviations, fix conventions)
4. **Split into Files** → generate per-class files, not one monolithic output
5. **Inject Imports** → analyze dependencies, add proper language-specific imports
6. **Inject Fields** → detect relationships, create constructor parameters and field assignments
7. **Fix Naming** → apply language conventions to every identifier
8. **Generate Code** → output clean, idiomatic, production-ready code

**Reverse Path (Code → UML):**
1. **Parse Source Code** (Algorithm A: AST extraction)
2. **Detect Relationships** (Algorithm B: Connection inference)
3. **Recognize Patterns** (Algorithm C: Design pattern analysis)
4. **Convert to UML Model** → create elements and connections
5. **Merge with Diagram** → integrate into canvas with positioning

When you generate code, the output is displayed with file tabs if multiple files were created. Each file is fully self-contained with proper imports, constructors, and naming conventions. When you import code, all detected classes, relationships, and patterns are displayed with confidence scores.

## Testing

- Run unit tests with:

```bash
npm test
```

## Contributing and Development Notes

- Follow the React component patterns already used: small, focused components and hooks for shared behavior.
- Keep domain logic (diagram model transformations, code templates) inside `services/` and `utils/` — this keeps UI code simple and testable.

## Where to look first when extending code generation

### Forward Path (UML → Code)

- `src/services/codeGenerator.js` — main place for language templates and generation logic.
  - `generateCode()` — Main entry point for code generation
  - `splitIntoFiles()` — Algorithm 8: File Splitting
  - `injectImports()` — Algorithm 9: Import Injection
  - `injectFields()` — Algorithm 10: Field Injection
  - `fixNamingConventions()` — Algorithm 11: CamelCase Fix
  - `toCamelCase()`, `toPascalCase()`, `toSnakeCase()`, `toUpperSnakeCase()` — Naming helpers
  - `generateSingleClassFile()` — Generate individual class files
  - `generateObjectDiagramCode()` — Object diagram generation

- `src/services/typeMapper.js` — add mappings for new types or languages here.

- `src/utils/diagramUtils.js` — adjust model normalization or serialization here.

### Reverse Path (Code → UML)

- `src/services/codeToUMLConverter.js` — code-to-diagram conversion logic.
  - `convertCodeToUML()` — Main pipeline orchestrator (returns elements, connections, patterns)
  - `parseSourceCode()` — Auto-detects language and routes to correct parser
  - `parseJavaAST()` — Java code extraction
  - `parsePythonAST()` — Python code extraction
  - `parseJavaScriptAST()` — JavaScript code extraction
  - `parsePlantUMLAST()` — PlantUML diagram parsing
  - `detectRelationships()` — Algorithm B: Relationship detection
  - `detectPatterns()` — Algorithm C: Design pattern recognition
  - `convertToUMLModel()` — Transform AST to CodeSync element format

- `src/components/CodeImportModal.jsx` — modal UI for code input and conversion results.

- `src/components/UMLEditor.jsx` — integration point for reverse engineering.
  - `handleCodeToUML()` — Opens code import modal
  - `handleImportCode()` — Merges converted diagram with existing elements
