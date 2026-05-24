/**
 * ============================================================
 * PropertiesPanel.jsx — Properties & Generated Code Side Panel
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This is the right-hand panel in the editor. It has two tabs:
 *
 *   "Properties" tab — shows an editing form for whatever is
 *   currently selected on the canvas. Select a class and you can
 *   rename it, add/remove attributes and methods, change visibility,
 *   mark things static or abstract, and resize it. Select a
 *   connection and you can set multiplicity, labels, and roles.
 *   Select nothing and you see a placeholder prompt.
 *
 *   "Generated Code" tab — shows the source code that was last
 *   generated from the diagram. If the diagram produced multiple
 *   files, file-name tabs let you browse between them. A "Copy Code"
 *   button lets the user grab the code quickly.
 *
 * TECHNICAL OVERVIEW:
 * Three React components are defined in this file:
 *   1. PropertiesPanel   — outer container; owns tab switching and
 *                          the currentCode sync effect; routes to the
 *                          correct sub-component based on selection.
 *   2. ElementProperties — form UI for editing a single element's
 *                          name, stereotype, size, attributes, and methods.
 *                          Inline helpers: updateAttribute, addAttribute,
 *                          removeAttribute, updateMethod, addMethod,
 *                          removeMethod.
 *   3. ConnectionProperties — form UI for editing a connection's
 *                             multiplicity, label, and role annotations.
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Rendered by UMLEditor.jsx as the fixed right sidebar.
 * - setElements / setConnections prop calls modify UMLEditor's
 *   live diagram state directly, so canvas rendering stays in sync.
 * - saveToHistory is called after any edit that should be undoable.
 * - generatedFiles / selectedFileIndex / setSelectedFileIndex connect
 *   the Code tab to the output of CodeGenerator.splitIntoFiles() in
 *   UMLEditor.jsx.
 * ============================================================
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trash2, GitCompare, Eye, Pencil, RefreshCw } from 'lucide-react';
import CodeToUMLConverter from '../services/codeToUMLConverter';

/**
 * Fix #18: Lightweight syntax highlighter — no external library needed.
 * Tokenises Java / Python / JavaScript source into coloured spans.
 * Returns an array of { text, className } tokens.
 */
const KEYWORDS = {
  Java: ['abstract','assert','boolean','break','byte','case','catch','char','class',
         'const','continue','default','do','double','else','enum','extends','final',
         'finally','float','for','goto','if','implements','import','instanceof','int',
         'interface','long','native','new','null','package','private','protected',
         'public','return','short','static','strictfp','super','switch','synchronized',
         'this','throw','throws','transient','try','void','volatile','while','true','false'],
  Python: ['and','as','assert','async','await','break','class','continue','def','del',
           'elif','else','except','finally','for','from','global','if','import','in',
           'is','lambda','None','nonlocal','not','or','pass','raise','return','True',
           'False','try','while','with','yield','self','super'],
  JavaScript: ['async','await','break','case','catch','class','const','continue',
               'debugger','default','delete','do','else','export','extends','finally',
               'for','from','function','if','import','in','instanceof','let','new',
               'null','of','return','static','super','switch','this','throw','true',
               'false','try','typeof','undefined','var','void','while','with','yield'],
};

/**
 * highlightCode(code, language)
 * Returns an array of token objects: { text, type }
 * type: 'keyword' | 'string' | 'comment' | 'number' | 'plain'
 */
function highlightCode(code, language) {
  if (!code) return [];
  const kwSet = new Set(KEYWORDS[language] || KEYWORDS.Java);
  const tokens = [];

  // Simple regex tokeniser — processes code left to right
  const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([^\w\s])/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const [full, comment, str, num, word, _space, _other] = match;
    if (comment)      tokens.push({ text: full, type: 'comment' });
    else if (str)     tokens.push({ text: full, type: 'string' });
    else if (num)     tokens.push({ text: full, type: 'number' });
    else if (word)    tokens.push({ text: full, type: kwSet.has(full) ? 'keyword' : 'plain' });
    else              tokens.push({ text: full, type: 'plain' });
  }
  return tokens;
}

const TOKEN_COLORS = {
  keyword: '#569cd6',   // blue  — keywords
  string:  '#ce9178',   // orange — strings
  comment: '#6a9955',   // green  — comments
  number:  '#b5cea8',   // light green — numbers
  plain:   '#d4d4d4',   // light grey — identifiers/operators
};

/**
 * computeDiff(oldCode, newCode)
 * -----------------------------
 * LAYMAN'S: Compares two versions of generated code line-by-line and
 *   tags each line as 'added', 'removed', 'changed', or 'unchanged'.
 *   This powers the diff-highlight feature so users can instantly see
 *   what changed in the code after editing the UML diagram.
 *
 * TECHNICAL: Implements a simple LCS (Longest Common Subsequence)-based
 *   diff using a DP table on lines. Returns an array of diff entries:
 *   { type: 'added'|'removed'|'unchanged', line: string, lineNum?: number }
 *   'changed' blocks are pairs of removed+added lines with the same index.
 */
function computeDiff(oldCode, newCode) {
  if (!oldCode && !newCode) return [];
  if (!oldCode) return newCode.split('\n').map(line => ({ type: 'added', line }));
  if (!newCode) return oldCode.split('\n').map(line => ({ type: 'removed', line }));

  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS DP table
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'unchanged', line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', line: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', line: oldLines[i - 1] });
      i--;
    }
  }

  // Merge adjacent removed+added into 'changed' pairs for nicer display
  const merged = [];
  let k = 0;
  while (k < result.length) {
    if (
      result[k].type === 'removed' &&
      k + 1 < result.length &&
      result[k + 1].type === 'added'
    ) {
      merged.push({ type: 'changed', oldLine: result[k].line, line: result[k + 1].line });
      k += 2;
    } else {
      merged.push(result[k]);
      k++;
    }
  }
  return merged;
}

/** Counts added/removed/changed lines for the diff summary badge */
function diffStats(diffLines) {
  let added = 0, removed = 0, changed = 0;
  for (const d of diffLines) {
    if (d.type === 'added') added++;
    else if (d.type === 'removed') removed++;
    else if (d.type === 'changed') changed++;
  }
  return { added, removed, changed };
}

