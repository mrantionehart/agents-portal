// ============================================================================
// Slice 2 Phase 3B-3.5 · Agent Portal → Vault signing package-status proxy
// ============================================================================
// GET /api/signing/packages/[packageId]
//
// Thin same-origin proxy to the Vault agent-safe package-detail endpoint
// (Vault Phase 3A · R3). Vault gates on gateCaller + owning-agent check +
// tenant scope + role projection, so the Portal only:
//   * requires an authenticated caller (requireAuth)
//   * URL-encodes the packageId path segment
//   * forwards to Vault verbatim
//   * returns Vault's status + JSON body byte-identical
//
// Read-only. No business logic. No composer, no compose-preview, no V2
// submission — those belong to Slice 3B-4. This slice only provides the
// dependency 3B-4 needs to navigate to and read package status.
//
// Feature-safe: the Vault side already returns the agent-safe projection
// regardless of `SIGNING_PLAN_V2_ENABLED`; this proxy carries no plan-version
// gate of its own. Both signing-composer flags remain OFF for this slice.
// ============================================================================

import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/security";
import { proxyToVault } from "@/lib/vault-forward";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const { packageId } = await params;
  return proxyToVault(
    request,
    "GET",
    `/signing/packages/${encodeURIComponent(packageId)}`,
  );
}
