/**
 * ============================================================
 * codeToUMLConverter.js — Code-to-UML Converter Service
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This file reads actual source code (Java, Python, or JavaScript)
 * and reverse-engineers it into a visual UML
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
   * @param {string} language   - 'Java' | 'Python' | 'JavaScript'
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
          // diagramType lets UMLEditor auto-switch to the right canvas mode
          // after a Code to Diagram conversion (usecase, sequence, or class).
          diagramType: ast.classes.some(c => c.elementType === 'actor' || c.elementType === 'usecase')
            ? 'usecase'
            : ast.classes.some(c => c.elementType === 'lifeline')
              ? 'sequence'
              : 'class',
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
   * TECHNICAL: Dispatches by language string to the correct parser.
   * Defaults to Java parser for unknown languages.
   *
   * RELATIONSHIP: Called by convertCodeToUML() in Step 1.
   * Delegates to parseJavaAST / parsePythonAST / parseJavaScriptAST.
   */
  static parseSourceCode(sourceCode, language) {
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
    // Strip method bodies first so "return null;" "throw new X();" etc. inside
    // methods are never mistaken for field declarations.
    // Replace everything between { } with spaces, preserving line count.
    const bodyStripped = classBody.replace(/\{[^{}]*\}/g, match =>
      ' '.repeat(match.length)
    );

    const attrRegex = /(public|private|protected)?\s+(static\s+)?(final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
    let match;
    const seen = new Set();
    // Keywords that are never valid field names or types
    const RESERVED = new Set(['return','throw','new','if','else','while','for','switch','case','break','continue','super','this','true','false','null','void','instanceof']);

    while ((match = attrRegex.exec(bodyStripped)) !== null) {
      const [, visibility = 'private', isStatic, isFinal, type, name] = match;
      // Skip if name or type is a Java keyword — means we matched a statement, not a field
      if (RESERVED.has(name) || RESERVED.has(type)) continue;
      // Skip if type is a visibility keyword — means the regex misparsed a method signature
      if (['public','private','protected'].includes(type)) continue;
      if (!seen.has(name)) {
        seen.add(name);
        attributes.push({
          name,
          rawType: type,
          type: type.replace(/<[^>]+>/, ''),
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
    const methodRegex = /(public|private|protected)?\s+(static\s+)?(abstract\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)(?:\s+throws\s+[\w\s,]+)?\s*(?:\{|;)/g;

    let match;
    const seen = new Set();
    const VISIBILITY = new Set(['public','private','protected']);

    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, visibility = 'public', isStatic, isAbstract, returnType, methodName, params] = match;

      // BUG FIX: If returnType is a visibility keyword (public/private/protected),
      // the regex misparsed a declaration like "public public Dog(...)" — this happens
      // when generated code is round-tripped and the method signature has an extra
      // access modifier. Skip these false positives entirely.
      if (VISIBILITY.has(returnType)) continue;

      // Skip Java keywords that are never valid method names
      if (['if','else','while','for','switch','new','return','class'].includes(methodName)) continue;

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

      // ── Annotated use case / sequence _rels (pre-parsed by parseAnnotatedUseCaseAST) ──
      // Only process _rels if this is a non-class element (actor, usecase, lifeline)
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
        return; // Skip code-based rules for non-class elements
      }

      // 1. INHERITANCE — preserve even when parent class is in a different file
      if (sourceClass.extends) {
        let targetClass = classes.find(c => c.name === sourceClass.extends);
        if (!targetClass) {
          // Parent class is in a different file — create a lightweight placeholder
          // so the inheritance arrow is still drawn. The placeholder gets an 'external'
          // stereotype so the diagram can style it differently if desired.
          targetClass = {
            id:         `ext_${sourceClass.extends}_${Date.now()}`,
            name:       sourceClass.extends,
            extends:    null, implements: [],
            attributes: [], methods: [],
            isAbstract: false,
            isExternal: true,   // flag: this class came from another file
            elementType: 'class'
          };
          classes.push(targetClass);
        }
        relationships.push({
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

      // Use elementType if set (actor/usecase/lifeline from annotated use case parser),
      // otherwise fall back to abstract/class based on isAbstract flag.
      const resolvedType = cls.elementType && cls.elementType !== 'class'
        ? cls.elementType
        : (cls.isAbstract ? 'abstract' : 'class');

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
        stereotype: cls.isAbstract ? 'abstract' : (cls.isExternal ? 'external' : ''),
        // isExternal: parent class lives in another file — shown with a note
        isExternal: cls.isExternal || false
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
      if (/^#\s*Sequence Diagram Documentation/m.test(sourceCode)) {
        return this.convertSequenceDocumentationToUML(sourceCode, language);
      }

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
          diagramType: 'sequence',
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

  /**
   * convertCodeToUMLUseCase(sourceCode, language)
   * -----------------------------------------------
   * LAYMAN'S: Reads the handler-style code that CodeGenerator emits for
   *   use-case diagrams and reverse-engineers it back into actors, use-case
   *   ovals, and the connections between them.
   *
   * TECHNICAL: Parses the actor-class-per-actor output format produced by
   *   generateUseCaseHandler(). Key signals extracted:
   *     • Class names      → actor names  (one class per actor)
   *     • execute*() methods inside a class → use cases owned by that actor
   *     • "// <<include>>"  comment lines  → include connections
   *     • "// <<extend>>"   comment lines  → extend connections
   *     • "handler.execute*()" calls       → shared use case nodes
   *   A UseCaseHandler or shared class is recognised by the absence of a
   *   matching actor pattern and its methods become free-standing use cases.
   *
   *   Python format: class names stay the same; method names are
   *   execute_snake_case() — converted back to Title Case for display.
   *   JavaScript: identical structure to Java.
   *
   * @param {string} sourceCode - Handler code produced by generateUseCaseHandler()
   * @param {string} language   - 'Java' | 'Python' | 'JavaScript'
   * @returns {{ success, elements, connections, replaceAll }}
   */
  static convertCodeToUMLUseCase(sourceCode, language = 'Java', existingElements = []) {
    try {
      if (/^#\s*Use Case Diagram Documentation/m.test(sourceCode)) {
        return this.convertUseCaseDocumentationToUML(sourceCode, language, existingElements);
      }

      const elements    = [];
      const connections = [];
      let idCounter     = Date.now();
      const uid         = () => `uc_${idCounter++}`;

      // ── name-matching helpers ────────────────────────────────
      // Normalise a display name for fuzzy matching (lowercase, no spaces/punctuation)
      const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      // Try to find an existing element by type + normalised name so we reuse
      // its id and position instead of generating new ones (keeps layout stable).
      const findExisting = (type, name) =>
        existingElements.find(e => e.type === type && norm(e.name) === norm(name));

      // ── display-name converters ──────────────────────────────
      const fromMethodName = (raw) => {
        let s = raw.replace(/^execute_?/i, '');
        if (!s) return raw;
        if (s.includes('_')) {
          return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        return s.replace(/([A-Z])/g, ' $1').trim().replace(/\s+/g, ' ')
                .replace(/^\w/, c => c.toUpperCase());
      };

      const fromClassName = (name) =>
        name.replace(/([A-Z])/g, ' $1').trim().replace(/\s+/g, ' ');

      // ── split source into per-class blocks ───────────────────
      const classBlocks = [];

      if (language === 'Python') {
        const lines = sourceCode.split('\n');
        let current = null;
        for (const line of lines) {
          const cm = line.match(/^class\s+(\w+)/);
          if (cm) {
            if (current) classBlocks.push(current);
            current = { name: cm[1], body: line + '\n' };
          } else if (current) {
            current.body += line + '\n';
          }
        }
        if (current) classBlocks.push(current);
      } else {
        const classRegex = /(?:public\s+)?class\s+(\w+)[^{]*\{/g;
        let m;
        while ((m = classRegex.exec(sourceCode)) !== null) {
          const name  = m[1];
          const start = m.index + m[0].length - 1;
          let depth = 0, end = start;
          for (let i = start; i < sourceCode.length; i++) {
            if (sourceCode[i] === '{') depth++;
            else if (sourceCode[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
          }
          classBlocks.push({ name, body: sourceCode.slice(start + 1, end) });
        }
      }

      if (classBlocks.length === 0) {
        return { success: false, message: 'No classes found in use case code.', elements: [], connections: [] };
      }

      const HANDLER_RE = /UseCaseHandler|SharedHandler|UseCaseRunner/i;

      const getMethodsFromBody = (body, lang) => {
        const methods = [];
        if (lang === 'Python') {
          const re = /def\s+(execute_\w+)\s*\(self\)/g;
          let m;
          while ((m = re.exec(body)) !== null) methods.push(m[1]);
        } else if (lang === 'JavaScript') {
          const re = /(?:^|\n)\s*(?:async\s+)?(execute\w+)\s*\([^)]*\)\s*\{/g;
          let m;
          while ((m = re.exec(body)) !== null) {
            if (!methods.includes(m[1])) methods.push(m[1]);
          }
        } else {
          // Match execute* method *declarations* only.
          //
          // BUG FIX — missing connections for package-private methods:
          // The previous regex required an explicit "public" keyword:
          //   /(?:public\s+\w+\s+|async\s+)(execute\w+)\s*\(/g
          // Methods declared without an access modifier (package-private) like
          //   "void executeLogIn() {"
          // or with other modifiers like "protected" were silently skipped,
          // causing their use-case connections to never be drawn (e.g. BankAdmin
          // → Log In was missing because executeLogIn() lacked "public").
          //
          // FIX: access modifier is now optional; static/final are also optional.
          // A return-type word (\w[\w<>,\s]*) before execute is still REQUIRED
          // so that call-sites like "handler.executeX();" — which have a dot,
          // not a space, before execute — can never accidentally match, preserving
          // the guard against phantom actor→shared-use-case direct edges.
          const re = /(?:(?:public|protected|private)\s+)?(?:static\s+)?(?:final\s+)?\w[\w<>,\s]*\s+(execute\w+)\s*\(/g;
          let m;
          while ((m = re.exec(body)) !== null) {
            if (!methods.includes(m[1])) methods.push(m[1]);
          }
        }
        return methods;
      };

      const getRelCalls = (methodBody, lang) => {
        const includes = [], extends_ = [];
        if (lang === 'Python') {
          const incRe = /(?:self(?:\.handler)?|handler)\.execute_(\w+)\(\).*#\s*<<include>>/g;
          const extRe = /#\s*(?:self(?:\.handler)?|handler)\.execute_(\w+)\(\).*#\s*<<extend>>/g;
          let m;
          while ((m = incRe.exec(methodBody)) !== null) includes.push(m[1]);
          while ((m = extRe.exec(methodBody)) !== null) extends_.push(m[1]);
        } else {
          const incRe = /(?:this(?:\.handler)?|handler)\.execute(\w+)\(\);\s*\/\/\s*<<include>>/g;
          const extRe = /\/\/\s*(?:this(?:\.handler)?|handler)\.execute(\w+)\(\);\s*\/\/\s*<<extend>>/g;
          let m;
          while ((m = incRe.exec(methodBody)) !== null) includes.push(m[1]);
          while ((m = extRe.exec(methodBody)) !== null) extends_.push(m[1]);
        }
        return { includes, extends_ };
      };

      // ── lazy use-case registry — reuses existing nodes by name ──
      const getUseCaseNameFromBody = (methodBody) => {
        const match = methodBody.match(/Execute use case:\s*([^\n|*"]+)/i);
        return match ? match[1].trim() : '';
      };

      const ucByMethodSuffix = new Map();
      const getOrCreateUC = (suffix, displayName = '') => {
        if (ucByMethodSuffix.has(suffix)) return ucByMethodSuffix.get(suffix);
        const name = displayName || fromMethodName(
          language === 'Python' ? 'execute_' + suffix : 'execute' + suffix
        );
        // Try to reuse an existing usecase element with the same name
        const existing = findExisting('usecase', name);
        const ucCount  = elements.filter(e => e.type === 'usecase').length;
        const el = existing
          ? { ...existing }  // keep id, x, y, width, height from canvas
          : {
              id:          uid(),
              type:        'usecase',
              diagramType: 'usecase',
              name,
              x:      300 + (ucCount % 4) * 220,
              y:      200 + Math.floor(ucCount / 4) * 130,
              width:  160,
              height: 60,
              properties: {},
            };
        elements.push(el);
        ucByMethodSuffix.set(suffix, el.id);
        return el.id;
      };

      // ── process each class block ──────────────────────────────
      // Spread actors horizontally; reuse positions when possible
      const existingActors = existingElements.filter(e => e.type === 'actor');
      let actorSlot = 0;

      for (const block of classBlocks) {
        const isHandler = HANDLER_RE.test(block.name);
        const methods   = getMethodsFromBody(block.body, language);

        if (!isHandler) {
          const actorName    = fromClassName(block.name);
          const existingActor = findExisting('actor', actorName);
          const actor = existingActor
            ? { ...existingActor }
            : {
                id:          uid(),
                type:        'actor',
                diagramType: 'usecase',
                name:        actorName,
                // space actors evenly across the top if no existing position
                x:      80 + actorSlot * 200,
                y:      120,
                width:  80,
                height: 100,
                properties: {},
              };
          elements.push(actor);
          actorSlot++;

          for (const method of methods) {
            const suffix = language === 'Python'
              ? method.replace(/^execute_/, '')
              : method.replace(/^execute/, '');
            if (!suffix) continue;

            let methodBody = '';
            if (language === 'Python') {
              const mRe = new RegExp(`def\\s+${method}\\s*\\(self\\)[\\s\\S]*?(?=\\n    def |$)`);
              const mM  = block.body.match(mRe);
              if (mM) methodBody = mM[0];
            } else {
              const mRe = new RegExp(`execute${suffix}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n    \\}`);
              const mM  = block.body.match(mRe);
              if (mM) methodBody = mM[1];
            }

            const ucId = getOrCreateUC(suffix, getUseCaseNameFromBody(methodBody));

            // Association: actor → use case
            connections.push({
              id:   uid(),
              type: 'association',
              from: actor.id,
              to:   ucId,
              fromMultiplicity: '', toMultiplicity: '',
              label: '', fromRole: '', toRole: '',
            });

            const { includes, extends_ } = getRelCalls(methodBody, language);

            for (const incSuffix of includes) {
              const incId = getOrCreateUC(incSuffix);
              connections.push({
                id:   uid(),
                type: 'include',
                from: ucId,
                to:   incId,
                fromMultiplicity: '', toMultiplicity: '',
                label: '<<include>>', fromRole: '', toRole: '',
              });
            }
            for (const extSuffix of extends_) {
              const extId = getOrCreateUC(extSuffix);
              connections.push({
                id:   uid(),
                type: 'extend',
                from: extId,
                to:   ucId,
                fromMultiplicity: '', toMultiplicity: '',
                label: '<<extend>>', fromRole: '', toRole: '',
              });
            }
          }
        } else if (/UseCaseHandler|SharedHandler/i.test(block.name)) {
          for (const method of methods) {
            const suffix = language === 'Python'
              ? method.replace(/^execute_/, '')
              : method.replace(/^execute/, '');
            if (!suffix) continue;

            let methodBody = '';
            if (language === 'Python') {
              const mRe = new RegExp(`def\\s+${method}\\s*\\(self\\)[\\s\\S]*?(?=\\n    def |$)`);
              const mM  = block.body.match(mRe);
              if (mM) methodBody = mM[0];
            } else {
              const mRe = new RegExp(`execute${suffix}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n    \\}`);
              const mM  = block.body.match(mRe);
              if (mM) methodBody = mM[1];
            }

            getOrCreateUC(suffix, getUseCaseNameFromBody(methodBody));
          }
        }
        // UseCaseRunner is intentionally skipped. Shared handler classes are
        // parsed as free-standing use-case nodes so unassociated/shared use
        // cases are not lost, while the runner never becomes a fake actor.
      }

      if (elements.length === 0) {
        return { success: false, message: 'Could not find any actors or use cases in the code.', elements: [], connections: [] };
      }

      // ── Deduplicate connections ──────────────────────────────────────────
      // The converter builds one connection per method per parse. When
      // applyCodeToDiagram is called repeatedly on the same code (e.g. on
      // code-side undo/redo, or on a debounce replay) the actor/use-case
      // nodes are reused by ID via findExisting(), but every call was still
      // pushing fresh connection objects — resulting in doubled (or tripled)
      // arrows on the canvas. We deduplicate here by (from, to, type) so the
      // returned connections array never has more than one edge of each kind
      // between any two nodes.
      const seen = new Set();
      const dedupedConnections = connections.filter(c => {
        const key = `${c.from}|${c.to}|${c.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        success: true,
        elements,
        connections: dedupedConnections,
        replaceAll: true,
        metadata: {
          sourceLanguage: language,
          diagramType: 'usecase',
          totalClasses: elements.length,
          totalMethods: 0,
          totalAttributes: 0,
          relationships: dedupedConnections.length,
          patternsDetected: 0
        }
      };

    } catch (err) {
      return { success: false, message: err.message || 'Unexpected error parsing use case code.', elements: [], connections: [] };
    }
  }

  static convertUseCaseDocumentationToUML(sourceCode, language = 'Java', existingElements = []) {
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const findExisting = (type, name) =>
      existingElements.find(e => e.type === type && norm(e.name) === norm(name));
    const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const clean = (s) => (s || '').trim();
    const elements = [];
    const connections = [];
    const actors = new Map();
    const usecases = new Map();

    const addElement = (type, name) => {
      const map = type === 'actor' ? actors : usecases;
      const key = norm(name);
      if (map.has(key)) return map.get(key);

      const existing = findExisting(type, name);
      const count = elements.filter(e => e.type === type).length;
      const element = existing ? { ...existing } : {
        id: uid(type === 'actor' ? 'actor' : 'usecase'),
        type,
        diagramType: 'usecase',
        name,
        x: type === 'actor' ? 80 + count * 200 : 300 + (count % 4) * 220,
        y: type === 'actor' ? 120 : 260 + Math.floor(count / 4) * 130,
        width: type === 'actor' ? 80 : 160,
        height: type === 'actor' ? 100 : 60,
        properties: {}
      };
      elements.push(element);
      map.set(key, element);
      return element;
    };

    const sectionBetween = (startHeader, endHeader) => {
      const start = sourceCode.indexOf(startHeader);
      if (start === -1) return '';
      const end = endHeader ? sourceCode.indexOf(endHeader, start + startHeader.length) : -1;
      return sourceCode.slice(start + startHeader.length, end === -1 ? sourceCode.length : end);
    };

    const actorSection = sectionBetween('## Actors', '## Use Cases');
    const useCaseSection = sectionBetween('## Use Cases', '## Connections');

    let match;
    const headingRe = /^###\s+(.+)$/gm;
    while ((match = headingRe.exec(actorSection)) !== null) {
      addElement('actor', clean(match[1]));
    }
    while ((match = headingRe.exec(useCaseSection)) !== null) {
      addElement('usecase', clean(match[1]));
    }

    const connRe = /^-\s+\*\*(.+?)\*\*\s+--\[(\w+)(?:\s+\((.*?)\))?\]-->\s+\*\*(.+?)\*\*/gm;
    while ((match = connRe.exec(sourceCode)) !== null) {
      const fromName = clean(match[1]);
      const type = clean(match[2]) || 'association';
      const label = clean(match[3]);
      const toName = clean(match[4]);
      const source =
        actors.get(norm(fromName)) ||
        usecases.get(norm(fromName)) ||
        addElement(type === 'include' || type === 'extend' ? 'usecase' : 'actor', fromName);
      const target =
        actors.get(norm(toName)) ||
        usecases.get(norm(toName)) ||
        addElement(type === 'include' || type === 'extend' ? 'usecase' : 'usecase', toName);

      connections.push({
        id: uid('conn'),
        type,
        from: source.id,
        to: target.id,
        label,
        fromMultiplicity: '',
        toMultiplicity: '',
        fromRole: '',
        toRole: ''
      });
    }

    if (elements.length === 0) {
      return { success: false, message: 'No use case documentation entries found.', elements: [], connections: [] };
    }

    return {
      success: true,
      replaceAll: true,
      elements,
      connections,
      patterns: [],
      metadata: {
        sourceLanguage: language,
        diagramType: 'usecase',
        totalClasses: elements.length,
        totalMethods: 0,
        totalAttributes: 0,
        relationships: connections.length,
        patternsDetected: 0
      }
    };
  }

  static convertSequenceDocumentationToUML(sourceCode, language = 'Java') {
    const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const clean = (s) => (s || '').trim();
    const elements = [];
    const connections = [];
    const byName = new Map();

    const addLifeline = (name) => {
      const key = clean(name).toLowerCase();
      if (byName.has(key)) return byName.get(key);
      const idx = elements.length;
      const element = {
        id: uid('seq'),
        type: 'lifeline',
        diagramType: 'sequence',
        name: clean(name),
        x: 80 + idx * 220,
        y: 80,
        width: 160,
        height: 100,
        attributes: [],
        methods: [],
        stereotype: ''
      };
      elements.push(element);
      byName.set(key, element);
      return element;
    };

    const participantSectionStart = sourceCode.indexOf('## Participants');
    const flowSectionStart = sourceCode.indexOf('## Message Flow');
    const participantSection = participantSectionStart === -1
      ? ''
      : sourceCode.slice(participantSectionStart, flowSectionStart === -1 ? sourceCode.length : flowSectionStart);

    let match;
    const headingRe = /^###\s+(.+)$/gm;
    while ((match = headingRe.exec(participantSection)) !== null) {
      addLifeline(match[1]);
    }

    const messageRe = /^\d+\.\s+\*\*(.+?)\*\*.*?\*\*(.+?)\*\*:\s*(.+)$/gm;
    while ((match = messageRe.exec(sourceCode)) !== null) {
      const source = addLifeline(match[1]);
      const target = addLifeline(match[2]);
      const label = clean(match[3]);
      if (source.id === target.id) continue;
      connections.push({
        id: uid('conn'),
        from: source.id,
        to: target.id,
        type: label.toLowerCase().includes('return') ? 'return' : 'message',
        label,
        fromMultiplicity: '',
        toMultiplicity: '',
        fromRole: '',
        toRole: ''
      });
    }

    if (elements.length === 0) {
      return { success: false, message: 'No sequence documentation entries found.', elements: [], connections: [] };
    }

    return {
      success: true,
      replaceAll: true,
      message: `Imported ${elements.length} lifelines and ${connections.length} messages from sequence documentation`,
      elements,
      connections,
      patterns: [],
      metadata: {
        sourceLanguage: language,
        diagramType: 'sequence',
        totalClasses: elements.length,
        totalMethods: 0,
        totalAttributes: 0,
        relationships: connections.length,
        patternsDetected: 0
      }
    };
  }

}

/**
 * Default Export
 * LAYMAN'S: Makes CodeToUMLConverter available to files that import it.
 * TECHNICAL: ES Module default export. All methods are static — no 'new' needed.
 */
export default CodeToUMLConverter;
