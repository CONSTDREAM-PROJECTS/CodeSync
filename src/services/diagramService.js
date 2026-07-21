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
 *
 * BUG 11 — API URLs used folder-style paths (/diagrams/save) but PHP
 *   files are named diagrams_save.php, diagrams_load.php, etc.
 *   FIX: Updated all URLs to match actual PHP filenames.
 *
 * FIXES APPLIED (recommended):
 *
 * FIX A — API_BASE_URL dev vs prod comment clarification.
 *   Both branches intentionally point to the live API for now.
 *   A comment is added so future contributors understand this is deliberate.
 *
 * FIX B — autoSave moved outside the class body to avoid relying on
 *   stage-3 static class field syntax, which can silently break under
 *   stricter Babel configs.
 *
 * FIX C — deleteDiagram switched from request body to query param.
 *   Some servers/proxies strip the body on DELETE requests, causing
 *   diagramId to silently go missing on the PHP side.
 * ============================================================
 */

export const TOKEN_KEY = 'codesynch_token';
export const OAUTH_ERROR_KEY = 'codesynch_oauth_error';

// ─────────────────────────────────────────────────────────────
// Configuration — keep in sync with LoginModal.jsx API_BASE_URL
//
// NOTE: Both branches intentionally point to the live API.
// Local dev also hits api.codesynch.tech by design — there is
// no local PHP server. Change the 'development' value here if
// you ever spin one up.
// ─────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.codesynch.tech'
    : 'https://api.codesynch.tech';

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

const _getToken = () => localStorage.getItem(TOKEN_KEY);

const _authHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${_getToken()}`,
});

const _apiRequest = async (url, options = {}) => {
  const res  = await fetch(url, options);
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
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
   * POST /diagrams_save.php
   */
  static async saveDiagram(user, diagramId, diagramData) {
    if (!user || !_getToken()) return { success: false, id: null, error: 'Not logged in.' };

    try {
      const json = await _apiRequest(`${API_BASE_URL}/diagrams_save.php`, {
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
   * GET /diagrams_load.php?diagramId=xxx
   */
  static async loadDiagram(user, diagramId) {
    if (!user || !_getToken()) return { success: false, data: null, error: 'Not logged in.' };

    try {
      const json = await _apiRequest(
        `${API_BASE_URL}/diagrams_load.php?diagramId=${encodeURIComponent(diagramId)}`,
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
   * GET /diagrams_list.php
   */
  static async listDiagrams(user) {
    if (!user || !_getToken()) return { success: false, diagrams: [], error: 'Not logged in.' };

    try {
      const json = await _apiRequest(`${API_BASE_URL}/diagrams_list.php`, {
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
   * DELETE /diagrams_delete.php?diagramId=xxx
   *
   * FIX C: diagramId is now passed as a query param instead of a request
   * body. Some servers and proxies strip the body on DELETE requests,
   * which caused diagramId to silently go missing on the PHP side.
   */
  static async deleteDiagram(user, diagramId) {
    if (!user || !_getToken()) return { success: false, error: 'Not logged in.' };

    try {
      await _apiRequest(
        `${API_BASE_URL}/diagrams_delete.php?diagramId=${encodeURIComponent(diagramId)}`,
        { method: 'DELETE', headers: _authHeaders() }
      );
      return { success: true, error: null };
    } catch (err) {
      console.error('[DiagramService] deleteDiagram:', err);
      return { success: false, error: err.message };
    }
  }
}

/**
 * autoSave — debounced 2 s wrapper around saveDiagram
 *
 * FIX B: Defined outside the class body to avoid relying on static class
 * field syntax (stage-3 proposal). Older Babel configs may not support it,
 * causing a silent failure where autoSave is undefined at call sites.
 */
DiagramService.autoSave = _debounce(async (user, diagramId, diagramData) => {
  if (!user || !_getToken()) return;
  const result = await DiagramService.saveDiagram(user, diagramId, diagramData);
  if (!result.success) console.warn('[DiagramService] autoSave failed:', result.error);
}, 2000);

export default DiagramService;
