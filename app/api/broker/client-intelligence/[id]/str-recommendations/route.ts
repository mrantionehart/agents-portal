// GET /api/broker/client-intelligence/[id]/str-recommendations
// Authenticated proxy to Vault STR recommendations.
//
// SECURITY FIX (Release A): see str-directory/route.ts. Vault gates this
// endpoint on a broker-tier session; the previous raw header forward supplied
// an empty credential, so the request was rejected before reaching the data.

import { NextRequest } from "next/server";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Portal-side gate (defense in depth). Vault re-verifies the token and
  // resolves role/tenant itself; this stops an unauthenticated request before
  // it ever leaves the portal.
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const qs = new URL(request.url).searchParams.toString();
  return proxyToVault(
    request,
    "GET",
    `/client-intelligence/${encodeURIComponent(id)}/str-recommendations${qs ? `?${qs}` : ""}`
  );
}
