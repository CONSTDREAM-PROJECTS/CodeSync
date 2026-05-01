/**
 * ============================================================
 * diagramService.js — Cloud Diagram Persistence Service
 * ============================================================
 *
 * WHAT THIS FILE DOES (Layman's):
 * This file is the "save to cloud" engine. Instead of diagrams
 * disappearing on page refresh, this service saves them to
 * Firebase Firestore (a cloud database) and loads them back.
 * Each user gets their own private collection of diagrams.
 * Every save operation is automatic — the user never has to
 * think about it. The diagram list also lets users pick up
 * where they left off from any device.
 *
 * TECHNICAL OVERVIEW:
 * Uses Firebase Firestore (v9 modular SDK). Data model:
 *   Collection: diagrams/
 *     Document:  {userId}_{diagramId}
 *       Fields:  userId, name, diagramType, language,
 *                elements[], connections[], updatedAt, createdAt
 *
 * Five public methods:
 *   saveDiagram()   — upsert (create or overwrite) one diagram
 *   loadDiagram()   — fetch one diagram by id
 *   listDiagrams()  — fetch all diagrams belonging to this user
 *   deleteDiagram() — delete one diagram
 *   autoSave()      — debounced wrapper around saveDiagram()
 *
 * HOW IT RELATES TO THE REST OF THE CODEBASE:
 * - Called by UMLEditor.jsx on every meaningful state change
 *   via autoSave() (debounced 2s).
 * - loadDiagram() is called when the user picks a saved diagram
 *   from a future DiagramListPanel.
 * - Requires currentUser (Firebase User object) from LoginModal.
 * - All operations are no-ops and return safe fallbacks when the
 *   user is not logged in, so the editor works offline too.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// Firestore helpers — lazy-loaded so the SDK is only bundled
// when a logged-in user actually triggers a save.
// ─────────────────────────────────────────────────────────────

/**
 * _getFirestore()
 * LAYMAN'S: Gets the Firestore database connection. Loaded lazily
 *   so users who never log in don't download the Firestore SDK.
 * TECHNICAL: Dynamic import returns the db singleton from firebase.js.
 *   Throws if firebase.js is not configured — caught by callers.
 */
const _getFirestore = async () => {
  const { db } = await import('../firebase');
  return db;
};

/**
 * _getFirestoreFns()
 * LAYMAN'S: Gets the Firestore operation functions (add, get, set, etc.).
 * TECHNICAL: Dynamic import of firebase/firestore modular functions.
 */
const _getFirestoreFns = async () => {
  const {
    collection, doc, setDoc, getDoc, getDocs,
    deleteDoc, query, where, orderBy, serverTimestamp
  } = await import('firebase/firestore');
  return { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, serverTimestamp };
};


// ─────────────────────────────────────────────────────────────
// Debounce utility for autoSave
// ─────────────────────────────────────────────────────────────

