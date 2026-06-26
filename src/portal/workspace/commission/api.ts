// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.4.3.1 — Commission Workspace fetcher
// ============================================================================
// Server-only. Two stages:
//   1. /api/commissions/get      → returns ALL commissions for the caller;
//                                  we filter by transaction_id, project to
//                                  SafeCommissionRow, and pick the most-
//                                  relevant row.
//   2. /api/commissions/[id]/gate-verdict (W3.4.3.0) → returns the 7-gate
//                                  verdict + payable flag.
//
// Both fail soft — composer renders a degraded state on any error. The
// fetcher never throws.
//
// Never called endpoints (by construction):
//   ✗ /api/commissions/pay        — would attempt payment
//   ✗ /api/commissions/approve    — would mutate state
//   ✗ /api/commissions/calculate  — broker workflow
//   ✗ /api/commissions/delete     — broker workflow
//   ✗ /api/stripe/*               — Vault-only
// ============================================================================

import "server-only";

import {
  pickCurrentCommission,
  toSafeCommissionRow,
  type RawCommissionRow,
} from "./safe-commission";
import type {
  CommissionGateVerdict,
  SafeCommissionRow,
} from "./types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export type FetchCommissionResult =
  | {
      kind: "ok";
      commission: SafeCommissionRow;
      verdict: CommissionGateVerdict | null;
      verdictError: string | null;
    }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export interface FetchCommissionInput {
  accessToken: string;
  transactionId: string;
}

export async function fetchCommissionWorkspaceSafely(
  input: FetchCommissionInput
): Promise<FetchCommissionResult> {
  try {
    // Stage 1 — list caller's commissions, find the one for this txn.
    const listRes = await fetch(`${VAULT_API_URL}/commissions/get`, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => listRes.statusText);
      return { kind: "error", message: trimMessage(body) };
    }
    const listBody = (await listRes.json()) as
      | { commissions?: RawCommissionRow[] }
      | RawCommissionRow[];
    const rows: RawCommissionRow[] = Array.isArray(listBody)
      ? listBody
      : Array.isArray(listBody?.commissions)
      ? listBody.commissions
      : [];

    const raw = pickCurrentCommission(rows, input.transactionId);
    const safe = toSafeCommissionRow(raw);
    if (!safe) {
      return { kind: "empty" };
    }

    // Stage 2 — call the W3.4.3.0 gate-verdict endpoint. Soft-fails to
    // null verdict; composer will render the commission status without
    // gate detail.
    let verdict: CommissionGateVerdict | null = null;
    let verdictError: string | null = null;
    try {
      const gvRes = await fetch(
        `${VAULT_API_URL}/commissions/${safe.id}/gate-verdict`,
        {
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );
      if (gvRes.ok) {
        verdict = (await gvRes.json()) as CommissionGateVerdict;
      } else {
        const body = await gvRes.text().catch(() => gvRes.statusText);
        verdictError = trimMessage(body);
      }
    } catch (err) {
      verdictError = err instanceof Error ? err.message : "Network error";
    }

    return { kind: "ok", commission: safe, verdict, verdictError };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

function trimMessage(body: string): string {
  if (typeof body !== "string") return "";
  const s = body.trim().replace(/\s+/g, " ");
  return s.length > 200 ? s.slice(0, 197) + "…" : s;
}
