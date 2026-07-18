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
 * Convert a raw SessionApiError into a learner-facing message. The
 * Vault route surfaces two 501 codes for the fail-closed posture
 * (validator unavailable, criterion unsupported); both are equivalent
 * from the learner's perspective — the framework isn't wired up yet.
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
  if (err.code === "unauthorized") {
    return "Sign-in expired. Please refresh and try again.";
  }
  if (err.code === "network_error") {
    return "Network error. Please retry.";
  }
  return err.message || "Session could not be completed.";
}
