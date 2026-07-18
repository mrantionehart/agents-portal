// GET/POST /api/broker/str-matches — Authenticated proxy to Vault STR matches
// Portal is presentation-only. All auth and data happen in Vault.
//
// SECURITY FIX (Release A): see str-directory/route.ts. The raw header
// forward supplied an empty credential; Vault's /str-matches requires an
// authenticated caller, so these requests were failing closed.

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

  const qs = new URL(request.url).searchParams.toString();
  return proxyToVault(request, "GET", `/str-matches${qs ? `?${qs}` : ""}`);
}

export async function POST(request: NextRequest) {
  // Portal-side gate (defense in depth). Vault re-verifies the token and
  // resolves role/tenant itself; this stops an unauthenticated request before
  // it ever leaves the portal.
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  return proxyToVault(request, "POST", "/str-matches", body);
}
