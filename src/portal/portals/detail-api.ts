// ============================================================================
// AGENT PORTAL 2.1 — R2B — Server-only detail fetchers
// ============================================================================
// Two read-only fetches:
//   1. Vault GET /api/deal-portals/advisor/[id] (Bearer)
//      → portal metadata + views + media
//   2. agents-portal GET /api/broker/deal-portals/[id]/feedback (Bearer/cookie)
//      → aggregated client feedback
//
// Both endpoints conflate cross-tenant / role-rejected / missing into the
// same 404 — so the detail page can just call them and treat 404 as
// "portal not visible" without leaking existence.
// ============================================================================

import "server-only";

import type { DetailResult, FeedbackResult } from "./detail-types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

/** Fetch portal detail (+ views + media) from Vault via Bearer. */
export async function fetchPortalDetail(input: {
  accessToken: string;
  portalId: string;
}): Promise<DetailResult> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/deal-portals/advisor/${input.portalId}`,
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
    // Vault returns { portal: {...} }; we forward as-is so the page
    // doesn't need to know about the envelope.
    if (!body?.portal) return { kind: "not_found" };
    return { kind: "ok", portal: body.portal };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Fetch per-portal feedback via the agents-portal proxy. The proxy
 *  honors the same role + ownership + tenant gate Vault would. Returns
 *  not_found when the caller can't see this portal — same shape as
 *  fetchPortalDetail so the page can early-out uniformly. */
export async function fetchPortalFeedback(input: {
  /** The agents-portal base URL — defaults to the deployed Vercel
   *  hostname, override via env for local dev / preview deploys. */
  baseUrl?: string;
  cookieHeader: string;
  portalId: string;
}): Promise<FeedbackResult> {
  const base = (
    input.baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://agents.hartfeltrealestate.com"
  ).replace(/\/$/, "");
  try {
    const res = await fetch(
      `${base}/api/broker/deal-portals/${input.portalId}/feedback`,
      {
        headers: {
          // Forward the caller's session cookies so requireAuth() in the
          // proxy can resolve the same agent.
          cookie: input.cookieHeader,
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
    return { kind: "ok", payload: body };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}
