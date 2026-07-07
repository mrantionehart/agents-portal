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
