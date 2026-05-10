/**
 * ============================================================
 * ValidationService.js — UML Diagram Validation Layer
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * Think of this as a quality-control inspector that reviews a UML
 * diagram before the system tries to turn it into code. It works
 * through three levels of inspection — like checking a blueprint
 * first for completeness, then for technical accuracy, then for
 * practical buildability. If anything is wrong, it gives the user
 * a plain-English explanation of the exact problem and a suggested fix.
 *
 * TECHNICAL OVERVIEW:
 * Implements the ValidationService class referenced in the CodeSynch
 * Class Diagram (Figure 5) and the three-stage validation pipeline
 * defined in Section 3.3.2 of the design specification:
 *
 *   Stage 1 — Structural Validation:   UML syntax rules (well-formedness).
 *                                       Failures HALT processing.
 *   Stage 2 — Semantic Validation:     Logical consistency checks.
 *                                       Violations produce WARNINGS, not hard stops.
 *   Stage 3 — Completeness Validation: Sufficiency for code generation.
 *                                       Incomplete diagrams proceed but get TODOs.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Receives the tokenStream + symbolTable produced by TokenizationService.js.
 * - UNKNOWN tokens from the tokenStream are passed in as unknownTokens and
 *   automatically generate structural errors.
 * - validate() result feeds back to UMLEditor.jsx which renders the
 *   inline error panel described in the spec.
 * - codeGenerator.js uses the completeness annotations (TODO comments)
 *   to mark incomplete generated code sections.
 * ============================================================
 */

import { TOKEN_TYPES } from './TokenizationService.js';

/**
 * SEVERITY levels — used to distinguish hard stops from soft warnings.
 * Matches the behavior described in the spec:
 *   ERROR   → halts transformation (structural failures)
 *   WARNING → user is informed but can proceed (semantic violations)
 *   INFO    → completeness annotations, TODOs injected into generated code
 */
export const SEVERITY = {
  ERROR:   'ERROR',
  WARNING: 'WARNING',
  INFO:    'INFO'
};

/**
 * VALID_MULTIPLICITY_PATTERN
 * Regex for valid UML multiplicity notation per the spec:
 * "1", "0..1", "1..*", "*", "0..*", "m..n" etc.
 */
const VALID_MULTIPLICITY_PATTERN = /^(\*|\d+(\.\.([\*]|\d+))?)$/;


// ─────────────────────────────────────────────────────────────
// ValidationService
// ─────────────────────────────────────────────────────────────

class ValidationService {

