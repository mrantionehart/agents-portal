// ============================================================================
// V4 TRAINING MODE — Production localStorage store
// ============================================================================
// Adapts the existing synchronous load/save/clear helpers from
// `workspace/new/wizard-session.ts` to the async `WizardSessionStore`
// interface. Sync calls wrapped in `Promise.resolve` — no behavioral
// change.
//
// This is the default the wizard hook uses when no store is injected.
// The production `/workspace/new` route therefore continues to hit
// localStorage exactly as before, character-for-character.
// ============================================================================

import {
  clearSession as clearLegacySession,
  loadSession as loadLegacySession,
  saveSession as saveLegacySession,
  type WizardSession,
} from "../../workspace/new/wizard-session";

import type {
  StoreLoadResult,
  StoreWriteResult,
  WizardSessionStore,
} from "./session-store";

/**
 * The default production store. Wraps the legacy synchronous helpers
 * so the async interface can accept them uniformly. `load()` returns
 * `session: null` when the legacy helper returns an empty session (via
 * the shape check: `transaction_type === null && parties.length === 0 &&
 * property has no keys && dates has no keys && current_step ===
 * DEFAULT_STEP && draft_transaction_id === null && created_party_ids.length
 * === 0`) — but for backwards compatibility with the existing hook, the
 * store simply forwards whatever the legacy helper returns because the
 * legacy helper's contract was always to return a session (never null).
 */
export const productionLocalStorageStore: WizardSessionStore = {
  async load(): Promise<StoreLoadResult> {
    const session: WizardSession = loadLegacySession();
    return { kind: "ok", session };
  },
  async save(session: WizardSession): Promise<StoreWriteResult> {
    saveLegacySession(session);
    return { kind: "ok" };
  },
  async clear(): Promise<StoreWriteResult> {
    clearLegacySession();
    return { kind: "ok" };
  },
};
