// ============================================================================
// V4 TRAINING MODE — WizardSessionStore abstraction
// ============================================================================
// Persistence seam between the wizard's session state and the underlying
// storage. Two concrete implementations:
//
//   * `productionLocalStorageStore` — the exact wrapper around
//     load/save/clear from `workspace/new/wizard-session.ts`. Sync
//     operations wrapped in resolved promises. Preserves production
//     behavior byte-for-byte when used as the default.
//
//   * `createTrainingSessionApiStore(...)` — API-backed store that
//     PATCHes to Vault's `/api/activity-sessions/[id]` and reads from
//     the same. The wizard session is stored inside the API session's
//     `state` JSONB column under `state.wizard`.
//
// The wizard hook (`useWizardSession`) accepts a store via config and,
// when none is provided, wires to the production store as its default —
// zero behavioral change for `/workspace/new`.
// ============================================================================

import type { WizardSession } from "../../workspace/new/wizard-session";

/**
 * Result of a store's load(). Distinguishes "no persisted state exists
 * yet" from "storage is unavailable / errored" so the training wizard
 * can render a specific failure state instead of silently starting a
 * fresh session.
 */
export type StoreLoadResult =
  | { kind: "ok"; session: WizardSession | null }
  | { kind: "error"; code: StoreErrorCode; detail?: string };

/**
 * Result of save() / clear(). Save is a best-effort operation from the
 * hook's perspective — errors are surfaced but do not block optimistic
 * UI updates.
 */
export type StoreWriteResult =
  | { kind: "ok" }
  | { kind: "error"; code: StoreErrorCode; detail?: string };

export type StoreErrorCode =
  // Session id in the URL points to a session that does not exist or
  // does not belong to the caller.
  | "session_not_found"
  // The training session's `expires_at` has passed. The caller must
  // start a new session; PATCH will refuse.
  | "session_expired"
  // The session is no longer active (revoked / abandoned / completed).
  | "session_not_active"
  // The session criterion validator reports at least one required step
  // is not yet in `completed_steps`. Post-PILOT-D-008 this reaches the
  // UI as an actionable "one or more steps didn't finish syncing" state.
  | "session_missing_step"
  // The session state is present but structurally invalid — e.g. wrong
  // activity_type, `state.wizard` missing/malformed. Fail-closed:
  // treated by the UI as "we can't complete this session" rather than
  // silently retrying.
  | "session_invalid_state"
  // The API refused the caller (auth expired, insufficient role).
  | "forbidden"
  // The learner is not authenticated.
  | "unauthorized"
  // Network / transport / unexpected 5xx.
  | "network_error"
  // Something we can't classify. Detail carries a short human string.
  | "unknown";

/**
 * The seam every store implements. All operations are Promises even for
 * synchronous stores so the wizard hook does not fork on store type.
 */
export interface WizardSessionStore {
  /**
   * Load the persisted session. `{kind:"ok", session: null}` means "no
   * persisted state yet — the wizard should start fresh."
   */
  load(): Promise<StoreLoadResult>;

  /**
   * Persist a snapshot of the session. Called on every state change.
   * Best-effort — errors are surfaced but do not block optimistic UI.
   */
  save(session: WizardSession): Promise<StoreWriteResult>;

  /**
   * Clear the persisted session. Called on cancel + finish. Best-effort.
   */
  clear(): Promise<StoreWriteResult>;
}
