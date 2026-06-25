// ============================================================================
// AGENT PORTAL 2.1 — R4 — Server-only Vault paperwork-forms fetcher
// ============================================================================
// Single read against Vault's existing endpoint:
//   GET /api/paperwork/transactions/[id]/forms  (Bearer)
//     → { requirements: RequirementRow[], instances: FormInstanceRow[] }
//
// Vault enforces SEC.3A tenant containment + agent ownership at the
// route layer (gateCaller + verifyTransactionInTenant); cross-tenant /
// unauthorized / missing all collapse to a 404. The agents-portal page
// just maps 404 → not_found and renders an empty Documents panel.
// ============================================================================

import "server-only";

import { mergeDocuments } from "./helpers";
import type {
  DocumentsResult,
  FormInstanceRow,
  RequirementRow,
} from "./types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export async function fetchDocumentsForTransaction(input: {
  accessToken: string;
  transactionId: string;
  vaultSiteBase: string;
}): Promise<DocumentsResult> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${input.transactionId}/forms`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (res.status === 404) return { kind: "not_found" };
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      return { kind: "error", status: res.status, message };
    }
    const body = await res.json();
    const requirements: RequirementRow[] = Array.isArray(body?.requirements)
      ? body.requirements
      : [];
    const instances: FormInstanceRow[] = Array.isArray(body?.instances)
      ? body.instances
      : [];
    const documents = mergeDocuments({
      vaultBase: input.vaultSiteBase,
      transactionId: input.transactionId,
      requirements,
      instances,
    });
    return { kind: "ok", documents };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}
