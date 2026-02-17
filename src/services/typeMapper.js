/**
 * ============================================================
 * typeMapper.js — Type Mapper Service
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Think of this as a universal translator for data types.
 * When you design a system using UML diagrams (a universal
 * blueprint language), every piece of data has a generic label
 * like "String" or "Integer". But when you actually write
 * code in Java, Python, JavaScript, etc., each language has
 * its own names and quirks for those same concepts.
 * This file bridges that gap.
 *
 * TECHNICAL OVERVIEW:
 * A static utility class with four responsibilities:
 *   1. mapType()            — UML type → language-specific type name
 *   2. getDefaultValue()    — language-specific type → zero/default value
 *   3. inferTypeFromValue() — JS runtime value → UML type name (reverse direction)
 *   4. getCollectionType()  — base type → typed collection syntax per language
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - codeGenerator.js calls this when emitting type names in generated code.
 * - codeToUMLConverter.js uses inferTypeFromValue() when going the other
 *   way — reading existing JS values and labeling them with UML types.
 * ============================================================
 */

class TypeMapper {

  /**
   * mapType(umlType, targetLanguage)
   * ---------------------------------
   * LAYMAN'S: Takes a generic blueprint label (like "Integer" or "Map")
   * and tells you the correct word for it in your chosen language.
   * "Boolean" becomes "bool" in C++ but stays "boolean" in Java.
   *
   * TECHNICAL: Two-level lookup in `typeMappings`:
   *   level 1 → language name, level 2 → UML type name.
   * Falls back to the raw UML type if unmapped, or 'Object' if null.
   *
   * RELATIONSHIP: Called by codeGenerator.js for every type annotation,
   * field declaration, and method signature it generates.
   *
   * @param {string} umlType        - Generic UML type (e.g., "Integer")
   * @param {string} targetLanguage - Target language (e.g., "Java")
   * @returns {string}
   */
  static mapType(umlType, targetLanguage) {

    /**
     * typeMappings
     * LAYMAN'S: A lookup table — "In language X, what is type Y called?"
     * TECHNICAL: Nested plain object. Outer keys = languages, inner keys = UML types,
     * values = native type strings. Local to mapType(); other methods have their own tables.
     */
    const typeMappings = {

      // Java: strongly typed; primitives differ from wrappers; generics use angle brackets
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
        'LocalDateTime': 'LocalDateTime'
      },

      // Python: dynamically typed; most numerics collapse to int or float
      Python: {
        'String': 'str',
        'Integer': 'int',
        'Double': 'float',    // No separate double in Python
        'Boolean': 'bool',
        'Float': 'float',
        'Long': 'int',        // Python ints are unbounded — no separate long
        'Character': 'str',   // No char type; single-char strings used instead
        'Byte': 'bytes',
        'List': 'list',
        'ArrayList': 'list',
        'Map': 'dict',
        'HashMap': 'dict',
        'Set': 'set',
        'Date': 'datetime',
        'LocalDateTime': 'datetime'
      },

      // JavaScript: single 'number' type covers all numerics (IEEE 754 float)
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
        'Map': 'Object',      // Generic key-value → plain JS object
        'HashMap': 'Map',     // Keyed collection → JS built-in Map
        'Set': 'Set',
        'Date': 'Date',
        'LocalDateTime': 'Date'
      },

    };

    /**
     * languageMap
     * LAYMAN'S: A shortcut to just the section of the table for the chosen language.
     * TECHNICAL: Intermediate variable to avoid double property access in the return.
     * Undefined when the language isn't in typeMappings, triggering the fallback.
     */
    const languageMap = typeMappings[targetLanguage];
    if (!languageMap) return umlType || 'Object';

    return languageMap[umlType] || umlType || 'Object';
  }

  /**
   * getDefaultValue(type, language)
   * --------------------------------
   * LAYMAN'S: Every variable needs a starting value. This returns the
   * correct "blank slate" (0, false, null, [], etc.) for a type in a language.
   *
   * TECHNICAL: Two-level lookup in `defaults` using the *already-mapped*
   * (native) type name, NOT the UML name — call mapType() first if needed.
   * Falls back to the string 'null'.
   *
   * RELATIONSHIP: Paired with mapType() inside codeGenerator.js —
   * mapType() gives the type name, this gives the value next to it.
   *
   * @param {string} type     - Native type name (e.g., "int", "str")
   * @param {string} language - Target language
   * @returns {string}
   */
  static getDefaultValue(type, language) {

    /**
     * defaults
     * LAYMAN'S: "What does an empty [type] look like in [language]?"
     * TECHNICAL: Nested object keyed by language then native type name.
     * Values are initialization literals ready to drop into generated code.
     */
    const defaults = {

      // Java: primitives get zeros; reference types default to null
      Java: {
        'int': '0',
        'double': '0.0',
        'float': '0.0f',   // 'f' suffix distinguishes float from double literals
        'boolean': 'false',
        'long': '0L',       // 'L' suffix marks long literals in Java
        'char': "'\\0'",   // Null character — zero value of char
        'byte': '0',
        'short': '0',
        'String': 'null',
        'Object': 'null'
      },

      // Python: None for null; empty literal forms for collections
      Python: {
        'int': '0',
        'float': '0.0',
        'bool': 'False',   // PascalCase — Python booleans are title-cased
        'str': '""',
        'list': '[]',
        'dict': '{}',
        'set': 'set()',    // {} makes a dict in Python — set() is required
        'None': 'None'
      },

      // JavaScript: null and undefined are distinct; collections use literals
      JavaScript: {
        'number': '0',
        'string': '""',
        'boolean': 'false',
        'Array': '[]',
        'Object': '{}',
        'null': 'null',
        'undefined': 'undefined'
      },

    };

    /**
     * languageDefaults
     * LAYMAN'S: Shortcut to just the defaults for the chosen language.
     * TECHNICAL: Same pattern as `languageMap` in mapType().
     */
    const languageDefaults = defaults[language];
    if (!languageDefaults) return 'null';

    return languageDefaults[type] || 'null';
  }

  /**
   * inferTypeFromValue(value)
   * -------------------------
   * LAYMAN'S: The reverse of mapType(). You hand it a real JS value
   * (42, "hello", [1,2,3]) and it figures out the UML type label for it.
   *
   * TECHNICAL: Uses typeof, Array.isArray(), and instanceof to inspect
   * a runtime value. Uses Number.isInteger() to split numbers into
   * Integer vs Double. No lookup table — purely conditional logic.
   *
   * RELATIONSHIP: Used by codeToUMLConverter.js when reverse-engineering
   * existing code back into UML. The inverse pipeline of mapType() + getDefaultValue().
   *
   * @param {*} value - Any JavaScript runtime value
   * @returns {string} - UML type name
   */
  static inferTypeFromValue(value) {
    if (typeof value === 'string') return 'String';

    if (typeof value === 'number') {
      // typeof alone can't tell int from float — Number.isInteger() handles this
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }

    if (typeof value === 'boolean') return 'Boolean';

    // Array MUST be checked before 'object' — typeof [] === 'object' in JS
    if (Array.isArray(value)) return 'List';

    // Date MUST also be checked before the generic object fallback
    if (value instanceof Date) return 'Date';

    // Catch-all for plain objects and null (typeof null === 'object' quirk)
    if (typeof value === 'object') return 'Map';

    // Fallback: undefined, functions, symbols, etc.
    return 'Object';
  }

  /**
   * getCollectionType(baseType, language)
   * --------------------------------------
   * LAYMAN'S: When you want a "list of Users", each language writes it
   * differently. This formats that syntax correctly — List<User> in Java,
   * List[User] in Python, std::vector<User> in C++, etc.
   *
   * TECHNICAL: Single-level lookup in `collections` using template literals
   * to interpolate `baseType` at call time. Complements mapType() —
   * mapType() handles static mappings like "List" → "List<Object>",
   * while this handles dynamic cases like any arbitrary inner type.
   *
   * RELATIONSHIP: Called by codeGenerator.js for UML associations with
   * "many" multiplicity, where a field must be a typed collection.
   *
   * @param {string} baseType - Element type, already language-mapped (e.g., "User")
   * @param {string} language - Target language
   * @returns {string}        - e.g., "List<User>", "List[User]"
   */
  static getCollectionType(baseType, language) {

    /**
     * collections
     * LAYMAN'S: A cheat-sheet for "list of [thing]" syntax per language.
     * TECHNICAL: Plain object with language names as keys; values are template
     * literals evaluated immediately using `baseType` from the enclosing scope.
     */
    const collections = {
      Java: `List<${baseType}>`,
      Python: `List[${baseType}]`,        // PEP 484 type-hint bracket syntax
      JavaScript: `Array<${baseType}>`,   // JSDoc / TypeScript annotation style
    };

    return collections[language] || `List<${baseType}>`;
  }
}

/**
 * Default Export
 * LAYMAN'S: Makes this class available to other files that import it.
 * Any file doing `import TypeMapper from './typeMapper'` gets all four methods.
 *
 * TECHNICAL: ES Module default export. All methods are static so callers
 * never instantiate with `new` — they call TypeMapper.mapType(...) directly.
 */
export default TypeMapper;