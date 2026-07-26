// ============================================================================
// POST /api/meetings/[id]/respond — requesting agent accepts/declines the
// broker's alternate time. action ∈ { accept_alternate, decline_alternate }.
// This is the ONLY way an agent responds to an alternate — there is NO decision
// route in the Portal (confirm/decline/propose_alternate are broker-only in
// Vault and are never proxied here). requireAuth gates at the edge.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["accept_alternate", "decline_alternate"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* handled below */ }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "action must be accept_alternate | decline_alternate" }, { status: 400 });
  }

  const payload: Record<string, unknown> = { action };
  if (typeof body.optionId === "string") payload.optionId = body.optionId;

  return proxyToVault(request, "POST", `/meetings/${encodeURIComponent(id)}/respond`, payload);
}
