// ============================================================================
// TRANSACTION OS 3.3B.3A — Wizard Session (client-only state model)
// ============================================================================
// The WizardSession is the single client-side record of an in-progress
// transaction draft. It is PURE data + pure updaters + localStorage
// persistence. NO React, NO API, NO business logic, NO transaction creation.
//
// Fields (per the 3.3B.3A contract):
//   transaction_type · property · parties · dates · current_step
//   draft_transaction_id · created_party_ids
//
// draft_transaction_id + created_party_ids are the idempotency anchors used by
// the later submission orchestrator (3.3B.3D) so a retry never re-creates a
// transaction or a duplicate party. They are introduced (and persisted) here;
// they stay null/empty until 3.3B.3D populates them.
// ============================================================================

import { DEFAULT_STEP, type StepId } from "./wizard-steps";

/** Bump when the persisted shape changes incompatibly — old blobs are dropped. */
export const WIZARD_SESSION_VERSION = 1;
export const WIZARD_SESSION_KEY = "hartfelt.wizard.session.v1";

export interface WizardPropertyDraft {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  year_built?: string;
  has_hoa?: boolean;
}

export interface WizardPartyDraft {
  role?: string;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  /** Whether this party must sign (collected in the wizard; used downstream). */
  signature_required?: boolean;
}

export interface WizardDatesDraft {
  contract_date?: string;
  closing_date?: string;
  lease_start?: string;
  lease_end?: string;
}

export interface WizardSession {
  version: number;
  /** Canonical transaction type id (one of the 7). Null until chosen. */
  transaction_type: string | null;
  property: WizardPropertyDraft;
  parties: WizardPartyDraft[];
  dates: WizardDatesDraft;
  current_step: StepId;
  /**
   * Canonical StepId set the learner has verifiably ADVANCED PAST via
   * validated forward navigation. Insert-only during a session; never
   * emptied by back-nav. Opening a step (via URL / stepper) does NOT add
   * it — only a validated `goNext` from that step does. The training
   * store lifts this array to the top-level `completed_steps` column
   * where the Vault validator reads it (PILOT-D-008).
   *
   * NOTE: The Production wizard (`/workspace/new`) still runs off this
   * same model but never READS this field — its submit orchestrator
   * writes a real transaction and does not consult per-step markers.
   */
  completed_steps: StepId[];
  /** Set once the draft transaction is created (3.3B.3D). Idempotency anchor. */
  draft_transaction_id: string | null;
  /** Party ids already persisted (3.3B.3D). Prevents duplicate party inserts. */
  created_party_ids: string[];
}

/** A fresh, empty session at the first step. */
export function emptySession(): WizardSession {
  return {
    version: WIZARD_SESSION_VERSION,
    transaction_type: null,
    property: {},
    parties: [],
    dates: {},
    current_step: DEFAULT_STEP,
    completed_steps: [],
    draft_transaction_id: null,
    created_party_ids: [],
  };
}

// ── Pure updaters (return a NEW session; never mutate) ───────────────────────

export function setTransactionType(
  s: WizardSession,
  transaction_type: string | null
): WizardSession {
  return { ...s, transaction_type };
}

export function mergeProperty(
  s: WizardSession,
  patch: Partial<WizardPropertyDraft>
): WizardSession {
  return { ...s, property: { ...s.property, ...patch } };
}

export function setParties(
  s: WizardSession,
  parties: WizardPartyDraft[]
): WizardSession {
  return { ...s, parties: [...parties] };
}

export function mergeDates(
  s: WizardSession,
  patch: Partial<WizardDatesDraft>
): WizardSession {
  return { ...s, dates: { ...s.dates, ...patch } };
}

export function setStep(s: WizardSession, current_step: StepId): WizardSession {
  return { ...s, current_step };
}

/**
 * Record a StepId as completed. Insert-only + dedupe. Callers must only
 * invoke this for a step the learner has ADVANCED PAST via a validated
 * forward navigation — never merely opened via the URL / stepper. Passing
 * a step that is already present returns the same session reference.
 */
export function addCompletedStep(
  s: WizardSession,
  step: StepId
): WizardSession {
  if (s.completed_steps.includes(step)) return s;
  return { ...s, completed_steps: [...s.completed_steps, step] };
}

