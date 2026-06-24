// ============================================================================
// AGENT PORTAL 2.0 — Vault Workspace API client (server-only)
// ============================================================================
// Thin wrapper that calls Vault's existing GET /api/platform/workspace
// endpoint with the user's access token forwarded as Bearer. ZERO new
// API surface — the function exists in the Portal repo only to call
// the Vault endpoint with the right headers.
//
// Server-only by virtue of `import "server-only"` at the top — if a
// client component ever imports this, the build fails.
// ============================================================================

import "server-only";

import type { WorkspaceCard } from "./types";

/** Vault API base URL. Defaults to the production custom domain. */
export const VAULT_BASE_URL =
  (process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api")
    .replace(/\/$/, "");

/** Vault site URL (without /api) for deep-link builders. */
export function vaultSiteBase(): string {
  return VAULT_BASE_URL.replace(/\/api$/, "");
}

export type FetchWorkspaceResult =
  | { ok: true; items: WorkspaceCard[] }
  | { ok: false; status: number; message: string };

export interface FetchWorkspaceOptions {
  accessToken: string;
  scope?: "mine" | "office";
}

/**
 * Server-side fetch against Vault's read-only workspace endpoint.
 * Forwards the user's access token as Authorization: Bearer — Vault
 * enforces tenant scope + broker-tier gates.
 */
export async function fetchWorkspaceFromVault(
  opts: FetchWorkspaceOptions
): Promise<FetchWorkspaceResult> {
  const params = new URLSearchParams();
  if (opts.scope === "office") params.set("scope", "office");
  const qs = params.toString() ? `?${params.toString()}` : "";

  let res: Response;
  try {
    res = await fetch(`${VAULT_BASE_URL}/platform/workspace${qs}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
      },
      // Always fresh — the workspace state changes per agent action.
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "network error",
    };
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.text();
      detail = body.slice(0, 200);
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, message: detail || res.statusText };
  }

  const json = (await res.json()) as { items?: WorkspaceCard[] };
  return { ok: true, items: Array.isArray(json.items) ? json.items : [] };
}
