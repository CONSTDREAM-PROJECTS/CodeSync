/**
 * ============================================================
 * codeToUMLConverter.js — Code-to-UML Converter Service
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This file reads actual source code (Java, Python, JavaScript, or
 * PlantUML diagrams) and reverse-engineers it into a visual UML
 * diagram model. Think of it like a blueprint scanner — you feed it
 * finished code and it draws the architectural diagram for you.
 *
 * TECHNICAL OVERVIEW:
 * Implements a 3-algorithm pipeline:
 *   Algorithm A — AST Parser:            Extract classes, methods, attributes
 *   Algorithm B — Relationship Detector: Find inheritance, composition, dependencies
 *   Algorithm C — Pattern Detector:      Recognize design patterns (Singleton, Factory, etc.)
 *
 * The output is a CodeSync-compatible UML model (elements + connections)
 * that the diagram editor can render directly.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - This is the REVERSE of codeGenerator.js.
 *     codeGenerator.js:       UML model → source code
 *     codeToUMLConverter.js:  source code → UML model
 * - typeMapper.js provides inferTypeFromValue() which parallels this
 *   file's inferPythonType() — both translate values into UML type names.
 * - UMLEditor.jsx reads the { elements, connections } this file produces.
 *   Connections MUST use 'from'/'to' field names — the canvas ignores
 *   'sourceId'/'targetId'.
 * ============================================================
 */

class CodeToUMLConverter {

