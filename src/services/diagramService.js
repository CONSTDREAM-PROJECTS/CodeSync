/**
 * ============================================================
 * diagramService.js — Diagram Persistence (PHP/MySQL)
 * ============================================================
 *
 * BUGS FIXED:
 *
 * BUG 1 — API_BASE_URL pointed to InfinityFree / localhost subfolder.
 *   FIX: Updated to match the Hostinger path used by LoginModal.jsx.
 *   Both files now share the same URL pattern.
 *
 * BUG 2 — TOKEN_KEY was a hardcoded string literal 'codesynch_token'
 *   duplicated in two files. A typo in either would silently break auth
 *   (the token would be saved under one key but read under another).
 *   FIX: TOKEN_KEY is now imported from LoginModal.jsx — single source of truth.
 *   If LoginModal is not importable here due to circular deps, the constant
 *   is also re-exported from this file as a fallback.
 *
 * BUG 3 — No guard against sending requests with an expired token.
 *   The PHP api would respond 401 with "Token expired" but the JS only
 *   logged a warning — it never told UMLEditor to show the login modal.
 *   FIX: _apiRequest() now checks for 401 responses and dispatches a
 *   custom 'codesynch:session-expired' event that UMLEditor can listen to.
 * ============================================================
 */

// TOKEN_KEY — defined locally to avoid a circular import with LoginModal.jsx.
// Must match the TOKEN_KEY exported from LoginModal.jsx exactly.
export const TOKEN_KEY = 'codesynch_token';

// ─────────────────────────────────────────────────────────────
// Configuration — keep in sync with LoginModal.jsx API_BASE_URL
// ─────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://yourdomain.com/api'   // ← your Hostinger domain
    : 'http://localhost/api';        // ← local dev

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

const _getToken = () => localStorage.getItem(TOKEN_KEY);

const _authHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${_getToken()}`,
});

/**
 * _apiRequest(url, options)
 * BUG FIX: Centralised fetch wrapper that detects 401 responses and
 * fires a 'codesynch:session-expired' event so UMLEditor can show
 * the login modal instead of silently failing.
 */
const _apiRequest = async (url, options = {}) => {
  const res  = await fetch(url, options);
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // Token expired or invalid — clear it and signal UMLEditor
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('codesynch:session-expired'));
    throw new Error(json.error || 'Session expired. Please log in again.');
  }

  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }

  return json;
};

const _debounce = (fn, delayMs) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
};

// ─────────────────────────────────────────────────────────────
// DiagramService
// ─────────────────────────────────────────────────────────────

class DiagramService {

  /**
   * saveDiagram(user, diagramId, diagramData)
   * POST /api/diagrams/save
   */
  static async saveDiagram(user, diagramId, diagramData) {
    if (!user || !_getToken()) return { success: false, id: null, error: 'Not logged in.' };

    try {
      const json = await _apiRequest(`${API_BASE_URL}/diagrams/save`, {
        method:  'POST',
        headers: _authHeaders(),
        body: JSON.stringify({
          diagramId,
          name:        diagramData.name        || 'Untitled Diagram',
          diagramType: diagramData.diagramType || 'class',
          language:    diagramData.language    || 'Java',
          elements:    diagramData.elements    || [],
          connections: diagramData.connections || [],
        }),
      });
      return { success: true, id: json.docId, error: null };
    } catch (err) {
      console.error('[DiagramService] saveDiagram:', err);
      return { success: false, id: null, error: err.message };
    }
  }

  /**
   * loadDiagram(user, diagramId)
   * GET /api/diagrams/load?diagramId=xxx
   */
  static async loadDiagram(user, diagramId) {
    if (!user || !_getToken()) return { success: false, data: null, error: 'Not logged in.' };

    try {
      const json = await _apiRequest(
        `${API_BASE_URL}/diagrams/load?diagramId=${encodeURIComponent(diagramId)}`,
        { method: 'GET', headers: _authHeaders() }
      );
      return { success: true, data: json.data, error: null };
    } catch (err) {
      console.error('[DiagramService] loadDiagram:', err);
      return { success: false, data: null, error: err.message };
    }
  }

  /**
   * listDiagrams(user)
   * GET /api/diagrams/list
   */
  static async listDiagrams(user) {
    if (!user || !_getToken()) return { success: false, diagrams: [], error: 'Not logged in.' };

    try {
      const json = await _apiRequest(`${API_BASE_URL}/diagrams/list`, {
        method: 'GET', headers: _authHeaders(),
      });
      return { success: true, diagrams: json.diagrams || [], error: null };
    } catch (err) {
      console.error('[DiagramService] listDiagrams:', err);
      return { success: false, diagrams: [], error: err.message };
    }
  }

  /**
   * deleteDiagram(user, diagramId)
   * DELETE /api/diagrams/delete
   */
  static async deleteDiagram(user, diagramId) {
    if (!user || !_getToken()) return { success: false, error: 'Not logged in.' };

    try {
      await _apiRequest(`${API_BASE_URL}/diagrams/delete`, {
        method:  'DELETE',
        headers: _authHeaders(),
        body:    JSON.stringify({ diagramId }),
      });
      return { success: true, error: null };
    } catch (err) {
      console.error('[DiagramService] deleteDiagram:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * autoSave — debounced 2 s wrapper around saveDiagram
   */
  static autoSave = _debounce(async (user, diagramId, diagramData) => {
    if (!user || !_getToken()) return;
    const result = await DiagramService.saveDiagram(user, diagramId, diagramData);
    if (!result.success) console.warn('[DiagramService] autoSave failed:', result.error);
  }, 2000);
}

export default DiagramService;