  /**
   * validate(tokenizationResult, diagramType)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: The main entry point. Feed it the output from
   * TokenizationService.tokenize() and it runs all three validation
   * stages, returning a full report of errors, warnings, and
   * completeness notes — along with a simple isValid flag.
   *
   * TECHNICAL: Runs stages 1 → 2 → 3 in sequence.
   * Stage 1 errors cause early exit (the spec says "the system halts
   * processing" on structural failure). Stages 2 and 3 always run
   * if stage 1 passes.
   * Returns a ValidationResult object consumed by UMLEditor.jsx
   * to render the inline error panel.
   *
   * @param {{
   *   tokenStream:   Array,
   *   symbolTable:   Map,
   *   unknownTokens: Array,
   *   metadata:      object
   * }} tokenizationResult - Output from TokenizationService.tokenize()
   * @param {string} [diagramType='class'] - 'class' | 'usecase' | 'sequence'
   * @returns {{
   *   isValid:          boolean,
   *   canProceed:       boolean,
   *   stage1Errors:     Array<ValidationIssue>,
   *   stage2Warnings:   Array<ValidationIssue>,
   *   stage3Infos:      Array<ValidationIssue>,
   *   allIssues:        Array<ValidationIssue>,
   *   todoAnnotations:  Array<TodoAnnotation>,
   *   summary:          string
   * }}
   */
  static validate(tokenizationResult, diagramType = 'class') {
    const { tokenStream, symbolTable, unknownTokens } = tokenizationResult;

    // ── Stage 1: Structural Validation ────────────────────
    const stage1Errors = this._structuralValidation(tokenStream, symbolTable, unknownTokens, diagramType);

    // Per spec: "If structural validation fails, the system halts processing"
    // We set canProceed=false but still run stages 2+3 so the full picture
    // is returned to the UI in one call (avoids multiple round-trips).
    const hasStructuralErrors = stage1Errors.length > 0;

    // ── Stage 2: Semantic Validation ──────────────────────
    const stage2Warnings = this._semanticValidation(tokenStream, symbolTable, diagramType);

    // ── Stage 3: Completeness Validation ──────────────────
    const { issues: stage3Infos, todoAnnotations } =
      this._completenessValidation(tokenStream, symbolTable, diagramType);

    const allIssues = [
      ...stage1Errors,
      ...stage2Warnings,
      ...stage3Infos
    ];

    return {
      isValid:         !hasStructuralErrors && stage2Warnings.length === 0,
      canProceed:      !hasStructuralErrors,     // soft warnings don't block generation
      stage1Errors,
      stage2Warnings,
      stage3Infos,
      allIssues,
      todoAnnotations,
      summary:         this._buildSummary(stage1Errors, stage2Warnings, stage3Infos)
    };
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 1 — STRUCTURAL VALIDATION
  // ─────────────────────────────────────────────────────────

  /**
   * _structuralValidation(tokenStream, symbolTable, unknownTokens, diagramType)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: Checks the "grammar" of the diagram — are all required
   * parts present? Are all arrows connected to real classes?
   * Does every class have a name? These are the hard rules that must
   * pass before any code generation can begin.
   *
   * TECHNICAL: Implements all structural checks listed in the spec:
   *   ✓ Every class node contains at least a name identifier
   *   ✓ Every RELATIONSHIP token references two valid, existing class identifiers
   *   ✓ No two classes share an identical name
   *   ✓ Every METHOD token contains a return type declaration
   *   ✓ Every ATTRIBUTE token is assigned a data type
   *   ✓ UNKNOWN tokens flagged by the tokenizer are surfaced as errors
   */
  static _structuralValidation(tokenStream, symbolTable, unknownTokens, diagramType) {
    const errors = [];

    // ── Check 1: Every class node has a name identifier ───
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.CLASS_DEF)
      .forEach(token => {
        if (!token.name || !token.name.trim()) {
          errors.push(this._issue(
            SEVERITY.ERROR,
            'MISSING_NAME',
            token.id,
            'Unnamed class element',
            'A class element in the diagram has no name. Every class must have a name identifier.',
            'Double-click the element and enter a class name.'
          ));
        }
      });

    // ── Check 2: No duplicate class names ──────────────────
    const classNames = tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.CLASS_DEF)
      .map(t => t.name?.trim())
      .filter(Boolean);

