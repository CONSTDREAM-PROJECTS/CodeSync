// ============================================================
// diagramService.js — PHP/MySQL Cloud Diagram Persistence
// ============================================================
// This replaces the Firebase version.
// All calls go to your InfinityFree PHP API.
// ============================================================

// ── IMPORTANT: set this to your InfinityFree subdomain ───────────────────────
// Example: 'https://mycodesync.infinityfreeapp.com/api'
// During local dev you can point it at a local PHP server:
//   'http://localhost/codesynch/api'
//                        YOUR_SUBDOMAIN (firebase-to-infinity.42web.io)
const API_BASE = 'https://firebase-to-infinity.42web.io.infinityfreeapp.com/api';

// ─────────────────────────────────────────────────────────────
// Token helpers — JWT stored in localStorage
// ─────────────────────────────────────────────────────────────

export function saveToken(token) {
  localStorage.setItem('codesynch_token', token);
}

export function getToken() {
  return localStorage.getItem('codesynch_token');
}

export function removeToken() {
  localStorage.removeItem('codesynch_token');
}

// ─────────────────────────────────────────────────────────────
// Base fetch with auth header
// ─────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
// Debounce utility for autoSave
// ─────────────────────────────────────────────────────────────

function debounce(fn, delayMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

// ─────────────────────────────────────────────────────────────
// Auth API calls (used by LoginModal)
// ─────────────────────────────────────────────────────────────

/**
 * register(email, password)
 * Returns { message } on success, throws on error.
 */
export async function register(email, password) {
  return apiFetch('register.php', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * login(email, password)
 * Returns { token, user: { uid, email } } on success, throws on error.
 * Automatically saves the token to localStorage.
 */
export async function login(email, password) {
  const data = await apiFetch('login.php', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveToken(data.token);
  return data;
}

/**
 * logout()
 * Removes the stored JWT — no server call needed for stateless JWT.
 */
export function logout() {
  removeToken();
}

// ─────────────────────────────────────────────────────────────
// DiagramService — same public API as the Firebase version
// ─────────────────────────────────────────────────────────────

class DiagramService {

  /**
   * saveDiagram(user, diagramId, diagramData)
   * Same signature as the Firebase version so UMLEditor.jsx needs no changes.
   */
  static async saveDiagram(user, diagramId, diagramData) {
    if (!user) return { success: false, id: null, error: 'Not logged in.' };

    try {
      const data = await apiFetch('diagrams_save.php', {
        method: 'POST',
        body: JSON.stringify({
          diagramId,
          name:        diagramData.name        || 'Untitled Diagram',
          diagramType: diagramData.diagramType || 'class',
          language:    diagramData.language    || 'Java',
          elements:    diagramData.elements    || [],
          connections: diagramData.connections || [],
        }),
      });
      return { success: true, id: data.docId, error: null };
    } catch (err) {
      console.error('[DiagramService] saveDiagram error:', err);
      return { success: false, id: null, error: err.message };
    }
  }

  /**
   * loadDiagram(user, diagramId)
   */
  static async loadDiagram(user, diagramId) {
    if (!user) return { success: false, data: null, error: 'Not logged in.' };

    try {
      const data = await apiFetch(`diagrams_load.php?diagramId=${encodeURIComponent(diagramId)}`);
      return { success: true, data: data.data, error: null };
    } catch (err) {
      console.error('[DiagramService] loadDiagram error:', err);
      return { success: false, data: null, error: err.message };
    }
  }

  /**
   * listDiagrams(user)
   */
  static async listDiagrams(user) {
    if (!user) return { success: false, diagrams: [], error: 'Not logged in.' };

    try {
      const data = await apiFetch('diagrams_list.php');
      return { success: true, diagrams: data.diagrams, error: null };
    } catch (err) {
      console.error('[DiagramService] listDiagrams error:', err);
      return { success: false, diagrams: [], error: err.message };
    }
  }

  /**
   * deleteDiagram(user, diagramId)
   */
  static async deleteDiagram(user, diagramId) {
    if (!user) return { success: false, error: 'Not logged in.' };

    try {
      await apiFetch('diagrams_delete.php', {
        method: 'DELETE',
        body: JSON.stringify({ diagramId }),
      });
      return { success: true, error: null };
    } catch (err) {
      console.error('[DiagramService] deleteDiagram error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * autoSave — debounced, same usage as before:
   *   DiagramService.autoSave(currentUser, diagramId, { ... });
   */
  static autoSave = debounce(async (user, diagramId, diagramData) => {
    if (!user) return;
    const result = await DiagramService.saveDiagram(user, diagramId, diagramData);
    if (!result.success) {
      console.warn('[DiagramService] autoSave failed:', result.error);
    }
  }, 2000);
}

export default DiagramService;
