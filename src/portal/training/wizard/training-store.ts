// ============================================================================
// V4 TRAINING MODE — TrainingSessionApiStore
// ============================================================================
// Store implementation that persists the wizard session inside a
// caller-owned `training_activity_sessions` row via Vault's Session API.
// The wizard's `WizardSession` shape lives under `state.wizard`; the
// route knows the API session id from URL segment and constructs the
// store on mount.
//
// Semantics:
//   load()  → GET  /api/activity-sessions/[id], return state.wizard (or
//             null on first save).
//   save()  → PATCH /api/activity-sessions/[id] with { state: { wizard: s } }.
//   clear() → best-effort PATCH with { state: {} }. The API session is
//             NOT terminated on clear (cancel just drops the wizard blob).
//             Termination happens via /complete or expiration.
// ============================================================================

import type { WizardSession } from "../../workspace/new/wizard-session";

import {
  SessionApiError,
  getSession,
  patchSession,
} from "./session-api";
import type {
  StoreLoadResult,
  StoreWriteResult,
  WizardSessionStore,
} from "./session-store";

export interface CreateTrainingStoreOptions {
  /** The API session UUID. Comes from the URL segment. */
  sessionId: string;
  /** Optional dependency overrides for tests. */
  deps?: {
    fetchImpl?: typeof fetch;
    getAccessTokenImpl?: () => Promise<string | null>;
  };
}

/**
 * Read the persisted WizardSession snapshot from an API session's
 * `state` JSONB payload. Returns null when `state.wizard` is absent —
 * that's a legitimate "first save hasn't happened yet" signal.
 */
function extractWizardSession(
  state: Record<string, unknown>,
): WizardSession | null {
  const wizard = state.wizard;
  if (!wizard || typeof wizard !== "object" || Array.isArray(wizard)) {
    return null;
  }
  return wizard as WizardSession;
}

export function createTrainingSessionApiStore(
  options: CreateTrainingStoreOptions,
): WizardSessionStore {
  const { sessionId, deps } = options;

  return {
    async load(): Promise<StoreLoadResult> {
      try {
        const row = await getSession(sessionId, deps);
        // Refuse if the row is not active — the training route must not
        // let a completed/expired/revoked session's state be edited.
        if (row.status !== "active") {
          return {
            kind: "error",
            code:
              row.status === "expired"
                ? "session_expired"
                : "session_not_active",
            detail: `Session status is '${row.status}'.`,
          };
        }
        // Time-based expiry sanity check (belt-and-braces — the API also
        // enforces this on next start).
        if (Date.parse(row.timestamps.expires_at) <= Date.now()) {
          return {
            kind: "error",
            code: "session_expired",
            detail: "Session deadline has passed.",
          };
        }
        return { kind: "ok", session: extractWizardSession(row.state) };
      } catch (err) {
        if (err instanceof SessionApiError) {
          return { kind: "error", code: err.code, detail: err.message };
        }
        return {
          kind: "error",
          code: "unknown",
          detail: err instanceof Error ? err.message : "Load failed",
        };
      }
    },

    async save(session: WizardSession): Promise<StoreWriteResult> {
      try {
        await patchSession(sessionId, { state: { wizard: session } }, deps);
        return { kind: "ok" };
      } catch (err) {
        if (err instanceof SessionApiError) {
          return { kind: "error", code: err.code, detail: err.message };
        }
        return {
          kind: "error",
          code: "unknown",
          detail: err instanceof Error ? err.message : "Save failed",
        };
      }
    },

    async clear(): Promise<StoreWriteResult> {
      try {
        await patchSession(sessionId, { state: {} }, deps);
        return { kind: "ok" };
      } catch (err) {
        if (err instanceof SessionApiError) {
          return { kind: "error", code: err.code, detail: err.message };
        }
        return {
          kind: "error",
          code: "unknown",
          detail: err instanceof Error ? err.message : "Clear failed",
        };
      }
    },
  };
}
