/**
 * ============================================================
 * TokenizationService.js — UML Diagram Tokenizer
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Think of this as a document scanner for UML diagrams. Before
 * CodeSynch can turn a diagram into code, it needs to read each
 * piece of the diagram and give it a proper label — just like a
 * compiler reads source code word-by-word before it can run it.
 * This file does exactly that: it reads every node, edge, label,
 * and attribute in a UML diagram and converts it into a neat,
 * labeled list (the "token stream") that the transformation
 * engine can work through one item at a time.
 *
 * TECHNICAL OVERVIEW:
 * Implements the 5-stage tokenization pipeline defined in the
 * CodeSynch design specification:
 *
 *   Stage 1 — Input Ingestion:        Accepts diagram model (elements + connections)
 *                                      or a JSON string and normalizes to internal form.
 *   Stage 2 — Element Identification: Scans every element and connection; maps each
 *                                      to a TOKEN_TYPE from the predefined vocabulary.
 *   Stage 3 — Attribute Extraction:   Pulls type-specific attributes from each token
 *                                      (e.g. visibility for CLASS_DEF, multiplicity
 *                                      for RELATIONSHIP).
 *   Stage 4 — Token Stream:           Assembles tokens into an ordered flat list
 *                                      ready for the transformation engine.
 *   Stage 5 — Symbol Table:           Builds a lookup map of className → { attributes,
 *                                      methods, relationships } for cross-reference
 *                                      resolution.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Sits between the UML editor (elements/connections state) and the
 *   transformation engine (codeGenerator.js / codeToUMLConverter.js).
 * - tokenize() is the public entry point — call it before generateCode().
 * - ValidationService.js consumes the token stream produced here.
 * - The TOKEN_TYPES vocabulary matches the table in the spec (Table 6).
 * ============================================================
 */

/**
 * TOKEN_TYPES
 * ─────────────────────────────────────────────────────────────
 * LAYMAN'S: The complete list of "labels" the tokenizer can assign
 * to any UML element it encounters. Every element in a diagram maps
 * to exactly one label from this list.
 *
 * TECHNICAL: String-keyed constant object used as an enum.
 * Matches Table 6 in the design specification exactly.
 * An extra UNKNOWN type is included for unrecognized elements —
 * these are flagged and routed to the validation layer rather
 * than passed silently to the transformation engine.
 */
export const TOKEN_TYPES = {
  CLASS_DEF:    'CLASS_DEF',    // Class node with name, attributes, methods
  ATTRIBUTE:    'ATTRIBUTE',    // Typed field belonging to a class
  METHOD:       'METHOD',       // Callable method with return type + params
  RELATIONSHIP: 'RELATIONSHIP', // Edge: association, inheritance, composition, etc.
  ACTOR:        'ACTOR',        // External entity in a Use Case diagram
  USE_CASE:     'USE_CASE',     // Functional capability in a Use Case diagram
  MESSAGE:      'MESSAGE',      // Directed call/return in a Sequence diagram
  LIFELINE:     'LIFELINE',     // Participant object in a Sequence diagram
  GUARD:        'GUARD',        // Conditional constraint on a message/fragment
  UNKNOWN:      'UNKNOWN'       // Unrecognized element — routed to validation
};

/**
 * ELEMENT_TYPE_MAP
 * ─────────────────────────────────────────────────────────────
 * LAYMAN'S: A quick lookup table — "if the diagram element's type
 * field says X, the token type is Y."
 *
 * TECHNICAL: Maps the internal element.type strings used by the
 * UMLEditor canvas to the canonical TOKEN_TYPES values.
 * Covers both structural and behavioral diagram element types.
 */
const ELEMENT_TYPE_MAP = {
  // Structural — Class Diagram
  'class':        TOKEN_TYPES.CLASS_DEF,
  'interface':    TOKEN_TYPES.CLASS_DEF,   // Interfaces tokenize as CLASS_DEF
  'abstract':     TOKEN_TYPES.CLASS_DEF,   // Abstract classes tokenize as CLASS_DEF
  'component':    TOKEN_TYPES.CLASS_DEF,   // Components tokenize as CLASS_DEF
  'object':       TOKEN_TYPES.CLASS_DEF,   // Object instances tokenize as CLASS_DEF
  'package':      TOKEN_TYPES.CLASS_DEF,   // Packages tokenize as CLASS_DEF (namespace)
  // Behavioral — Use Case Diagram
  'actor':        TOKEN_TYPES.ACTOR,
  'usecase':      TOKEN_TYPES.USE_CASE,
  // Behavioral — Sequence Diagram
  'lifeline':     TOKEN_TYPES.LIFELINE,
  'message':      TOKEN_TYPES.MESSAGE,
  'guard':        TOKEN_TYPES.GUARD,
  // Behavioral — State / Activity (generic node, no dedicated token)
  'state':        TOKEN_TYPES.CLASS_DEF,
  'activity':     TOKEN_TYPES.CLASS_DEF,
  'note':         TOKEN_TYPES.UNKNOWN      // Notes are not transformed — flagged
};