    const nameCounts = classNames.reduce((acc, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    Object.entries(nameCounts).forEach(([name, count]) => {
      if (count > 1) {
        errors.push(this._issue(
          SEVERITY.ERROR,
          'DUPLICATE_CLASS_NAME',
          name,
          `Duplicate class name: '${name}'`,
          `Two or more classes share the name '${name}'. Class names must be unique within the same diagram.`,
          `Rename one of the '${name}' classes to a distinct identifier.`
        ));
      }
    });

    // ── Check 3: Every RELATIONSHIP references valid classes ─
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.RELATIONSHIP)
      .forEach(token => {
        const { sourceClass, targetClass, sourceId, targetId } = token.attributes;

        // Check source exists — fires only when the endpoint name is completely
        // absent (the connection has no `from` element at all).
        if (!sourceClass) {
          errors.push(this._issue(
            SEVERITY.ERROR,
            'DANGLING_RELATIONSHIP_SOURCE',
            token.id,
            `Dangling relationship: missing source class`,
            `A relationship (ID: ${token.id}) has no valid source class. Every relationship must connect two existing class nodes.`,
            'Reconnect the relationship arrow to a valid source class, or delete the dangling connector.'
          ));
        }

        // Check target exists — same guard: fires only when targetClass is absent.
        if (!targetClass) {
          errors.push(this._issue(
            SEVERITY.ERROR,
            'DANGLING_RELATIONSHIP_TARGET',
            token.id,
            `Dangling relationship: missing target class`,
            `A relationship (ID: ${token.id}) has no valid target class. Every relationship must connect two existing class nodes.`,
            'Reconnect the relationship arrow to a valid target class, or delete the dangling connector.'
          ));
        }

        // Check that referenced names actually exist in the symbol table.
        // After the TokenizationService fix, actors and use cases are
        // registered in the symbol table alongside class definitions, so
        // this check now works correctly for all diagram types.
        if (sourceClass && !symbolTable.has(sourceClass)) {
          errors.push(this._issue(
            SEVERITY.ERROR,
            'UNDEFINED_SOURCE_CLASS',
            token.id,
            `Relationship references undefined class '${sourceClass}'`,
            `A relationship references source class '${sourceClass}', but this class is not defined in the diagram.`,
            `Add a class node named '${sourceClass}' or remove the relationship.`
          ));
        }

        if (targetClass && !symbolTable.has(targetClass)) {
          errors.push(this._issue(
            SEVERITY.ERROR,
            'UNDEFINED_TARGET_CLASS',
            token.id,
            `Relationship references undefined class '${targetClass}'`,
            `A relationship references target class '${targetClass}', but this class is not defined in the diagram.`,
            `Add a class node named '${targetClass}' or remove the relationship.`
          ));
        }
      });

    // ── Check 4: Every METHOD has a return type ────────────
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.METHOD)
      .forEach(token => {
        const returnType = token.attributes?.returnType;
        if (!returnType || !returnType.trim() || returnType.trim() === '') {
          errors.push(this._issue(
            SEVERITY.ERROR,
            'MISSING_RETURN_TYPE',
            token.id,
            `Method '${token.name}' in class '${token.parentClass}' has no return type`,
            `The method '${token.name}' belonging to '${token.parentClass}' does not declare a return type. All methods must specify a return type (e.g., void, String, int).`,
            `Open the properties panel for '${token.parentClass}' and set a return type for the '${token.name}' method.`
          ));
        }
      });

