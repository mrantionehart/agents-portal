// ============================================================================
// TRANSACTION OS 3.3B.3D — Wizard submit orchestration
// ============================================================================
// Composes existing Agent Portal APIs to turn a completed WizardSession into a
// draft transaction with its parties, then hands off to Package Review. It
// ONLY orchestrates — no PDFs, no envelopes, no DocuSign, no Package Builder
// call, no lifecycle/deadline calc.
//
// Flow:
//   1. POST /api/transactions/create        (skipped if draft_transaction_id set)
//   2. POST /api/transactions/[id]/parties   (per party; index-resume)
//   3. recompute happens inside the party endpoint (fail-open)
//   4. resolve the redirect target → /workspace/[id]
//
// IDEMPOTENCY (no server dedup exists):
//   • transaction — created only when draft_transaction_id is null; every retry
//     / refresh reuses it. Never a duplicate transaction.
//   • parties — resume from `created_party_ids.length`; a mid-list failure
//     leaves the created prefix recorded so a retry only creates the rest.
//     Never a duplicate party.
// `fetchImpl` is injectable so the whole flow is unit-testable offline.
// ============================================================================

import type { WizardSession, WizardPartyDraft } from "./wizard-session";
import { isLeaseType } from "./transaction-types";

export interface SubmitCallbacks {
  /** Persist the created transaction id (idempotency anchor). */
  onTransactionCreated: (id: string) => void;
  /** Persist a created party id (idempotency anchor). */
  onPartyCreated: (id: string) => void;
}

export interface SubmitDeps {
  fetchImpl?: typeof fetch;
}

export interface SubmitResult {
  ok: boolean;
  transactionId?: string;
  /** Where to navigate on success (Package Review is owned by 3.3C). */
  redirectTo?: string;
  createdParties?: number;
  error?: string;
  /** Which stage failed — lets the UI phrase the retry. */
  stage?: "create" | "parties";
}

function s(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/** Map a WizardSession to the /api/transactions/create body. The canonical
 *  `type` is sent as-is — the create route stores it enum-safe and derives the
 *  FAR-BAR rule set from the canonical value. */
export function toCreateBody(session: WizardSession): Record<string, unknown> {
  const { property, dates } = session;
  const lease = isLeaseType(session.transaction_type);
  // The transactions table holds lease dates in the contract/closing columns
  // (the legacy page did the same via relabeled inputs).
  const contract_date = lease ? s(dates.lease_start) : s(dates.contract_date);
  const closing_date = lease ? s(dates.lease_end) : s(dates.closing_date);

  // Best-effort "primary client" for the pipeline card; parties remain the
  // source of truth (created via the party endpoint).
  const primary = session.parties.find((p) => s(p.name)) ?? session.parties[0];

  return {
    type: session.transaction_type,
    property_address: s(property.address),
    city: s(property.city),
    state: s(property.state),
    zip: s(property.zip),
    year_built: s(property.year_built) || undefined,
    has_hoa: !!property.has_hoa,
    contract_date: contract_date || undefined,
    closing_date: closing_date || undefined,
    client_name: primary ? s(primary.name) || s(primary.company) : "",
    client_email: primary ? s(primary.email) || undefined : undefined,
    client_phone: primary ? s(primary.phone) || undefined : undefined,
  };
}

/** Map a wizard party to the party endpoint body (empties omitted). */
export function toPartyBody(p: WizardPartyDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    role: s(p.role),
    signature_required: p.signature_required !== false,
  };
  if (s(p.name)) body.name = s(p.name);
  if (s(p.company)) body.company = s(p.company);
  if (s(p.email)) body.email = s(p.email);
  if (s(p.phone)) body.phone = s(p.phone);
  return body;
}

async function postJson(
  doFetch: typeof fetch,
  url: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function submitWizard(
  session: WizardSession,
  callbacks: SubmitCallbacks,
  deps: SubmitDeps = {}
): Promise<SubmitResult> {
  const doFetch = deps.fetchImpl ?? fetch;

  // ── 1. Create the draft transaction (idempotent) ──────────────────────────
  let transactionId = session.draft_transaction_id;
  if (!transactionId) {
    let created;
    try {
      created = await postJson(doFetch, "/api/transactions/create", toCreateBody(session));
    } catch {
      return { ok: false, stage: "create", error: "Network error creating the transaction." };
    }
    const id = created.data?.transaction?.id;
    if (!created.ok || !id) {
      return {
        ok: false,
        stage: "create",
        error: created.data?.error || "Failed to create the transaction.",
      };
    }
    transactionId = id;
    callbacks.onTransactionCreated(id);
  }

  // ── 2. Create parties (resume from the already-created prefix) ────────────
  const already = session.created_party_ids.length;
  const remaining = session.parties.slice(already);
  let createdParties = 0;
  for (const party of remaining) {
    let res;
    try {
      res = await postJson(
        doFetch,
        `/api/transactions/${transactionId}/parties`,
        toPartyBody(party)
      );
    } catch {
      return {
        ok: false,
        stage: "parties",
        transactionId,
        createdParties,
        error: "Network error adding a party. Your progress is saved — retry to continue.",
      };
    }
    const partyId = res.data?.party?.id;
    if (!res.ok || !partyId) {
      return {
        ok: false,
        stage: "parties",
        transactionId,
        createdParties,
        error: res.data?.error || "Failed to add a party.",
      };
    }
    callbacks.onPartyCreated(partyId);
    createdParties += 1;
  }

  // ── 3. Recompute is inside the party endpoint (fail-open). Redirect. ──────
  // Transaction OS 3.3C: hand off to Package Review (the wizard's next step).
  return {
    ok: true,
    transactionId,
    createdParties,
    redirectTo: `/workspace/new/${transactionId}/review`,
  };
}
