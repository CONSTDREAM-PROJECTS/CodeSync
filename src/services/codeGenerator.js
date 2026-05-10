/**
 * ============================================================
 * codeGenerator.js — Code Generator Service
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Think of this as a translator that takes your visual diagram
 * and writes the actual source code for you. Once you've drawn
 * your classes, attributes, methods, and relationships in the
 * UML editor, this file turns that drawing into real, runnable
 * Java, Python, or JavaScript code — ready to copy-paste into
 * a project and compile or run without editing a single line.
 * It also handles use-case and sequence diagrams, generating
 * documentation and handler stubs for those as well.
 *
 * TECHNICAL OVERVIEW:
 * A static-method-only class organized into four layers:
 *   Layer 1 — Type/Normalisation Utilities: mapType(), getDefaultValue(),
 *              normalizeIdentifier(), normalizeType() — sanitize diagram
 *              data before it touches any code-emission logic.
 *   Layer 2 — Public API: generateCode(), splitIntoFiles() — the only
 *              methods external callers should use.
 *   Layer 3 — Language Dispatchers: generateClassDiagramCode(),
 *              generateJavaCode(), generatePythonCode(),
 *              generateJavaScriptCode() — one branch per language.
 *   Layer 4 — Element Builders: buildJavaClass(), buildPythonClass(),
 *              buildJavaScriptClass(), and their helper methods —
 *              emit fully valid class bodies including fields,
 *              constructors, methods, getters/setters, and toString.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - UMLEditor.jsx calls splitIntoFiles() when the user clicks "Generate Code".
 * - typeMapper.js is the standalone equivalent of mapType()/getDefaultValue()
 *   used by codeToUMLConverter.js for the reverse direction.
 * - ValidationService.js runs before this file to guarantee the diagram
 *   data fed in is structurally sound.
 *
 * Key guarantees per language:
 *   Java       — valid package, imports, public class per file,
 *                real constructor with field initialisation,
 *                getters/setters, concrete return statements.
 *   Python     — correct ABC usage, super().__init__(), typed
 *                hints, __repr__, if __name__ == '__main__' demo.
 *   JavaScript — ES6 classes, JSDoc types, export default,
 *                toString(), demo at bottom.
 * ============================================================
 */

import TypeMapper from './typeMapper';

class CodeGenerator {

  // ─────────────────────────────────────────────────────────
  // TYPE-MAPPING UTILITIES — delegated to TypeMapper (Fix #21)
  // ─────────────────────────────────────────────────────────

  /**
   * mapType(umlType, lang)
   * ----------------------
   * LAYMAN'S: Translates a generic UML type like "Integer" to the
   * correct word for the chosen language ("int" in Java, "number" in JS).
   *
   * TECHNICAL: Fix #21 — previously this maintained its own duplicate
   * lookup table that could drift out of sync with TypeMapper. Now it
   * delegates directly to TypeMapper.mapType() as the single source of truth.
   * Extra entries Java{Short, void, Any}, Python{void, Any}, JS{void, Any}
   * that were only in this table are preserved by extending TypeMapper's
   * result with a small local fallback so no generation output changes.
   *
   * @param {string} umlType - Generic UML type name (e.g., "Integer")
   * @param {string} lang    - Target language ("Java" | "Python" | "JavaScript")
   * @returns {string}       - Language-native type string
   */
  static mapType(umlType, lang) {
    // Extra entries that codeGenerator needs beyond TypeMapper's table
    const extras = {
      Java:       { Short: 'short', void: 'void', Any: 'Object' },
      Python:     { void: 'None',   Any: 'Any' },
      JavaScript: { void: 'void',   Any: 'any', Object: 'any' },
    };
    const fromExtras = extras[lang]?.[umlType];
    if (fromExtras !== undefined) return fromExtras;
    return TypeMapper.mapType(umlType, lang);
  }