/**
 * RELATIONSHIP_TYPE_MAP
 * ─────────────────────────────────────────────────────────────
 * LAYMAN'S: A lookup for connection/edge types — every arrow in the
 * diagram maps to the RELATIONSHIP token and carries its own subtype.
 *
 * TECHNICAL: All connection.type values recognized by the UMLEditor
 * canvas. Any edge type found here tokenizes as TOKEN_TYPES.RELATIONSHIP.
 * The subtype is preserved in the token's attributes for use by the
 * transformation rules.
 */
const KNOWN_RELATIONSHIP_TYPES = new Set([
  'association', 'inheritance', 'aggregation', 'composition',
  'dependency',  'realization', 'link',        'include',
  'extend',      'generalization', 'flow',     'transition',
  'message',     'return',      'connector',   'import',
  'extension'
]);


// ─────────────────────────────────────────────────────────────
// TokenizationService
// ─────────────────────────────────────────────────────────────

class TokenizationService {

  /**
   * tokenize(diagramInput)
   * ─────────────────────────────────────────────────────────────
   * LAYMAN'S: The main entry point. Give it a diagram (either the
   * live { elements, connections } state from UMLEditor, or a JSON
   * string from a saved file) and it runs all 5 stages, returning
   * a fully labeled token stream and a symbol table.
   *
   * TECHNICAL: Orchestrates stages 1–5 in sequence. Wrapped in
   * try/catch — always returns a consistent response shape so
   * callers never need to guard against undefined.
   *
   * RELATIONSHIP: Called by the transformation pipeline before
   * code generation. ValidationService.validate() accepts the
   * tokenStream produced here.
   *
   * @param {{ elements: Array, connections: Array }|string} diagramInput
   *   Either a live diagram model object or a serialized JSON string.
   * @param {string} [diagramType='class']  - 'class' | 'usecase' | 'sequence'
   * @returns {{
   *   success:     boolean,
   *   tokenStream: Array<TokenObject>,
   *   symbolTable: Map<string, SymbolEntry>,
   *   unknownTokens: Array<TokenObject>,
   *   metadata:    object,
   *   error:       string|null
   * }}
   */
  static tokenize(diagramInput, diagramType = 'class') {
    try {

      // ── Stage 1: Input Ingestion ───────────────────────────
      const { elements, connections } = this._ingestInput(diagramInput);

      // ── Stage 2: Element Identification (Lexical Scanning) ─
      const rawTokens = this._identifyElements(elements, connections);

      // ── Stage 3: Attribute Extraction ──────────────────────
      const enrichedTokens = this._extractAttributes(rawTokens, elements, connections);

      // ── Stage 4: Token Stream Construction ─────────────────
      const { tokenStream, unknownTokens } = this._buildTokenStream(enrichedTokens);

      // ── Stage 5: Symbol Table Population ───────────────────
      const symbolTable = this._buildSymbolTable(tokenStream, connections, elements);

      return {
        success: true,
        tokenStream,
        symbolTable,
        unknownTokens,
        metadata: this._buildMetadata(tokenStream, unknownTokens, diagramType),
        error: null
      };

    } catch (err) {
      return {
        success: false,
        tokenStream: [],
        symbolTable: new Map(),
        unknownTokens: [],
        metadata: {},
        error: err.message || 'Unknown tokenization error'
      };
    }
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 1 — INPUT INGESTION
  // ─────────────────────────────────────────────────────────

  /**
   * _ingestInput(diagramInput)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: Accepts the diagram in whatever form it arrives —
   * a live React state object or a JSON string from a file —
   * and normalizes it to a plain { elements, connections } pair.
   *
   * TECHNICAL: Handles three cases:
   *   (a) Already a { elements, connections } object → use as-is.
   *   (b) A JSON string → parse and extract fields.
   *   (c) Anything else → throw a descriptive error.
   * Defensive defaults ensure empty arrays if fields are missing.
   */
  static _ingestInput(diagramInput) {
    if (typeof diagramInput === 'string') {
      const parsed = JSON.parse(diagramInput); // throws on invalid JSON — caught upstream
      return {
        elements:    Array.isArray(parsed.elements)    ? parsed.elements    : [],
        connections: Array.isArray(parsed.connections) ? parsed.connections : []
      };
    }

    if (diagramInput && typeof diagramInput === 'object') {
      return {
        elements:    Array.isArray(diagramInput.elements)    ? diagramInput.elements    : [],
        connections: Array.isArray(diagramInput.connections) ? diagramInput.connections : []
      };
    }

    throw new Error('Invalid diagram input: expected an object or JSON string.');
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 2 — ELEMENT IDENTIFICATION (LEXICAL SCANNING)
  // ─────────────────────────────────────────────────────────

  /**
   * _identifyElements(elements, connections)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: Goes through every box (element) and every arrow
   * (connection) in the diagram and stamps each one with its
   * token type label from the TOKEN_TYPES vocabulary.
   *
   * TECHNICAL: Two passes:
   *   Pass 1 — elements[]:    Map element.type → TOKEN_TYPE via
   *                           ELEMENT_TYPE_MAP; fall back to UNKNOWN.
   *   Pass 2 — connections[]: If connection.type is in the known
   *                           relationship set → RELATIONSHIP; else UNKNOWN.
   * Returns a flat array of raw token objects before attribute extraction.
   */
  static _identifyElements(elements, connections) {
    const rawTokens = [];

    // Pass 1: element nodes
    elements.forEach((el, idx) => {
      const tokenType = ELEMENT_TYPE_MAP[el.type?.toLowerCase()] || TOKEN_TYPES.UNKNOWN;
      rawTokens.push({
        tokenType,
        id:           el.id || `elem_${idx}`,
        sourceRef:    el.id || `elem_${idx}`,  // traceability: points back to source element
        elementType:  el.type || 'unknown',
        name:         el.name || '',
        attributes:   {},    // filled in Stage 3
        _raw:         el     // retained temporarily for Stage 3; stripped before output
      });
    });

    // Pass 2: connection edges
    connections.forEach((conn, idx) => {
      const isKnownRel = KNOWN_RELATIONSHIP_TYPES.has(conn.type?.toLowerCase());
      const tokenType  = isKnownRel ? TOKEN_TYPES.RELATIONSHIP : TOKEN_TYPES.UNKNOWN;
      rawTokens.push({
        tokenType,
        id:           conn.id || `conn_${idx}`,
        sourceRef:    conn.id || `conn_${idx}`,
        elementType:  conn.type || 'unknown',
        name:         conn.label || '',
        attributes:   {},
        _raw:         conn
      });
    });

    return rawTokens;
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 3 — ATTRIBUTE EXTRACTION
  // ─────────────────────────────────────────────────────────

  /**
   * _extractAttributes(rawTokens, elements, connections)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: For each labeled token, we now dig deeper and pull out
   * all the details that matter for that type. A class token gets its
   * visibility modifier and abstract flag; a relationship token gets
   * its source/target, subtype, and multiplicity values.
   *
   * TECHNICAL: Dispatches to a type-specific extractor per TOKEN_TYPE.
   * Sub-tokens (ATTRIBUTE and METHOD) are synthesized here from the
   * parent CLASS_DEF's attribute/method arrays. This expands the flat
   * element list into a richer stream that mirrors every nested member.
   * The _raw field is deleted before returning — it is an internal scaffold.
   */
  static _extractAttributes(rawTokens, elements, connections) {
    const enriched = [];

    rawTokens.forEach(token => {
      switch (token.tokenType) {

        case TOKEN_TYPES.CLASS_DEF: {
          const el = token._raw;
          token.attributes = this._extractClassAttributes(el);
          enriched.push(token);

          // Synthesize ATTRIBUTE sub-tokens — one per class attribute
          (el.attributes || []).forEach((attr, i) => {
            enriched.push({
              tokenType:   TOKEN_TYPES.ATTRIBUTE,
              id:          `${token.id}_attr_${i}`,
              sourceRef:   token.id,          // traceable back to parent element
              parentClass: el.name || '',
              elementType: 'attribute',
              name:        attr.name || '',
              attributes:  this._extractAttributeAttributes(attr)
            });
          });

          // Synthesize METHOD sub-tokens — one per class method
          (el.methods || []).forEach((method, i) => {
            enriched.push({
              tokenType:   TOKEN_TYPES.METHOD,
              id:          `${token.id}_method_${i}`,
              sourceRef:   token.id,
              parentClass: el.name || '',
              elementType: 'method',
              name:        method.name || '',
              attributes:  this._extractMethodAttributes(method)
            });
          });
          break;
        }

        case TOKEN_TYPES.RELATIONSHIP: {
          const conn = token._raw;
          token.attributes = this._extractRelationshipAttributes(conn, elements);
          enriched.push(token);
          break;
        }

        case TOKEN_TYPES.ACTOR:
        case TOKEN_TYPES.USE_CASE: {
          const el = token._raw;
          token.attributes = {
            name:        el.name || '',
            diagramType: el.diagramType || 'usecase',
            stereotype:  el.stereotype || ''
          };
          enriched.push(token);
          break;
        }

        case TOKEN_TYPES.LIFELINE: {
          const el = token._raw;
          token.attributes = {
            name:       el.name || '',
            className:  el.className || el.name || '',
            stereotype: el.stereotype || ''
          };
          enriched.push(token);
          break;
        }

        case TOKEN_TYPES.MESSAGE: {
          const conn = token._raw;
          token.attributes = {
            label:       conn.label || conn.name || '',
            fromLifeline: conn.from || '',
            toLifeline:  conn.to || '',
            messageType: conn.type || 'message',   // 'message' | 'return'
            guard:       conn.guard || ''
          };
          enriched.push(token);
          break;
        }

        case TOKEN_TYPES.GUARD: {
          const el = token._raw;
          token.attributes = {
            condition: el.name || el.label || ''
          };
          enriched.push(token);
          break;
        }

        case TOKEN_TYPES.UNKNOWN:
        default: {
          // UNKNOWN tokens are kept in the stream but flagged — they will
          // be intercepted by the validation layer, never reach the engine.
          token.attributes = {
            rawType:  token._raw?.type || 'unrecognized',
            rawName:  token._raw?.name || '',
            reason:   `Element type '${token._raw?.type}' is not in the recognized token vocabulary`
          };
          enriched.push(token);
          break;
        }
      }

      // Remove internal scaffold (_raw) — not part of the public token shape
      delete token._raw;
    });

    return enriched;
  }

  /**
   * _extractClassAttributes(el)
   * Extracts the CLASS_DEF-specific attribute fields per the spec:
   * class name, visibility modifier, abstract/concrete flag.
   */
  static _extractClassAttributes(el) {
    return {
      className:         el.name || '',
      visibilityModifier: el.visibility || el.properties?.visibility || 'public',
      isAbstract:        el.type === 'abstract' || el.properties?.isAbstract === true,
      isInterface:       el.type === 'interface',
      stereotype:        el.stereotype || '',
      attributeCount:    (el.attributes || []).length,
      methodCount:       (el.methods || []).length,
      diagramType:       el.diagramType || 'class'
    };
  }

  /**
   * _extractAttributeAttributes(attr)
   * Extracts ATTRIBUTE token fields: name, type, visibility, default.
   */
  static _extractAttributeAttributes(attr) {
    return {
      name:         attr.name || '',
      type:         attr.type || 'Object',
      visibility:   attr.visibility || 'private',
      defaultValue: attr.defaultValue ?? attr.default ?? null,
      isStatic:     attr.isStatic || false,
      isFinal:      attr.isFinal  || false
    };
  }

  /**
   * _extractMethodAttributes(method)
   * Extracts METHOD token fields: name, returnType, params, visibility.
   */
  static _extractMethodAttributes(method) {
    return {
      name:         method.name || '',
      returnType:   method.returnType || 'void',
      parameters:   method.parameters || [],
      visibility:   method.visibility || 'public',
      isAbstract:   method.isAbstract  || false,
      isStatic:     method.isStatic    || false
    };
  }

  /**
   * _extractRelationshipAttributes(conn, elements)
   * Extracts RELATIONSHIP token fields per the spec:
   * source class, target class, relationship type, multiplicity, directionality.
   * Resolves element IDs to class names for readability.
   */
  static _extractRelationshipAttributes(conn, elements) {
    const findName = (id) => elements.find(e => e.id === id)?.name || id || '';
    return {
      sourceClass:      findName(conn.from),
      targetClass:      findName(conn.to),
      sourceId:         conn.from || '',
      targetId:         conn.to   || '',
      relationshipType: conn.type || 'association',
      fromMultiplicity: conn.fromMultiplicity || '',
      toMultiplicity:   conn.toMultiplicity   || '',
      directionality:   conn.directed !== false ? 'directed' : 'undirected',
      label:            conn.label     || '',
      fromRole:         conn.fromRole  || '',
      toRole:           conn.toRole    || ''
    };
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 4 — TOKEN STREAM CONSTRUCTION
  // ─────────────────────────────────────────────────────────

  /**
   * _buildTokenStream(enrichedTokens)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: Splits the enriched token list into two buckets:
   *   (a) valid tokens — ready for the transformation engine
   *   (b) unknown tokens — flagged for the validation layer
   *
   * TECHNICAL: The tokenStream is ordered: CLASS_DEF tokens come
   * first (so the symbol table resolves classes before relationships
   * reference them), then sub-tokens (ATTRIBUTE, METHOD), then
   * RELATIONSHIP tokens, then behavioral tokens.
   * This ordering satisfies the "flat sequential list that preserves
   * structural relationships" requirement from the spec.
   */
  static _buildTokenStream(enrichedTokens) {
    const ORDER = {
      [TOKEN_TYPES.CLASS_DEF]:    0,
      [TOKEN_TYPES.ATTRIBUTE]:    1,
      [TOKEN_TYPES.METHOD]:       2,
      [TOKEN_TYPES.RELATIONSHIP]: 3,
      [TOKEN_TYPES.ACTOR]:        4,
      [TOKEN_TYPES.USE_CASE]:     5,
      [TOKEN_TYPES.LIFELINE]:     6,
      [TOKEN_TYPES.MESSAGE]:      7,
      [TOKEN_TYPES.GUARD]:        8,
      [TOKEN_TYPES.UNKNOWN]:      99
    };

    const tokenStream   = [];
    const unknownTokens = [];

    // Sort so the engine always sees class definitions before references to them
    const sorted = [...enrichedTokens].sort(
      (a, b) => (ORDER[a.tokenType] ?? 99) - (ORDER[b.tokenType] ?? 99)
    );

    sorted.forEach(token => {
      if (token.tokenType === TOKEN_TYPES.UNKNOWN) {
        unknownTokens.push(token);
      } else {
        tokenStream.push(token);
      }
    });

    return { tokenStream, unknownTokens };
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 5 — SYMBOL TABLE POPULATION
  // ─────────────────────────────────────────────────────────

  /**
   * _buildSymbolTable(tokenStream, connections, elements)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: Builds a "phone book" of every class in the diagram.
   * When the transformation engine later sees a relationship arrow
   * pointing to "OrderService", it can look up "OrderService" in this
   * table to find all its attributes and methods immediately —
   * without scanning the whole diagram again.
   *
   * TECHNICAL: Constructs a Map<className, SymbolEntry> where each
   * entry holds the class's token ID, attributes[], methods[], and
   * outgoing/incoming relationship lists. Relationships are cross-
   * referenced using the sourceRef fields set in Stage 3.
   * This enables forward reference resolution for tokens that appear
   * later in the stream than the classes they reference.
   */
  static _buildSymbolTable(tokenStream, connections, elements) {
    const symbolTable = new Map();

    // First pass: register every class, actor, and use case.
    // ACTOR and USE_CASE tokens must be registered here so that
    // ValidationService._structuralValidation() can find them when it
    // checks RELATIONSHIP endpoints against the symbol table. Without
    // this, every association in a use case diagram fires a false-positive
    // "Relationship references undefined class 'X'" error (BUG FIX).
    tokenStream
      .filter(t =>
        t.tokenType === TOKEN_TYPES.CLASS_DEF ||
        t.tokenType === TOKEN_TYPES.ACTOR     ||
        t.tokenType === TOKEN_TYPES.USE_CASE
      )
      .forEach(token => {
        symbolTable.set(token.name, {
          tokenId:       token.id,
          className:     token.name,
          attributes:    [],   // filled in second pass from ATTRIBUTE tokens
          methods:       [],   // filled in second pass from METHOD tokens
          relationships: [],   // filled in third pass from RELATIONSHIP tokens
          isAbstract:    token.attributes.isAbstract   || false,
          isInterface:   token.attributes.isInterface  || false,
          visibility:    token.attributes.visibilityModifier || 'public',
          // Preserve the token kind so callers can distinguish actors/use
          // cases from real class definitions when needed.
          tokenType:     token.tokenType
        });
      });

    // Second pass: attach ATTRIBUTE and METHOD tokens to their parent class
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.ATTRIBUTE || t.tokenType === TOKEN_TYPES.METHOD)
      .forEach(token => {
        const entry = symbolTable.get(token.parentClass);
        if (!entry) return; // parent not in symbol table — caught by validation
        if (token.tokenType === TOKEN_TYPES.ATTRIBUTE) {
          entry.attributes.push(token);
        } else {
          entry.methods.push(token);
        }
      });

    // Third pass: attach RELATIONSHIP tokens (bi-directional registration)
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.RELATIONSHIP)
      .forEach(token => {
        const { sourceClass, targetClass } = token.attributes;

        // Register on the source class
        const sourceEntry = symbolTable.get(sourceClass);
        if (sourceEntry) {
          sourceEntry.relationships.push({
            direction:        'outgoing',
            relationshipType: token.attributes.relationshipType,
            partnerClass:     targetClass,
            tokenId:          token.id,
            fromMultiplicity: token.attributes.fromMultiplicity,
            toMultiplicity:   token.attributes.toMultiplicity
          });
        }

        // Register on the target class (incoming direction)
        const targetEntry = symbolTable.get(targetClass);
        if (targetEntry) {
          targetEntry.relationships.push({
            direction:        'incoming',
            relationshipType: token.attributes.relationshipType,
            partnerClass:     sourceClass,
            tokenId:          token.id,
            fromMultiplicity: token.attributes.fromMultiplicity,
            toMultiplicity:   token.attributes.toMultiplicity
          });
        }
      });

    return symbolTable;
  }


  // ─────────────────────────────────────────────────────────
  // METADATA BUILDER
  // ─────────────────────────────────────────────────────────

  /**
   * _buildMetadata(tokenStream, unknownTokens, diagramType)
   * Summary statistics about the tokenization run. Displayed in the
   * UI and logged for auditability (traceability requirement).
   */
  static _buildMetadata(tokenStream, unknownTokens, diagramType) {
    const count = (type) => tokenStream.filter(t => t.tokenType === type).length;
    return {
      diagramType,
      totalTokens:          tokenStream.length,
      unknownTokenCount:    unknownTokens.length,
      classDefs:            count(TOKEN_TYPES.CLASS_DEF),
      attributes:           count(TOKEN_TYPES.ATTRIBUTE),
      methods:              count(TOKEN_TYPES.METHOD),
      relationships:        count(TOKEN_TYPES.RELATIONSHIP),
      actors:               count(TOKEN_TYPES.ACTOR),
      useCases:             count(TOKEN_TYPES.USE_CASE),
      lifelines:            count(TOKEN_TYPES.LIFELINE),
      messages:             count(TOKEN_TYPES.MESSAGE),
      guards:               count(TOKEN_TYPES.GUARD)
    };
  }


  // ─────────────────────────────────────────────────────────
  // UTILITY — TOKEN LOOKUP HELPERS
  // ─────────────────────────────────────────────────────────

  /**
   * getTokenById(tokenStream, id)
   * Retrieves a single token from the stream by its ID.
   * Supports traceability: every token can be traced back to
   * its source element in the original diagram.
   */
  static getTokenById(tokenStream, id) {
    return tokenStream.find(t => t.id === id) || null;
  }

  /**
   * getTokensByType(tokenStream, tokenType)
   * Returns all tokens in the stream matching a given type.
   * Convenience method for the transformation engine.
   */
  static getTokensByType(tokenStream, tokenType) {
    return tokenStream.filter(t => t.tokenType === tokenType);
  }

  /**
   * serializeTokenStream(tokenStream)
   * Converts the token stream to a JSON string for logging,
   * debugging, or persistence. Supports the audit trail
   * requirement from the spec.
   */
  static serializeTokenStream(tokenStream) {
    return JSON.stringify(tokenStream, null, 2);
  }
}

export default TokenizationService;