const DIFF_BG = {
  added:     'rgba(40,167,69,0.18)',
  removed:   'rgba(220,53,69,0.18)',
  changed:   'rgba(255,193,7,0.15)',
  unchanged: 'transparent',
};
const DIFF_BORDER = {
  added:   '#28a745',
  removed: '#dc3545',
  changed: '#ffc107',
};
const DIFF_PREFIX = {
  added:   '+',
  removed: '-',
  changed: '~',
  unchanged: ' ',
};

/**
 * SyntaxHighlightedCode({ code, prevCode, language, showDiff })
 * -------------------------------------------------------------
 * LAYMAN'S: Renders the generated code with syntax colouring. When
 *   showDiff is true AND there is a previous version to compare against,
 *   each line also gets a coloured background: green for new lines, red
 *   for deleted lines, yellow for lines that were rewritten.
 *
 * TECHNICAL: When showDiff is false it renders exactly as before —
 *   a flat token stream in a <pre>. When showDiff is true it switches
 *   to a line-by-line render so each line can carry its own background
 *   colour. The diff is computed via computeDiff() (LCS-based).
 */
const SyntaxHighlightedCode = ({ code, prevCode, language, showDiff }) => {
  const tokens = useMemo(() => highlightCode(code, language), [code, language]);

  const diffLines = useMemo(() => {
    if (!showDiff || !prevCode || prevCode === code) return null;
    return computeDiff(prevCode, code);
  }, [showDiff, prevCode, code, language]);

  const preStyle = {
    tabSize: 2,
    margin: 0,
    fontSize: '0.75rem',
    lineHeight: '1.6',
    fontFamily: 'monospace',
    overflowX: 'auto',
    overflowY: 'auto',
    flex: 1,
    background: '#1e1e1e',
    padding: '0.75rem',
    borderRadius: '0.25rem',
  };

  if (!diffLines) {
    // Normal render — flat token stream
    return (
      <pre style={preStyle}>
        {tokens.map((tok, i) => (
          <span key={i} style={{ color: TOKEN_COLORS[tok.type] || TOKEN_COLORS.plain }}>
            {tok.text}
          </span>
        ))}
      </pre>
    );
  }

  // Diff render — line by line
  return (
    <pre style={{ ...preStyle, padding: 0 }}>
      {diffLines.map((entry, idx) => {
        const isChanged = entry.type === 'changed';
        const bg = DIFF_BG[entry.type] || 'transparent';
        const borderColor = DIFF_BORDER[entry.type];
        const prefix = DIFF_PREFIX[entry.type] || ' ';

        if (isChanged) {
          // Show old line (red) then new line (green)
          const oldTokens = highlightCode(entry.oldLine, language);
          const newTokens = highlightCode(entry.line, language);
          return (
            <React.Fragment key={idx}>
              <span style={{
                display: 'block',
                background: DIFF_BG.removed,
                borderLeft: `3px solid ${DIFF_BORDER.removed}`,
                paddingLeft: '0.5rem',
                paddingRight: '0.75rem',
                minHeight: '1.2em',
              }}>
                <span style={{ color: '#dc3545', userSelect: 'none', marginRight: '0.4rem', opacity: 0.7 }}>-</span>
                {oldTokens.map((tok, ti) => (
                  <span key={ti} style={{ color: TOKEN_COLORS[tok.type] || TOKEN_COLORS.plain }}>{tok.text}</span>
                ))}
              </span>
              <span style={{
                display: 'block',
                background: DIFF_BG.added,
                borderLeft: `3px solid ${DIFF_BORDER.added}`,
                paddingLeft: '0.5rem',
                paddingRight: '0.75rem',
                minHeight: '1.2em',
              }}>
                <span style={{ color: '#28a745', userSelect: 'none', marginRight: '0.4rem', opacity: 0.7 }}>+</span>
                {newTokens.map((tok, ti) => (
                  <span key={ti} style={{ color: TOKEN_COLORS[tok.type] || TOKEN_COLORS.plain }}>{tok.text}</span>
                ))}
              </span>
            </React.Fragment>
          );
        }

        const lineTokens = highlightCode(entry.line, language);
        return (
          <span key={idx} style={{
            display: 'block',
            background: bg,
            borderLeft: borderColor ? `3px solid ${borderColor}` : '3px solid transparent',
            paddingLeft: '0.5rem',
            paddingRight: '0.75rem',
            minHeight: '1.2em',
          }}>
            {entry.type !== 'unchanged' && (
              <span style={{
                color: borderColor,
                userSelect: 'none',
                marginRight: '0.4rem',
                opacity: 0.8,
                fontWeight: 'bold',
              }}>{prefix}</span>
            )}
            {lineTokens.map((tok, ti) => (
              <span key={ti} style={{ color: TOKEN_COLORS[tok.type] || TOKEN_COLORS.plain }}>{tok.text}</span>
            ))}
          </span>
        );
      })}
    </pre>
  );
};

/**
 * PropertiesPanel({ ...props })
 * ------------------------------
 * LAYMAN'S: The outer panel component. Manages the Properties / Generated
 *   Code tab toggle and uses a useEffect to keep the displayed code in
 *   sync with the selected file tab or the latest generated output.
 *
 * TECHNICAL: Owns the currentCode local state (derived/synced from
 *   generatedFiles + selectedFileIndex via useEffect). Delegates
 *   rendering to ElementProperties, ConnectionProperties, or placeholder
 *   text depending on what is selected in the diagram.
 *
 * @param {boolean}  showCodePanel          - True when the Code tab is active
 * @param {Function} setShowCodePanel       - Switches between Properties/Code tabs
 * @param {Array}    selectedElements       - Currently selected element objects
 * @param {Object}   selectedConnection     - Currently selected connection object
 * @param {Array}    elements               - Full element list from UMLEditor
 * @param {Array}    connections            - Full connection list from UMLEditor
 * @param {Function} setElements            - Updates the element list in UMLEditor
 * @param {Function} setSelectedElements    - Updates the selection in UMLEditor
 * @param {Function} setConnections         - Updates the connection list in UMLEditor
 * @param {Function} setSelectedConnection  - Updates the selected connection in UMLEditor
 * @param {Function} saveToHistory          - Commits the current state to undo history
 * @param {string}   selectedDiagram        - Active diagram type: 'class' | 'usecase' | 'sequence'
 * @param {Array}    generatedFiles         - Array of { filename, content } objects
 * @param {number}   selectedFileIndex      - Index of the active file tab
 * @param {Function} setSelectedFileIndex   - Changes the active file tab
 */