  /**
   * getDefaultValue(nativeType, lang)
   * -----------------------------------
   * LAYMAN'S: Returns the correct "blank slate" value for a type in a
   * language — 0 for Java ints, "" for Python strings, [] for JS Arrays.
   *
   * TECHNICAL: Fix #21 — delegates to TypeMapper.getDefaultValue() as the
   * single source of truth. Java collection literals (new ArrayList<>() etc.)
   * and the JS space-padded 'string ' quirk are preserved via a local
   * override map applied before falling back to TypeMapper.
   *
   * @param {string} nativeType - Language-native type string (e.g., "int")
   * @param {string} lang       - Target language
   * @returns {string}          - Initialization literal (e.g., "0", "null", "[]")
   */
  static getDefaultValue(nativeType, lang) {
    // Overrides needed for generated code that TypeMapper doesn't cover
    const overrides = {
      Java: {
        'void': '',
        'List<Object>':          'new ArrayList<>()',
        'ArrayList<Object>':     'new ArrayList<>()',
        'Map<String,Object>':    'new HashMap<>()',
        'HashMap<String,Object>':'new HashMap<>()',
        'Set<Object>':           'new HashSet<>()',
      },
      Python: { 'None': 'None', 'Any': 'None' },
      JavaScript: {
        'void': '',
        'string ': '"" ',  // space-padded key — JS Map collision workaround
        'any': 'null',
        'Map': 'new Map()',
        'Set': 'new Set()',
        'Date': 'new Date()',
      },
    };
    const override = overrides[lang]?.[nativeType];
    if (override !== undefined) return override;
    // Trim to handle the space-padded 'string ' key before delegating
    const result = TypeMapper.getDefaultValue(nativeType?.trim(), lang);
    return result !== 'null' ? result : (nativeType === 'void' ? '' : 'null');
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────

  /**
   * generateCode(elements, connections, language, diagramType)
   * -----------------------------------------------------------
   * LAYMAN'S: The main "one big file" output. Hands back all classes
   * concatenated into a single string — useful for the preview panel
   * where the user wants to quickly see what was generated.
   *
   * TECHNICAL: Normalizes the model first, then dispatches to the
   * correct diagram-type handler, and finally runs formatCode()
   * to strip trailing whitespace and collapse excess blank lines.
   * For multi-file output, use splitIntoFiles() instead.
   *
   * RELATIONSHIP: Called by UMLEditor.jsx for the single-string
   * preview. splitIntoFiles() is called when the user downloads.
   *
   * @param {Array}  elements    - Diagram element objects
   * @param {Array}  connections - Diagram connection objects
   * @param {string} language    - "Java" | "Python" | "JavaScript"
   * @param {string} diagramType - "class" | "usecase" | "sequence"
   * @returns {string}           - Complete generated source code
   */
  static generateCode(elements, connections = [], language = 'Java', diagramType = 'class') {
    const { elements: els, connections: conns } = this.normalizeModel(elements, connections);
    let code = '';
    switch (diagramType) {
      case 'class':    code = this.generateClassDiagramCode(els, conns, language); break;
      case 'usecase':  code = this.generateUseCaseDiagramCode(els, conns, language); break;
      case 'sequence': code = this.generateSequenceDiagramCode(els, conns, language); break;
      default:         code = this.generateClassDiagramCode(els, conns, language);
    }
    return this.formatCode(code, language);
  }

  /**
   * splitIntoFiles(elements, connections, language, diagramType)
   * -------------------------------------------------------------
   * LAYMAN'S: Instead of one big blob, this produces one properly named
   * file per class — exactly what you'd have in a real project. Java gets
   * "BankAccount.java", Python gets "bank_account.py", and so on.
   * Use-case and sequence diagrams also get a Markdown docs file alongside
   * their handler class.
   *
   * TECHNICAL: Returns Array<{ filename: string, content: string }>.
   * For class diagrams, one entry is emitted per class element.
   * Other diagram types get two entries: a .md documentation file and
   * a language-specific handler class file. Falls back to a placeholder
   * if no relevant elements are found.
   *
   * RELATIONSHIP: Primary output method called by UMLEditor.jsx when
   * the user clicks the download/generate-files action. generateCode()
   * uses this internally for its single-string version.
   */
  static splitIntoFiles(elements, connections = [], language = 'Java', diagramType = 'class') {
    const { elements: els, connections: conns } = this.normalizeModel(elements, connections);
    const files = [];

    if (diagramType === 'class') {
      const classEls = els.filter(e => ['class','interface','abstract'].includes(e.type));
      if (classEls.length === 0) {
        return [{ filename: 'NoClasses.txt', content: '// No class elements found in diagram.' }];
      }
      classEls.forEach(el => {
        files.push({
          filename: this.getFileName(el.name, language),
          content:  this.generateSingleClass(el, conns, classEls, language)
        });
      });
    } else if (diagramType === 'usecase') {
      files.push({ filename: 'UseCases.md',
                   content: this.generateUseCaseDocumentation(els, conns) });
      files.push({ filename: this.getFileName('UseCaseHandler', language),
                   content: this.generateUseCaseHandler(els, conns, language) });
    } else if (diagramType === 'sequence') {
      files.push({ filename: 'SequenceFlow.md',
                   content: this.generateSequenceDocumentation(els, conns) });
      files.push({ filename: this.getFileName('SequenceHandler', language),
                   content: this.generateSequenceCode(els, conns, language) });
    }

    return files.length > 0 ? files : [{ filename: 'Generated.txt', content: '// Nothing to generate.' }];
  }

  // kept for backward-compat with any callers using the old name
  static generateMultiFileCode(elements, connections = [], language = 'Java', diagramType = 'class') {
    return this.splitIntoFiles(elements, connections, language, diagramType)
               .map(f => ({ name: f.filename, content: f.content }));
  }

  // ─────────────────────────────────────────────────────────
  // NORMALISATION
  // ─────────────────────────────────────────────────────────

  /**
   * normalizeModel(elements, connections)
   * ----------------------------------------
   * LAYMAN'S: Before generating code, this cleans up the diagram data —
   * fixing capitalization, stripping illegal characters from names, and
   * falling back to safe defaults for missing types. It's the "sanitizer"
   * that prevents bad diagram data from producing broken source code.
   *
   * TECHNICAL: Maps over all elements and their attributes/methods,
   * applying normalizeIdentifier() and normalizeType() to every name
   * and type field. Returns a new {elements, connections} object —
   * original data is never mutated.
   *
   * RELATIONSHIP: Called at the very top of generateCode() and
   * splitIntoFiles() before any language-specific dispatch occurs.
   */
  static normalizeModel(elements, connections) {
    // BUG FIX (root cause of mangled use case names):
    // normalizeIdentifier() strips ALL non-alphanumeric characters including
    // spaces. Correct for class identifiers ("bank account" -> "BankAccount")
    // but wrong for actor/usecase/lifeline elements whose names are human-readable
    // phrases like "Search docs full text". These must reach generateUseCaseHandler()
    // intact so they can be camelCased there. Fix: skip normalisation for
    // behavioural element types entirely.
    const BEHAVIOURAL_TYPES = new Set(['actor', 'usecase', 'lifeline']);

    const els = elements.map(el => {
      if (BEHAVIOURAL_TYPES.has(el.type)) {
        return el; // preserve original human-readable name
      }
      return {
        ...el,
        name:       this.normalizeIdentifier(el.name, 'class'),
        attributes: (el.attributes || []).map(a => ({
          ...a,
          name: this.normalizeIdentifier(a.name, 'variable'),
          type: this.normalizeType(a.type)
        })),
        methods: (el.methods || []).map(m => ({
          ...m,
          name:       this.normalizeIdentifier(m.name, 'method'),
          returnType: this.normalizeType(m.returnType)
        }))
      };
    });
    return { elements: els, connections };
  }

  static normalizeIdentifier(name, context = 'class') {
    if (!name || !name.trim()) return context === 'class' ? 'Unnamed' : 'unnamed';
    let n = name.replace(/[^a-zA-Z0-9_]/g, '');
    if (!n) return context === 'class' ? 'Unnamed' : 'unnamed';
    if (context === 'class') return n.charAt(0).toUpperCase() + n.slice(1);
    return n.charAt(0).toLowerCase() + n.slice(1);
  }

  static normalizeType(type) {
    if (!type || !type.trim()) return 'Object';
    const clean = type.replace(/[^a-zA-Z0-9<>,\s\[\]]/g, '').trim();
    return clean || 'Object';
  }

  // ─────────────────────────────────────────────────────────
  // CLASS DIAGRAM — DISPATCH
  // ─────────────────────────────────────────────────────────

  static generateClassDiagramCode(elements, connections, language) {
    switch (language) {
      case 'Java':       return this.generateJavaCode(elements, connections);
      case 'Python':     return this.generatePythonCode(elements, connections);
      case 'JavaScript': return this.generateJavaScriptCode(elements, connections);
      default:           return this.generateJavaCode(elements, connections);
    }
  }

  // ─────────────────────────────────────────────────────────
  // JAVA CODE GENERATION
  // ─────────────────────────────────────────────────────────

  /**
   * When generating a single-preview (all classes in one view), we still
   * emit individually valid classes separated by a clear comment banner
   * so the user can see exactly what each file should contain.
   */
  static generateJavaCode(elements, connections) {
    const classEls = elements.filter(e => ['class','interface','abstract'].includes(e.type));
    if (classEls.length === 0) return '// No classes to generate';

    if (classEls.length === 1) {
      return this.generateSingleClass(classEls[0], connections, classEls, 'Java');
    }

    // Multi-class preview: show each class as it would appear in its own file,
    // separated by a file-banner comment so it is clear what goes where.
    let code = '// ══════════════════════════════════════════════════════════\n';
    code += '// MULTI-CLASS PREVIEW\n';
    code += '// Each section below belongs in its own .java file.\n';
    code += '// Use "Generate Code" → download individual files for a\n';
    code += '// project that compiles directly.\n';
    code += '// ══════════════════════════════════════════════════════════\n\n';

    classEls.forEach((el, i) => {
      code += `// ── File: ${this.getFileName(el.name, 'Java')} ${'─'.repeat(Math.max(0, 50 - el.name.length))}\n\n`;
      code += this.generateSingleClass(el, connections, classEls, 'Java');
      if (i < classEls.length - 1) code += '\n\n\n';
    });
    return code;
  }

  static generateSingleClass(element, connections, allElements, language) {
    switch (language) {
      case 'Java':       return this.javaFileHeader()  + this.buildJavaClass(element, connections, allElements);
      case 'Python':     return this.pythonFileHeader() + this.buildPythonClass(element, connections, allElements);
      case 'JavaScript': return this.buildJavaScriptClass(element, connections, allElements);
      default:           return this.javaFileHeader()  + this.buildJavaClass(element, connections, allElements);
    }
  }

  static javaFileHeader() {
    return (
      'package com.example.model;\n\n' +
      'import java.util.*;\n' +
      'import java.time.*;\n\n'
    );
  }

  static buildJavaClass(element, connections, allElements) {
    const isInterface = element.type === 'interface';
    const isAbstract  = element.type === 'abstract';

    // ── Resolve inheritance / realisation ──────────────────
    const extendsConn    = connections.find(c => c.from === element.id && c.type === 'inheritance');
    const realizConns    = connections.filter(c => c.from === element.id && c.type === 'realization');
    const parentEl       = extendsConn ? allElements.find(e => e.id === extendsConn.to) : null;
    const interfaceNames = realizConns
      .map(c => allElements.find(e => e.id === c.to)?.name)
      .filter(Boolean);

    let code = '';

    // ── Javadoc ────────────────────────────────────────────
    code += `/**\n * ${isInterface ? 'Interface' : isAbstract ? 'Abstract class' : 'Class'}: ${element.name}\n`;
    code += ` * Auto-generated from UML diagram.\n`;
    if (parentEl) code += ` * @extends ${parentEl.name}\n`;
    code += ' */\n';

    // ── Declaration ────────────────────────────────────────
    let decl = `public ${isAbstract ? 'abstract ' : ''}${isInterface ? 'interface' : 'class'} ${element.name}`;
    if (!isInterface) {
      if (parentEl)              decl += ` extends ${parentEl.name}`;
      if (interfaceNames.length) decl += ` implements ${interfaceNames.join(', ')}`;
    } else if (interfaceNames.length) {
      decl += ` extends ${interfaceNames.join(', ')}`;
    }
    code += decl + ' {\n\n';

    const attrs   = element.attributes || [];
    const methods = element.methods    || [];

    // ── Field declarations ─────────────────────────────────
    if (attrs.length > 0) {
      code += '    // Fields \n';
      attrs.forEach(a => {
        const vis   = a.visibility || 'private';
        const jType = CodeGenerator.mapType(a.type || 'Object', 'Java');
        const mods  = `${a.isStatic ? 'static ' : ''}${a.isFinal ? 'final ' : ''}`;
        code += `    ${vis} ${mods}${jType} ${a.name};\n`;
      });
      code += '\n';
    }

    // ── Relationship fields (composition / aggregation / association) ──
    const relFields = this.buildJavaRelationshipFields(element, connections, allElements);
    if (relFields) {
      code += '    //  Relationship fields \n';
      code += relFields + '\n';
    }

    // ── Constructor ────────────────────────────────────────
    if (!isInterface) {
      code += '    //  Constructor \n';

      // Collect all parameters that should go in the constructor
      const initAttrs = attrs.filter(a => !a.isStatic && !a.isFinal);

      if (initAttrs.length > 0) {
        // Parameterised constructor
        const params = initAttrs
          .map(a => `${CodeGenerator.mapType(a.type || 'Object', 'Java')} ${a.name}`)
          .join(', ');
        code += `    public ${element.name}(${params}) {\n`;
        if (parentEl) code += '        super();\n';
        initAttrs.forEach(a => {
          code += `        this.${a.name} = ${a.name};\n`;
        });
        code += '    }\n\n';

        // No-arg constructor (always useful, required by many frameworks)
        code += `    /** No-arg constructor (required by some frameworks). */\n`;
        code += `    public ${element.name}() {\n`;
        if (parentEl) code += '        super();\n';
        initAttrs.forEach(a => {
          const jType = CodeGenerator.mapType(a.type || 'Object', 'Java');
          const defVal = CodeGenerator.getDefaultValue(jType, 'Java');
          code += `        this.${a.name} = ${defVal};\n`;
        });
        code += '    }\n\n';
      } else {
        code += `    public ${element.name}() {\n`;
        if (parentEl) code += '        super();\n';
        code += '    }\n\n';
      }
    }

    // ── Methods ────────────────────────────────────────────
    if (methods.length > 0) {
      code += '    // Methods\n';
      methods.forEach(m => {
        const vis      = m.visibility || 'public';
        const retType  = CodeGenerator.mapType(m.returnType || 'void', 'Java');
        const mods     = `${m.isStatic ? 'static ' : ''}${m.isAbstract ? 'abstract ' : ''}`;
        const params   = this.buildJavaParams(m.parameters);

        code += `    ${vis} ${mods}${retType} ${m.name}(${params})`;

        if (isInterface || m.isAbstract) {
          code += ';\n\n';
        } else {
          code += ' {\n';
          if (retType !== 'void') {
            const defVal = CodeGenerator.getDefaultValue(retType, 'Java');
            code += `        return ${defVal};\n`;
          }
          code += '    }\n\n';
        }
      });
    }

    // ── Getters & Setters ──────────────────────────────────
    // Skip generating a getter/setter when a method with the same name already
    // exists in the diagram (e.g. user declared getBalance() explicitly).
    if (attrs.length > 0 && !isInterface) {
      const existingNames = new Set(methods.map(m => m.name.toLowerCase()));
      code += '    // Getters & Setters \n';
      attrs.forEach(a => {
        const jType = CodeGenerator.mapType(a.type || 'Object', 'Java');
        const cap   = a.name.charAt(0).toUpperCase() + a.name.slice(1);
        if (!existingNames.has(`get${cap}`.toLowerCase())) {
          code += `    public ${jType} get${cap}() {\n        return this.${a.name};\n    }\n\n`;
        }
        if (!a.isFinal && !existingNames.has(`set${cap}`.toLowerCase())) {
          code += `    public void set${cap}(${jType} ${a.name}) {\n        this.${a.name} = ${a.name};\n    }\n\n`;
        }
      });
    }

    // ── toString ───────────────────────────────────────────
    if (!isInterface && attrs.length > 0) {
      code += '    //  toString \n';
      code += '    @Override\n    public String toString() {\n';
      const parts = attrs.map(a => `"${a.name}=" + ${a.name}`).join(' + ", " + ');
      code += `        return "${element.name}{" + ${parts} + "}";\n`;
      code += '    }\n\n';
    }

    code += '}\n';
    return code;
  }

  /** Parse a raw parameter string OR array into a clean Java param list */
  static buildJavaParams(parameters) {
    if (!parameters) return '';
    if (Array.isArray(parameters)) {
      return parameters
        .map(p => {
          if (typeof p === 'string') return p.trim();
          const t = CodeGenerator.mapType(p.type || 'Object', 'Java');
          return `${t} ${p.name || 'param'}`;
        })
        .join(', ');
    }
    if (typeof parameters === 'string' && parameters.trim()) return parameters.trim();
    return '';
  }

  static buildJavaRelationshipFields(element, connections, allElements) {
    let out = '';
    connections
      .filter(c => c.from === element.id &&
                   ['composition','aggregation','association'].includes(c.type))
      .forEach(c => {
        const target = allElements.find(e => e.id === c.to);
        if (!target) return;
        const many = (c.toMultiplicity || c.multiplicity || '1').includes('*');
        if (many) {
          out += `    private List<${target.name}> ${this.pluralize(target.name.toLowerCase())} = new ArrayList<>();\n`;
        } else {
          out += `    private ${target.name} ${target.name.toLowerCase()} = null;\n`;
        }
      });
    return out;
  }

  // ─────────────────────────────────────────────────────────
  // PYTHON CODE GENERATION
  // ─────────────────────────────────────────────────────────

  static pythonFileHeader() {
    return (
      'from __future__ import annotations\n' +
      'from typing import List, Optional, Dict, Set, Any\n' +
      'from datetime import datetime\n' +
      'from abc import ABC, abstractmethod\n\n\n'
    );
  }

  static generatePythonCode(elements, connections) {
    const classEls = elements.filter(e => ['class','interface','abstract'].includes(e.type));
    if (classEls.length === 0) return '# No classes to generate\n';

    let code = this.pythonFileHeader();

    // Topological ordering: parents before children
    const ordered = this.topoSort(classEls, connections);
    ordered.forEach(el => {
      code += this.buildPythonClass(el, connections, classEls);
      code += '\n\n';
    });

    // Demo block — lets the user just run `python file.py` and see output
    code += '\n# Demo \n';
    code += 'if __name__ == "__main__":\n';
    ordered.filter(e => e.type === 'class').forEach(el => {
      const varName = el.name.toLowerCase();
      code += `    ${varName} = ${el.name}()\n`;
      code += `    print(${varName})\n`;
    });
    if (!ordered.some(e => e.type === 'class')) code += '    pass\n';

    return code;
  }

  static buildPythonClass(element, connections, allElements) {
    const isAbstract  = element.type === 'abstract';
    const isInterface = element.type === 'interface';

    const extendsConn = connections.find(c => c.from === element.id && c.type === 'inheritance');
    const parentEl    = extendsConn ? allElements.find(e => e.id === extendsConn.to) : null;

    let bases = [];
    if (isAbstract || isInterface) bases.push('ABC');
    else if (parentEl)             bases.push(parentEl.name);

    let code = '';

    // ── Class declaration ──────────────────────────────────
    code += `class ${element.name}`;
    if (bases.length) code += `(${bases.join(', ')})`;
    code += ':\n';

    code += '    """\n';
    code += `    ${isInterface ? 'Interface' : isAbstract ? 'Abstract class' : 'Class'}: ${element.name}\n`;
    code += '    Auto-generated from UML diagram.\n';
    code += '    """\n\n';

    const attrs   = element.attributes || [];
    const methods = element.methods    || [];

    // ── __init__ ───────────────────────────────────────────
    const initAttrs = attrs.filter(a => !a.isStatic);

    if (initAttrs.length > 0) {
      // Build typed signature
      const paramParts = initAttrs.map(a => {
        const pyType = CodeGenerator.mapType(a.type || 'Object', 'Python');
        const defVal = CodeGenerator.getDefaultValue(pyType, 'Python');
        return `${a.name}: ${pyType} = ${defVal}`;
      });
      code += `    def __init__(self, ${paramParts.join(', ')}) -> None:\n`;
    } else {
      code += '    def __init__(self) -> None:\n';
    }

    if (parentEl) code += '        super().__init__()\n';

    if (initAttrs.length > 0) {
      initAttrs.forEach(a => {
        const pyType = CodeGenerator.mapType(a.type || 'Object', 'Python');
        code += `        self.${a.name}: ${pyType} = ${a.name}\n`;
      });
    } else {
      code += '        pass\n';
    }

    // Relationship fields inside __init__
    const relFields = this.buildPythonRelationshipFields(element, connections, allElements);
    if (relFields) code += relFields;

    code += '\n';

    // ── Abstract / concrete methods ────────────────────────
    methods.forEach(m => {
      const retType = CodeGenerator.mapType(m.returnType || 'None', 'Python');
      const params  = this.buildPythonParams(m.parameters);
      const paramStr = params ? `, ${params}` : '';

      if (isInterface || isAbstract || m.isAbstract) {
        code += '    @abstractmethod\n';
        code += `    def ${m.name}(self${paramStr}) -> ${retType}:\n`;
        code += `        """Abstract: ${m.name}"""\n`;
        code += '        ...\n\n';
      } else {
        code += `    def ${m.name}(self${paramStr}) -> ${retType}:\n`;
        code += `        """${m.name} — implement logic here."""\n`;
        if (retType === 'None' || retType === 'none') {
          code += '        pass\n\n';
        } else {
          const defVal = CodeGenerator.getDefaultValue(retType, 'Python');
          code += `        return ${defVal}\n\n`;
        }
      }
    });

    // ── __repr__ ───────────────────────────────────────────
    if (!isInterface) {
      code += '    def __repr__(self) -> str:\n';
      if (initAttrs.length > 0) {
        const parts = initAttrs.map(a => `${a.name}={self.${a.name}!r}`).join(', ');
        code += `        return f"${element.name}(${parts})"\n`;
      } else {
        code += `        return f"${element.name}()"\n`;
      }
      code += '\n';
    }

    return code;
  }

  /**
   * Strip Java/C-style type prefixes for Python params.
   * "double amount, String name" → "amount, name"
   */
  static buildPythonParams(parameters) {
    if (!parameters) return '';
    if (Array.isArray(parameters)) {
      return parameters
        .map(p => {
          if (typeof p === 'string') return CodeGenerator.stripTypePrefix(p);
          const t = CodeGenerator.mapType(p.type || 'Any', 'Python');
          return `${p.name || 'param'}: ${t}`;
        })
        .join(', ');
    }
    if (typeof parameters === 'string' && parameters.trim()) {
      return parameters.split(',')
        .map(p => CodeGenerator.stripTypePrefix(p.trim()))
        .filter(Boolean)
        .join(', ');
    }
    return '';
  }

  /**
   * Strip a leading Java/C-style type word from "type name" → "name".
   * "double amount" → "amount", "String name" → "name"
   */
  static stripTypePrefix(param) {
    if (!param) return '';
    const parts = param.trim().split(/\s+/);
    const primitives = new Set(['int','double','float','boolean','long','char','byte','short',
                                 'string','number','any','void','object']);
    if (parts.length >= 2) {
      const first = parts[0];
      if (primitives.has(first.toLowerCase()) || /^[A-Z]/.test(first)) {
        return parts.slice(1).join(' ');
      }
    }
    return param.trim();
  }

  static buildPythonRelationshipFields(element, connections, allElements) {
    let out = '';
    connections
      .filter(c => c.from === element.id &&
                   ['composition','aggregation','association'].includes(c.type))
      .forEach(c => {
        const target = allElements.find(e => e.id === c.to);
        if (!target) return;
        const many = (c.toMultiplicity || c.multiplicity || '1').includes('*');
        const fieldName = many
          ? this.pluralize(target.name.toLowerCase())
          : target.name.toLowerCase();
        const typeHint = many ? `List[${target.name}]` : `Optional[${target.name}]`;
        const defVal   = many ? '[]' : 'None';
        out += `        self.${fieldName}: ${typeHint} = ${defVal}\n`;
      });
    return out;
  }

  // ─────────────────────────────────────────────────────────
  // JAVASCRIPT CODE GENERATION
  // ─────────────────────────────────────────────────────────

  static generateJavaScriptCode(elements, connections) {
    const classEls = elements.filter(e => ['class','interface','abstract'].includes(e.type));
    if (classEls.length === 0) return '// No classes to generate\n';

    let code = '// Auto-generated from UML Class Diagram\n// ES2022 module — run with Node.js 18+\n\n';

    const ordered = this.topoSort(classEls, connections);
    ordered.forEach(el => {
      code += this.buildJavaScriptClass(el, connections, classEls);
      code += '\n\n';
    });

    // Demo block
    code += '// ── Demo (Node.js) ──────────────────────────────────────────\n';
    code += '// Uncomment and run: node <filename>.js\n';
    ordered.filter(e => e.type === 'class').forEach(el => {
      const varName = el.name.charAt(0).toLowerCase() + el.name.slice(1);
      code += `// const ${varName} = new ${el.name}();\n`;
      code += `// console.log(${varName}.toString());\n`;
    });

    return code;
  }

  static buildJavaScriptClass(element, connections, allElements) {
    const isInterface = element.type === 'interface';
    const isAbstract  = element.type === 'abstract';

    const extendsConn = connections.find(c => c.from === element.id && c.type === 'inheritance');
    const parentEl    = extendsConn ? allElements.find(e => e.id === extendsConn.to) : null;

    const attrs   = element.attributes || [];
    const methods = element.methods    || [];

    let code = '';

    // ── JSDoc ──────────────────────────────────────────────
    code += '/**\n';
    code += ` * @class ${element.name}\n`;
    if (isAbstract)  code += ' * @abstract\n';
    if (isInterface) code += ' * @interface\n';
    if (parentEl)    code += ` * @extends ${parentEl.name}\n`;
    attrs.forEach(a => {
      const jsType = CodeGenerator.mapType(a.type || 'any', 'JavaScript');
      code += ` * @property {${jsType}} ${a.name}\n`;
    });
    code += ' */\n';

    // ── Class declaration ──────────────────────────────────
    code += `class ${element.name}`;
    if (parentEl) code += ` extends ${parentEl.name}`;
    code += ' {\n\n';

    // ── Constructor ────────────────────────────────────────
    if (attrs.length > 0) {
      const initAttrs = attrs.filter(a => !a.isStatic);
      const params = initAttrs.map(a => a.name).join(', ');
      const hasDefaults = initAttrs.length > 0;

      if (hasDefaults) {
        const paramWithDefaults = initAttrs.map(a => {
          const jsType = CodeGenerator.mapType(a.type || 'any', 'JavaScript');
          const defVal = CodeGenerator.getDefaultValue(jsType, 'JavaScript') || 'null';
          return `${a.name} = ${defVal}`;
        }).join(', ');
        code += `    constructor(${paramWithDefaults}) {\n`;
      } else {
        code += '    constructor() {\n';
      }

      if (parentEl) code += '        super();\n';

      if (isAbstract) {
        code += `        if (new.target === ${element.name}) {\n`;
        code += `            throw new Error('Cannot instantiate abstract class ${element.name}');\n`;
        code += '        }\n';
      }

      initAttrs.forEach(a => {
        code += `        /** @type {${CodeGenerator.mapType(a.type || 'any', 'JavaScript')}} */\n`;
        code += `        this.${a.name} = ${a.name};\n`;
      });
    } else {
      code += '    constructor() {\n';
      if (parentEl) code += '        super();\n';
      if (isAbstract) {
        code += `        if (new.target === ${element.name}) {\n`;
        code += `            throw new Error('Cannot instantiate abstract class ${element.name}');\n`;
        code += '        }\n';
      }
    }

    // Relationship fields
    const relFields = this.buildJavaScriptRelationshipFields(element, connections, allElements);
    if (relFields) code += relFields;

    code += '    }\n\n';

    // ── Methods ────────────────────────────────────────────
    methods.forEach(m => {
      const retType  = CodeGenerator.mapType(m.returnType || 'void', 'JavaScript');
      const params   = this.buildJavaScriptParams(m.parameters);
      const isStaticM = m.isStatic ? 'static ' : '';

      code += `    /**\n     * @returns {${retType}}\n     */\n`;
      code += `    ${isStaticM}${m.name}(${params}) {\n`;

      if (isInterface) {
        code += `        throw new Error('${m.name}() must be implemented by subclass');\n`;
      } else if (m.isAbstract) {
        code += `        throw new Error('Abstract method ${m.name}() must be overridden');\n`;
      } else if (retType !== 'void') {
        const defVal = CodeGenerator.getDefaultValue(retType, 'JavaScript') || 'null';
        code += `        return ${defVal};\n`;
      }
      code += '    }\n\n';
    });

    // ── Getters / Setters ──────────────────────────────────
    if (attrs.length > 0) {
      const existingMethods = new Set(methods.map(m => m.name.toLowerCase()));
      const instanceAttrs = attrs.filter(a => !a.isStatic);
      instanceAttrs.forEach(a => {
        const cap = a.name.charAt(0).toUpperCase() + a.name.slice(1);
        if (!existingMethods.has(`get${cap}`.toLowerCase())) {
          code += `    get${cap}() { return this.${a.name}; }\n`;
        }
        if (!a.isFinal && !existingMethods.has(`set${cap}`.toLowerCase())) {
          code += `    set${cap}(value) { this.${a.name} = value; }\n`;
        }
        code += '\n';
      });
    }

    // ── toString ───────────────────────────────────────────
    if (!isInterface) {
      code += '    toString() {\n';
      if (attrs.length > 0) {
        const parts = attrs
          .filter(a => !a.isStatic)
          .map(a => `${a.name}: \${this.${a.name}}`)
          .join(', ');
        code += `        return \`${element.name} { ${parts} }\`;\n`;
      } else {
        code += `        return '${element.name}';\n`;
      }
      code += '    }\n\n';
    }

    code += '}\n\n';
    code += `export default ${element.name};`;
    return code;
  }

  static buildJavaScriptParams(parameters) {
    if (!parameters) return '';
    if (Array.isArray(parameters)) {
      return parameters
        .map(p => (typeof p === 'string'
          ? CodeGenerator.stripTypePrefix(p)
          : (p.name || 'param')))
        .join(', ');
    }
    if (typeof parameters === 'string' && parameters.trim()) {
      return parameters.split(',')
        .map(p => CodeGenerator.stripTypePrefix(p.trim()))
        .filter(Boolean)
        .join(', ');
    }
    return '';
  }

  static buildJavaScriptRelationshipFields(element, connections, allElements) {
    let out = '';
    connections
      .filter(c => c.from === element.id &&
                   ['composition','aggregation','association'].includes(c.type))
      .forEach(c => {
        const target = allElements.find(e => e.id === c.to);
        if (!target) return;
        const many = (c.toMultiplicity || c.multiplicity || '1').includes('*');
        if (many) {
          out += `        /** @type {${target.name}[]} */\n`;
          out += `        this.${this.pluralize(target.name.toLowerCase())} = [];\n`;
        } else {
          out += `        /** @type {${target.name}|null} */\n`;
          out += `        this.${target.name.toLowerCase()} = null;\n`;
        }
      });
    return out;
  }

  // ─────────────────────────────────────────────────────────
  // USE-CASE DIAGRAM
  // ─────────────────────────────────────────────────────────

  static generateUseCaseDiagramCode(elements, connections, language) {
    let code = '';
    code += this.generateUseCaseHandler(elements, connections, language);
    return code;
  }

  static generateUseCaseHandler(elements, connections, language) {
    const usecases = elements.filter(e => e.type === 'usecase');
    if (usecases.length === 0) {
      return language === 'Python'
        ? '# No use cases defined\npass\n'
        : '// No use cases defined\n';
    }

    // BUG FIX: normalizeIdentifier() strips ALL non-alphanumeric characters before
    // capitalising, so "Search docs full text" collapsed to "Searchdocsfulltext".
    // Use-case names are multi-word phrases — they need word-boundary camelCase,
    // not character stripping. toCamelCase() splits on spaces/special chars,
    // capitalises each word, and joins — producing "searchDocsFullText" which is
    // readable and follows standard Java/JS naming conventions.
    const toCamelCase = (phrase) => {
      const words = phrase.trim().split(/[\s_\-]+/);
      return words
        .map((w, i) => {
          // Strip any remaining non-alphanumeric characters from each word
          const clean = w.replace(/[^a-zA-Z0-9]/g, '');
          if (!clean) return '';
          return i === 0
            ? clean.charAt(0).toLowerCase() + clean.slice(1)
            : clean.charAt(0).toUpperCase() + clean.slice(1);
        })
        .join('');
    };

    let code = '';

    if (language === 'Java') {
      code += 'package com.example.usecases;\n\n';
      code += '/**\n * Auto-generated Use Case Handler.\n */\n';
      code += 'public class UseCaseHandler {\n\n';
      usecases.forEach(uc => {
        const m  = toCamelCase(uc.name);
        const mC = m.charAt(0).toUpperCase() + m.slice(1);
        code += `    /**\n     * Execute use case: ${uc.name}\n     */\n`;
        code += `    public boolean execute${mC}() {\n`;
        code += `        // TODO: implement "${uc.name}"\n`;
        code += '        return true;\n';
        code += '    }\n\n';
      });
      code += '    // ── Entry point ───────────────────────────────────\n';
      code += '    public static void main(String[] args) {\n';
      code += '        UseCaseHandler handler = new UseCaseHandler();\n';
      usecases.forEach(uc => {
        const m  = toCamelCase(uc.name);
        const mC = m.charAt(0).toUpperCase() + m.slice(1);
        code += `        System.out.println("${uc.name}: " + handler.execute${mC}());\n`;
      });
      code += '    }\n';
      code += '}\n';

    } else if (language === 'Python') {
      code += 'class UseCaseHandler:\n';
      code += '    """Auto-generated Use Case Handler."""\n\n';
      usecases.forEach(uc => {
        // Python convention: snake_case
        const m = uc.name.trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
        code += `    def execute_${m}(self) -> bool:\n`;
        code += `        """Execute use case: ${uc.name}\"\"\"\n`;
        code += `        # TODO: implement "${uc.name}"\n`;
        code += '        return True\n\n';
      });
      code += '\nif __name__ == "__main__":\n';
      code += '    handler = UseCaseHandler()\n';
      usecases.forEach(uc => {
        const m = uc.name.trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
        code += `    print("${uc.name}:", handler.execute_${m}())\n`;
      });

    } else if (language === 'JavaScript') {
      code += '/**\n * Auto-generated Use Case Handler.\n */\n';
      code += 'class UseCaseHandler {\n\n';
      usecases.forEach(uc => {
        const m  = toCamelCase(uc.name);
        const mC = m.charAt(0).toUpperCase() + m.slice(1);
        code += `    /** Execute use case: ${uc.name} */\n`;
        code += `    execute${mC}() {\n`;
        code += `        // TODO: implement "${uc.name}"\n`;
        code += '        return true;\n';
        code += '    }\n\n';
      });
      code += '}\n\n';
      code += 'export default UseCaseHandler;\n\n';
      code += '// ── Demo ──────────────────────────────────────────────\n';
      code += '// const h = new UseCaseHandler();\n';
      usecases.forEach(uc => {
        const m  = toCamelCase(uc.name);
        const mC = m.charAt(0).toUpperCase() + m.slice(1);
        code += `// console.log("${uc.name}:", h.execute${mC}());\n`;
      });
    }

    return code;
  }

  static generateUseCaseDocumentation(elements, connections) {
    let doc = '# Use Case Diagram Documentation\n\n';
    doc += '## Actors\n\n';
    elements.filter(e => e.type === 'actor').forEach(actor => {
      // Only show direct associations (solid lines) for actor→use case
      const directUcNames = connections
        .filter(c => (c.from === actor.id || c.to === actor.id) && c.type === 'association')
        .map(c => {
          const ucId = c.from === actor.id ? c.to : c.from;
          return elements.find(e => e.id === ucId)?.name || '';
        })
        .filter(Boolean);
      doc += `### ${actor.name}\n- **Use Cases**: ${directUcNames.join(', ') || 'none'}\n\n`;
    });

    doc += '## Use Cases\n\n';
    elements.filter(e => e.type === 'usecase').forEach(uc => {
      doc += `### ${uc.name}\n`;
      doc += `- **Description**: ${uc.description || 'No description provided'}\n`;

      // Actors directly associated
      const actorNames = connections
        .filter(c => (c.from === uc.id || c.to === uc.id) && c.type === 'association')
        .map(c => {
          const actorId = c.from === uc.id ? c.to : c.from;
          return elements.find(e => e.id === actorId && e.type === 'actor')?.name || '';
        })
        .filter(Boolean);
      doc += `- **Actors**: ${actorNames.join(', ') || 'none'}\n`;

      // BUG FIX: Also list <<include>> and <<extend>> relationships so the
      // documentation reflects the full diagram structure, not just direct actor ties.
      const includes = connections
        .filter(c => c.from === uc.id && (c.type === 'include' || c.label?.includes('include')))
        .map(c => elements.find(e => e.id === c.to)?.name || '')
        .filter(Boolean);
      if (includes.length) doc += `- **Includes**: ${includes.join(', ')}\n`;

      const extendedBy = connections
        .filter(c => c.to === uc.id && (c.type === 'extend' || c.label?.includes('extend')))
        .map(c => elements.find(e => e.id === c.from)?.name || '')
        .filter(Boolean);
      if (extendedBy.length) doc += `- **Extended by**: ${extendedBy.join(', ')}\n`;

      const includedBy = connections
        .filter(c => c.to === uc.id && (c.type === 'include' || c.label?.includes('include')))
        .map(c => elements.find(e => e.id === c.from)?.name || '')
        .filter(Boolean);
      if (includedBy.length) doc += `- **Included by**: ${includedBy.join(', ')}\n`;

      doc += '\n';
    });
    return doc;
  }

  // ─────────────────────────────────────────────────────────
  // SEQUENCE DIAGRAM
  // ─────────────────────────────────────────────────────────

  static generateSequenceDiagramCode(elements, connections, language) {
    return this.generateSequenceCode(elements, connections, language);
  }

  static generateSequenceCode(elements, connections, language) {
    const lifelines = elements.filter(e => e.type === 'lifeline');
    if (lifelines.length === 0) {
      return language === 'Python' ? '# No lifelines defined\npass\n' : '// No lifelines defined\n';
    }

    let code = '';

    if (language === 'Java') {
      code += 'package com.example.sequences;\n\n';
      code += '/**\n * Auto-generated Sequence Handler.\n */\n';
      code += 'public class SequenceHandler {\n\n';
      lifelines.forEach(ll => {
        const msgs = connections.filter(c => c.from === ll.id);
        msgs.forEach(msg => {
          const mName = this.normalizeIdentifier(msg.label || 'interact', 'method');
          const toEl  = elements.find(e => e.id === msg.to);
          code += `    /** Message from ${ll.name} → ${toEl?.name || '?'}: ${msg.label || ''} */\n`;
          code += `    public void ${mName}() {\n`;
          code += `        System.out.println("${ll.name} → ${toEl?.name || '?'}: ${msg.label || mName}");\n`;
          code += '    }\n\n';
        });
      });
      // main that runs all messages in order
      code += '    public static void main(String[] args) {\n';
      code += '        SequenceHandler seq = new SequenceHandler();\n';
      lifelines.forEach(ll => {
        const msgs = connections.filter(c => c.from === ll.id);
        msgs.forEach(msg => {
          const mName = this.normalizeIdentifier(msg.label || 'interact', 'method');
          code += `        seq.${mName}();\n`;
        });
      });
      code += '    }\n';
      code += '}\n';

    } else if (language === 'Python') {
      code += 'class SequenceHandler:\n';
      code += '    """Auto-generated Sequence Handler."""\n\n';
      lifelines.forEach(ll => {
        const msgs = connections.filter(c => c.from === ll.id);
        msgs.forEach(msg => {
          const mName = this.normalizeIdentifier(msg.label || 'interact', 'method');
          const toEl  = elements.find(e => e.id === msg.to);
          code += `    def ${mName}(self) -> None:\n`;
          code += `        """Message from ${ll.name} to ${toEl?.name || '?'}"""\n`;
          code += `        print(f"${ll.name} → ${toEl?.name || '?'}: ${msg.label || mName}")\n\n`;
        });
      });
      code += '\nif __name__ == "__main__":\n';
      code += '    seq = SequenceHandler()\n';
      lifelines.forEach(ll => {
        connections.filter(c => c.from === ll.id).forEach(msg => {
          const mName = this.normalizeIdentifier(msg.label || 'interact', 'method');
          code += `    seq.${mName}()\n`;
        });
      });

    } else if (language === 'JavaScript') {
      code += '/** Auto-generated Sequence Handler. */\n';
      code += 'class SequenceHandler {\n\n';
      lifelines.forEach(ll => {
        const msgs = connections.filter(c => c.from === ll.id);
        msgs.forEach(msg => {
          const mName = this.normalizeIdentifier(msg.label || 'interact', 'method');
          const toEl  = elements.find(e => e.id === msg.to);
          code += `    /** ${ll.name} → ${toEl?.name || '?'}: ${msg.label || ''} */\n`;
          code += `    ${mName}() {\n`;
          code += `        console.log("${ll.name} → ${toEl?.name || '?'}: ${msg.label || mName}");\n`;
          code += '    }\n\n';
        });
      });
      code += '}\n\n';
      code += 'export default SequenceHandler;\n\n';
      code += '// ── Demo ──────────────────────────────────────────────\n';
      code += '// const seq = new SequenceHandler();\n';
      lifelines.forEach(ll => {
        connections.filter(c => c.from === ll.id).forEach(msg => {
          const mName = this.normalizeIdentifier(msg.label || 'interact', 'method');
          code += `// seq.${mName}();\n`;
        });
      });
    }

    return code;
  }

  static generateSequenceDocumentation(elements, connections) {
    let doc = '# Sequence Diagram Documentation\n\n## Participants\n\n';
    elements.filter(e => e.type === 'lifeline').forEach(ll => {
      doc += `### ${ll.name}\n`;
      const out = connections.filter(c => c.from === ll.id);
      const inn = connections.filter(c => c.to === ll.id);
      if (out.length) doc += `- **Sends**: ${out.map(c => c.label || 'message').join(', ')}\n`;
      if (inn.length) doc += `- **Receives**: ${inn.map(c => c.label || 'message').join(', ')}\n`;
      doc += '\n';
    });
    doc += '## Message Flow\n\n';
    connections.forEach((c, i) => {
      const src = elements.find(e => e.id === c.from);
      const tgt = elements.find(e => e.id === c.to);
      doc += `${i + 1}. **${src?.name || '?'}** → **${tgt?.name || '?'}**: ${c.label || 'no label'}\n`;
    });
    return doc;
  }

  // ─────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────

  /**
   * topoSort(elements, connections)
   * ---------------------------------
   * LAYMAN'S: When a child class extends a parent, the parent's code must
   * appear first in the file — otherwise the compiler complains it doesn't
   * know what the parent is yet. This sorts the classes so parents always
   * come before their children.
   *
   * TECHNICAL: Depth-first recursive traversal following 'inheritance'
   * connection edges. Uses a visited Set to prevent double-emission for
   * shared ancestors. Returns a topologically ordered copy of elements.
   *
   * RELATIONSHIP: Called by generatePythonCode() and generateJavaScriptCode()
   * before emitting class bodies. Java doesn't require it (each class is its
   * own file) but uses it for consistency in multi-class preview mode.
   */
  static topoSort(elements, connections) {
    const visited = new Set();
    const result  = [];

    const visit = (el) => {
      if (visited.has(el.id)) return;
      visited.add(el.id);
      // Visit parent first
      const parentConn = connections.find(c => c.from === el.id && c.type === 'inheritance');
      if (parentConn) {
        const parent = elements.find(e => e.id === parentConn.to);
        if (parent) visit(parent);
      }
      result.push(el);
    };

    elements.forEach(el => visit(el));
    return result;
  }

  /**
   * pluralize(word)
   * ---------------
   * LAYMAN'S: When a class "owns many Orders", the field should be called
   * `orders`, not `order`. This adds the right plural suffix (s, es, ies).
   *
   * TECHNICAL: Applies simple English suffix rules in priority order:
   * words ending in s/x/z → +es, words ending in consonant+y → -y+ies,
   * all others → +s. Not a full morphological engine — handles the common
   * cases that appear in typical class names.
   *
   * RELATIONSHIP: Called by buildJavaRelationshipFields(),
   * buildPythonRelationshipFields(), and buildJavaScriptRelationshipFields()
   * whenever a "many" multiplicity (* or 1..*) is detected on a connection.
   */
  static pluralize(word) {
    if (!word) return 'items';
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z')) return word + 'es';
    if (word.endsWith('y') && !/[aeiou]y$/.test(word))                   return word.slice(0, -1) + 'ies';
    return word + 's';
  }

  /**
   * getFileName(className, language)
   * ----------------------------------
   * LAYMAN'S: Every language has a naming convention for its files.
   * Java uses PascalCase.java, Python uses snake_case.py, JS uses
   * PascalCase.js. This makes sure the generated file gets the right name.
   *
   * TECHNICAL: Simple switch on language string. Python paths go through
   * toSnakeCase() first; others use the class name directly. Unknown
   * languages fall back to .txt so the file is always downloadable.
   *
   * RELATIONSHIP: Called by splitIntoFiles() when building the filename
   * field of each {filename, content} entry in the returned array.
   */
  static getFileName(className, language) {
    switch (language) {
      case 'Java':       return `${className}.java`;
      case 'Python':     return `${this.toSnakeCase(className)}.py`;
      case 'JavaScript': return `${className}.js`;
      default:           return `${className}.txt`;
    }
  }

  static toSnakeCase(name) {
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * formatCode(code, language)
   * ----------------------------
   * LAYMAN'S: A final polish step — collapses triple blank lines into
   * double, strips trailing spaces from every line, and trims the whole
   * file so there's no leading/trailing whitespace. Makes the output
   * look like a human wrote it.
   *
   * TECHNICAL: Two regex passes followed by a split-map-join for
   * per-line trimEnd(). The language parameter is accepted for future
   * language-specific formatting hooks (currently unused).
   *
   * RELATIONSHIP: Called as the last step inside generateCode() before
   * the string is returned to the caller.
   */
  static formatCode(code, language) {
    let out = code.replace(/\n{3,}/g, '\n\n');
    out = out.split('\n').map(l => l.trimEnd()).join('\n');
    return out.trim() + '\n';
  }
}

export default CodeGenerator;