/**
 * Reconciliation helper used by the training route on mount. Derives the
 * canonical StepId set that a session's `state.wizard` content proves
 * were actually completed (address filled → "property" was completed,
 * parties present → "parties" was completed, etc.).
 *
 * The training route uses this ONLY when the server's persisted
 * `completed_steps` column is missing entries that state.wizard proves —
 * never to synthesize evidence. The exit criterion is: every returned id
 * must have a supporting field populated in `s`. If the current_step
 * itself has advanced past a step, that also counts as "completed past".
 *
 * Returns a canonical order-preserving list drawn from the fixed journey.
 */
export function deriveCompletedFromState(s: WizardSession): StepId[] {
  const out: StepId[] = [];
  // "type": transaction_type must be set to a canonical value string.
  if (typeof s.transaction_type === "string" && s.transaction_type.length > 0) {
    out.push("type");
  }
  // "property": address must be a non-empty string (matches Vault's
  // propertyHasRequiredFields check).
  if (
    typeof s.property.address === "string" &&
    s.property.address.trim().length > 0
  ) {
    out.push("property");
  }
  // "parties": at least one party with a non-empty role AND name.
  if (
    Array.isArray(s.parties) &&
    s.parties.some(
      (p) =>
        typeof p.role === "string" &&
        p.role.length > 0 &&
        typeof p.name === "string" &&
        p.name.trim().length > 0
    )
  ) {
    out.push("parties");
  }
  // "dates": at least a contract_date OR a lease_start (per-type rules
  // live server-side; here we only assert the learner filled in the
  // dates step at least once).
  if (
    (typeof s.dates.contract_date === "string" &&
      s.dates.contract_date.length > 0) ||
    (typeof s.dates.lease_start === "string" &&
      s.dates.lease_start.length > 0)
  ) {
    out.push("dates");
  }
  // "review": inferred ONLY from the current_step having advanced past
  // review. The wizard only reaches `create` (or the terminal `package`
  // node) after a validated goNext from review, so those are proof.
  if (s.current_step === "create" || s.current_step === "package") {
    out.push("review");
  }
  return out;
}

export function setDraftTransactionId(
  s: WizardSession,
  draft_transaction_id: string | null
): WizardSession {
  return { ...s, draft_transaction_id };
}

/** Record a persisted party id (deduped) — idempotency for retries. */
export function addCreatedPartyId(s: WizardSession, id: string): WizardSession {
  if (!id || s.created_party_ids.includes(id)) return s;
  return { ...s, created_party_ids: [...s.created_party_ids, id] };
}

// ── localStorage persistence (SSR-safe; corruption-tolerant) ─────────────────

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Load the persisted session. Missing / corrupt / version-mismatched blobs
 *  yield a fresh empty session (never throws). */
export function loadSession(): WizardSession {
  if (!hasStorage()) return emptySession();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(WIZARD_SESSION_KEY);
  } catch {
    return emptySession();
  }
  if (!raw) return emptySession();
  try {
    const parsed = JSON.parse(raw) as Partial<WizardSession>;
    if (!parsed || parsed.version !== WIZARD_SESSION_VERSION) {
      return emptySession();
    }
    // Merge over an empty base so any missing field is backfilled safely.
    const base = emptySession();
    return {
      ...base,
      ...parsed,
      property: { ...base.property, ...(parsed.property ?? {}) },
      dates: { ...base.dates, ...(parsed.dates ?? {}) },
      parties: Array.isArray(parsed.parties) ? parsed.parties : base.parties,
      // Pre-PILOT-D-008 blobs did not carry completed_steps. Backfill
      // with the empty array — the wizard hook fills it as the learner
      // clicks Next through validated steps in the current mount.
      completed_steps: Array.isArray(parsed.completed_steps)
        ? (parsed.completed_steps.filter(
            (v): v is StepId => typeof v === "string"
          ) as StepId[])
        : base.completed_steps,
      created_party_ids: Array.isArray(parsed.created_party_ids)
        ? parsed.created_party_ids
        : base.created_party_ids,
      current_step: parsed.current_step ?? base.current_step,
      version: WIZARD_SESSION_VERSION,
    };
  } catch {
    return emptySession();
  }
}

export function saveSession(s: WizardSession): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(WIZARD_SESSION_KEY, JSON.stringify(s));
  } catch {
    /* quota / privacy mode — persistence is best-effort */
  }
}

export function clearSession(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(WIZARD_SESSION_KEY);
  } catch {
    /* best-effort */
  }
}
