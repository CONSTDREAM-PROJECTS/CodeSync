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
      // Documentation file
      files.push({ filename: 'SequenceFlow.md',
                   content: this.generateSequenceDocumentation(els, conns) });

      // One combined file for all languages — consistent with Python and JS behaviour.
      // For Java we strip the redundant "public" modifier from non-entry classes so
      // all classes can coexist in a single .java file (only one public class per file
      // is a Java restriction, not a one-class-per-file requirement).
      if (language === 'Java') {
        const fullCode = this.generateSequenceCode(els, conns, language);
        // Keep SequenceRunner public; demote all other "public class" to package-private
        const combined = fullCode.replace(/public class (\w+)/g, (match, className) => {
          if (className === 'SequenceRunner') return match;
          return `class ${className}`;
        });
        files.push({ filename: 'SequenceHandler.java', content: combined });
      } else {
        // Python and JS: one combined file is idiomatic
        files.push({ filename: this.getFileName('sequence_handler', language),
                     content: this.generateSequenceCode(els, conns, language) });
      }
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
    return this.generateUseCaseHandler(elements, connections, language);
  }

  /**
   * generateUseCaseHandler(elements, connections, language)
   * ─────────────────────────────────────────────────────────
   * WHAT CHANGED (v2):
   *   Old: emitted one flat UseCaseHandler class with every use case as a
   *        method stub. Actors, associations, and include/extend relationships
   *        were completely ignored — the output had no access control, no
   *        delegation, and no wiring between related use cases.
   *
   *   New: emits one class PER ACTOR containing only the use cases that actor
   *        is directly associated with. Include relationships are wired as
   *        internal method calls (mandatory delegation). Extend relationships
   *        are wired as guarded optional calls. A shared UseCaseHandler base
   *        class holds use cases reachable only via include/extend (not directly
   *        tied to any actor) so nothing is lost.
   *
   * ALGORITHM:
   *   1. Build a map: actorId → Set<useCaseId> from association connections.
   *   2. Build include map:  ucId → [ucId]  (mandatory sub-calls).
   *   3. Build extend map:   ucId → [ucId]  (optional extension calls).
   *   4. Emit one class per actor with only its associated use-case methods,
   *      each method body calling its includes and optionally its extensions.
   *   5. Emit a shared UseCaseHandler for any use cases not directly owned
   *      by an actor (only reachable via include/extend from another use case).
   *   6. Emit a Runner/main that instantiates all actor classes and exercises them.
   */
  static generateUseCaseHandler(elements, connections, language) {
    const actors   = elements.filter(e => e.type === 'actor');
    const usecases = elements.filter(e => e.type === 'usecase');

    if (usecases.length === 0) {
      return language === 'Python'
        ? '# No use cases defined\npass\n'
        : '// No use cases defined\n';
    }

    // ── Naming helpers ──────────────────────────────────────
    const toCamelCase = (phrase) =>
      phrase.trim().split(/[\s_\-]+/)
        .map((w, i) => {
          const c = w.replace(/[^a-zA-Z0-9]/g, '');
          if (!c) return '';
          return i === 0
            ? c.charAt(0).toLowerCase() + c.slice(1)
            : c.charAt(0).toUpperCase() + c.slice(1);
        })
        .join('');

    const toPascalCase = (phrase) => {
      const cc = toCamelCase(phrase);
      return cc.charAt(0).toUpperCase() + cc.slice(1);
    };

    const toSnakeCase = (phrase) =>
      phrase.trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');

    const toClassName = (name) =>
      name.trim().split(/[\s_\-]+/)
        .map(w => { const c = w.replace(/[^a-zA-Z0-9]/g, ''); return c.charAt(0).toUpperCase() + c.slice(1); })
        .join('');

    // ── Step 1: actor → directly-associated use cases ───────
    // Treats association AND dependency/generalization/realization as
    // "actor participates in use case" so ANY connecting arrow registers.
    const actorUcIds = new Map(); // actorId → Set<ucId>
    actors.forEach(a => actorUcIds.set(a.id, new Set()));

    const ACTOR_UC_CONN_TYPES = new Set([
      'association', 'dependency', 'realization', 'generalization',
      'inheritance', 'link', 'connector'
    ]);
    connections
      .filter(c => ACTOR_UC_CONN_TYPES.has(c.type))
      .forEach(c => {
        const fromEl = elements.find(e => e.id === c.from);
        const toEl   = elements.find(e => e.id === c.to);
        if (!fromEl || !toEl) return;
        // actor → usecase  or  usecase → actor
        if (fromEl.type === 'actor' && toEl.type === 'usecase') {
          actorUcIds.get(fromEl.id)?.add(toEl.id);
        } else if (toEl.type === 'actor' && fromEl.type === 'usecase') {
          actorUcIds.get(toEl.id)?.add(fromEl.id);
        }
        // actor → actor generalization: child actor inherits parent's use cases
        if (fromEl.type === 'actor' && toEl.type === 'actor') {
          const parentSet = actorUcIds.get(toEl.id);
          const childSet  = actorUcIds.get(fromEl.id);
          if (parentSet && childSet) {
            parentSet.forEach(id => childSet.add(id));
          }
        }
      });

    // ── Step 2: include map  ucId → [ucId] ──────────────────
    const includeMap = new Map(); // ucId → [target ucId]
    usecases.forEach(uc => includeMap.set(uc.id, []));
    connections
      .filter(c => c.type === 'include'
               || c.label?.toLowerCase().includes('include')
               || c.label?.includes('<<include>>'))
      .forEach(c => {
        if (includeMap.has(c.from)) includeMap.get(c.from).push(c.to);
      });

    // ── Step 3: extend map  ucId → [ucId] ───────────────────
    const extendMap = new Map(); // ucId → [extension ucId]
    usecases.forEach(uc => extendMap.set(uc.id, []));
    connections
      .filter(c => c.type === 'extend'
               || c.label?.toLowerCase().includes('extend')
               || c.label?.includes('<<extend>>'))
      .forEach(c => {
        // extend arrow points FROM the extension TO the base use case
        // we want: baseUcId → [extensionUcId]
        if (extendMap.has(c.to)) extendMap.get(c.to).push(c.from);
      });

    // ── Step 3b: generalization map — actor/uc inheritance ──
    // generalization between usecases: child inherits parent's label in docs
    const genMap = new Map(); // childId → parentId
    connections
      .filter(c => c.type === 'generalization' || c.type === 'inheritance')
      .forEach(c => {
        const fromEl = elements.find(e => e.id === c.from);
        const toEl   = elements.find(e => e.id === c.to);
        if (fromEl && toEl) genMap.set(c.from, c.to);
      });

    // ── Step 4: shared use cases (included/extended only, no direct actor) ──
    const actorOwnedIds = new Set([...actorUcIds.values()].flatMap(s => [...s]));
    const sharedUcs = usecases.filter(uc => !actorOwnedIds.has(uc.id));

    // ── Emit helpers per language ────────────────────────────

    const emitJavaMethod = (uc, indent = '    ') => {
      const mC = toPascalCase(uc.name);
      const includes = (includeMap.get(uc.id) || [])
        .map(id => elements.find(e => e.id === id))
        .filter(Boolean);
      const extensions = (extendMap.get(uc.id) || [])
        .map(id => elements.find(e => e.id === id))
        .filter(Boolean);
      const parentUcId = genMap.get(uc.id);
      const parentUc   = parentUcId ? elements.find(e => e.id === parentUcId) : null;

      let m = `${indent}/**\n${indent} * Execute use case: ${uc.name}\n`;
      if (parentUc)          m += `${indent} * Specializes: ${parentUc.name}\n`;
      if (includes.length)   m += `${indent} * Includes: ${includes.map(u => u.name).join(', ')}\n`;
      if (extensions.length) m += `${indent} * Extended by: ${extensions.map(u => u.name).join(', ')}\n`;
      m += `${indent} */\n`;
      m += `${indent}public boolean execute${mC}() {\n`;
      if (parentUc) {
        m += `${indent}    // Calls parent use case first (generalization)\n`;
        m += `${indent}    execute${toPascalCase(parentUc.name)}();\n`;
      }
      // wire mandatory includes
      includes.forEach(inc => {
        const shared = sharedUcs.find(s => s.id === inc.id);
        const prefix = shared ? 'handler.' : 'this.';
        m += `${indent}    ${prefix}execute${toPascalCase(inc.name)}(); // <<include>>\n`;
      });
      // wire optional extensions
      extensions.forEach(ext => {
        const shared = sharedUcs.find(s => s.id === ext.id);
        const prefix = shared ? 'handler.' : 'this.';
        m += `${indent}    // <<extend>> — call conditionally based on your business logic\n`;
        m += `${indent}    // ${prefix}execute${toPascalCase(ext.name)}();\n`;
      });
      m += `${indent}    // TODO: implement "${uc.name}"\n`;
      m += `${indent}    return true;\n`;
      m += `${indent}}\n\n`;
      return m;
    };

    const emitPythonMethod = (uc, indent = '    ') => {
      const ms = toSnakeCase(uc.name);
      const includes = (includeMap.get(uc.id) || [])
        .map(id => elements.find(e => e.id === id))
        .filter(Boolean);
      const extensions = (extendMap.get(uc.id) || [])
        .map(id => elements.find(e => e.id === id))
        .filter(Boolean);
      const parentUcId = genMap.get(uc.id);
      const parentUc   = parentUcId ? elements.find(e => e.id === parentUcId) : null;

      let m = `${indent}def execute_${ms}(self) -> bool:\n`;
      m += `${indent}    """Execute use case: ${uc.name}`;
      if (parentUc)          m += ` | specializes: ${parentUc.name}`;
      if (includes.length)   m += ` | includes: ${includes.map(u => u.name).join(', ')}`;
      if (extensions.length) m += ` | extended by: ${extensions.map(u => u.name).join(', ')}`;
      m += `"""\n`;
      if (parentUc) {
        m += `${indent}    self.execute_${toSnakeCase(parentUc.name)}()  # generalization\n`;
      }
      includes.forEach(inc => {
        const shared = sharedUcs.find(s => s.id === inc.id);
        const prefix = shared ? 'self.handler.' : 'self.';
        m += `${indent}    ${prefix}execute_${toSnakeCase(inc.name)}()  # <<include>>\n`;
      });
      extensions.forEach(ext => {
        const shared = sharedUcs.find(s => s.id === ext.id);
        const prefix = shared ? 'self.handler.' : 'self.';
        m += `${indent}    # <<extend>> — call conditionally based on your business logic\n`;
        m += `${indent}    # ${prefix}execute_${toSnakeCase(ext.name)}()\n`;
      });
      m += `${indent}    # TODO: implement "${uc.name}"\n`;
      m += `${indent}    return True\n\n`;
      return m;
    };

    const emitJSMethod = (uc, indent = '    ') => {
      const mC = toPascalCase(uc.name);
      const includes = (includeMap.get(uc.id) || [])
        .map(id => elements.find(e => e.id === id))
        .filter(Boolean);
      const extensions = (extendMap.get(uc.id) || [])
        .map(id => elements.find(e => e.id === id))
        .filter(Boolean);
      const parentUcId = genMap.get(uc.id);
      const parentUc   = parentUcId ? elements.find(e => e.id === parentUcId) : null;

      let m = `${indent}/** Execute use case: ${uc.name}`;
      if (parentUc)          m += ` | specializes: ${parentUc.name}`;
      if (includes.length)   m += ` | includes: ${includes.map(u => u.name).join(', ')}`;
      if (extensions.length) m += ` | extended by: ${extensions.map(u => u.name).join(', ')}`;
      m += ` */\n`;
      m += `${indent}execute${mC}() {\n`;
      if (parentUc) {
        m += `${indent}    this.execute${toPascalCase(parentUc.name)}(); // generalization\n`;
      }
      includes.forEach(inc => {
        const shared = sharedUcs.find(s => s.id === inc.id);
        const prefix = shared ? 'this.handler.' : 'this.';
        m += `${indent}    ${prefix}execute${toPascalCase(inc.name)}(); // <<include>>\n`;
      });
      extensions.forEach(ext => {
        const shared = sharedUcs.find(s => s.id === ext.id);
        const prefix = shared ? 'this.handler.' : 'this.';
        m += `${indent}    // <<extend>> — call conditionally based on your business logic\n`;
        m += `${indent}    // ${prefix}execute${toPascalCase(ext.name)}();\n`;
      });
      m += `${indent}    // TODO: implement "${uc.name}"\n`;
      m += `${indent}    return true;\n`;
      m += `${indent}}\n\n`;
      return m;
    };

    // ── Emit ────────────────────────────────────────────────
    let code = '';

    if (language === 'Java') {
      const hasShared = sharedUcs.length > 0;

      // Shared handler (use cases not directly owned by any actor)
      if (hasShared) {
        code += 'package com.example.usecases;\n\n';
        code += '/**\n * Shared use cases reached only via <<include>> or <<extend>>.\n */\n';
        code += 'public class UseCaseHandler {\n\n';
        sharedUcs.forEach(uc => { code += emitJavaMethod(uc); });
        code += '}\n\n';
      }

      // One class per actor
      actors.forEach(actor => {
        const ownedIds = actorUcIds.get(actor.id) || new Set();
        const ownedUcs = usecases.filter(uc => ownedIds.has(uc.id));
        const className = toClassName(actor.name);

        code += 'package com.example.usecases;\n\n';
        code += `/**\n * Use cases accessible by actor: ${actor.name}\n */\n`;
        code += `public class ${className} {\n\n`;

        if (hasShared) {
          code += '    private final UseCaseHandler handler = new UseCaseHandler();\n\n';
        }

        if (ownedUcs.length === 0) {
          code += '    // No use cases directly associated with this actor\n\n';
        } else {
          ownedUcs.forEach(uc => { code += emitJavaMethod(uc); });
        }

        code += '}\n\n';
      });

      // Runner
      code += 'package com.example.usecases;\n\n';
      code += '/** Runner — exercises all actor use cases. */\n';
      code += 'public class UseCaseRunner {\n';
      code += '    public static void main(String[] args) {\n';
      actors.forEach(actor => {
        const ownedIds = actorUcIds.get(actor.id) || new Set();
        const ownedUcs = usecases.filter(uc => ownedIds.has(uc.id));
        const className = toClassName(actor.name);
        const varName   = toCamelCase(actor.name);
        code += `        ${className} ${varName} = new ${className}();\n`;
        ownedUcs.forEach(uc => {
          code += `        System.out.println("${actor.name} → ${uc.name}: " + ${varName}.execute${toPascalCase(uc.name)}());\n`;
        });
      });
      code += '    }\n';
      code += '}\n';

    } else if (language === 'Python') {
      const hasShared = sharedUcs.length > 0;

      if (hasShared) {
        code += 'class UseCaseHandler:\n';
        code += '    """Shared use cases reached only via <<include>> or <<extend>>."""\n\n';
        sharedUcs.forEach(uc => { code += emitPythonMethod(uc); });
        code += '\n\n';
      }

      actors.forEach(actor => {
        const ownedIds = actorUcIds.get(actor.id) || new Set();
        const ownedUcs = usecases.filter(uc => ownedIds.has(uc.id));
        const className = toClassName(actor.name);

        code += `class ${className}:\n`;
        code += `    """Use cases accessible by actor: ${actor.name}"""\n\n`;
        if (hasShared) {
          code += '    def __init__(self):\n';
          code += '        self.handler = UseCaseHandler()\n\n';
        }
        if (ownedUcs.length === 0) {
          code += '    pass  # No use cases directly associated with this actor\n\n';
        } else {
          ownedUcs.forEach(uc => { code += emitPythonMethod(uc); });
        }
        code += '\n';
      });

      code += '\nif __name__ == "__main__":\n';
      actors.forEach(actor => {
        const ownedIds = actorUcIds.get(actor.id) || new Set();
        const ownedUcs = usecases.filter(uc => ownedIds.has(uc.id));
        const varName  = toSnakeCase(actor.name);
        const className = toClassName(actor.name);
        code += `    ${varName} = ${className}()\n`;
        ownedUcs.forEach(uc => {
          code += `    print("${actor.name} → ${uc.name}:", ${varName}.execute_${toSnakeCase(uc.name)}())\n`;
        });
      });

    } else if (language === 'JavaScript') {
      const hasShared = sharedUcs.length > 0;

      if (hasShared) {
        code += '/** Shared use cases reached only via <<include>> or <<extend>>. */\n';
        code += 'class UseCaseHandler {\n\n';
        sharedUcs.forEach(uc => { code += emitJSMethod(uc); });
        code += '}\n\n';
      }

      actors.forEach(actor => {
        const ownedIds = actorUcIds.get(actor.id) || new Set();
        const ownedUcs = usecases.filter(uc => ownedIds.has(uc.id));
        const className = toClassName(actor.name);

        code += `/** Use cases accessible by actor: ${actor.name} */\n`;
        code += `class ${className} {\n\n`;
        if (hasShared) {
          code += '    constructor() {\n';
          code += '        this.handler = new UseCaseHandler();\n';
          code += '    }\n\n';
        }
        if (ownedUcs.length === 0) {
          code += '    // No use cases directly associated with this actor\n\n';
        } else {
          ownedUcs.forEach(uc => { code += emitJSMethod(uc); });
        }
        code += '}\n\n';
      });

      if (hasShared) code += 'export { UseCaseHandler';
      else           code += 'export {';
      actors.forEach((a, i) => {
        const cn = toClassName(a.name);
        code += (hasShared || i > 0 ? ', ' : ' ') + cn;
      });
      code += ' };\n\n';

      code += '// ── Demo ──────────────────────────────────────────────\n';
      actors.forEach(actor => {
        const ownedIds  = actorUcIds.get(actor.id) || new Set();
        const ownedUcs  = usecases.filter(uc => ownedIds.has(uc.id));
        const className = toClassName(actor.name);
        const varName   = toCamelCase(actor.name);
        code += `// const ${varName} = new ${className}();\n`;
        ownedUcs.forEach(uc => {
          code += `// console.log("${actor.name} → ${uc.name}:", ${varName}.execute${toPascalCase(uc.name)}());\n`;
        });
      });
    }

    return code;
  }

  static generateUseCaseDocumentation(elements, connections) {
    let doc = '# Use Case Diagram Documentation\n\n';

    // ── Actors ──────────────────────────────────────────────
    doc += '## Actors\n\n';
    elements.filter(e => e.type === 'actor').forEach(actor => {
      const PARTICIPATION_TYPES = new Set([
        'association','dependency','realization','generalization','inheritance','link','connector'
      ]);
      const directUcNames = connections
        .filter(c => PARTICIPATION_TYPES.has(c.type)
                  && (c.from === actor.id || c.to === actor.id))
        .map(c => {
          const ucId = c.from === actor.id ? c.to : c.from;
          return elements.find(e => e.id === ucId && e.type === 'usecase')?.name || '';
        })
        .filter(Boolean);

      // Actor generalizations (inherits-from)
      const parentActorConn = connections.find(
        c => (c.type === 'generalization' || c.type === 'inheritance') && c.from === actor.id
      );
      const parentActor = parentActorConn
        ? elements.find(e => e.id === parentActorConn.to && e.type === 'actor')
        : null;

      doc += `### ${actor.name}\n`;
      if (parentActor) doc += `- **Specializes**: ${parentActor.name}\n`;
      doc += `- **Use Cases**: ${directUcNames.join(', ') || 'none'}\n\n`;
    });

    // ── Use Cases ────────────────────────────────────────────
    doc += '## Use Cases\n\n';
    elements.filter(e => e.type === 'usecase').forEach(uc => {
      doc += `### ${uc.name}\n`;
      doc += `- **Description**: ${uc.description || 'No description provided'}\n`;

      // Actors directly associated (any participation type)
      const PARTICIPATION_TYPES = new Set([
        'association','dependency','realization','generalization','inheritance','link','connector'
      ]);
      const actorNames = connections
        .filter(c => PARTICIPATION_TYPES.has(c.type)
                  && (c.from === uc.id || c.to === uc.id))
        .map(c => {
          const actorId = c.from === uc.id ? c.to : c.from;
          return elements.find(e => e.id === actorId && e.type === 'actor')?.name || '';
        })
        .filter(Boolean);
      doc += `- **Actors**: ${actorNames.join(', ') || 'none'}\n`;

      // <<include>> relationships
      const includes = connections
        .filter(c => c.from === uc.id
                  && (c.type === 'include'
                    || c.label?.toLowerCase().includes('include')
                    || c.label?.includes('<<include>>')))
        .map(c => elements.find(e => e.id === c.to)?.name || '')
        .filter(Boolean);
      if (includes.length) doc += `- **Includes**: ${includes.join(', ')}\n`;

      // <<extend>> relationships
      const extendedBy = connections
        .filter(c => c.to === uc.id
                  && (c.type === 'extend'
                    || c.label?.toLowerCase().includes('extend')
                    || c.label?.includes('<<extend>>')))
        .map(c => elements.find(e => e.id === c.from)?.name || '')
        .filter(Boolean);
      if (extendedBy.length) doc += `- **Extended by**: ${extendedBy.join(', ')}\n`;

      const includedBy = connections
        .filter(c => c.to === uc.id
                  && (c.type === 'include'
                    || c.label?.toLowerCase().includes('include')
                    || c.label?.includes('<<include>>')))
        .map(c => elements.find(e => e.id === c.from)?.name || '')
        .filter(Boolean);
      if (includedBy.length) doc += `- **Included by**: ${includedBy.join(', ')}\n`;

      // Generalization (this use case specializes another)
      const genConn = connections.find(
        c => (c.type === 'generalization' || c.type === 'inheritance') && c.from === uc.id
      );
      const parentUc = genConn ? elements.find(e => e.id === genConn.to && e.type === 'usecase') : null;
      if (parentUc) doc += `- **Specializes**: ${parentUc.name}\n`;

      doc += '\n';
    });

    // ── Connection Summary ───────────────────────────────────
    // Every connection is listed so the diff always shows a change
    // when ANY arrow is added or removed on the canvas.
    doc += '## Connections\n\n';
    connections.forEach(c => {
      const src = elements.find(e => e.id === c.from);
      const tgt = elements.find(e => e.id === c.to);
      if (!src || !tgt) return;
      const label = c.label ? ` (${c.label})` : '';
      doc += `- **${src.name}** --[${c.type}${label}]--> **${tgt.name}**\n`;
    });
    doc += '\n';

    return doc;
  }

  // ─────────────────────────────────────────────────────────
  // SEQUENCE DIAGRAM
  // ─────────────────────────────────────────────────────────

  static generateSequenceDiagramCode(elements, connections, language) {
    return this.generateSequenceCode(elements, connections, language);
  }

  /**
   * generateSequenceCode(elements, connections, language)
   * ─────────────────────────────────────────────────────
   * WHAT CHANGED (v2):
   *   Old: emitted one flat class with one method per message, grouped by
   *        sender lifeline. Order was wrong, nesting was lost, no params/returns.
   *
   *   New: emits one REAL class per lifeline. Each class:
   *     - holds field references to the other participants it calls
   *     - has properly typed method stubs for every message it RECEIVES
   *     - calls the correct receiver's method inside the sender's body
   *       (preserving the original message ORDER from the diagram)
   *     - adds a Runner/main class that calls only the top-level messages
   *       (messages whose sender is NOT the target of another message in
   *        the same flow, i.e. the "entry point" calls)
   *
   * ALGORITHM:
   *   1. Sort connections by their index in the array (= diagram time order).
   *   2. For each lifeline, collect:
   *        outgoing = messages it sends   → go into the method BODY of that lifeline
   *        incoming = messages it receives → become METHOD SIGNATURES on that lifeline
   *   3. Build a dependency map: if lifeline A sends a message to B,
   *      A needs a field reference `b: B`.
   *   4. Identify "top-level" messages = messages whose sender is never
   *      the receiver of an earlier message (i.e. the initiator calls).
   *      These go into the Runner/main entry point.
   *   5. Emit one class per lifeline, then the Runner class.
   */
  static generateSequenceCode(elements, connections, language) {
    const lifelines = elements.filter(e => e.type === 'lifeline' || e.type === 'actor');
    if (lifelines.length === 0) {
      return language === 'Python' ? '# No lifelines defined\npass\n' : '// No lifelines defined\n';
    }

    // ── Step 1: sort messages by diagram order (array index = time order) ──
    const messages = connections.filter(c => {
      const f = elements.find(e => e.id === c.from);
      const t = elements.find(e => e.id === c.to);
      return f && t && (f.type === 'lifeline' || f.type === 'actor') &&
                       (t.type === 'lifeline' || t.type === 'actor');
    });

    // ── Step 2: build per-lifeline outgoing/incoming maps ──────────────────
    // outgoing[id] = [ {msg, toEl} ]   — messages this lifeline SENDS
    // incoming[id] = [ {msg, fromEl} ] — messages this lifeline RECEIVES
    const outgoing = {}, incoming = {};
    lifelines.forEach(ll => { outgoing[ll.id] = []; incoming[ll.id] = []; });

    messages.forEach(msg => {
      const fromEl = elements.find(e => e.id === msg.from);
      const toEl   = elements.find(e => e.id === msg.to);
      if (!fromEl || !toEl) return;
      if (outgoing[fromEl.id]) outgoing[fromEl.id].push({ msg, toEl });
      if (incoming[toEl.id])   incoming[toEl.id].push({ msg, fromEl });
    });

    // ── Step 3: dependency map — who does each lifeline need a field for? ──
    const deps = {};  // deps[ll.id] = Set of lifeline elements it calls
    lifelines.forEach(ll => { deps[ll.id] = new Set(); });
    messages.forEach(msg => {
      if (deps[msg.from]) deps[msg.from].add(msg.to);
    });

    // ── Step 4: top-level senders (never receive a message themselves) ──────
    const receiverIds = new Set(messages.map(m => m.to));
    const topSenders  = lifelines.filter(ll => !receiverIds.has(ll.id));
    // Fallback: if every lifeline receives something (circular), use first sender
    const entryLifelines = topSenders.length > 0 ? topSenders : [lifelines[0]];
    // Top-level messages = sent by an entry lifeline
    const entryMsgIds = new Set(
      messages.filter(m => entryLifelines.some(el => el.id === m.from)).map(m => m.id)
    );

    // ── Step 5: emit code per language ─────────────────────────────────────
    const ni = (name, ctx) => this.normalizeIdentifier(name, ctx);
    let code = '';

    // ── Helper: infer a plausible return type from message label ───────────
    const inferReturnType = (label, lang) => {
      if (!label) return lang === 'Java' ? 'void' : 'None';
      const l = label.toLowerCase();
      if (l.startsWith('get') || l.includes('fetch') || l.includes('find') || l.includes('load'))
        return lang === 'Java' ? 'Object' : 'object';
      if (l.includes('create') || l.includes('build') || l.includes('make'))
        return lang === 'Java' ? 'Object' : 'object';
      if (l.includes('check') || l.includes('is') || l.includes('has') || l.includes('valid') || l.includes('auth'))
        return lang === 'Java' ? 'boolean' : 'bool';
      if (l.includes('count') || l.includes('size') || l.includes('index'))
        return lang === 'Java' ? 'int' : 'int';
      if (l.includes('token') || l.includes('name') || l.includes('label') || l.includes('message'))
        return lang === 'Java' ? 'String' : 'str';
      return lang === 'Java' ? 'void' : 'None';
    };

    // ─────────────────────────── JAVA ─────────────────────────────────────
    if (language === 'Java') {
      code += 'package com.example.sequences;\n\n';
      code += '/**\n * Auto-generated sequence classes.\n';
      code += ' * Participants: ' + lifelines.map(ll => ll.name).join(', ') + '\n */\n\n';

      lifelines.forEach(ll => {
        const className = ni(ll.name, 'class');
        const out = outgoing[ll.id];
        const inc = incoming[ll.id];
        const fieldIds = deps[ll.id];

        code += `// ${'─'.repeat(60)}\n`;
        code += `// Lifeline: ${ll.name}\n`;
        code += `// ${'─'.repeat(60)}\n`;
        code += `public class ${className} {\n\n`;

        // Fields for each lifeline this one calls
        fieldIds.forEach(targetId => {
          const target = elements.find(e => e.id === targetId);
          if (!target) return;
          const fieldType = ni(target.name, 'class');
          const fieldName = ni(target.name, 'method');
          code += `    private ${fieldType} ${fieldName};\n`;
        });
        if (fieldIds.size > 0) code += '\n';

        // Constructor injecting dependencies
        if (fieldIds.size > 0) {
          const params = [...fieldIds].map(id => {
            const t = elements.find(e => e.id === id);
            if (!t) return '';
            return `${ni(t.name, 'class')} ${ni(t.name, 'method')}`;
          }).filter(Boolean).join(', ');
          code += `    public ${className}(${params}) {\n`;
          fieldIds.forEach(id => {
            const t = elements.find(e => e.id === id);
            if (!t) return;
            const fn = ni(t.name, 'method');
            code += `        this.${fn} = ${fn};\n`;
          });
          code += '    }\n\n';
        }

        // One method per INCOMING message (this lifeline is the receiver)
        inc.forEach(({ msg, fromEl }) => {
          const mName  = ni(msg.label || 'handle', 'method');
          const retType = inferReturnType(msg.label, 'Java');
          const isReturn = msg.type === 'return';
          if (isReturn) return; // return arrows don't generate receiver methods
          code += `    /**\n     * Receives: ${fromEl.name} → ${ll.name}: ${msg.label || mName}\n     */\n`;
          code += `    public ${retType} ${mName}(String caller) {\n`;
          // Inside this method, emit the outgoing calls triggered by receiving this message
          const triggered = out.filter(({ msg: om }) =>
            messages.indexOf(om) > messages.indexOf(msg)
          );
          triggered.forEach(({ msg: om, toEl }) => {
            const callName = ni(om.label || 'interact', 'method');
            const fieldName = ni(toEl.name, 'method');
            code += `        ${fieldName}.${callName}("${ll.name}");\n`;
          });
          if (retType !== 'void') {
            // FIX 1: return a type-safe default, not null — null is a compile
            // error for Java primitives (boolean, int, etc.)
            const javaDefault = {
              'boolean': 'false',
              'int':     '0',
              'long':    '0L',
              'double':  '0.0',
              'float':   '0.0f',
              'String':  'null',
              'Object':  'null',
            }[retType] || 'null';
            code += `        return ${javaDefault}; // TODO: return actual ${retType}\n`;
          }
          code += '    }\n\n';
        });

        // If this lifeline sends messages but receives none (entry point),
        // emit a single run() method with all sends in order
        if (inc.length === 0 && out.length > 0) {
          code += `    /** Entry point — initiates the sequence. */\n`;
          code += `    public void run() {\n`;
          out.forEach(({ msg, toEl }) => {
            if (msg.type === 'return') return;
            const callName = ni(msg.label || 'interact', 'method');
            const fieldName = ni(toEl.name, 'method');
            code += `        ${fieldName}.${callName}("${ll.name}");\n`;
          });
          code += '    }\n\n';
        }

        code += '}\n\n';
      });

      // Runner / main class
      code += '// ── Runner ───────────────────────────────────────────────\n';
      code += 'public class SequenceRunner {\n\n';
      code += '    public static void main(String[] args) {\n';
      // Instantiate all lifelines bottom-up (dependents first)
      const order = [...lifelines].reverse();
      order.forEach(ll => {
        const className = ni(ll.name, 'class');
        const varName   = ni(ll.name, 'method');
        const fieldIds  = deps[ll.id];
        if (fieldIds.size === 0) {
          code += `        ${className} ${varName} = new ${className}();\n`;
        } else {
          const args2 = [...fieldIds].map(id => {
            const t = elements.find(e => e.id === id);
            return t ? ni(t.name, 'method') : '';
          }).filter(Boolean).join(', ');
          code += `        ${className} ${varName} = new ${className}(${args2});\n`;
        }
      });
      code += '\n        // Execute top-level sequence calls in diagram order\n';
      entryLifelines.forEach(ll => {
        const varName = ni(ll.name, 'method');
        code += `        ${varName}.run();\n`;
      });
      code += '    }\n';
      code += '}\n';

    // ─────────────────────────── PYTHON ───────────────────────────────────
    } else if (language === 'Python') {
      // FIX 3: snake_case field names for Python
      const pyField = (name) => this.toSnakeCase(this.normalizeIdentifier(name, 'class'));

      code += '"""\nAuto-generated sequence classes.\n';
      code += 'Participants: ' + lifelines.map(ll => ll.name).join(', ') + '\n"""\n\n';
      code += 'from __future__ import annotations\n\n\n';

      lifelines.forEach(ll => {
        const className = ni(ll.name, 'class');
        const out = outgoing[ll.id];
        const inc = incoming[ll.id];
        const fieldIds = deps[ll.id];

        code += `# ${'─'.repeat(60)}\n`;
        code += `# Lifeline: ${ll.name}\n`;
        code += `# ${'─'.repeat(60)}\n`;
        code += `class ${className}:\n\n`;

        // __init__ with typed fields
        if (fieldIds.size > 0) {
          const params = [...fieldIds].map(id => {
            const t = elements.find(e => e.id === id);
            if (!t) return '';
            return `${pyField(t.name)}: ${ni(t.name, 'class')}`;
          }).filter(Boolean).join(', ');
          code += `    def __init__(self, ${params}) -> None:\n`;
          fieldIds.forEach(id => {
            const t = elements.find(e => e.id === id);
            if (!t) return;
            const fn = pyField(t.name);
            code += `        self.${fn} = ${fn}\n`;
          });
          code += '\n';
        } else {
          // No fields — no __init__ needed; methods follow directly
        }

        // Incoming message methods
        inc.forEach(({ msg, fromEl }) => {
          if (msg.type === 'return') return;
          const mName   = ni(msg.label || 'handle', 'method');
          const retType = inferReturnType(msg.label, 'Python');
          const retHint = retType === 'None' ? 'None' : retType;
          code += `    def ${mName}(self, caller: str) -> ${retHint}:\n`;
          code += `        """Receives: ${fromEl.name} → ${ll.name}: ${msg.label || mName}"""\n`;
          const triggered = out.filter(({ msg: om }) =>
            messages.indexOf(om) > messages.indexOf(msg)
          );
          triggered.forEach(({ msg: om, toEl }) => {
            const callName  = ni(om.label || 'interact', 'method');
            const fieldName = pyField(toEl.name);
            code += `        self.${fieldName}.${callName}("${ll.name}")\n`;
          });
          if (retType !== 'None') {
            code += `        return None  # TODO: return actual ${retType}\n`;
          } else if (triggered.length === 0) {
            code += '        pass\n';
          }
          code += '\n';
        });

        // Entry-point run() for initiators
        if (inc.length === 0 && out.length > 0) {
          code += '    def run(self) -> None:\n';
          code += '        """Initiates the sequence."""\n';
          out.forEach(({ msg, toEl }) => {
            if (msg.type === 'return') return;
            const callName  = ni(msg.label || 'interact', 'method');
            const fieldName = pyField(toEl.name);
            code += `        self.${fieldName}.${callName}("${ll.name}")\n`;
          });
          code += '\n';
        }
      });

      // Runner
      code += '\n# ── Runner ───────────────────────────────────────────────\n';
      code += 'if __name__ == "__main__":\n';
      const order2 = [...lifelines].reverse();
      order2.forEach(ll => {
        const className = ni(ll.name, 'class');
        const varName   = pyField(ll.name);
        const fieldIds  = deps[ll.id];
        if (fieldIds.size === 0) {
          code += `    ${varName} = ${className}()\n`;
        } else {
          const args2 = [...fieldIds].map(id => {
            const t = elements.find(e => e.id === id);
            return t ? pyField(t.name) : '';
          }).filter(Boolean).join(', ');
          code += `    ${varName} = ${className}(${args2})\n`;
        }
      });
      entryLifelines.forEach(ll => {
        code += `    ${pyField(ll.name)}.run()\n`;
      });

    // ─────────────────────────── JAVASCRIPT ───────────────────────────────
    } else if (language === 'JavaScript') {
      code += '/**\n * Auto-generated sequence classes.\n';
      code += ' * Participants: ' + lifelines.map(ll => ll.name).join(', ') + '\n */\n\n';

      lifelines.forEach(ll => {
        const className = ni(ll.name, 'class');
        const out = outgoing[ll.id];
        const inc = incoming[ll.id];
        const fieldIds = deps[ll.id];

        code += `// ${'─'.repeat(60)}\n`;
        code += `// Lifeline: ${ll.name}\n`;
        code += `// ${'─'.repeat(60)}\n`;
        code += `class ${className} {\n\n`;

        // Constructor
        if (fieldIds.size > 0) {
          const params = [...fieldIds].map(id => {
            const t = elements.find(e => e.id === id);
            return t ? ni(t.name, 'method') : '';
          }).filter(Boolean).join(', ');
          code += `    constructor(${params}) {\n`;
          fieldIds.forEach(id => {
            const t = elements.find(e => e.id === id);
            if (!t) return;
            const fn = ni(t.name, 'method');
            code += `        this.${fn} = ${fn};\n`;
          });
          code += '    }\n\n';
        }

        // Incoming message methods
        inc.forEach(({ msg, fromEl }) => {
          if (msg.type === 'return') return;
          const mName = ni(msg.label || 'handle', 'method');
          code += `    /** Receives: ${fromEl.name} → ${ll.name}: ${msg.label || mName} */\n`;
          code += `    ${mName}(caller) {\n`;
          const triggered = out.filter(({ msg: om }) =>
            messages.indexOf(om) > messages.indexOf(msg)
          );
          triggered.forEach(({ msg: om, toEl }) => {
            const callName  = ni(om.label || 'interact', 'method');
            const fieldName = ni(toEl.name, 'method');
            code += `        this.${fieldName}.${callName}('${ll.name}');\n`;
          });
          if (triggered.length === 0) {
            code += '        // TODO: implement handler\n';
          }
          code += '    }\n\n';
        });

        // Entry-point run()
        if (inc.length === 0 && out.length > 0) {
          code += '    /** Initiates the sequence. */\n';
          code += '    run() {\n';
          out.forEach(({ msg, toEl }) => {
            if (msg.type === 'return') return;
            const callName  = ni(msg.label || 'interact', 'method');
            const fieldName = ni(toEl.name, 'method');
            code += `        this.${fieldName}.${callName}('${ll.name}');\n`;
          });
          code += '    }\n\n';
        }

        code += `}\n\n`;
      });

      // Runner
      code += '// ── Runner ───────────────────────────────────────────────\n';
      code += '(function main() {\n';
      const order3 = [...lifelines].reverse();
      order3.forEach(ll => {
        const className = ni(ll.name, 'class');
        const varName   = ni(ll.name, 'method');
        const fieldIds  = deps[ll.id];
        if (fieldIds.size === 0) {
          code += `    const ${varName} = new ${className}();\n`;
        } else {
          const args2 = [...fieldIds].map(id => {
            const t = elements.find(e => e.id === id);
            return t ? ni(t.name, 'method') : '';
          }).filter(Boolean).join(', ');
          code += `    const ${varName} = new ${className}(${args2});\n`;
        }
      });
      code += '\n    // Execute top-level sequence calls in diagram order\n';
      entryLifelines.forEach(ll => {
        code += `    ${ni(ll.name, 'method')}.run();\n`;
      });
      code += '})();\n';
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