/**
 * _debounce(fn, delayMs)
 * LAYMAN'S: Wraps a function so it only runs after the user has
 *   stopped making changes for `delayMs` milliseconds. Prevents
 *   saving on every single keystroke.
 * TECHNICAL: Standard leading-edge debounce using setTimeout/clearTimeout.
 */
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
   * ------------------------------------------
   * LAYMAN'S: Saves the current diagram to the cloud. If this diagram
   *   was saved before, it overwrites the old version. If it's new,
   *   it creates a new entry. The user's id is always attached so
   *   diagrams are private to that account.
   *
   * TECHNICAL: Uses Firestore setDoc (upsert) with merge:false so
   *   the whole document is replaced atomically. Document ID is
   *   `{userId}_{diagramId}` — namespaced by user to avoid collisions.
   *   serverTimestamp() is used for updatedAt so the server's clock
   *   is authoritative (avoids client clock skew issues).
   *
   * @param {object} user        - Firebase User object ({ uid, email })
   * @param {string} diagramId   - Unique diagram identifier (e.g. Date.now())
   * @param {object} diagramData - { name, diagramType, language, elements, connections }
   * @returns {{ success: boolean, id: string, error: string|null }}
   */
  static async saveDiagram(user, diagramId, diagramData) {
    if (!user) return { success: false, id: null, error: 'Not logged in.' };

    try {
      const db  = await _getFirestore();
      const fns = await _getFirestoreFns();

      const docId  = `${user.uid}_${diagramId}`;
      const docRef = fns.doc(db, 'diagrams', docId);

      await fns.setDoc(docRef, {
        userId:      user.uid,
        userEmail:   user.email || '',
        diagramId,
        name:        diagramData.name        || 'Untitled Diagram',
        diagramType: diagramData.diagramType || 'class',
        language:    diagramData.language    || 'Java',
        elements:    diagramData.elements    || [],
        connections: diagramData.connections || [],
        updatedAt:   fns.serverTimestamp(),
        createdAt:   diagramData.createdAt   || fns.serverTimestamp()
      });

      return { success: true, id: docId, error: null };

    } catch (err) {
      console.error('[DiagramService] saveDiagram error:', err);
      return { success: false, id: null, error: err.message };
    }
  }

  /**
   * loadDiagram(user, diagramId)
   * -----------------------------
   * LAYMAN'S: Loads a previously saved diagram from the cloud.
   *   Returns the elements, connections, language, and diagram type
   *   exactly as they were when last saved.
   *
   * TECHNICAL: Reads the Firestore document at diagrams/{userId}_{diagramId}.
   *   Returns null data (not an error) if the document doesn't exist —
   *   callers should handle the null case gracefully.
   *
   * @param {object} user      - Firebase User object
   * @param {string} diagramId - The diagram id to load
   * @returns {{ success: boolean, data: object|null, error: string|null }}
   */
  static async loadDiagram(user, diagramId) {
    if (!user) return { success: false, data: null, error: 'Not logged in.' };

    try {
      const db  = await _getFirestore();
      const fns = await _getFirestoreFns();

      const docId  = `${user.uid}_${diagramId}`;
      const docRef = fns.doc(db, 'diagrams', docId);
      const snap   = await fns.getDoc(docRef);

      if (!snap.exists()) {
        return { success: true, data: null, error: null };
      }

      return { success: true, data: snap.data(), error: null };

    } catch (err) {
      console.error('[DiagramService] loadDiagram error:', err);
      return { success: false, data: null, error: err.message };
    }
  }

  /**
   * listDiagrams(user)
   * -------------------
   * LAYMAN'S: Gets the list of all diagrams the logged-in user has saved.
   *   Each entry in the list has the diagram's name, type, and last-updated
   *   time so the user can pick which one to open.
   *
   * TECHNICAL: Firestore query filtered by userId and ordered by updatedAt
   *   descending. Returns a lightweight summary array — does NOT include
   *   elements/connections (those are large; loaded on demand by loadDiagram).
   *
   * @param {object} user - Firebase User object
   * @returns {{ success: boolean, diagrams: Array, error: string|null }}
   */
  static async listDiagrams(user) {
    if (!user) return { success: false, diagrams: [], error: 'Not logged in.' };

    try {
      const db  = await _getFirestore();
      const fns = await _getFirestoreFns();

      const q    = fns.query(
        fns.collection(db, 'diagrams'),
        fns.where('userId', '==', user.uid),
        fns.orderBy('updatedAt', 'desc')
      );
      const snap = await fns.getDocs(q);

      const diagrams = snap.docs.map(d => {
        const data = d.data();
        return {
          id:          data.diagramId,
          docId:       d.id,
          name:        data.name,
          diagramType: data.diagramType,
          language:    data.language,
          elementCount: (data.elements || []).length,
          updatedAt:   data.updatedAt?.toDate?.()?.toISOString() || null
        };
      });

      return { success: true, diagrams, error: null };

    } catch (err) {
      console.error('[DiagramService] listDiagrams error:', err);
      return { success: false, diagrams: [], error: err.message };
    }
  }

  /**
   * deleteDiagram(user, diagramId)
   * --------------------------------
   * LAYMAN'S: Permanently deletes a saved diagram from the cloud.
   *   This cannot be undone, so the UI should confirm with the user first.
   *
   * TECHNICAL: Deletes the Firestore document at diagrams/{userId}_{diagramId}.
   *   Only the owner (matched by userId prefix in docId) can delete their
   *   own diagrams — Firestore security rules enforce this on the server.
   *
   * @param {object} user      - Firebase User object
   * @param {string} diagramId - The diagram id to delete
   * @returns {{ success: boolean, error: string|null }}
   */
  static async deleteDiagram(user, diagramId) {
    if (!user) return { success: false, error: 'Not logged in.' };

    try {
      const db  = await _getFirestore();
      const fns = await _getFirestoreFns();

      const docId  = `${user.uid}_${diagramId}`;
      const docRef = fns.doc(db, 'diagrams', docId);
      await fns.deleteDoc(docRef);

      return { success: true, error: null };

    } catch (err) {
      console.error('[DiagramService] deleteDiagram error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * autoSave (debounced)
   * ----------------------
   * LAYMAN'S: A "smart save" that waits 2 seconds after the last change
   *   before actually saving. This prevents saving on every single
   *   keystroke or element move — only saves after the user pauses.
   *
   * TECHNICAL: Debounced wrapper around saveDiagram() with a 2000ms delay.
   *   The debounced function is created once as a static property so it
   *   persists across renders and the timer resets correctly.
   *   Returns the same { success, id, error } shape as saveDiagram
   *   but the call is fire-and-forget from the caller's perspective.
   *
   * Usage in UMLEditor:
   *   DiagramService.autoSave(currentUser, diagramId, { elements, connections, ... });
   */
  static autoSave = _debounce(async (user, diagramId, diagramData) => {
    if (!user) return;
    const result = await DiagramService.saveDiagram(user, diagramId, diagramData);
    if (!result.success) {
      console.warn('[DiagramService] autoSave failed:', result.error);
    }
  }, 2000);
}

export default DiagramService;