const PropertiesPanel = ({
  showCodePanel,
  setShowCodePanel,
  language,
  selectedDiagram = 'class',
  selectedElements,
  selectedConnection,
  elements,
  connections,
  setElements,
  setSelectedElements,
  setConnections,
  setSelectedConnection,
  saveToHistory,
  onCopySuccess,
  onCodeEdit,
  generatedCode,
  generatedFiles = [],
  selectedFileIndex = 0,
  setSelectedFileIndex = () => {},
  panelWidth = 384,
  setPanelWidth = () => {},
}) => {
  /**
   * currentCode / useEffect sync
   * LAYMAN'S: Keeps the code display in sync whenever the user clicks a
   *   different file tab or new code is generated. Without this, switching
   *   file tabs would show stale code from the previous generation.
   * TECHNICAL: Derived state pattern — currentCode is a local mirror of
   *   generatedFiles[selectedFileIndex].content. The effect re-runs whenever
   *   selectedFileIndex, generatedFiles, or generatedCode changes, ensuring
   *   the displayed code always reflects the current selection.
   */
  // ── Panel drag-resize ─────────────────────────────────────
  // Lets the user drag the left edge of the panel to make it wider/narrower.
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(panelWidth);

  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = panelWidth;

    const onMouseMove = (me) => {
      if (!isDraggingRef.current) return;
      // Dragging left increases the panel (panel is on the right side)
      const delta = dragStartXRef.current - me.clientX;
      const next = Math.min(700, Math.max(280, dragStartWidthRef.current + delta));
      setPanelWidth(next);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelWidth, setPanelWidth]);

  const [currentCode, setCurrentCode] = useState(generatedCode);
  const currentCodeRef = useRef(generatedCode);

  const [showDiff, setShowDiff] = useState(false);

  // prevSnapshot: permanently holds the PREVIOUS generation's files so
  // switching tabs and re-generating never loses the "before" picture.
  // Separate from currentFilesRef so the two never alias each other.
  const prevSnapshotRef  = useRef([]); // files from generation N-1
  const currentFilesRef  = useRef([]); // files from generation N (latest)

  // prevCode for the currently-viewed file tab — derived from prevSnapshotRef
  const [prevCode, setPrevCode]   = useState('');
  const prevCodeRef               = useRef('');

  // true once there has been at least one previous generation to diff against.
  // Must be STATE (not just a ref) so the Show Diff button re-renders and appears.
  const [hasPrevGeneration, setHasPrevGeneration] = useState(false);
  const hasPrevGenerationRef = useRef(false); // ref mirror for use inside effects

  // ── Inline code editing ───────────────────────────────────
  const [editBuffer, setEditBuffer] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncError,  setSyncError]  = useState('');

  // ── Code-side undo/redo stack ─────────────────────────────
  // Maintained independently from the diagram's useHistory so that
  // Ctrl+Z inside the code textarea rolls back code text AND re-parses
  // to restore the diagram to the matching state.
  // Each entry is a plain code string snapshot.
  const codeHistoryRef      = useRef(['']);   // stack of code strings
  const codeHistoryIndexRef = useRef(0);      // pointer into the stack
  // Debounce timer ref — cleared/reset on every keystroke so a snapshot
  // is only pushed (and diagram only parsed) after 700ms of inactivity.
  const applyDebounceRef    = useRef(null);

  // Refs for scroll-sync between textarea and highlight layer
  const textareaRef  = useRef(null);
  const highlightRef = useRef(null);

  // Live ref so applyCodeToDiagram always reads the current canvas elements
  // without capturing a stale closure — critical for use-case position reuse.
  const elementsRef = useRef(elements);
  useEffect(() => { elementsRef.current = elements; }, [elements]);

  // ── Helper: resolve prevCode for a given file tab index ──
  // Looks up the matching file from prevSnapshotRef by filename,
  // falling back to position-based lookup if the filename changed.
  const getPrevCodeForTab = (tabIndex, newFiles) => {
    if (prevSnapshotRef.current.length === 0) return '';
    const targetFilename = newFiles?.[tabIndex]?.filename;
    if (targetFilename) {
      const match = prevSnapshotRef.current.find(f => f.filename === targetFilename);
      if (match) return match.content;
    }
    // Fallback: same position
    return prevSnapshotRef.current[tabIndex]?.content || '';
  };

  useEffect(() => {
    if (!generatedFiles || generatedFiles.length === 0) return;

    const isNewGeneration = generatedFiles !== currentFilesRef.current;

    if (isNewGeneration) {
      // ── New generation arrived ────────────────────────────
      // 1. If there was a previous generation, archive it as the snapshot.
      if (currentFilesRef.current.length > 0) {
        prevSnapshotRef.current = currentFilesRef.current;
        hasPrevGenerationRef.current = true;
        setHasPrevGeneration(true);
      }
      // 2. Advance the current pointer.
      currentFilesRef.current = generatedFiles;

      // 3. Compute prev/next for the currently-selected tab.
      const next = generatedFiles[selectedFileIndex]?.content || '';
      const prev = getPrevCodeForTab(selectedFileIndex, generatedFiles);

      prevCodeRef.current    = prev;
      currentCodeRef.current = next;
      setPrevCode(prev);
      setCurrentCode(next);
      setEditBuffer(next);
      // Seed a fresh code-history baseline so Ctrl+Z in the code panel
      // never undoes past the point where this code was generated.
      codeHistoryRef.current      = [next];
      codeHistoryIndexRef.current = 0;
      setSyncStatus(null);
      setSyncError('');
      // Do NOT reset showDiff — if it was on, keep it on so the user
      // immediately sees the new diff without having to click again.

    } else {
      // ── User switched file tabs (same generation) ─────────
      // currentFilesRef and prevSnapshotRef are unchanged;
      // just re-derive prev/next for the new tab index.
      const next = generatedFiles[selectedFileIndex]?.content || '';
      const prev = getPrevCodeForTab(selectedFileIndex, generatedFiles);

      prevCodeRef.current    = prev;
      currentCodeRef.current = next;
      setPrevCode(prev);
      setCurrentCode(next);
      setEditBuffer(next);
      // Reset code history for the newly active tab too.
      codeHistoryRef.current      = [next];
      codeHistoryIndexRef.current = 0;
      setSyncStatus(null);
      setSyncError('');
      // showDiff stays exactly as it was — switching tabs never toggles it.
    }
  }, [selectedFileIndex, generatedFiles, generatedCode]);

  /**
   * pushCodeHistory(code)
   * Saves a code string onto the code-side undo stack.
   * Any "future" entries (from prior undos) are discarded — same
   * semantics as the diagram useHistory hook.
   * Capped at 100 entries to avoid unbounded memory growth.
   * Declared before applyCodeToDiagram and handleCodeChange so those
   * useCallbacks can safely reference it without a TDZ error.
   */
  const pushCodeHistory = useCallback((code) => {
    const trimmed = codeHistoryRef.current.slice(0, codeHistoryIndexRef.current + 1);
    const next = [...trimmed, code];
    codeHistoryRef.current = next.length > 100 ? next.slice(next.length - 100) : next;
    codeHistoryIndexRef.current = codeHistoryRef.current.length - 1;
  }, []);

  /**
   * applyCodeToDiagram(code, onSuccess, options)
   * Parses the code and pushes the result to UMLEditor.
   * Called automatically by the debounced live-sync and by the code-side
   * undo/redo handler. UMLEditor saves the current diagram to history
   * BEFORE applying, so Ctrl+Z on the canvas restores the pre-edit state.
   *
   * FIX (undo-stack desync): When called from the code-side undo/redo handler
   * (options.fromCodeUndo = true), we forward that flag to onCodeEdit so
   * UMLEditor knows to skip saveToHistory entirely. This prevents the diagram
   * undo stack from accumulating spurious entries every time the user presses
   * Ctrl+Z inside the code textarea, which previously caused connections to
   * reappear in the wrong place after an undo-then-redo cycle.
   */
  const applyCodeToDiagram = useCallback((code, onSuccess, options = {}) => {
    if (!code.trim()) return;
    setSyncStatus('applying');
    setSyncError('');
    setTimeout(() => {
      try {
        let result;
        if (selectedDiagram === 'sequence') {
          result = CodeToUMLConverter.convertCodeToUMLSequence(code, language || 'Java');
        } else if (selectedDiagram === 'usecase') {
          // Pass elementsRef.current (always fresh, never stale) so the converter
          // can reuse existing actor/use-case IDs and canvas positions.
          // Using a ref instead of the `elements` closure variable prevents the
          // stale-closure feedback loop that previously caused phantom nodes.
          result = CodeToUMLConverter.convertCodeToUMLUseCase(code, language || 'Java', elementsRef.current);
        } else {
          result = CodeToUMLConverter.convertCodeToUML(code, language || 'Java');
        }

        if (!result.success) {
          setSyncStatus('error');
          setSyncError(result.message || 'Could not parse the edited code.');
          return;
        }

        onCodeEdit?.(result.elements, result.connections, {
          replaceAll: result.replaceAll,
          diagramType: selectedDiagram,
          // Forward the fromCodeUndo flag so UMLEditor skips diagram saveToHistory
          // on replays — only fresh live-edits should push a new diagram snapshot.
          fromCodeUndo: options.fromCodeUndo || false,
        });
        setCurrentCode(code);
        setSyncStatus('success');
        onSuccess?.();  // push to code history only after successful parse+apply
        setTimeout(() => setSyncStatus(null), 2000);
      } catch (err) {
        setSyncStatus('error');
        setSyncError(err.message || 'Unexpected error during sync.');
      }
    }, 30);
  }, [language, selectedDiagram, onCodeEdit]);

  /**
   * handleCodeChange
   *
   * For CLASS and USE-CASE diagrams: updates the buffer and schedules a
   * debounced diagram re-parse 700 ms after the user stops typing.
   * The converter always does a full replaceAll from the current code text,
   * so deleting a method removes its connection, adding one creates it.
   *
   * For SEQUENCE diagrams only: buffer update only, no live sync, because
   * sequence code structure doesn't map cleanly to incremental re-parsing.
   */
  const handleCodeChange = useCallback((value) => {
    setEditBuffer(value);
    setSyncStatus(null);
    setSyncError('');

    // Sequence diagrams: text-only edit, no live sync (structure too different).
    // Use-case diagrams: live sync IS enabled — the converter does a full
    // replaceAll re-parse from the current code, which correctly adds/removes
    // actors and connections to match exactly what the code says.
    if (selectedDiagram === 'sequence') return;

    // Cancel any previously scheduled apply
    clearTimeout(applyDebounceRef.current);

    // Schedule a new apply 700ms from now
    applyDebounceRef.current = setTimeout(() => {
      applyCodeToDiagram(value, () => pushCodeHistory(value));
    }, 700);
  }, [applyCodeToDiagram, pushCodeHistory, selectedDiagram]);

  /**
   * handleCodeKeyDown
   * -----------------
   * Ctrl+Z  — undo: pop code history, restore text, re-parse diagram.
   * Ctrl+Y / Ctrl+Shift+Z — redo: same in the forward direction.
   *
   * Both are intercepted before the browser's native textarea undo so the
   * diagram always stays in sync with the code undo stack.
   * All other keys fall through to normal textarea behaviour.
   */
  const handleCodeKeyDown = useCallback((e) => {
    const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
    const isRedo = (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey));

    // Sequence diagrams have no live sync — let browser handle Ctrl+Z natively.
    if (selectedDiagram === 'sequence') return;

    if (isUndo) {
      e.preventDefault();
      clearTimeout(applyDebounceRef.current); // cancel any pending debounce
      if (codeHistoryIndexRef.current > 0) {
        codeHistoryIndexRef.current--;
        const prev = codeHistoryRef.current[codeHistoryIndexRef.current];
        setEditBuffer(prev);
        applyCodeToDiagram(prev, undefined, { fromCodeUndo: true });
      }
      return;
    }

    if (isRedo) {
      e.preventDefault();
      clearTimeout(applyDebounceRef.current);
      if (codeHistoryIndexRef.current < codeHistoryRef.current.length - 1) {
        codeHistoryIndexRef.current++;
        const next = codeHistoryRef.current[codeHistoryIndexRef.current];
        setEditBuffer(next);
        applyCodeToDiagram(next, undefined, { fromCodeUndo: true });
      }
      return;
    }
  }, [applyCodeToDiagram, selectedDiagram]);

  /**
   * Scroll-sync: when the textarea scrolls, mirror to the highlight layer
   * so colored text and the cursor always stay perfectly aligned.
   */
  const handleScroll = useCallback(() => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop  = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  /**
   * updateElement(elementId, updates)
   * LAYMAN'S: Applies a partial update (like a name change or new attribute)
   *   to an element both in the master elements list and in the current
   *   selection, so the properties form stays in sync with the canvas.
   * TECHNICAL: Immutable update — maps over the elements array returning a
   *   new array with only the matching element replaced via spread. Also
   *   updates selectedElements so the form's controlled inputs reflect
   *   the new values without a re-select.
   */
  const updateElement = (elementId, updates) => {
    const updated = elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );
    setElements(updated);
    setSelectedElements(prev => prev.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    ));
  };

  /**
   * updateConnection(connectionId, updates)
   * LAYMAN'S: Updates a connection's properties (label, multiplicity, roles)
   *   both in the master connections list and in the selectedConnection so
   *   the properties form stays in sync.
   * TECHNICAL: Same immutable map pattern as updateElement. Also patches
   *   selectedConnection directly to avoid a stale-closure issue where
   *   the form would show the old value until the next render.
   */
  const updateConnection = (connectionId, updates) => {
    const updated = connections.map(c =>
      c.id === connectionId ? { ...c, ...updates } : c
    );
    setConnections(updated);
    if (selectedConnection?.id === connectionId) {
      setSelectedConnection({ ...selectedConnection, ...updates });
    }
  };

  /**
   * deleteElement()
   * LAYMAN'S: Removes all currently selected elements from the canvas and
   *   also removes any connections that were attached to them — you can't
   *   leave a dangling arrow pointing to nothing.
   * TECHNICAL: Filters both arrays in one pass each. Calls saveToHistory()
   *   so the deletion is undoable. Clears selectedElements afterward to
   *   prevent the properties form from trying to display a deleted element.
   */
  const deleteElement = () => {
    if (selectedElements.length === 0) return;
    const newElements = elements.filter(el => !selectedElements.some(sel => sel.id === el.id));
    const newConnections = connections.filter(c => 
      !selectedElements.some(sel => sel.id === c.from || sel.id === c.to)
    );
    setElements(newElements);
    setConnections(newConnections);
    saveToHistory(newElements, newConnections);
    setSelectedElements([]);
  };

  /**
   * deleteConnection()
   * LAYMAN'S: Removes the currently selected connection line from the
   *   diagram and saves an undo snapshot.
   * TECHNICAL: Filters connections by id, saves to history, then
   *   sets selectedConnection to null to clear the properties form.
   */
  const deleteConnection = () => {
    if (!selectedConnection) return;
    const updated = connections.filter(c => c.id !== selectedConnection.id);
    setConnections(updated);
    saveToHistory(elements, updated);
    setSelectedConnection(null);
  };

  return (
    <div
      className="flex-shrink-0 bg-[#252526] border-l border-[#3e3e42] flex flex-col relative"
      style={{ width: panelWidth }}
    >
      {/* Drag handle — left edge, grab to resize */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize panel"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,122,204,0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      />
      {/* Tabs */}
      <div className="flex border-b border-[#3e3e42]">
        <button
          onClick={() => setShowCodePanel(false)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            !showCodePanel
              ? 'bg-[#1e1e1e] text-white border-b-2 border-[#007acc]'
              : 'text-gray-400 hover:text-white hover:bg-[#2a2d2e]'
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setShowCodePanel(true)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            showCodePanel
              ? 'bg-[#1e1e1e] text-white border-b-2 border-[#007acc]'
              : 'text-gray-400 hover:text-white hover:bg-[#2a2d2e]'
          }`}
        >
          Generated Code
        </button>
      </div>

      {/* Content Area */}
      <div className={`flex-1 ${showCodePanel ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {!showCodePanel ? (
          // Properties Panel
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">PROPERTIES</h3>
            {selectedElements.length === 1 ? (
              <ElementProperties
                element={selectedElements[0]}
                onUpdate={updateElement}
                onDelete={deleteElement}
                saveToHistory={saveToHistory}
                elements={elements}
                connections={connections}
              />
            ) : selectedElements.length > 1 ? (
              <div className="text-sm text-gray-500">
                <p>{selectedElements.length} elements selected</p>
                <button
                  onClick={deleteElement}
                  className="w-full bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm flex items-center justify-center space-x-2 transition-colors mt-2"
                >
                  <Trash2 size={16} />
                  <span>Delete Selected Elements</span>
                </button>
              </div>
            ) : selectedConnection ? (
              <ConnectionProperties
                connection={selectedConnection}
                onUpdate={updateConnection}
                onDelete={deleteConnection}
                saveToHistory={saveToHistory}
                elements={elements}
                connections={connections}
              />
            ) : (
              <p className="text-sm text-gray-500">Select an element or connection to edit properties</p>
            )}
          </div>
        ) : (
          // Generated Code Panel
          <div className="h-full flex flex-col p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-400">GENERATED CODE</h3>
              <div className="flex items-center gap-2">
                {hasPrevGeneration && (
                  <button
                    onClick={() => setShowDiff(v => !v)}
                    title={showDiff ? 'Hide changes' : 'Show what changed'}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                      showDiff
                        ? 'bg-[#007acc] text-white'
                        : 'text-gray-400 hover:text-white bg-[#3e3e42] hover:bg-[#4a4a4f]'
                    }`}
                  >
                    <GitCompare size={12} />
                    {showDiff ? 'Diff On' : 'Show Diff'}
                  </button>
                )}
                {currentCode && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(editBuffer || currentCode).then(() => {
                        onCopySuccess?.('Code copied to clipboard!');
                      }).catch(() => {
                        onCopySuccess?.('Failed to copy — please copy manually.', 'error');
                      });
                    }}
                    className="text-xs text-[#007acc] hover:text-[#005a9e] transition-colors"
                  >
                    Copy Code
                  </button>
                )}
              </div>
            </div>

            {/* Sync status indicators */}
            {syncStatus === 'success' && (
              <div className="mb-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-[#1e3a1e] border border-[#28a745] text-[#28a745]">
                <RefreshCw size={11} /> Diagram updated!
              </div>
            )}
            {syncStatus === 'applying' && (
              <div className="mb-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-[#1e2a3a] border border-[#007acc] text-[#007acc]">
                <RefreshCw size={11} className="animate-spin" /> Syncing diagram…
              </div>
            )}
            {syncStatus === 'error' && (
              <div className="mb-2 text-xs px-2 py-1.5 rounded bg-[#3a1e1e] border border-[#dc3545] text-[#dc3545]">
                <strong>Parse error:</strong> {syncError}
              </div>
            )}

            {/* Diff stats bar */}
            {showDiff && (() => {
              if (!prevCodeRef.current) {
                // No previous generation to compare against yet
                return (
                  <div className="mb-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-[#1e1e1e] border border-[#3e3e42] text-gray-500">
                    <GitCompare size={11} /> No previous generation to compare — generate code again after making changes.
                  </div>
                );
              }
              if (prevCodeRef.current === currentCodeRef.current) {
                // Code is identical between generations for this file
                return (
                  <div className="mb-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-[#1e1e1e] border border-[#3e3e42] text-gray-500">
                    <GitCompare size={11} /> No changes in this file between generations.
                  </div>
                );
              }
              const dl = computeDiff(prevCodeRef.current, currentCodeRef.current);
              const { added, removed, changed } = diffStats(dl);
              return (
                <div className="mb-2 flex items-center gap-3 text-xs px-2 py-1.5 rounded bg-[#1e1e1e] border border-[#3e3e42]">
                  <span className="text-gray-400 font-medium">Changes:</span>
                  {added   > 0 && <span style={{ color: '#28a745' }}>+{added} added</span>}
                  {removed > 0 && <span style={{ color: '#dc3545' }}>−{removed} removed</span>}
                  {changed > 0 && <span style={{ color: '#ffc107' }}>~{changed} modified</span>}
                  <span className="ml-auto flex gap-3">
                    <span style={{ color: '#28a745' }}>■ Added</span>
                    <span style={{ color: '#dc3545' }}>■ Removed</span>
                  </span>
                </div>
              );
            })()}

            {/* File tabs */}
            {generatedFiles.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto border-b border-[#3e3e42] pb-2">
                {generatedFiles.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedFileIndex(index)}
                    className={`px-3 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                      selectedFileIndex === index
                        ? 'bg-[#007acc] text-white'
                        : 'bg-[#3e3e42] text-gray-300 hover:bg-[#4a4a4f]'
                    }`}
                  >
                    {file.filename}
                  </button>
                ))}
              </div>
            )}

            {currentCode ? (
              showDiff ? (
                /* Diff view — read only */
                <SyntaxHighlightedCode
                  code={currentCodeRef.current || currentCode}
                  prevCode={prevCodeRef.current || prevCode}
                  language={language || 'Java'}
                  showDiff={true}
                />
              ) : (
                /*
                 * Live editor — a single scrollable box that layers:
                 *   1. A syntax-highlighted <pre> (pointer-events:none, aria-hidden)
                 *   2. A transparent <textarea> on top that captures all input
                 * Both share identical font/size/padding so characters align
                 * pixel-perfectly. The textarea's onScroll mirrors scroll position
                 * to the <pre> so they never drift apart.
                 */
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                    borderRadius: '0.25rem',
                    background: '#1e1e1e',
                    overflow: 'hidden',
                  }}
                >
                  {/* Syntax highlight layer — visual only, never scrolled by user */}
                  <pre
                    ref={highlightRef}
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      margin: 0,
                      padding: '0.75rem',
                      fontSize: '0.75rem',
                      lineHeight: '1.6',
                      fontFamily: 'monospace',
                      tabSize: 2,
                      whiteSpace: 'pre',
                      overflowX: 'hidden',
                      overflowY: 'hidden',   // scroll is driven by textarea
                      pointerEvents: 'none', // let all clicks fall through to textarea
                      color: 'transparent',  // text hidden; only colored spans show
                      wordBreak: 'normal',
                      zIndex: 1,
                    }}
                  >
                    {/* Render highlighted spans for the live buffer */}
                    {highlightCode(editBuffer, language || 'Java').map((tok, i) => (
                      <span key={i} style={{ color: TOKEN_COLORS[tok.type] || TOKEN_COLORS.plain }}>
                        {tok.text}
                      </span>
                    ))}
                    {/* Trailing newline keeps the pre the same height as the textarea */}
                    {'\n'}
                  </pre>

                  {/* Editable textarea — transparent text, visible caret */}
                  <textarea
                    ref={textareaRef}
                    value={editBuffer}
                    onChange={e => handleCodeChange(e.target.value)}
                    onKeyDown={handleCodeKeyDown}
                    onScroll={handleScroll}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      margin: 0,
                      padding: '0.75rem',
                      fontSize: '0.75rem',
                      lineHeight: '1.6',
                      fontFamily: 'monospace',
                      tabSize: 2,
                      whiteSpace: 'pre',
                      resize: 'none',
                      background: 'transparent',
                      color: 'transparent',
                      caretColor: '#ffffffcc',
                      border: 'none',
                      outline: 'none',
                      overflowX: 'auto',
                      overflowY: 'auto',
                      zIndex: 2,
                    }}
                  />
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-500 text-center">
                  Click "Generate Code" button<br />to see the generated code
                </p>
              </div>
            )}

            {/* Hint shown below editor */}
            {currentCode && !showDiff && (
              <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <Pencil size={10} />
                {selectedDiagram === 'sequence'
                  ? 'Edit code · click "Code to Diagram" to apply changes to the diagram'
                  : 'Diagram updates live as you type · Ctrl+Z/Y to undo/redo'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ElementProperties({ element, onUpdate, onDelete, saveToHistory })
 * -------------------------------------------------------------------
 * LAYMAN'S: The form that appears in the Properties tab when a single
 *   class, interface, abstract class, or object is selected on the canvas.
 *   It lets the user rename the element, pick a stereotype, resize it,
 *   and manage its attributes and methods — adding, removing, and editing
 *   each one with visibility selectors, type dropdowns, and checkboxes
 *   for static/abstract flags. Custom types are supported via a fallback
 *   text input that appears when "Custom..." is chosen from the dropdown.
 *
 * TECHNICAL: Stateless helper — all state lives in the parent elements
 *   array via onUpdate. Local helper functions (updateAttribute,
 *   addAttribute, removeAttribute, updateMethod, addMethod, removeMethod)
 *   are defined inline to avoid prop-drilling and keep the mutation
 *   logic close to the form fields that trigger it.
 *   saveToHistory() is called on blur and on discrete actions (add/remove)
 *   so intermediate keystrokes don't flood the undo stack.
 *
 * @param {Object}   element         - The element data object being edited
 * @param {Function} onUpdate        - Applies partial updates to the element
 * @param {Function} onDelete        - Deletes the element from the diagram
 * @param {Function} saveToHistory   - Commits current state to undo history
 */
const ElementProperties = ({ element, onUpdate, onDelete, saveToHistory, elements, connections }) => {
  // Minimal set of common types
  const commonTypes = ['String', 'int', 'double', 'boolean', 'void', 'Object', 'List'];

  const returnTypes = ['void', 'String', 'int', 'double', 'boolean', 'Object', 'List'];

  const updateAttribute = (index, updates) => {
    const newAttrs = [...(element.attributes || [])];
    newAttrs[index] = { ...newAttrs[index], ...updates };
    onUpdate(element.id, { attributes: newAttrs });
  };

  const addAttribute = () => {
    const newAttrs = [...(element.attributes || []), { name: 'newAttribute', type: 'String', visibility: 'private' }];
    onUpdate(element.id, { attributes: newAttrs });
    saveToHistory(elements, connections);
  };

  const removeAttribute = (index) => {
    const newAttrs = (element.attributes || []).filter((_, i) => i !== index);
    onUpdate(element.id, { attributes: newAttrs });
    saveToHistory(elements, connections);
  };

  const updateMethod = (index, updates) => {
    const newMethods = [...(element.methods || [])];
    newMethods[index] = { ...newMethods[index], ...updates };
    onUpdate(element.id, { methods: newMethods });
  };

  const addMethod = () => {
    const newMethods = [...(element.methods || []), { name: 'newMethod', returnType: 'void', parameters: '', visibility: 'public' }];
    onUpdate(element.id, { methods: newMethods });
    saveToHistory(elements, connections);
  };

  const removeMethod = (index) => {
    const newMethods = (element.methods || []).filter((_, i) => i !== index);
    onUpdate(element.id, { methods: newMethods });
    saveToHistory(elements, connections);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Name</label>
        <input
          type="text"
          value={element.name}
          onChange={(e) => onUpdate(element.id, { name: e.target.value })}
          onBlur={() => saveToHistory(elements, connections)}
          className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
        />
      </div>

      {(element.type === 'class' || element.type === 'interface' || element.type === 'abstract') && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Stereotype</label>
          <select
            value={element.stereotype || ''}
            onChange={(e) => {
              onUpdate(element.id, { stereotype: e.target.value });
              saveToHistory(elements, connections);
            }}
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          >
            <option value="">None</option>
            <option value="singleton">singleton</option>
            <option value="utility">utility</option>
            <option value="entity">entity</option>
            <option value="control">control</option>
            <option value="boundary">boundary</option>
            <option value="service">service</option>
            <option value="repository">repository</option>
            <option value="controller">controller</option>
          </select>
        </div>
      )}

      {element.type === 'object' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Class Name</label>
            <input
              type="text"
              value={element.className || ''}
              onChange={(e) => onUpdate(element.id, { className: e.target.value })}
              onBlur={() => saveToHistory(elements, connections)}
              placeholder="Class this object is an instance of"
              className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Object State</label>
            <input
              type="text"
              value={element.state || ''}
              onChange={(e) => onUpdate(element.id, { state: e.target.value })}
              onBlur={() => saveToHistory(elements, connections)}
              placeholder="e.g., active, pending, completed"
              className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Attribute Values</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {element.attributeValues && Object.keys(element.attributeValues).length > 0 ? (
                Object.entries(element.attributeValues).map(([key, value], idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newValues = { ...element.attributeValues };
                        delete newValues[key];
                        newValues[e.target.value] = value;
                        onUpdate(element.id, { attributeValues: newValues });
                        saveToHistory(elements, connections);
                      }}
                      onBlur={() => saveToHistory(elements, connections)}
                      placeholder="attribute"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <span className="text-xs text-gray-500">=</span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const newValues = { ...element.attributeValues };
                        newValues[key] = e.target.value;
                        onUpdate(element.id, { attributeValues: newValues });
                      }}
                      onBlur={() => saveToHistory(elements, connections)}
                      placeholder="value"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <button
                      onClick={() => {
                        const newValues = { ...element.attributeValues };
                        delete newValues[key];
                        onUpdate(element.id, { attributeValues: newValues });
                        saveToHistory(elements, connections);
                      }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 italic">No attribute values yet</p>
              )}
            </div>
            <button
              onClick={() => {
                const newValues = element.attributeValues || {};
                const keyCount = Object.keys(newValues).length + 1;
                newValues[`attribute${keyCount}`] = '';
                onUpdate(element.id, { attributeValues: newValues });
                saveToHistory(elements, connections);
              }}
              className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors mt-2"
            >
              + Add Attribute Value
            </button>
          </div>
        </div>
      )}

      {(element.type === 'class' || element.type === 'interface' || element.type === 'abstract') && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Width</label>
              <input
                type="number"
                value={element.width}
                onChange={(e) => onUpdate(element.id, { width: Math.max(50, parseInt(e.target.value) || 100) })}
                onBlur={() => saveToHistory(elements, connections)}
                className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Height</label>
              <input
                type="number"
                value={element.height}
                onChange={(e) => onUpdate(element.id, { height: Math.max(50, parseInt(e.target.value) || 100) })}
                onBlur={() => saveToHistory(elements, connections)}
                className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
              />
            </div>
          </div>
        <div className="space-y-3">
          {(element.type === 'class' || element.type === 'abstract') && (
            <div>
              <label className="text-xs text-gray-500 block mb-2">Attributes</label>
              <div className="space-y-2 mb-2">
                {(element.attributes || []).map((attr, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={attr.visibility || 'private'}
                      onChange={(e) => updateAttribute(index, { visibility: e.target.value })}
                      className="w-12 bg-[#3c3c3c] text-white px-1 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      <option value="public">+</option>
                      <option value="private">-</option>
                      <option value="protected">#</option>
                      <option value="package">~</option>
                    </select>
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttribute(index, { name: e.target.value })}
                      placeholder="name"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <select
                      value={commonTypes.includes(attr.type) ? attr.type : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          updateAttribute(index, { type: '' });
                        } else {
                          updateAttribute(index, { type: e.target.value });
                          saveToHistory(elements, connections);
                        }
                      }}
                      className="w-24 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      {commonTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                    {!commonTypes.includes(attr.type) && (
                      <input
                        type="text"
                        value={attr.type || ''}
                        onChange={(e) => updateAttribute(index, { type: e.target.value })}
                        onBlur={() => saveToHistory(elements, connections)}
                        placeholder="custom type"
                        className="w-20 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#007acc] text-xs focus:outline-none"
                      />
                    )}
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={attr.isStatic || false}
                        onChange={(e) => updateAttribute(index, { isStatic: e.target.checked })}
                        className="w-3 h-3"
                      />
                      static
                    </label>
                    <button
                      onClick={() => removeAttribute(index)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addAttribute}
                className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors"
              >
                + Add Attribute
              </button>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-2">Methods</label>
            <div className="space-y-2 mb-2">
              {(element.methods || []).map((method, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex gap-2">
                    <select
                      value={method.visibility || 'public'}
                      onChange={(e) => updateMethod(index, { visibility: e.target.value })}
                      className="w-12 bg-[#3c3c3c] text-white px-1 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      <option value="public">+</option>
                      <option value="private">-</option>
                      <option value="protected">#</option>
                      <option value="package">~</option>
                    </select>
                    <input
                      type="text"
                      value={method.name}
                      onChange={(e) => updateMethod(index, { name: e.target.value })}
                      placeholder="method name"
                      className="flex-1 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    />
                    <select
                      value={returnTypes.includes(method.returnType) ? method.returnType : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          updateMethod(index, { returnType: '' });
                        } else {
                          updateMethod(index, { returnType: e.target.value });
                          saveToHistory(elements, connections);
                        }
                      }}
                      className="w-20 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                    >
                      {returnTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                    {!returnTypes.includes(method.returnType) && (
                      <input
                        type="text"
                        value={method.returnType || ''}
                        onChange={(e) => updateMethod(index, { returnType: e.target.value })}
                        onBlur={() => saveToHistory(elements, connections)}
                        placeholder="custom"
                        className="w-16 bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#007acc] text-xs focus:outline-none"
                      />
                    )}
                    <button
                      onClick={() => removeMethod(index)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={method.parameters || ''}
                    onChange={(e) => updateMethod(index, { parameters: e.target.value })}
                    placeholder="parameters (e.g., name: String, age: int)"
                    className="w-full bg-[#3c3c3c] text-white px-2 py-1 rounded border border-[#3e3e42] text-xs focus:outline-none focus:border-[#007acc]"
                  />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={method.isStatic || false}
                        onChange={(e) => updateMethod(index, { isStatic: e.target.checked })}
                        className="w-3 h-3"
                      />
                      static
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={method.isAbstract || false}
                        onChange={(e) => updateMethod(index, { isAbstract: e.target.checked })}
                        className="w-3 h-3"
                      />
                      abstract
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addMethod}
              className="w-full bg-[#007acc] hover:bg-[#005a9e] px-3 py-1.5 rounded text-sm transition-colors"
            >
              + Add Method
            </button>
          </div>
        </div>
        </>
      )}

      <button
        onClick={onDelete}
        className="w-full bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
      >
        <Trash2 size={16} />
        <span>Delete Element</span>
      </button>
    </div>
  );
};

/**
 * ConnectionProperties({ connection, onUpdate, onDelete, saveToHistory })
 * -------------------------------------------------------------------------
 * LAYMAN'S: The form that appears in the Properties tab when a connection
 *   line is selected on the canvas. It shows the connection type (read-only),
 *   and lets the user set "From Multiplicity" (e.g., "1"), "To Multiplicity"
 *   (e.g., "*"), a relationship label (e.g., "owns"), and role names at
 *   each end. All of these appear as annotations on the line in the diagram.
 *
 * TECHNICAL: Stateless helper component. The connection type field is
 *   intentionally disabled — type is set when the line is drawn and is
 *   not editable after the fact (it would require re-routing the arrow).
 *   onUpdate patches only the changed field so unedited fields are preserved.
 *   saveToHistory() is called on blur so each discrete edit is undoable.
 *
 * @param {Object}   connection     - The connection data object being edited
 * @param {Function} onUpdate       - Applies partial updates to the connection
 * @param {Function} onDelete       - Removes the connection from the diagram
 * @param {Function} saveToHistory  - Commits current state to undo history
 */
const ConnectionProperties = ({ connection, onUpdate, onDelete, saveToHistory, elements, connections }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Connection Type</label>
        <input
          type="text"
          value={connection.type}
          disabled
          className="w-full bg-[#3c3c3c] text-gray-400 px-3 py-1.5 rounded border border-[#3e3e42] text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From Multiplicity</label>
          <input
            type="text"
            value={connection.fromMultiplicity || ''}
            onChange={(e) => onUpdate(connection.id, { fromMultiplicity: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="1, *, 0..1, 1..*"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To Multiplicity</label>
          <input
            type="text"
            value={connection.toMultiplicity || ''}
            onChange={(e) => onUpdate(connection.id, { toMultiplicity: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="1, *, 0..1, 1..*"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Label</label>
        <input
          type="text"
          value={connection.label || ''}
          onChange={(e) => onUpdate(connection.id, { label: e.target.value })}
          onBlur={() => saveToHistory(elements, connections)}
          placeholder="e.g., owns, uses, manages"
          className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From Role</label>
          <input
            type="text"
            value={connection.fromRole || ''}
            onChange={(e) => onUpdate(connection.id, { fromRole: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="role name"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To Role</label>
          <input
            type="text"
            value={connection.toRole || ''}
            onChange={(e) => onUpdate(connection.id, { toRole: e.target.value })}
            onBlur={() => saveToHistory(elements, connections)}
            placeholder="role name"
            className="w-full bg-[#3c3c3c] text-white px-3 py-1.5 rounded border border-[#3e3e42] text-sm focus:outline-none focus:border-[#007acc]"
          />
        </div>
      </div>

      <button
        onClick={onDelete}
        className="w-full bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
      >
        <Trash2 size={16} />
        <span>Delete Connection</span>
      </button>
    </div>
  );
};

export default PropertiesPanel;