    // ── Check 5: Every ATTRIBUTE has a data type ───────────
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.ATTRIBUTE)
      .forEach(token => {
        const type = token.attributes?.type;
        if (!type || !type.trim() || (type.trim() === 'Object' && !token.attributes._typeWasExplicit)) {
          // We only warn here if type is completely absent (Object is a valid fallback)
          if (!type || !type.trim()) {
            errors.push(this._issue(
              SEVERITY.ERROR,
              'MISSING_ATTRIBUTE_TYPE',
              token.id,
              `Attribute '${token.name}' in class '${token.parentClass}' has no data type`,
              `The attribute '${token.name}' in class '${token.parentClass}' does not have an assigned data type. All attributes must specify a type (e.g., String, int, Boolean).`,
              `Open the properties panel for '${token.parentClass}' and assign a type to the '${token.name}' attribute.`
            ));
          }
        }
      });

    // ── Check 6: UNKNOWN tokens from tokenizer ─────────────
    unknownTokens.forEach(token => {
      errors.push(this._issue(
        SEVERITY.ERROR,
        'UNKNOWN_TOKEN',
        token.sourceRef || token.id,
        `Unrecognized element type: '${token.attributes?.rawType || token.elementType}'`,
        token.attributes?.reason || `An element of type '${token.elementType}' could not be classified into a recognized token category.`,
        'Remove the unsupported element or replace it with a standard UML element type.'
      ));
    });

    return errors;
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 2 — SEMANTIC VALIDATION
  // ─────────────────────────────────────────────────────────

  /**
   * _semanticValidation(tokenStream, symbolTable, diagramType)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: Checks the "logic" of the diagram — even if all parts
   * are present and named correctly, do they make sense together?
   * Circular inheritance (A extends B extends A) is technically "present"
   * but logically impossible. These are warnings: the user is told
   * about the issue but can choose to proceed.
   *
   * TECHNICAL: Implements all semantic checks listed in the spec:
   *   ✓ Circular inheritance detection
   *   ✓ Abstract classes with no abstract methods warned
   *   ✓ Multiplicity values conform to valid UML notation
   *   ✓ Use case diagrams: each use case connected to at least one actor
   */
  static _semanticValidation(tokenStream, symbolTable, diagramType) {
    const warnings = [];

    // ── Check 1: Circular inheritance ──────────────────────
    const inheritanceGraph = this._buildInheritanceGraph(tokenStream);
    const cycles = this._detectCycles(inheritanceGraph);
    cycles.forEach(cycle => {
      const cycleStr = cycle.join(' → ');
      warnings.push(this._issue(
        SEVERITY.WARNING,
        'CIRCULAR_INHERITANCE',
        cycle[0],
        `Circular inheritance detected: ${cycleStr}`,
        `The inheritance chain '${cycleStr}' forms a cycle. Circular inheritance is not valid in UML or in most programming languages.`,
        `Remove one of the inheritance relationships in the chain: ${cycleStr}.`
      ));
    });

    // ── Check 2: Abstract class with no abstract methods ───
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.CLASS_DEF && t.attributes.isAbstract)
      .forEach(token => {
        const symbolEntry  = symbolTable.get(token.name);
        const abstractMethods = (symbolEntry?.methods || [])
          .filter(m => m.attributes?.isAbstract === true);

        if (abstractMethods.length === 0) {
          warnings.push(this._issue(
            SEVERITY.WARNING,
            'ABSTRACT_NO_ABSTRACT_METHODS',
            token.id,
            `Abstract class '${token.name}' contains no abstract methods`,
            `The class '${token.name}' is marked as abstract but defines no abstract methods. An abstract class without abstract methods provides no contract for subclasses to implement.`,
            `Add at least one abstract method to '${token.name}', or change its type to a concrete class.`
          ));
        }
      });

    // ── Check 3: Multiplicity notation validity ─────────────
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.RELATIONSHIP)
      .forEach(token => {
        const { fromMultiplicity, toMultiplicity } = token.attributes;

        [
          { value: fromMultiplicity, side: 'source' },
          { value: toMultiplicity,   side: 'target' }
        ].forEach(({ value, side }) => {
          if (value && !VALID_MULTIPLICITY_PATTERN.test(value.trim())) {
            warnings.push(this._issue(
              SEVERITY.WARNING,
              'INVALID_MULTIPLICITY',
              token.id,
              `Invalid multiplicity '${value}' on ${side} end of relationship`,
              `The ${side} multiplicity '${value}' on the relationship between '${token.attributes.sourceClass}' and '${token.attributes.targetClass}' does not conform to valid UML notation.`,
              `Use a valid UML multiplicity value such as "1", "0..1", "1..*", or "*".`
            ));
          }
        });
      });

    // ── Check 4: Use Case — every use case reachable from at least one actor
    // BUG FIX: Previously only direct actor→use case associations were considered.
    // Use cases connected only via <<include>> or <<extend>> arrows (like
    // "Download docs", "Preview doc", "Manage folders", "Add company") were
    // falsely flagged as unconnected because the check only looked one hop.
    // Fix: a use case is considered reachable if there is a transitive path from
    // any actor through association / include / extend edges. We do a BFS/DFS
    // from all actor nodes and mark every reachable use case as connected.
    if (diagramType === 'usecase') {
      const actorTokens = tokenStream.filter(t => t.tokenType === TOKEN_TYPES.ACTOR);
      const useCases    = tokenStream.filter(t => t.tokenType === TOKEN_TYPES.USE_CASE);
      const relTokens   = tokenStream.filter(t => t.tokenType === TOKEN_TYPES.RELATIONSHIP);

      // Build adjacency: id → Set of connected ids (undirected, all rel types)
      const adj = new Map();
      const addEdge = (a, b) => {
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a).add(b);
        adj.get(b).add(a);
      };
      relTokens.forEach(rel => {
        const { sourceId, targetId } = rel.attributes;
        if (sourceId && targetId) addEdge(sourceId, targetId);
      });

      // BFS from all actor nodes to find every reachable element
      const reachable = new Set();
      const queue = actorTokens.map(a => a.id);
      queue.forEach(id => reachable.add(id));
      while (queue.length > 0) {
        const current = queue.shift();
        (adj.get(current) || new Set()).forEach(neighbor => {
          if (!reachable.has(neighbor)) {
            reachable.add(neighbor);
            queue.push(neighbor);
          }
        });
      }

      useCases.forEach(ucToken => {
        if (!reachable.has(ucToken.id)) {
          warnings.push(this._issue(
            SEVERITY.WARNING,
            'USE_CASE_NO_ACTOR',
            ucToken.id,
            `Use case '${ucToken.name}' is not connected to any actor`,
            `The use case '${ucToken.name}' has no relationship (direct or via include/extend) to any actor in the diagram.`,
            `Connect '${ucToken.name}' to an actor or to another use case that is already reachable from an actor.`
          ));
        }
      });
    }

    return warnings;
  }


  // ─────────────────────────────────────────────────────────
  // STAGE 3 — COMPLETENESS VALIDATION
  // ─────────────────────────────────────────────────────────

  /**
   * _completenessValidation(tokenStream, symbolTable, diagramType)
   * ─────────────────────────────────────────────────────────
   * LAYMAN'S: Checks whether the diagram has *enough* information
   * to generate useful code. A class with no attributes or methods
   * can still be tokenized and passes structural checks — but the
   * generated code will be an empty shell. This stage catches that
   * and annotates the output with TODO comments so the developer
   * knows what to fill in.
   *
   * TECHNICAL: Returns both INFO-severity issues (for the error panel)
   * and todoAnnotations (injected by codeGenerator.js into generated files).
   * Incomplete diagrams PROCEED through generation — they just produce
   * annotated, incomplete output as the spec requires.
   *
   * Checks per diagram type match the spec exactly:
   *   Class:    every class has ≥1 attribute or ≥1 method
   *   Sequence: every lifeline has ≥1 message
   *   Use Case: every actor is connected to ≥1 use case
   */
  static _completenessValidation(tokenStream, symbolTable, diagramType) {
    const issues         = [];
    const todoAnnotations = [];

    if (diagramType === 'class' || diagramType === undefined) {

      tokenStream
        .filter(t => t.tokenType === TOKEN_TYPES.CLASS_DEF)
        .forEach(token => {
          const entry        = symbolTable.get(token.name);
          const attrCount    = entry?.attributes?.length || 0;
          const methodCount  = entry?.methods?.length    || 0;

          if (attrCount === 0 && methodCount === 0) {
            issues.push(this._issue(
              SEVERITY.INFO,
              'EMPTY_CLASS',
              token.id,
              `Class '${token.name}' has no attributes or methods`,
              `The class '${token.name}' contains no attributes or methods. The generated code will be a structural shell only.`,
              `Add at least one attribute or method to '${token.name}' to generate meaningful code.`
            ));
            todoAnnotations.push({
              targetClass: token.name,
              comment:     `// TODO: No attributes or methods defined for class '${token.name}'. Add members to generate meaningful code.`
            });
          }

          if (attrCount === 0 && methodCount > 0) {
            todoAnnotations.push({
              targetClass: token.name,
              comment:     `// TODO: Class '${token.name}' has no attributes. Consider adding fields.`
            });
          }

          if (methodCount === 0 && attrCount > 0) {
            todoAnnotations.push({
              targetClass: token.name,
              comment:     `// TODO: Class '${token.name}' has no methods. Consider adding behavior.`
            });
          }
        });
    }

    if (diagramType === 'sequence') {
      const lifelineIds = new Set(
        tokenStream.filter(t => t.tokenType === TOKEN_TYPES.LIFELINE).map(t => t.id)
      );
      const messageTokens = tokenStream.filter(t => t.tokenType === TOKEN_TYPES.MESSAGE);

      lifelineIds.forEach(lifelineId => {
        const lifelineToken = tokenStream.find(t => t.id === lifelineId);
        const hasMessage = messageTokens.some(m =>
          m.attributes.fromLifeline === lifelineId ||
          m.attributes.toLifeline   === lifelineId
        );

        if (!hasMessage) {
          issues.push(this._issue(
            SEVERITY.INFO,
            'LIFELINE_NO_MESSAGES',
            lifelineId,
            `Lifeline '${lifelineToken?.name}' has no messages`,
            `The lifeline '${lifelineToken?.name}' is not associated with any messages. Each lifeline should participate in at least one message.`,
            `Connect '${lifelineToken?.name}' to at least one message arrow.`
          ));
          todoAnnotations.push({
            targetClass: lifelineToken?.name || lifelineId,
            comment:     `// TODO: Lifeline '${lifelineToken?.name}' has no messages — no interaction code generated.`
          });
        }
      });
    }

    if (diagramType === 'usecase') {
      const actorTokens  = tokenStream.filter(t => t.tokenType === TOKEN_TYPES.ACTOR);
      const relTokens    = tokenStream.filter(t => t.tokenType === TOKEN_TYPES.RELATIONSHIP);
      const useCaseIds   = new Set(
        tokenStream.filter(t => t.tokenType === TOKEN_TYPES.USE_CASE).map(t => t.id)
      );

      actorTokens.forEach(actorToken => {
        const connectedToUseCase = relTokens.some(rel => {
          const { sourceId, targetId } = rel.attributes;
          return (
            (sourceId === actorToken.id && useCaseIds.has(targetId)) ||
            (targetId === actorToken.id && useCaseIds.has(sourceId))
          );
        });

        if (!connectedToUseCase) {
          issues.push(this._issue(
            SEVERITY.INFO,
            'ACTOR_NO_USE_CASES',
            actorToken.id,
            `Actor '${actorToken.name}' is not connected to any use case`,
            `The actor '${actorToken.name}' has no associations with any use cases. Each actor should interact with at least one use case.`,
            `Connect '${actorToken.name}' to at least one use case using an association.`
          ));
          todoAnnotations.push({
            targetClass: actorToken.name,
            comment:     `// TODO: Actor '${actorToken.name}' has no associated use cases — handler stub only.`
          });
        }
      });
    }

    return { issues, todoAnnotations };
  }


  // ─────────────────────────────────────────────────────────
  // HELPERS — INHERITANCE CYCLE DETECTION
  // ─────────────────────────────────────────────────────────

  /**
   * _buildInheritanceGraph(tokenStream)
   * Builds a directed adjacency map { className → [parentClassName] }
   * from all inheritance/generalization RELATIONSHIP tokens.
   */
  static _buildInheritanceGraph(tokenStream) {
    const graph = {};
    tokenStream
      .filter(t => t.tokenType === TOKEN_TYPES.CLASS_DEF)
      .forEach(t => { graph[t.name] = []; });

    tokenStream
      .filter(t =>
        t.tokenType === TOKEN_TYPES.RELATIONSHIP &&
        ['inheritance', 'generalization', 'realization'].includes(t.attributes?.relationshipType)
      )
      .forEach(t => {
        const { sourceClass, targetClass } = t.attributes;
        if (sourceClass && targetClass) {
          if (!graph[sourceClass]) graph[sourceClass] = [];
          graph[sourceClass].push(targetClass);
        }
      });

    return graph;
  }

  /**
   * _detectCycles(graph)
   * DFS cycle detection on the inheritance graph.
   * Returns an array of cycle paths, each as an array of class names.
   * e.g. [['ClassA', 'ClassB', 'ClassA']]
   */
  static _detectCycles(graph) {
    const visited   = new Set();
    const inStack   = new Set();
    const cycles    = [];

    const dfs = (node, path) => {
      if (inStack.has(node)) {
        // Found a cycle — extract just the cyclic portion
        const cycleStart = path.indexOf(node);
        cycles.push([...path.slice(cycleStart), node]);
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      inStack.add(node);
      path.push(node);

      (graph[node] || []).forEach(neighbor => dfs(neighbor, path));

      path.pop();
      inStack.delete(node);
    };

    Object.keys(graph).forEach(node => {
      if (!visited.has(node)) dfs(node, []);
    });

    return cycles;
  }


  // ─────────────────────────────────────────────────────────
  // HELPERS — ISSUE FACTORY & SUMMARY
  // ─────────────────────────────────────────────────────────

  /**
   * _issue(severity, code, elementRef, title, description, recommendedAction)
   * Factory for ValidationIssue objects.
   * Matches the inline error panel data shape described in the spec:
   *   - elementRef:        the name or ID of the problematic element
   *   - description:       plain-language violation description
   *   - recommendedAction: suggested fix
   */
  static _issue(severity, code, elementRef, title, description, recommendedAction) {
    return {
      severity,
      code,
      elementRef,
      title,
      description,
      recommendedAction,
      timestamp: Date.now()
    };
  }

  /**
   * _buildSummary(errors, warnings, infos)
   * Returns a one-line human-readable summary for the status bar / toast.
   */
  static _buildSummary(errors, warnings, infos) {
    if (errors.length === 0 && warnings.length === 0 && infos.length === 0) {
      return 'Diagram is valid and ready for code generation.';
    }
    const parts = [];
    if (errors.length > 0)   parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''}`);
    if (warnings.length > 0) parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
    if (infos.length > 0)    parts.push(`${infos.length} completeness note${infos.length > 1 ? 's' : ''}`);
    const canProceed = errors.length === 0;
    return `Validation: ${parts.join(', ')}. ${canProceed ? 'Code generation can proceed.' : 'Fix errors before generating code.'}`;
  }


  // ─────────────────────────────────────────────────────────
  // PUBLIC UTILITY — ISSUE FILTERS
  // ─────────────────────────────────────────────────────────

  /** Returns only ERROR-severity issues from a ValidationResult. */
  static getErrors(validationResult) {
    return validationResult.allIssues.filter(i => i.severity === SEVERITY.ERROR);
  }

  /** Returns only WARNING-severity issues. */
  static getWarnings(validationResult) {
    return validationResult.allIssues.filter(i => i.severity === SEVERITY.WARNING);
  }

  /** Returns only INFO-severity (completeness) issues. */
  static getInfos(validationResult) {
    return validationResult.allIssues.filter(i => i.severity === SEVERITY.INFO);
  }

  /**
   * getTodoAnnotationsForClass(validationResult, className)
   * Returns TODO comment strings for a specific class, used by
   * codeGenerator.js to inject placeholder comments into generated files.
   */
  static getTodoAnnotationsForClass(validationResult, className) {
    return validationResult.todoAnnotations
      .filter(a => a.targetClass === className)
      .map(a => a.comment);
  }
}

export default ValidationService;