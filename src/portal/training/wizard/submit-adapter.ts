// ============================================================================
// V4 TRAINING MODE — Submit adapter
// ============================================================================
// Terminal-action swap for the wizard. The adapter type mirrors the
// production `submitWizard()` signature so `WizardShell.handleCreate`
// can call either uniformly. Only the wiring at the terminal step
// changes — every screen before submission is identical.
//
//   Production (default):
//     productionSubmitAdapter — wraps submitWizard() from
//     workspace/new/submit-orchestrator.ts. Writes to
//     /api/transactions/create + /api/transactions/[id]/parties.
//
//   Training:
//     createTrainingSubmitAdapter({ sessionId }) — calls
//     completeSession() from session-api.ts. Writes NOTHING to
//     public.transactions. Returns a redirect to the caller-configured
//     completion href.
// ============================================================================

import {
  submitWizard,
  type SubmitCallbacks,
  type SubmitDeps,
  type SubmitResult,
} from "../../workspace/new/submit-orchestrator";
import type { WizardSession } from "../../workspace/new/wizard-session";

import {
  SessionApiError,
  completeSession,
} from "./session-api";

/**
 * Signature every adapter conforms to. Matches how WizardShell already
 * invokes `submitWizard`: two positional args (session, callbacks) plus
 * optional deps for testability.
 */
export type SubmitAdapter = (
  session: WizardSession,
  callbacks: SubmitCallbacks,
  deps?: SubmitDeps,
) => Promise<SubmitResult>;

/**
 * Default. Byte-for-byte identical to what WizardShell called before
 * this PR — just re-exposed under the adapter type so the wizard
 * accepts either variant.
 */
export const productionSubmitAdapter: SubmitAdapter = (
  session,
  callbacks,
  deps,
) => submitWizard(session, callbacks, deps);

export interface CreateTrainingSubmitAdapterOptions {
  /** The Vault API session UUID to complete. */
  sessionId: string;
  /**
   * Where to send the learner on successful completion. Not a
   * transaction detail page — training completions don't produce
   * transactions. Typical value: "/training?completed=1".
   */
  successHref: string;
  /**
   * Optional injection points for tests.
   */
  deps?: {
    fetchImpl?: typeof fetch;
    getAccessTokenImpl?: () => Promise<string | null>;
  };
}

/**
 * Build a training adapter. Returns { ok: false } (never throws) when
 * the API refuses — the wizard's handleCreate surfaces `error` on the
 * Create step just as it does for the production error path.
 *
 * NOTE: the `callbacks` argument is ignored. Training sessions don't
 * produce transaction ids or party ids to record as idempotency
 * anchors; the API session id is the sole idempotency anchor and it's
 * already threaded via the URL.
 */
export function createTrainingSubmitAdapter(
  options: CreateTrainingSubmitAdapterOptions,
): SubmitAdapter {
  return async (
    _session: WizardSession,
    _callbacks: SubmitCallbacks,
    _deps?: SubmitDeps,
  ): Promise<SubmitResult> => {
    try {
      await completeSession(options.sessionId, options.deps);
      return {
        ok: true,
        redirectTo: options.successHref,
      };
    } catch (err) {
      if (err instanceof SessionApiError) {
        return {
          ok: false,
          error: mapTrainingSubmitError(err),
        };
      }
      return {
        ok: false,
        error:
          err instanceof Error && err.message
            ? err.message
            : "Session could not be completed.",
      };
    }
  };
}

/**
 * Convert a raw SessionApiError into a learner-facing message.
 *
 * PILOT-D-008: added actionable text for `session_missing_step` and
 * `session_invalid_state`, and switched the terminal fallback from a
 * confidently-wrong sentence to a neutral fail-closed message that
 * carries the raw server code + detail. The prior default
 * (`err.message`) was fed to the learner even when it came from a
 * completely different code path — see the ledger for the exact
 * incident.
 */
function mapTrainingSubmitError(err: SessionApiError): string {
  if (err.apiCode === "session_criterion_unsupported") {
    return "This lesson does not yet have a training criterion configured.";
  }
  if (err.apiCode === "session_validator_unavailable") {
    return "Training scoring for this lesson is not yet available.";
  }
  if (err.code === "session_expired") {
    return "Training session has expired. Please start a new one.";
  }
  if (err.code === "session_not_active") {
    return "This training session is no longer active.";
  }
  if (err.code === "session_missing_step") {
    return "Some wizard steps have not finished syncing. Review the incomplete steps and try again.";
  }
  if (err.code === "session_invalid_state") {
    return "Training session cannot be completed — the wizard state is missing a required field.";
  }
  if (err.code === "unauthorized") {
    return "Sign-in expired. Please refresh and try again.";
  }
  if (err.code === "network_error") {
    return "Network error. Please retry.";
  }
  // Fail-closed neutral fallback. `err.apiCode` (raw Vault code, if any)
  // is preserved so an operator reading the surfaced message can look
  // up the exact server-side cause in the runbook. We intentionally
  // avoid collapsing unknown validator codes into any of the specific
  // sentences above.
  const codeHint = err.apiCode ? ` (server code: ${err.apiCode})` : "";
  return `Session could not be completed${codeHint}. Please retry or start a new session.`;
}
