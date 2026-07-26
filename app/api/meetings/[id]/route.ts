// ============================================================================
// GET /api/meetings/[id] — thin same-origin proxy to Vault agent-safe detail.
// Vault returns the agent-safe projection (own-or-404); the Portal never sees
// broker-internal fields. No decision/participant/reminder mutation exists here.
// ============================================================================
import { NextRequest } from "next/server";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  return proxyToVault(request, "GET", `/meetings/${encodeURIComponent(id)}`);
}
