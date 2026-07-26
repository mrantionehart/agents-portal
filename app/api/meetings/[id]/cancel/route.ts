// ============================================================================
// POST /api/meetings/[id]/cancel — agent cancels their OWN request.
// Authority (own-or-broker) is enforced by Vault's state machine; the Portal
// only forwards the optional note. requireAuth gates at the edge.
// ============================================================================
import { NextRequest } from "next/server";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { id } = await params;

  let note: string | null = null;
  try {
    const b = (await request.json()) as Record<string, unknown>;
    if (typeof b?.note === "string") note = b.note;
  } catch { /* empty body is fine for cancel */ }

  return proxyToVault(request, "POST", `/meetings/${encodeURIComponent(id)}/cancel`, { note });
}
