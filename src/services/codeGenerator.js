/**
 * ============================================================
 * codeGenerator.js — Code Generator Service
 * ============================================================
 *
 * Produces RUNNABLE source code from UML class, use-case, and
 * sequence diagrams. "Runnable" means copy-paste into a compiler
 * or interpreter and execute without touching a single line.
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

class CodeGenerator {

  // ─────────────────────────────────────────────────────────
  // TYPE-MAPPING UTILITIES
  // ─────────────────────────────────────────────────────────

  static mapType(umlType, lang) {
    const map = {
      Java: {
        String:'String', Integer:'int', Double:'double', Boolean:'boolean',
        Float:'float',   Long:'long',   Character:'char', Byte:'byte',
        Short:'short',   List:'List<Object>', ArrayList:'ArrayList<Object>',
        Map:'Map<String,Object>', HashMap:'HashMap<String,Object>',
        Set:'Set<Object>', Date:'Date', LocalDateTime:'LocalDateTime',
        Object:'Object', void:'void', Any:'Object'
      },
      Python: {
        String:'str', Integer:'int', Double:'float', Boolean:'bool',
        Float:'float', Long:'int', Character:'str', Byte:'bytes',
        List:'List', ArrayList:'List', Map:'Dict', HashMap:'Dict',
        Set:'Set', Date:'datetime', LocalDateTime:'datetime',
        Object:'object', void:'None', Any:'Any'
      },
      JavaScript: {
        String:'string', Integer:'number', Double:'number', Boolean:'boolean',
        Float:'number',  Long:'number',  Character:'string', Byte:'number',
        List:'Array',   ArrayList:'Array', Map:'Object', HashMap:'Map',
        Set:'Set', Date:'Date', LocalDateTime:'Date',
        Object:'any', void:'void', Any:'any'
      }
    };
    const lm = map[lang];
    if (!lm) return umlType || 'Object';
    return lm[umlType] || umlType || 'Object';
  }

  /**
   * Return a concrete literal that satisfies the type — never 'null'
   * where the compiler would reject it for primitives.
   */
  static getDefaultValue(nativeType, lang) {
    const defs = {
      Java: {
        'int':'0', 'double':'0.0', 'float':'0.0f', 'boolean':'false',
        'long':'0L', 'char':"'\\0'", 'byte':'0', 'short':'0',
        'String':'""', 'Object':'null', 'void':'', 'Date':'null',
        'LocalDateTime':'null',
        'List<Object>':'new ArrayList<>()',
        'ArrayList<Object>':'new ArrayList<>()',
        'Map<String,Object>':'new HashMap<>()',
        'HashMap<String,Object>':'new HashMap<>()',
        'Set<Object>':'new HashSet<>()'
      },
      Python: {
        'str':'""', 'int':'0', 'float':'0.0', 'bool':'False',
        'bytes':'b""', 'list':'[]', 'dict':'{}', 'set':'set()',
        'None':'None', 'object':'None', 'List':'[]', 'Dict':'{}',
        'Set':'set()', 'datetime':'None', 'Any':'None'
      },
      JavaScript: {
        'number':'0', 'string':'"" ', 'boolean':'false',
        'Array':'[]', 'Object':'{}', 'Map':'new Map()', 'Set':'new Set()',
        'Date':'new Date()', 'any':'null', 'void':'', 'string ':'"" '
      }
    };
    const ld = defs[lang];
    if (!ld) return 'null';
    // trim to handle the space-padded 'string ' key
    return ld[nativeType] ?? ld[nativeType?.trim()] ?? (
      nativeType === 'void' ? '' : 'null'
    );
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────

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

  /** Returns Array<{ filename, content }> — one real file per class */
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

  static normalizeModel(elements, connections) {
    const els = elements.map(el => ({
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
    }));
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
      code += '    // ── Fields ──────────────────────────────────────────\n';
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
      code += '    // ── Relationship fields ─────────────────────────────\n';
      code += relFields + '\n';
    }

    // ── Constructor ────────────────────────────────────────
    if (!isInterface) {
      code += '    // ── Constructor ─────────────────────────────────────\n';

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
      code += '    // ── Methods ─────────────────────────────────────────\n';
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
      code += '    // ── Getters & Setters ───────────────────────────────\n';
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
      code += '    // ── toString ────────────────────────────────────────\n';
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
    code += '\n# ── Demo ────────────────────────────────────────────────────\n';
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

    let code = '';

    if (language === 'Java') {
      code += 'package com.example.usecases;\n\n';
      code += '/**\n * Auto-generated Use Case Handler.\n */\n';
      code += 'public class UseCaseHandler {\n\n';
      usecases.forEach(uc => {
        const m  = this.normalizeIdentifier(uc.name, 'method');
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
        const m  = this.normalizeIdentifier(uc.name, 'method');
        const mC = m.charAt(0).toUpperCase() + m.slice(1);
        code += `        System.out.println("${uc.name}: " + handler.execute${mC}());\n`;
      });
      code += '    }\n';
      code += '}\n';

    } else if (language === 'Python') {
      code += 'class UseCaseHandler:\n';
      code += '    """Auto-generated Use Case Handler."""\n\n';
      usecases.forEach(uc => {
        const m = this.normalizeIdentifier(uc.name, 'method');
        code += `    def execute_${m}(self) -> bool:\n`;
        code += `        """Execute use case: ${uc.name}\"\"\"\n`;
        code += `        # TODO: implement "${uc.name}"\n`;
        code += '        return True\n\n';
      });
      code += '\nif __name__ == "__main__":\n';
      code += '    handler = UseCaseHandler()\n';
      usecases.forEach(uc => {
        const m = this.normalizeIdentifier(uc.name, 'method');
        code += `    print("${uc.name}:", handler.execute_${m}())\n`;
      });

    } else if (language === 'JavaScript') {
      code += '/**\n * Auto-generated Use Case Handler.\n */\n';
      code += 'class UseCaseHandler {\n\n';
      usecases.forEach(uc => {
        const m  = this.normalizeIdentifier(uc.name, 'method');
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
        const m  = this.normalizeIdentifier(uc.name, 'method');
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
      const ucNames = connections
        .filter(c => c.from === actor.id || c.to === actor.id)
        .map(c => {
          const ucId = c.from === actor.id ? c.to : c.from;
          return elements.find(e => e.id === ucId)?.name || '';
        })
        .filter(Boolean);
      doc += `### ${actor.name}\n- **Use Cases**: ${ucNames.join(', ') || 'none'}\n\n`;
    });
    doc += '## Use Cases\n\n';
    elements.filter(e => e.type === 'usecase').forEach(uc => {
      doc += `### ${uc.name}\n`;
      doc += `- **Description**: ${uc.description || 'No description provided'}\n`;
      const actorNames = connections
        .filter(c => c.from === uc.id || c.to === uc.id)
        .map(c => {
          const actorId = c.from === uc.id ? c.to : c.from;
          return elements.find(e => e.id === actorId && e.type === 'actor')?.name || '';
        })
        .filter(Boolean);
      doc += `- **Actors**: ${actorNames.join(', ') || 'none'}\n\n`;
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

  /** Topological sort so parent classes are emitted before children */
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

  static pluralize(word) {
    if (!word) return 'items';
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z')) return word + 'es';
    if (word.endsWith('y') && !/[aeiou]y$/.test(word))                   return word.slice(0, -1) + 'ies';
    return word + 's';
  }

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

  static formatCode(code, language) {
    let out = code.replace(/\n{3,}/g, '\n\n');
    out = out.split('\n').map(l => l.trimEnd()).join('\n');
    return out.trim() + '\n';
  }
}

export default CodeGenerator;