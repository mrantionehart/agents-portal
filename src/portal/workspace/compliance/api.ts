// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.2 — Compliance tab fetcher
// ============================================================================
// Server-only. Calls the AGENT-READABLE Vault endpoint
//   GET /api/transactions/[id]/payout-readiness
// (verified agent-readable for the assigned agent; broker-tier gets
// can_refresh=true which we ignore).
//
// Returns the SAFE projection only — Vault's broker-context strings
// are masked off at this boundary via toSafePayoutReadiness().
// Soft-fails: on any non-OK response or network error, returns null so
// the Compliance tab can still render the other sections.
// ============================================================================

import "server-only";

import type { SafePayoutReadinessSummary } from "./types";
import { toSafePayoutReadiness } from "./safe-payout-readiness";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export interface FetchPayoutReadinessInput {
  accessToken: string;
  transactionId: string;
}

export async function fetchPayoutReadinessSafely(
  input: FetchPayoutReadinessInput
): Promise<SafePayoutReadinessSummary | null> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/transactions/${input.transactionId}/payout-readiness`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return toSafePayoutReadiness(body);
  } catch {
    return null;
  }
}
