// ============================================================================
// GET /api/broker/str-directory — Authenticated proxy to Vault STR directory
// ============================================================================
// Portal is presentation-only. All auth, rate limiting, logging, and
// field-gating happen in Vault.
//
// ── SECURITY FIX (Release A) ───────────────────────────────────────────────
// This route previously forwarded `request.headers.get("authorization") || ""`
// verbatim. STRDirectoryScreen is a browser component that does not attach an
// Authorization header — it relies on the Supabase session cookie — so the
// forwarded value was the empty string and Vault answered from its
// ANONYMOUS branch. Every agent in the portal was being served the public
// response, and any tightening of that branch would have blanked the screen.
//
// `proxyToVault` resolves the caller's access token from the Bearer header
// FIRST and falls back to the cookie session, returning 401 when neither
// resolves. Identity, role, and tenant are then verified server-side inside
// Vault from that token — never from a client-supplied header.
//
// This is the same helper already used by the transaction and paperwork
// proxies in this repo; nothing new is introduced.
// ============================================================================

import { NextRequest } from "next/server";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Portal-side gate (defense in depth). Vault re-verifies the token and
  // resolves role/tenant itself; this stops an unauthenticated request before
  // it ever leaves the portal.
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();

  return proxyToVault(
    request,
    "GET",
    `/str-directory${qs ? `?${qs}` : ""}`
  );
}
