// POST /api/broker/str-analytics — Authenticated proxy to Vault STR analytics
// Portal is presentation-only. All auth and logging happen in Vault.
//
// SECURITY FIX (Release A): previously forwarded a raw `authorization` header
// that the calling browser component never sets, so Vault received an empty
// credential and rejected the write. Now resolves the caller's session via
// proxyToVault (Bearer, then cookie fallback).

import { NextRequest } from "next/server";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Portal-side gate (defense in depth). Vault re-verifies the token and
  // resolves role/tenant itself; this stops an unauthenticated request before
  // it ever leaves the portal.
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  return proxyToVault(request, "POST", "/str-analytics", body);
}