  /**
   * convertCodeToUML(sourceCode, language)
   * ----------------------------------------
   * LAYMAN'S: The main "start here" function. Hand it source code and a
   * language name; it runs the full pipeline and returns a complete
   * diagram model with classes, arrows, and detected patterns.
   *
   * TECHNICAL: Orchestrates all three algorithms in sequence:
   *   1. parseSourceCode()     → AST              (Algorithm A)
   *   2. detectRelationships() → relationships[]  (Algorithm B)
   *   3. detectPatterns()      → patterns[]       (Algorithm C)
   *   4. convertToUMLModel()   → { elements, connections }
   * Wrapped in try/catch — always returns a consistent response shape.
   *
   * RELATIONSHIP: Entry point called by the application layer.
   * Every other method in this file ultimately serves this one.
   *
   * @param {string} sourceCode - Raw source code to analyze
   * @param {string} language   - 'Java' | 'Python' | 'JavaScript' | 'plantuml'
   * @returns {object}          - { success, message, elements, connections, patterns, ast, metadata }
   */
  static convertCodeToUML(sourceCode, language = 'Java') {
    try {

      // ── Step 1: Parse code into an Abstract Syntax Tree (Algorithm A) ──
      const ast = this.parseSourceCode(sourceCode, language);

      /**
       * Early-exit guard
       * LAYMAN'S: If the parser found nothing, there's nothing to diagram —
       * return a friendly failure instead of crashing.
       * TECHNICAL: Guards against null AST or an AST with an empty classes array.
       */
      if (!ast || (!ast.classes || ast.classes.length === 0)) {
        return {
          success: false,
          message: `Could not parse ${language} code. Ensure syntax is valid.`,
          elements: [],
          connections: [],
          patterns: []
        };
      }

      /**
       * Assign unique IDs to every class
       * LAYMAN'S: Each class gets a unique "nametag" so relationship arrows
       * know exactly which box to connect to.
       * TECHNICAL: Combines Date.now() + array index. The spread operator
       * preserves all existing class properties while adding the id field.
       */
      ast.classes = ast.classes.map((cls, idx) => ({
        ...cls,
        id: `class_${Date.now()}_${idx}`
      }));

      // ── Step 2: Detect inter-class relationships (Algorithm B) ──
      const relationships = this.detectRelationships(ast.classes, sourceCode, language);

      // ── Step 3: Detect design patterns (Algorithm C) ──
      const patterns = this.detectPatterns(ast.classes, sourceCode);

      // ── Step 4: Convert internal AST → CodeSync diagram model ──
      const { elements, connections } = this.convertToUMLModel(ast.classes, relationships);

      /**
       * metadata
       * LAYMAN'S: A summary card — counts of classes, methods, attributes,
       * relationships, and detected patterns for display in the UI.
       * TECHNICAL: reduce() with optional chaining safely sums nested
       * array lengths even when arrays are undefined.
       */
      return {
        success: true,
        message: `Successfully converted ${ast.classes.length} classes to UML`,
        // BUG FIX: replaceAll tells UMLEditor to REPLACE the current canvas
        // elements/connections rather than merging with them. Without this,
        // stale elements from a previous diagram (e.g. the default placeholder
        // "Name" actor) remain on the canvas alongside the newly converted ones,
        // causing phantom validation warnings like "Actor 'Name' is not connected
        // to any use case."
        replaceAll: true,
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
      // Always return a structured failure — never let an exception escape unhandled
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
  // ALGORITHM A: AST PARSER
  // LAYMAN'S: The "reader" section — scans raw text and extracts every
  // class, its fields, and its methods.
  // TECHNICAL: Each language gets its own parser; all return the same
  // AST shape { classes, imports } so the rest of the pipeline is
  // language-agnostic after this point.
  // ============================================================

  /**
   * parseSourceCode(sourceCode, language)
   * ----------------------------------------
   * LAYMAN'S: The router — figures out what language you gave it
   * and hands off to the right specialist parser.
   *
   * TECHNICAL: First checks for PlantUML markers (classDiagram keyword,
   * or class + { combination). If not PlantUML, dispatches by language string.
   * Defaults to Java parser for unknown languages.
   *
   * RELATIONSHIP: Called by convertCodeToUML() in Step 1.
   * Delegates to parseJavaAST / parsePythonAST / parseJavaScriptAST / parsePlantUMLAST.
   */
  static parseSourceCode(sourceCode, language) {
    // Fix #16: PlantUML auto-detect — only fire on definitive PlantUML markers,
    // NOT on bare 'class {' which matches Java/JS/Python classes.
    const isDefinitivelyPlantUML = (
      sourceCode.includes('@startuml') ||
      sourceCode.includes('classDiagram') ||
      sourceCode.includes('sequenceDiagram') ||
      /^\s*actor\s+\w/m.test(sourceCode) ||
      /^\s*participant\s+/m.test(sourceCode) ||
      /^\s*usecase\s+/im.test(sourceCode) ||
      /(?:^|\n)\s*\w+\s*->+\s*\w+\s*:/m.test(sourceCode) ||
      /^\\s*class\\s+\\w+\\s*\\{[^}]*<</.test(sourceCode)
    );
    if (isDefinitivelyPlantUML) {
      return this.parsePlantUMLAST(sourceCode);
    }

    // ── Annotation-based use case detection ──────────────────────────────
    // Must run BEFORE the language switch so Java/Python/JS files that use
    // @Actor / @UseCase annotations are routed to the use case parser
    // regardless of which language is selected in the dropdown.
    const isAnnotatedUseCase = (
      /@Actor\s*\(/.test(sourceCode)   ||
      /@UseCase\s*\(/.test(sourceCode) ||
      /\/\/\s*@Actor\s*\(/.test(sourceCode)   ||
      /\/\/\s*@UseCase\s*\(/.test(sourceCode) ||
      /#\s*@Actor\s*\(/.test(sourceCode)      ||
      /#\s*@UseCase\s*\(/.test(sourceCode)
    );
    if (isAnnotatedUseCase) {
      return CodeToUMLConverter.parseAnnotatedUseCaseAST(sourceCode);
    }

    switch(language.toLowerCase()) {
      case 'java':       return this.parseJavaAST(sourceCode);
      case 'python':     return this.parsePythonAST(sourceCode);
      case 'javascript':
      case 'js':         return this.parseJavaScriptAST(sourceCode);
      case 'plantuml':   return this.parsePlantUMLAST(sourceCode);
      default:           return this.parseJavaAST(sourceCode); // Java as universal fallback
    }
  }

  /**
   * parseJavaAST(sourceCode)
   * --------------------------
   * LAYMAN'S: Reads Java code and picks out every class definition,
   * what it extends/implements, its fields, and its methods.
   *
   * TECHNICAL: Two-pass regex approach:
   *   Pass 1 — importRegex: collects import statements.
   *   Pass 2 — classRegex: captures modifiers, name, extends/implements, and body.
   * Delegates body parsing to extractJavaAttributes() and extractJavaMethods().
   *
   * RELATIONSHIP: Called by parseSourceCode() for Java input.
   */
  static parseJavaAST(sourceCode) {
    /**
     * ast — the accumulator bucket; everything found gets added here.
     */
    const ast = { classes: [], interfaces: [], imports: [] };

    // Collect import statements for context
    const importRegex = /import\s+(.*?);/g;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      ast.imports.push(match[1]);
    }

    /**
     * classRegex
     * LAYMAN'S: Finds every "class X extends Y implements Z { ... }" block.
     * TECHNICAL: Capture groups:
     *   \1 = class name   \2 = extends target   \3 = implements list   \4 = class body
     */
    const classRegex = /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*\{([\s\S]*?)(?=\n\}(?:\s|$)|\Z)/g;

    while ((match = classRegex.exec(sourceCode)) !== null) {
      const [, className, extendsClass, implementsClasses, classBody] = match;

      /**
       * classNode — one descriptor card per class.
       * isAbstract / isFinal re-checked on the full match string because
       * those keywords appear before 'class' and may not be in captured groups.
       */
      const classNode = {
        name: className,
        extends: extendsClass || null,
        implements: implementsClasses ? implementsClasses.split(',').map(s => s.trim()) : [],
        attributes: this.extractJavaAttributes(classBody),
        methods: this.extractJavaMethods(classBody),
        isAbstract: /\babstract\s+class\b/.test(match[0]),
        isFinal:    /\bfinal\s+class\b/.test(match[0])
      };

      ast.classes.push(classNode);
    }

    return ast;
  }

  /**
   * extractJavaAttributes(classBody)
   * -----------------------------------
   * LAYMAN'S: Finds all field declarations inside a Java class
   * (like "private int age;" or "public List<Book> books;").
   *
   * TECHNICAL: Regex captures: visibility, static, final, type (incl. generics), name.
   * Stores TWO type values per attribute — rawType and type — because the
   * relationship detector needs the unstripped string to find class names inside
   * generics (e.g. "Book" inside "List<Book>"), while the diagram display only
   * needs the clean stripped version (e.g. "List").
   * Deduplicates by name using a Set.
   *
   * BUG FIX — rawType: Previously only the stripped type was stored. A field like
   * "List<Book> books" was recorded as type "List", so the relationship detector
   * searched for a class literally named "List" and found nothing — no aggregation
   * arrow was ever drawn. Now rawType preserves the full string so "<Book>" is
   * still present for matching in detectRelationships() Rule 3.
   *
   * RELATIONSHIP: Called by parseJavaAST().
   * Results used by detectRelationships() to find composition/aggregation.
   */
  static extractJavaAttributes(classBody) {
    const attributes = [];
    /**
     * attrRegex — matches "private static final List<Book> books = ..."
     * Optional groups: visibility, static, final; required: type (with optional
     * generic params like <Book>), name. Semicolon required to avoid matching
     * method parameters that look identical without it.
     */
    const attrRegex = /(public|private|protected)?\s+(static\s+)?(final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;

    let match;
    const seen = new Set(); // Prevents duplicate field entries

    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, visibility = 'private', isStatic, isFinal, type, name] = match;
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          rawType: type,                      // FIX: full string e.g. "List<Book>" — used by relationship detector
          type: type.replace(/<[^>]+>/, ''), // Stripped e.g. "List" — used for diagram display label only
          visibility: visibility || 'private',
          isStatic: !!isStatic,
          isFinal: !!isFinal
        });
      }
    }

    return attributes;
  }

  /**
   * extractJavaMethods(classBody)
   * --------------------------------
   * LAYMAN'S: Finds all method definitions inside a Java class
   * (like "public void save()" or "private int calculate(int x)").
   *
   * TECHNICAL: Captures visibility, static, abstract, return type, name,
   * and parameter list. Handles both concrete ({) and abstract (;) endings.
   * Does NOT parse method bodies — signatures only. Deduplicates by name.
   *
   * RELATIONSHIP: Called by parseJavaAST().
   * Results used by detectRelationships() (dependency detection) and detectPatterns().
   */
  static extractJavaMethods(classBody) {
    const methods = [];
    /**
     * methodRegex — matches "public static abstract ReturnType methodName(params) throws X {"
     * The (?:\{|;) at the end matches both concrete and abstract method endings.
     */
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

  /**
   * parsePythonAST(sourceCode)
   * ----------------------------
   * LAYMAN'S: Reads Python code and finds every class, its parent,
   * its fields (self.x = ...), and its methods (def ...).
   *
   * TECHNICAL: Uses a split-based approach instead of a single body regex.
   * First all class declaration positions are found, then each class's body
   * is sliced from its start position to the next class's start position.
   * This correctly captures blank lines between methods that the old regex missed.
   *
   * BUG FIX — blank lines break body capture: The old regex
   * ((?:(?:    |\t).*\n?)*) stopped at the first blank line inside a class,
   * because blank lines have no leading spaces to satisfy the indent match.
   * This caused two problems:
   *   1. Cat's body appeared empty when it followed a blank line after Dog,
   *      so its parent class (Animal) was not detected → no inheritance arrow.
   *   2. Library's methods (addBook, registerMember) came after a blank line
   *      and were never captured → no dependency arrow to Member was drawn.
   * Fixed by slicing source on class boundary positions instead.
   *
   * RELATIONSHIP: Called by parseSourceCode() for Python input.
   */
  static parsePythonAST(sourceCode) {
    const ast = { classes: [], imports: [] };

    // Handle both "import X" and "from X import Y" styles
    const importRegex = /^(?:from\s+[\w.]+\s+)?import\s+([\w,\s*]+)/gm;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      ast.imports.push(match[1]);
    }

    /**
     * Step 1 — find all class declaration positions.
     * LAYMAN'S: Mark where every class starts so we can slice each class's
     * content from one marker to the next, blank lines included.
     * TECHNICAL: Records character index of each 'class Name(Parent):' line.
     */
    const classStartRegex = /^class\s+(\w+)(?:\(([^)]*)\))?\s*:/gm;
    const classStarts = [];
    while ((match = classStartRegex.exec(sourceCode)) !== null) {
      classStarts.push({
        name:      match[1],
        parent:    match[2] ? match[2].split(',')[0].trim() : null,
        pos:       match.index,
        fullMatch: match[0]
      });
    }

    /**
     * Step 2 — slice each class body from its start to the next class start.
     * LAYMAN'S: Class A's content is everything from 'class A:' up to but
     * not including 'class B:' — blank lines in between are included.
     * TECHNICAL: Last class runs to end of file (sourceCode.length).
     */
    classStarts.forEach((cls, i) => {
      const endPos    = i + 1 < classStarts.length ? classStarts[i + 1].pos : sourceCode.length;
      const classBody = sourceCode.slice(cls.pos, endPos);

      ast.classes.push({
        name:       cls.name,
        extends:    (cls.parent && cls.parent !== 'object') ? cls.parent : null,
        implements: [],
        attributes: this.extractPythonAttributes(classBody),
        methods:    this.extractPythonMethods(classBody),
        isAbstract: sourceCode.includes('from abc import') && /class\s+\w+\(ABC\)/.test(cls.fullMatch)
      });
    });

    return ast;
  }

  /**
   * extractPythonAttributes(classBody)
   * -------------------------------------
   * LAYMAN'S: Finds all instance variables defined with "self.name = ..."
   * (the standard Python way to declare an object's fields).
   *
   * TECHNICAL: Targets self.name = value assignments. The value string
   * is passed to inferPythonType() since Python has no explicit type declarations.
   * All attributes default to 'private' visibility by Python convention.
   *
   * RELATIONSHIP: Called by parsePythonAST().
   */
  static extractPythonAttributes(classBody) {
    const attributes = [];
    const attrRegex = /self\.(\w+)\s*=\s*(.+?)(?:\n|$)/g;

    let match;
    const seen = new Set();

    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, name, value] = match;
      if (!seen.has(name)) {
        seen.add(name);
        const inferredType = this.inferPythonType(value.trim());
        attributes.push({
          name,
          rawType:    inferredType, // FIX: set rawType so relationship detector can match class names
          type:       inferredType, // Same value used for diagram display label
          nameHint:   name,         // FIX: variable name stored for plural matching (books → Book)
          visibility: 'private',
          isStatic:   false
        });
      }
    }

