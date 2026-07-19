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

import {
  deriveCompletedFromState,
  type WizardSession,
} from "../../workspace/new/wizard-session";
import { NAVIGABLE_STEPS, type StepId } from "../../workspace/new/wizard-steps";

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

const NAVIGABLE_STEPS_SET: ReadonlySet<string> = new Set(NAVIGABLE_STEPS);

/**
 * Reconcile the three sources of truth for `completed_steps` on load:
 *
 *   1. `state.wizard.completed_steps` — the client-tracked list from any
 *      prior mount of this session. May contain old + valid entries.
 *   2. `serverCompletedSteps` — the top-level `training_activity_sessions`
 *      column value the server persisted. Also authoritative.
 *   3. `deriveCompletedFromState(session)` — the evidence-based derivation
 *      from state.wizard content (address filled → "property" completed,
 *      etc). Bounded to what the wizard content proves.
 *
 * We union all three, filter to canonical navigable StepIds (guards against
 * malformed persisted entries), and dedupe in journey order. Order preserves
 * the canonical navigation sequence so UI + tests can reason about it.
 *
 * This is the PILOT-D-008 recovery path. It runs on every training-mode
 * load, not only for the stuck learner. Once a session is repaired, its
 * next natural PATCH will persist the reconciled list to the server —
 * subsequent loads see the same list back and the reconciliation is a
 * no-op (idempotent).
 */
function reconcileCompletedSteps(
  wizard: WizardSession,
  serverCompletedSteps: readonly string[],
): StepId[] {
  const union = new Set<string>();
  for (const s of wizard.completed_steps) union.add(s);
  for (const s of serverCompletedSteps) union.add(s);
  for (const s of deriveCompletedFromState(wizard)) union.add(s);
  // Preserve canonical journey order + drop anything not in the
  // navigable set (defensive against a corrupt persisted list).
  return NAVIGABLE_STEPS.filter((step) => union.has(step) && NAVIGABLE_STEPS_SET.has(step));
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
        // Extract the persisted WizardSession from state.wizard. Null =
        // the wizard has never been touched — nothing to reconcile.
        const wizard = extractWizardSession(row.state);
        if (!wizard) return { kind: "ok", session: null };

        // PILOT-D-008 recovery on load: reconcile completed_steps across
        // the three truth sources (client-persisted, server-persisted,
        // evidence-derived from state.wizard content). The next natural
        // save fires immediately after hydration in useWizardSession,
        // PATCHes the union back through the public session API, and
        // the row's top-level `completed_steps` column catches up. No
        // direct DB write is performed; the whole recovery rides on the
        // normal authenticated PATCH endpoint.
        const reconciled = reconcileCompletedSteps(wizard, row.completed_steps);
        const withReconciled: WizardSession = {
          ...wizard,
          completed_steps: reconciled,
        };
        return { kind: "ok", session: withReconciled };
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
        // PILOT-D-008: send `state.wizard` AND top-level `completed_steps`
        // in a single atomic PATCH — Vault's PATCH endpoint applies both
        // fields in one UPDATE (see `training_activity_sessions` PATCH
        // route). Doing this in ONE request eliminates the state-vs-steps
        // race that a two-call sequence would open.
        //
        // Vault's completion validator reads the top-level
        // `completed_steps` column, NOT `state.wizard.completed_steps`,
        // so we MUST lift the client-tracked list to the top level here.
        // The wizard hook only ever appends canonical StepIds to
        // `session.completed_steps` (via addCompletedStep on validated
        // forward navigation), so passing the whole array through is safe
        // — Vault's PATCH endpoint additionally validates the array-of-
        // strings shape.
        await patchSession(
          sessionId,
          {
            state: { wizard: session },
            completed_steps: session.completed_steps,
          },
          deps,
        );
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
