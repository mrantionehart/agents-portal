// ============================================================================
// AGENT PORTAL 2.1 — R2A — Server-only fetcher
// ============================================================================
// Reuses the EXISTING agents-portal proxy at /api/broker/deal-portals/advisor
// which in turn proxies to Vault /api/deal-portals/advisor. No new API
// routes, no DB writes. Forwards the caller's Bearer token so Vault's
// existing role + tenant + assignment gates run unchanged.
// ============================================================================

import "server-only";

import type { DealPortalRow, ListResult } from "./types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

/** Fetch the caller's deal portals directly from Vault. Vault enforces
 *  the existing visibility rule (agent sees their own; broker sees
 *  tenant-scoped per SEC.3A). */
export async function fetchDealPortals(input: {
  accessToken: string;
}): Promise<ListResult> {
  try {
    const res = await fetch(`${VAULT_API_URL}/deal-portals/advisor`, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      return { kind: "error", status: res.status, message };
    }
    const body = await res.json();
    // Vault returns an array directly. Defensive: also accept the
    // shape variants observed elsewhere (data / portals wrappers).
    const items: DealPortalRow[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.portals)
      ? body.portals
      : [];
    return { kind: "ok", items };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}