    return attributes;
  }

  /**
   * extractPythonMethods(classBody)
   * ---------------------------------
   * LAYMAN'S: Finds all function definitions inside a Python class,
   * skipping __init__ since that's the constructor (handled separately in UML).
   *
   * TECHNICAL: Captures name, params, optional return-type annotation.
   * Filters 'self' from the param list. Infers visibility from the
   * underscore-prefix naming convention. Treats __new__ as static.
   *
   * RELATIONSHIP: Called by parsePythonAST().
   */
  static extractPythonMethods(classBody) {
    const methods = [];
    const methodRegex = /^\s{0,}def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+))?\s*:/gm;

    let match;
    const seen = new Set();

    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, methodName, params, returnType] = match;

      if (methodName !== '__init__' && !seen.has(methodName)) {
        seen.add(methodName);

        /**
         * paramList — removes 'self' from param string since it's a Python
         * implementation detail, not part of the logical method signature.
         */
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
          isStatic: methodName === '__new__' // __new__ is Python's class-level factory
        });
      }
    }

    return methods;
  }

  /**
   * inferPythonType(value)
   * ------------------------
   * LAYMAN'S: Looks at a raw Python value string ("0", "[]", "'hello'") and
   * guesses what type it is, since Python doesn't require type labels.
   *
   * TECHNICAL: Regex-based classification of raw assignment value strings.
   * Returns Python native type names. Operates on source-code strings —
   * contrast with typeMapper.inferTypeFromValue() which operates on JS runtime values.
   *
   * BUG FIX — class instantiation not detected: Previously "Address()" was
   * classified as 'object', so detectRelationships() searched for a class
   * literally named 'object' and found nothing — no composition arrow was
   * drawn for "self.address = Address()". Fixed by detecting ClassName()
   * patterns first and returning the class name directly as the type.
   *
   * RELATIONSHIP: Called by extractPythonAttributes() for each attribute value.
   */
  static inferPythonType(value) {
    // FIX: detect class instantiation like "Address()" → return "Address"
    // so the relationship detector can match it against known class names.
    // Built-in Python types are excluded so "list()" stays typed as 'list'.
    const BUILTIN_TYPES = new Set(['int','str','float','bool','list','dict','set','tuple','bytes','object','type']);
    const constructorMatch = value.match(/^(\w+)\s*\(/);
    if (constructorMatch && !BUILTIN_TYPES.has(constructorMatch[1])) {
      return constructorMatch[1]; // e.g. "Address()" → "Address"
    }

    if (/\[\]|\{\}/.test(value))     return 'list';   // [] or {}
    if (/^\d+$/.test(value))          return 'int';    // whole number
    if (/^\d+\.\d+$/.test(value))     return 'float';  // decimal number
    if (/^['"]/.test(value))          return 'str';    // starts with a quote
    if (/^(True|False)$/.test(value)) return 'bool';   // Python boolean literal
    return 'object';                                    // unknown/complex
  }

  /**
   * parseJavaScriptAST(sourceCode)
   * --------------------------------
   * LAYMAN'S: Reads JavaScript ES6 class definitions and extracts
   * their fields (this.name = ...) and methods.
   *
   * TECHNICAL: Handles ES6 class syntax only (not prototype-based).
   * All types default to 'any' — no TypeScript support here.
   * Private field detection uses the '#' prefix (ES2022 syntax).
   *
   * RELATIONSHIP: Called by parseSourceCode() for 'javascript'/'js' input.
   */
  static parseJavaScriptAST(sourceCode) {
    const ast = { classes: [], imports: [] };

    // Handle both "import { Foo } from '...'" and "import Foo from '...'"
    const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      ast.imports.push(match[3]); // Record the module path
    }

    /**
     * classRegex (JS) — matches "class Foo extends Bar { ... }"
     */
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([\s\S]*?)\n\}/g;

    while ((match = classRegex.exec(sourceCode)) !== null) {
      const [, className, extendsClass, classBody] = match;

      ast.classes.push({
        name: className,
        extends: extendsClass || null,
        implements: [],
        attributes: this.extractJSAttributes(classBody),
        methods: this.extractJSMethods(classBody),
        isAbstract: false // JS has no abstract keyword
      });
    }

    return ast;
  }

  /**
   * extractJSAttributes(classBody)
   * ---------------------------------
   * LAYMAN'S: Finds "this.name = ..." assignments inside a JS class.
   * TECHNICAL: The (?:this\.)? makes 'this.' optional to catch class-field syntax too.
   * Type is always 'any'; '#' prefix = ES2022 private field.
   *
   * RELATIONSHIP: Called by parseJavaScriptAST().
   */
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

  /**
   * extractJSMethods(classBody)
   * ----------------------------
   * LAYMAN'S: Finds all function definitions in a JS class, skipping constructor.
   * TECHNICAL: Handles optional async keyword. Infers private from '_' prefix.
   * Static detection is best-effort via regex on the match string.
   *
   * RELATIONSHIP: Called by parseJavaScriptAST().
   */
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
  // PlantUML PARSER
  // LAYMAN'S: PlantUML is a text format for describing diagrams.
  // This section reads those descriptions and extracts the same
  // class structure as the code parsers above.
  // ============================================================

  /**
   * parsePlantUMLAST(sourceCode)
   * LAYMAN'S: Reads PlantUML class diagram text and extracts class definitions.
   * TECHNICAL: Two-pass — first extracts class bodies, then resolves
   * relationship arrows (which update extends/implements on class nodes).
   *
   * RELATIONSHIP: Called by parseSourceCode() for PlantUML input.
   */

  // ============================================================
  // parseAnnotatedUseCaseAST
  // ============================================================
  // Parses Java, Python, or JavaScript files that use special
  // annotations to describe a use case diagram.
  //
  // JAVA / JAVASCRIPT syntax:
  //   @Actor("Site User")
  //   @UseCase("Search docs")
  //   @Association("Site User", "Search docs")
  //   @Includes("Search docs", "Download docs")
  //   @Extends("Upload docs", "Manage folders")
  //
  // PYTHON syntax (same but prefixed with #):
  //   # @Actor("Site User")
  //   # @UseCase("Search docs")
  //   # @Association("Site User", "Search docs")
  //   # @Includes("Search docs", "Download docs")
  //   # @Extends("Upload docs", "Manage folders")
  // ============================================================
  static parseAnnotatedUseCaseAST(sourceCode) {
    const ast = { classes: [], imports: [] };
    const seen = new Set();

    // Helper: strip quotes and trim
    const clean = (s) => (s || '').replace(/['"]/g, '').trim();
    // Helper: make a key from a label (no spaces)
    const toKey = (s) => clean(s).replace(/\s+/g, '');

    // Helper: find element by key or label
    const findEl = (raw) => {
      const key = toKey(raw);
      return ast.classes.find(c => c.name === key) ||
             ast.classes.find(c => c.label === clean(raw));
    };

    // ── Parse @Actor("Name") or // @Actor("Name") or # @Actor("Name") ──
    const actorRe = /(?:\/\/\s*|#\s*)?@Actor\(\s*["']?([^"'\n)]+)["']?\s*\)/g;
    let m;
    while ((m = actorRe.exec(sourceCode)) !== null) {
      const label = clean(m[1]);
      const key   = toKey(label);
      if (!seen.has(key)) {
        seen.add(key);
        ast.classes.push({
          name: key, label,
          elementType: 'actor',
          extends: null, implements: [],
          attributes: [], methods: [],
          isAbstract: false, _rels: []
        });
      }
    }

    // ── Parse @UseCase("Name") ──────────────────────────────────────────
    const ucRe = /(?:\/\/\s*|#\s*)?@UseCase\(\s*["']?([^"'\n)]+)["']?\s*\)/g;
    while ((m = ucRe.exec(sourceCode)) !== null) {
      const label = clean(m[1]);
      const key   = toKey(label);
      if (!seen.has(key)) {
        seen.add(key);
        ast.classes.push({
          name: key, label,
          elementType: 'usecase',
          extends: null, implements: [],
          attributes: [], methods: [],
          isAbstract: false, _rels: []
        });
      }
    }

    // ── Parse @Association("From", "To") — solid line ──────────────────
    const assocRe = /(?:\/\/\s*|#\s*)?@Association\(\s*["']?([^"'\n,)]+)["']?\s*,\s*["']?([^"'\n)]+)["']?\s*\)/g;
    while ((m = assocRe.exec(sourceCode)) !== null) {
      const fromEl = findEl(m[1]);
      const toEl   = findEl(m[2]);
      if (fromEl && toEl) {
        fromEl._rels.push({ targetName: toEl.name, connType: 'association', label: '' });
      }
    }

    // ── Parse @Includes("From", "To") — dashed <<include>> arrow ───────
    const includeRe = /(?:\/\/\s*|#\s*)?@Includes\(\s*["']?([^"'\n,)]+)["']?\s*,\s*["']?([^"'\n)]+)["']?\s*\)/g;
    while ((m = includeRe.exec(sourceCode)) !== null) {
      const fromEl = findEl(m[1]);
      const toEl   = findEl(m[2]);
      if (fromEl && toEl) {
        fromEl._rels.push({ targetName: toEl.name, connType: 'include', label: '<<include>>' });
      }
    }

    // ── Parse @Extends("From", "To") — dashed <<extend>> arrow ─────────
    const extendRe = /(?:\/\/\s*|#\s*)?@Extends\(\s*["']?([^"'\n,)]+)["']?\s*,\s*["']?([^"'\n)]+)["']?\s*\)/g;
    while ((m = extendRe.exec(sourceCode)) !== null) {
      const fromEl = findEl(m[1]);
      const toEl   = findEl(m[2]);
      if (fromEl && toEl) {
        fromEl._rels.push({ targetName: toEl.name, connType: 'extend', label: '<<extend>>' });
      }
    }

    return ast;
  }

  static parsePlantUMLAST(sourceCode) {
    const ast = { classes: [], imports: [] };

    const cleanCode = sourceCode.replace(/@startuml[\s\S]*?\n/i, '')
                                .replace(/@enduml.*/i, '')
                                .replace(/classDiagram\s*/i, '')
                                .trim();

    // ── Detect diagram type from keywords ────────────────────
    const isSequence = /^\s*(participant|actor|->|-->|->>)/m.test(cleanCode);
    const isUseCase  = /^\s*(actor\s+\w|usecase\s+|\([\w\s]+\))/m.test(cleanCode) &&
                       !isSequence;

    if (isSequence) {
      return this.parsePlantUMLSequenceAST(cleanCode);
    }

    if (isUseCase) {
      return this.parsePlantUMLUseCaseAST(cleanCode);
    }

    // ── Default: class diagram parser ─────────────────────────
    const classRegex = /class\s+(\w+)\s*(\{[^}]*\})?/g;
    let match;

    while ((match = classRegex.exec(cleanCode)) !== null) {
      const [, className, classBody] = match;
      ast.classes.push({
        name: className,
        elementType: 'class',
        extends: null,
        implements: [],
        attributes: this.extractPlantUMLAttributes(classBody || ''),
        methods: this.extractPlantUMLMethods(classBody || ''),
        isAbstract: false
      });
    }

    this.extractPlantUMLRelationships(cleanCode, ast.classes);
    return ast;
  }

  /**
   * parsePlantUMLUseCaseAST(sourceCode)
   * Parses PlantUML use case diagram syntax:
   *   actor Customer
   *   usecase (Login)
   *   Customer --> (Login)
   */
  static parsePlantUMLUseCaseAST(sourceCode) {
    const ast = { classes: [], imports: [] };
    const seen     = new Set(); // element name keys already added
    const aliasMap = {};        // alias → name key  e.g. "Search" → "Searchdocsfulltext"
    const labelMap = {};        // alias → display label e.g. "Search" → "Search docs full text"

    // ── Helper: normalise a raw token to a lookup key ─────────────────────
    // Strips parens, trims, collapses spaces so "Search docs full text" → "Searchdocsfulltext"
    const toKey = (raw) => raw.replace(/[()]/g, '').trim().replace(/\s+/g, '');

    // ── 1. Parse actors ───────────────────────────────────────────────────
    // Handles:  actor "Site User" as SiteUser
    //           actor Webmaster
    const actorRegex = /^actor\s+"?([^"\n]+?)"?\s*(?:as\s+(\w+))?\s*$/gm;
    let match;

    while ((match = actorRegex.exec(sourceCode)) !== null) {
      const label = match[1].trim();
      const alias = match[2] || null;
      const key   = alias || toKey(label);

      if (alias) {
        aliasMap[alias] = key;
        labelMap[alias] = label;
      }
      aliasMap[toKey(label)] = key; // also map by label key

      if (!seen.has(key)) {
        seen.add(key);
        ast.classes.push({
          name: key, label,
          elementType: 'actor',
          extends: null, implements: [],
          attributes: [], methods: [],
          isAbstract: false, _rels: []
        });
      }
    }

    // ── 2. Parse use case declarations ────────────────────────────────────
    // Handles:  (Search docs full text) as (Search)
    //           (Log in)
    //           usecase (Browse docs)
    // IMPORTANT: only match lines that declare a use case — NOT alias-only references
    // We detect declarations by requiring the full-text label to appear
    // i.e. the match must appear on lines that use "as" OR have a multi-word label
    const ucDeclRegex = /^\s*(?:usecase\s+)?\(([^)]+)\)\s*(?:as\s+\((\w+)\))?\s*$/gm;

    while ((match = ucDeclRegex.exec(sourceCode)) !== null) {
      const label = match[1].trim();
      const alias = match[2] || null;
      const key   = alias || toKey(label);

      if (alias) {
        aliasMap[alias] = key;
        labelMap[alias] = label;
      }
      aliasMap[toKey(label)] = key;

      if (!seen.has(key)) {
        seen.add(key);
        ast.classes.push({
          name: key, label,
          elementType: 'usecase',
          extends: null, implements: [],
          attributes: [], methods: [],
          isAbstract: false, _rels: []
        });
      }
    }

    // ── 3. Helper: resolve any token to an element ────────────────────────
    // Handles plain names (SiteUser), aliases (Search),
    // parenthesised aliases ((Search)), full labels ("Search docs full text")
    const findEl = (raw) => {
      const cleaned = raw.replace(/[()]/g, '').trim();
      const key     = toKey(cleaned);

      // Direct key match
      let el = ast.classes.find(c => c.name === key);
      if (el) return el;

      // Alias map lookup
      const mappedKey = aliasMap[cleaned] || aliasMap[key];
      if (mappedKey) return ast.classes.find(c => c.name === mappedKey);

      // Label match (fallback)
      return ast.classes.find(c => c.label === cleaned);
    };

    // ── 4. Parse relationships ────────────────────────────────────────────
    // Handles:
    //   SiteUser --> (Search)
    //   (Search) --> (Download)
    //   (Upload) .> (ManageFolders)
    //   (AddUser) ..> (AddCompany)
    //   (UC1) --> (UC2) : <<include>>
    const relRegex = /^\s*(\w[\w\s]*|\([^)]+\))\s*(-->|--|\.\.>|\.>|\.\.)\s*(\w[\w\s]*|\([^)]+\))(?:\s*:\s*(.+))?\s*$/gm;

    while ((match = relRegex.exec(sourceCode)) !== null) {
      const [, rawFrom, arrow, rawTo, label] = match;
      const fromEl = findEl(rawFrom.trim());
      const toEl   = findEl(rawTo.trim());

      if (!fromEl || !toEl) continue;

      const labelText = (label || '').trim().toLowerCase();
      let connType  = 'association';
      let connLabel = '';

      if (arrow === '.>' || arrow === '..>' || labelText.includes('include')) {
        connType  = 'include';
        connLabel = '<<include>>';
      } else if (arrow === '..' || labelText.includes('extend')) {
        connType  = 'extend';
        connLabel = '<<extend>>';
      } else if (fromEl.elementType === 'usecase' && toEl.elementType === 'usecase') {
        // usecase → usecase with plain --> is <<include>> by convention
        connType  = 'include';
        connLabel = '<<include>>';
      }
      // actor → usecase with --> stays as 'association' (solid line)

      if (!fromEl._rels) fromEl._rels = [];
      fromEl._rels.push({ targetName: toEl.name, connType, label: connLabel });
    }

    return ast;
  }

  /**
   * parsePlantUMLSequenceAST(sourceCode)
   * Parses PlantUML sequence diagram syntax:
   *   participant "System" as S
   *   actor Customer
   *   Customer -> S : Login
   */
  static parsePlantUMLSequenceAST(sourceCode) {
    const ast = { classes: [], imports: [], messages: [] };

    // Parse explicit participant/actor declarations
    // Handles: actor User, participant Browser, participant "Auth Server" as Auth
    const declRegex = /^(participant|actor)\s+"?([^"\n]+?)"?\s*(?:as\s+(\w+))?$/gm;
    let match;
    const seen     = new Set();
    const aliasMap = {};

    while ((match = declRegex.exec(sourceCode)) !== null) {
      const kind  = match[1].toLowerCase();
      const label = match[2].trim();
      const alias = match[3] || null;
      const name  = alias || label.replace(/\s+/g, '');

      if (alias) aliasMap[alias] = name;

      if (!seen.has(name)) {
        seen.add(name);
        ast.classes.push({
          name,
          label,
          elementType: kind === 'actor' ? 'actor' : 'lifeline',
          extends: null,
          implements: [],
          attributes: [],
          methods: [],
          isAbstract: false,
          _rels: []
        });
      }
    }

    // Parse message lines — also picks up undeclared participants
    const msgRegex = /^(\w+)\s*(->>?|-->>?|->x)\s*(\w+)\s*(?::\s*(.+))?$/gm;

    while ((match = msgRegex.exec(sourceCode)) !== null) {
      const [, fromRaw, arrow, toRaw, label] = match;
      const from     = aliasMap[fromRaw] || fromRaw;
      const to       = aliasMap[toRaw]   || toRaw;
      const msgLabel = (label || '').trim();

      // Register implicit participants
      for (const [name, raw] of [[from, fromRaw], [to, toRaw]]) {
        if (!seen.has(name)) {
          seen.add(name);
          ast.classes.push({
            name, label: raw,
            elementType: 'lifeline',
            extends: null, implements: [],
            attributes: [], methods: [],
            isAbstract: false, _rels: []
          });
        }
      }

      // Store message as a _rel on the source participant
      const fromEl = ast.classes.find(c => c.name === from);
      if (fromEl) {
        if (!fromEl._rels) fromEl._rels = [];
        const connType = arrow.startsWith('--') ? 'return' : 'message';
        fromEl._rels.push({ targetName: to, arrow, connType, label: msgLabel });
      }

      ast.messages.push({ from, to, arrow, label: msgLabel });
    }

    return ast;
  }

  /**
   * extractPlantUMLAttributes(classBody)
   * LAYMAN'S: Reads PlantUML field lines like "+String name" or "-int age".
   * TECHNICAL: + = public, - = private, # = protected.
   *
   * RELATIONSHIP: Called by parsePlantUMLAST().
   */
  static extractPlantUMLAttributes(classBody) {
    const attributes = [];
    if (!classBody) return attributes;

    const attrRegex = /([+\-#])(\w+)\s+(\w+)/g;
    let match;
    const seen = new Set();

    while ((match = attrRegex.exec(classBody)) !== null) {
      const [, visibility, type, name] = match;
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name, type,
          visibility: visibility === '+' ? 'public' : visibility === '-' ? 'private' : 'protected',
          isStatic: false
        });
      }
    }

    return attributes;
  }

  /**
   * extractPlantUMLMethods(classBody)
   * LAYMAN'S: Reads PlantUML method lines like "+checkout()" or "#getName(): String".
   * TECHNICAL: Distinguished from attributes by parentheses. Return type is optional.
   *
   * RELATIONSHIP: Called by parsePlantUMLAST().
   */
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

  /**
   * extractPlantUMLRelationships(sourceCode, classes)
   * LAYMAN'S: Reads arrow lines like "Library --* Book" and uses them to
   * set which classes extend or implement each other.
   * TECHNICAL: '|' in arrow = inheritance/realization. Mutates classes in-place.
   *
   * RELATIONSHIP: Called by parsePlantUMLAST() as a second pass.
   */
  static extractPlantUMLRelationships(sourceCode, classes) {
    const relationshipRegex = /(\w+)\s+([<|]*-+[>|*]?)\s+(\w+)\s*:\s*(\w+)?/g;
    let match;

    while ((match = relationshipRegex.exec(sourceCode)) !== null) {
      const [, source, arrow, target] = match;
      if (arrow.includes('|')) {
        const sourceClass = classes.find(c => c.name === source);
        if (sourceClass) {
          if (arrow.includes('<')) sourceClass.extends = target;
          else sourceClass.implements = [target];
        }
      }
    }
  }

  // ============================================================
  // ALGORITHM B: RELATIONSHIP DETECTOR
  // LAYMAN'S: After finding all classes, this section figures out
  // HOW they relate — who inherits whom, who contains whom, who depends on whom.
  // TECHNICAL: Produces flat relationship descriptors (sourceId → targetId + type)
  // that convertToUMLModel() later turns into diagram arrows.
  // Four rules applied per class:
  //   Rule 1 — Inheritance:             extends keyword
  //   Rule 2 — Realization:             implements keyword
  //   Rule 3 — Composition/Aggregation: field type matches another class
  //   Rule 4 — Dependency:              method parameter type matches another class
  // ============================================================

  /**
   * detectRelationships(classes, sourceCode, language)
   * LAYMAN'S: Walks every class and checks four relationship types:
   *   1. Inheritance  — "extends" another class
   *   2. Realization  — "implements" an interface
   *   3. Composition/Aggregation — has a field of another class type
   *   4. Dependency   — a method parameter is another class type
   *
   * TECHNICAL: Returns array of { sourceId, targetId, type, label, multiplicity? }.
   * Only creates edges between classes that were parsed (no dangling references).
   *
   * BUG FIX — rawType (Rule 3): Previously searched attr.type which was already
   * stripped of generics. A field "List<Book> books" was stored as type "List",
   * so the matcher looked for a class named "List" and found nothing — no arrow
   * was drawn. Now uses attr.rawType ("List<Book>") so "Book" is found inside the
   * angle brackets and the aggregation arrow is correctly generated.
   *
   * BUG FIX — self-loop guard (Rule 3): A class whose field references itself
   * (e.g. a linked-list Node with "Node next") no longer produces an arrow
   * pointing back to its own box.
   *
   * RELATIONSHIP: Called by convertCodeToUML() as Step 2.
   */
  static detectRelationships(classes, sourceCode, language) {
    const relationships = [];

    classes.forEach((sourceClass) => {

      // ── PlantUML use case / sequence _rels (pre-parsed by PlantUML parsers) ──
      // Only process _rels if this is a PlantUML element (has elementType set)
      if (sourceClass.elementType && sourceClass.elementType !== 'class' && sourceClass.elementType !== 'abstract') {
        // Process any stored _rels (messages, associations)
        if (sourceClass._rels?.length > 0) {
        sourceClass._rels.forEach(rel => {
          const targetClass = classes.find(c => c.name === rel.targetName);
          if (targetClass) {
            // Use connType if set (sequence messages), otherwise infer from arrow
            let relType = rel.connType || (
              rel.arrow === '-->'  ? 'association'
            : rel.arrow === '.>'  ? 'include'
            : rel.arrow === '..'  ? 'extend'
            : rel.arrow === '--'  ? 'association'
            : rel.arrow === '..>' ? 'include'
            : 'association'
            );
            relationships.push({
              sourceId:  sourceClass.id,
              targetId:  targetClass.id,
              type:      relType,
              label:     rel.label || '',
              // Sequence messages carry the message text as their label
              msgLabel:  rel.label || ''
            });
          }
        });
        }
        return; // Skip code-based rules for PlantUML elements
      }

      // 1. INHERITANCE
      if (sourceClass.extends) {
        const targetClass = classes.find(c => c.name === sourceClass.extends);
        if (targetClass) relationships.push({
          sourceId: sourceClass.id, targetId: targetClass.id,
          type: 'inheritance', label: 'extends'
        });
      }

      // 2. REALIZATION (implements)
      if (sourceClass.implements?.length > 0) {
        sourceClass.implements.forEach(iface => {
          const targetClass = classes.find(c => c.name === iface);
          if (targetClass) relationships.push({
            sourceId: sourceClass.id, targetId: targetClass.id,
            type: 'realization', label: 'implements'
          });
        });
      }

      // 3. COMPOSITION / AGGREGATION (fields that reference other classes)
      if (sourceClass.attributes?.length > 0) {
        sourceClass.attributes.forEach(attr => {
          /**
           * typeStr — FIX: use rawType (e.g. "List<Book>") not type (e.g. "List").
           * The stripped type loses the class name inside angle brackets, making
           * it impossible to match "Book" and draw the aggregation arrow.
           * Falls back to attr.type for Python/JS parsers that don't set rawType.
           */
          const typeStr = attr.rawType || attr.type || '';

          /**
           * nameHint — the variable name (e.g. "books") used for plural matching.
           * BUG FIX — plural names: Python has no generics, so "self.books = []"
           * stores type 'list' not 'Book'. typeStr alone can never match the Book
           * class. By also checking if the variable name (lowercased, with trailing
           * 's' stripped) equals a known class name, we catch these collection fields.
           * e.g. "books" → strip 's' → "book" → matches class "Book" (case-insensitive).
           */
          const nameHint = (attr.nameHint || attr.name || '').toLowerCase();

          const matchedClass = classes.find(c => {
            const cn = c.name;
            return cn === typeStr ||                                    // Exact type match: "Address"
                   typeStr.includes(cn) ||                             // Substring: "AddressWrapper"
                   typeStr.includes(`<${cn}>`) ||                      // Generic: "List<Book>"
                   nameHint === cn.toLowerCase() ||                    // Exact name match: "book" = "Book"
                   nameHint === cn.toLowerCase() + 's' ||              // Plural: "books" → "Book"
                   nameHint === cn.toLowerCase() + 'es' ||             // Plural: "addresses" → "Address"
                   nameHint === cn.toLowerCase() + 'list' ||           // Compound: "bookList" → "Book"
                   (nameHint.endsWith('s') && nameHint.slice(0,-1) === cn.toLowerCase()); // "items" → "Item"
          });

          /**
           * Self-loop guard — skip if the matched class is the same as the source class.
           * Without this, a Node class with "Node next" draws an arrow to itself.
           */
          if (matchedClass && matchedClass.id !== sourceClass.id) {
            /**
             * isCollection — true if the type name contains collection keywords.
             * Determines aggregation (hollow diamond, many) vs composition (filled, one).
             */
            const isCollection = /list|array|set|collection|vector/i.test(typeStr);
            relationships.push({
              sourceId: sourceClass.id, targetId: matchedClass.id,
              type: isCollection ? 'aggregation' : 'composition',
              label: attr.name || '',
              multiplicity: isCollection ? '0..*' : '1'
            });
          }
        });
      }

      // 4. DEPENDENCY (method parameter types)
      // LAYMAN'S: If this class's methods accept another class as a parameter,
      // it "depends on" that class even without storing a reference.
      if (sourceClass.methods?.length > 0) {
        sourceClass.methods.forEach(method => {
          const paramRegex = /(\w+)/g;
          let paramMatch;
          const seenParams = new Set(); // Dedup per source class to avoid repeat edges

          while ((paramMatch = paramRegex.exec(method.parameters)) !== null) {
            const paramType = paramMatch[1];
            const matchedClass = classes.find(c => c.name === paramType);
            const key = `${sourceClass.id}_${matchedClass?.id}`;

            if (matchedClass && !seenParams.has(key) && matchedClass.id !== sourceClass.id) {
              seenParams.add(key);
              relationships.push({
                sourceId: sourceClass.id, targetId: matchedClass.id,
                type: 'dependency', label: method.name || ''
              });
            }
          }
        });
      }
    });

    return relationships;
  }

  // ============================================================
  // ALGORITHM C: PATTERN DETECTOR
  // LAYMAN'S: Scans classes for telltale signs of four famous
  // design patterns and reports findings with confidence scores.
  // TECHNICAL: Heuristic checks — structural signals mapped to pattern
  // types. Confidence scores are fixed estimates based on reliability.
  // ============================================================

  /**
   * detectPatterns(classes, sourceCode)
   * LAYMAN'S: Checks every class for signs of Singleton, Factory,
   * Observer, or Strategy patterns.
   * TECHNICAL: Four independent heuristic checks per class.
   * Does NOT affect elements or connections — purely informational.
   *
   * RELATIONSHIP: Called by convertCodeToUML() as Step 3.
   */
  static detectPatterns(classes, sourceCode) {
    const patterns = [];

    classes.forEach(cls => {

      // 1. SINGLETON — only one instance allowed, accessed via a static method
      // Signals: static 'instance' attribute + getInstance() method
      const hasGetInstanceMethod = cls.methods?.some(m =>
        m.name.toLowerCase().includes('getinstance') || m.name.toLowerCase().includes('get_instance')
      );
      const hasStaticInstance = cls.attributes?.some(attr =>
        attr.isStatic && attr.name.toLowerCase().includes('instance')
      );
      if (hasStaticInstance && hasGetInstanceMethod) {
        patterns.push({ type: 'Singleton', class: cls.name, confidence: 0.95 });
      }

      // 2. FACTORY — creates objects on behalf of callers
      // Signal: methods starting with 'create' or 'build'
      const createMethods = cls.methods?.filter(m =>
        m.name.toLowerCase().startsWith('create') || m.name.toLowerCase().startsWith('build')
      ) || [];
      if (createMethods.length >= 1) {
        patterns.push({
          type: 'Factory', class: cls.name,
          methods: createMethods.map(m => m.name), confidence: 0.80
        });
      }

      // 3. OBSERVER — reacts to events from other objects
      // Signal: method named 'update' or 'notify'
      const hasUpdate = cls.methods?.some(m => m.name === 'update' || m.name === 'notify');
      if (hasUpdate) {
        patterns.push({ type: 'Observer/Observable', class: cls.name, confidence: 0.70 });
      }

      // 4. STRATEGY — swappable implementation of a shared interface
      // Signal: implements an interface + has methods + is not abstract
      if (cls.implements?.length > 0 && cls.methods?.length > 0 && !cls.isAbstract) {
        patterns.push({
          type: 'Strategy', class: cls.name,
          interface: cls.implements[0], confidence: 0.75
        });
      }
    });

    return patterns;
  }

  // ============================================================
  // UML MODEL CONVERTER
  // LAYMAN'S: The final packaging step — formats everything into
  // the exact shape the visual diagram editor needs.
  // ============================================================

  /**
   * convertToUMLModel(classes, relationships)
   * LAYMAN'S: Turns class data into diagram boxes (elements) and
   * relationship data into diagram arrows (connections).
   *
   * TECHNICAL: Positions elements in a 3-column grid so that large diagrams
   * don't collapse into a single unreadable horizontal row. Heights are
   * dynamic based on attribute/method counts. Connections are deduplicated
   * so the same arrow isn't drawn twice.
   *
   * BUG FIX — grid layout: Previously all classes used y: 100 and x: 100+(idx*300).
   * More than 4 classes caused boxes to run off the canvas edge. Now classes
   * wrap into rows of 3, keeping every box visible without manual rearranging.
   *
   * BUG FIX — deduplication: The same source→target→type combination can be
   * detected by multiple rules (e.g. both inheritance and composition to the
   * same class). A Set of keys prevents duplicate arrows from being drawn.
   *
   * RELATIONSHIP: Called by convertCodeToUML() as Step 4 (final step).
   */
  static convertToUMLModel(classes, relationships) {
    /**
     * Grid layout constants
     * LAYMAN'S: Instead of lining all boxes in one long row, we arrange
     * them 3-across then wrap to the next row — like reading a page.
     */
    const COLS    = 3;   // Classes per row before wrapping
    const COL_GAP = 320; // Horizontal distance between columns (px)
    const ROW_GAP = 260; // Vertical distance between rows (px)
    const START_X = 80;  // Left margin from canvas edge (px)
    const START_Y = 80;  // Top margin from canvas edge (px)

    /**
     * elements — one diagram box per class.
     * col/row derived from array index so classes tile left-to-right,
     * then wrap to the next row after every 3rd class.
     */
    const elements = classes.map((cls, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);

      // Use elementType if set (actor/usecase/lifeline from PlantUML parsers),
      // otherwise fall back to abstract/class based on isAbstract flag.
      const resolvedType = cls.elementType && cls.elementType !== 'class'
        ? cls.elementType
        : (cls.isAbstract ? 'abstract' : 'class');

      // Actors and lifelines need taller boxes to fit the stickman drawing
      const defaultWidth  = resolvedType === 'actor'    ? 100
                          : resolvedType === 'lifeline' ? 150
                          : resolvedType === 'usecase'  ? 180
                          : 200;
      const defaultHeight = resolvedType === 'actor'    ? 110
                          : resolvedType === 'lifeline' ? 100
                          : resolvedType === 'usecase'  ? 80
                          : this.calculateHeight(cls);

      return {
        id: cls.id,
        type: resolvedType,
        name: cls.label || cls.name,
        x: START_X + col * COL_GAP,
        y: START_Y + row * ROW_GAP,
        width:  defaultWidth,
        height: defaultHeight,
        attributes: cls.attributes || [],
        methods: cls.methods || [],
        stereotype: cls.isAbstract ? 'abstract' : ''
      };
    });

    /**
     * seen — deduplication Set for relationship keys.
     * Key format: "sourceId__targetId__type".
     * Prevents two arrows of the same type between the same class pair.
     */
    const seen = new Set();

    /**
     * connections — one diagram arrow per unique relationship.
     * IDs use Date.now() + Math.random() to prevent collisions
     * even when multiple connections are created in the same millisecond.
     */
    const connections = [];
    relationships.forEach(rel => {
      const key = `${rel.sourceId}__${rel.targetId}__${rel.type}`;
      if (seen.has(key)) return; // Skip duplicate
      seen.add(key);

      connections.push({
        id: `conn_${Date.now()}_${Math.random()}`,
        from: rel.sourceId,
        to:   rel.targetId,
        type: rel.type,
        // Use msgLabel for sequence messages so the arrow shows the action text
        label: rel.msgLabel || rel.label || '',
        fromMultiplicity: (rel.type === 'aggregation' || rel.type === 'composition') ? '1' : '',
        toMultiplicity: rel.multiplicity || (
          rel.type === 'aggregation' ? '0..*' :
          rel.type === 'composition' ? '1' : ''
        ),
        fromRole: '',
        toRole:   ''
      });
    });

    return { elements, connections };
  }

  /**
   * calculateHeight(cls)
   * LAYMAN'S: Taller classes have more fields/methods, so they need bigger boxes.
   * TECHNICAL: baseHeight(60) + 18px/attribute + 18px/method + 30px padding.
   * Math.max(100) enforces a minimum so empty classes are still visible.
   *
   * RELATIONSHIP: Called by convertToUMLModel() for each element.
   */
  static calculateHeight(cls) {
    const baseHeight   = 60;
    const attrHeight   = (cls.attributes?.length || 0) * 18;
    const methodHeight = (cls.methods?.length || 0) * 18;
    return Math.max(100, baseHeight + attrHeight + methodHeight + 30);
  }

  // ============================================================
  // SEQUENCE DIAGRAM PARSER — Java, Python, JavaScript
  // ============================================================

  static convertCodeToUMLSequence(sourceCode, language = 'Java') {
    try {
      let lifelines, messages;
      switch (language.toLowerCase()) {
        case 'python':
          ({ lifelines, messages } = this.parseSequencePython(sourceCode));
          break;
        case 'javascript':
        case 'js':
          ({ lifelines, messages } = this.parseSequenceJavaScript(sourceCode));
          break;
        default:
          ({ lifelines, messages } = this.parseSequenceJava(sourceCode));
      }

      if (lifelines.length === 0) {
        return {
          success: false,
          message: `No classes found in ${language} code. Ensure you have class definitions.`,
          elements: [], connections: [], patterns: []
        };
      }

      const ts = Date.now();
      lifelines.forEach((ll, i) => { ll.id = `seq_${ts}_${i}`; });
      const nameToId = {};
      lifelines.forEach(ll => { nameToId[ll.name] = ll.id; });

      const SPACING = 220;
      const elements = lifelines.map((ll, i) => ({
        id: ll.id, type: 'lifeline', name: ll.name,
        x: 80 + i * SPACING, y: 80,
        width: 160, height: 100,
        attributes: [], methods: [], stereotype: ''
      }));

      const seen = new Set();
      const connections = [];
      messages.forEach(msg => {
        const fromId = nameToId[msg.from];
        const toId   = nameToId[msg.to];
        if (!fromId || !toId || fromId === toId) return;
        const key = `${fromId}__${toId}__${msg.label}`;
        if (seen.has(key)) return;
        seen.add(key);
        connections.push({
          id: `conn_${Date.now()}_${Math.random()}`,
          from: fromId, to: toId,
          type: msg.isReturn ? 'return' : 'message',
          label: msg.label || '',
          fromMultiplicity: '', toMultiplicity: '', fromRole: '', toRole: ''
        });
      });

      return {
        success: true, replaceAll: true,
        message: `Extracted ${lifelines.length} lifelines and ${connections.length} messages`,
        elements, connections, patterns: [],
        metadata: {
          sourceLanguage: language,
          totalClasses: lifelines.length, totalMethods: 0,
          totalAttributes: 0, relationships: connections.length, patternsDetected: 0
        }
      };
    } catch (err) {
      return { success: false, message: `Sequence parse error: ${err.message}`, elements: [], connections: [], patterns: [] };
    }
  }

  static parseSequenceJava(sourceCode) {
    const lifelines = [];
    const messages  = [];
    const classRegex = /(?:public\s+)?(?:abstract\s+)?(?:static\s+)?class\s+(\w+)[^{]*\{([\s\S]*?)(?=\n\}(?:\s|$))/g;
    let classMatch;
    while ((classMatch = classRegex.exec(sourceCode)) !== null) {
      const className = classMatch[1];
      const classBody = classMatch[2];
      if (className === 'SequenceHandler') continue;
      lifelines.push({ name: className });
      const fieldMap = {};
      // Field declarations: "private AuthService authService;"
      const fieldRegex = /(?:private|public|protected)?\s+([A-Z]\w+)\s+(\w+)\s*[=;]/g;
      let fm;
      while ((fm = fieldRegex.exec(classBody)) !== null) {
        fieldMap[fm[2]] = fm[1];
      }
      // Constructor params: "public LoginPage(AuthService authService, ...)"
      const ctorRegex = /public\s+\w+\s*\(([^)]+)\)/g;
      let cm;
      while ((cm = ctorRegex.exec(classBody)) !== null) {
        cm[1].split(',').forEach(param => {
          const parts = param.trim().split(/\s+/);
          if (parts.length >= 2 && /^[A-Z]/.test(parts[0])) fieldMap[parts[1]] = parts[0];
        });
      }
      // Method calls: "fieldName.methodName("
      const callRegex = /(\w+)\.(\w+)\s*\(/g;
      let call;
      while ((call = callRegex.exec(classBody)) !== null) {
        const targetClass = fieldMap[call[1]];
        if (targetClass && targetClass !== className) {
          messages.push({ from: className, to: targetClass, label: call[2], isReturn: false });
        }
      }
    }
    return { lifelines, messages };
  }

  static parseSequencePython(sourceCode) {
    const lifelines = [];
    const messages  = [];
    const classStartRegex = /^class\s+(\w+)(?:\([^)]*\))?\s*:/gm;
    const classStarts = [];
    let m;
    while ((m = classStartRegex.exec(sourceCode)) !== null) {
      classStarts.push({ name: m[1], pos: m.index });
    }
    classStarts.forEach((cls, i) => {
      const endPos    = i + 1 < classStarts.length ? classStarts[i + 1].pos : sourceCode.length;
      const classBody = sourceCode.slice(cls.pos, endPos);
      const className = cls.name;
      lifelines.push({ name: className });
      const fieldMap = {};
      // __init__ type-hinted params: "def __init__(self, auth: AuthService)"
      const initMatch = classBody.match(/def\s+__init__\s*\(([^)]+)\)/);
      if (initMatch) {
        initMatch[1].split(',').forEach(param => {
          const ann = param.match(/(\w+)\s*:\s*(\w+)/);
          if (ann && ann[1] !== 'self' && /^[A-Z]/.test(ann[2])) fieldMap[ann[1]] = ann[2];
        });
      }
      // self.field = param assignments
      const selfRegex = /self\.(\w+)\s*=\s*(\w+)/g;
      let sa;
      while ((sa = selfRegex.exec(classBody)) !== null) {
        if (/^[A-Z]/.test(sa[2])) fieldMap[sa[1]] = sa[2];
        else if (fieldMap[sa[2]]) fieldMap[sa[1]] = fieldMap[sa[2]];
      }
      // self.field.method( calls
      const callRegex = /self\.(\w+)\.(\w+)\s*\(/g;
      let call;
      while ((call = callRegex.exec(classBody)) !== null) {
        const targetClass = fieldMap[call[1]];
        if (targetClass && targetClass !== className) {
          messages.push({ from: className, to: targetClass, label: call[2], isReturn: false });
        }
      }
    });
    return { lifelines, messages };
  }

  static parseSequenceJavaScript(sourceCode) {
    const lifelines = [];
    const messages  = [];
    const classRegex = /class\s+(\w+)[^{]*\{([\s\S]*?)(?=\nclass\s|$)/g;
    let classMatch;
    while ((classMatch = classRegex.exec(sourceCode)) !== null) {
      const className = classMatch[1];
      const classBody = classMatch[2];
      if (className === 'SequenceHandler') continue;
      lifelines.push({ name: className });
      const fieldMap = {};
      // constructor params + this.x = y assignments
      const ctorMatch = classBody.match(/constructor\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\n\s{0,4}\w|$)/);
      if (ctorMatch) {
        const ctorParams = ctorMatch[1].split(',').map(p => p.trim()).filter(Boolean);
        const ctorBody   = ctorMatch[2];
        const thisRx = /this\.(\w+)\s*=\s*(\w+)/g;
        let ta;
        while ((ta = thisRx.exec(ctorBody)) !== null) {
          const matched = ctorParams.find(p => p === ta[2]);
          if (matched) {
            const inferred = matched.charAt(0).toUpperCase() + matched.slice(1);
            fieldMap[ta[1]] = inferred;
          }
          if (/^[A-Z]/.test(ta[2])) fieldMap[ta[1]] = ta[2];
        }
      }
      // this.field.method( calls
      const callRegex = /this\.(\w+)\.(\w+)\s*\(/g;
      let call;
      while ((call = callRegex.exec(classBody)) !== null) {
        const targetClass = fieldMap[call[1]];
        if (targetClass && targetClass !== className) {
          messages.push({ from: className, to: targetClass, label: call[2], isReturn: false });
        }
      }
    }
    return { lifelines, messages };
  }

}

/**
 * Default Export
 * LAYMAN'S: Makes CodeToUMLConverter available to files that import it.
 * TECHNICAL: ES Module default export. All methods are static — no 'new' needed.
 */
export default CodeToUMLConverter;