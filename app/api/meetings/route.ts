// ============================================================================
// /api/meetings — thin same-origin proxy to the Vault meetings API
// ============================================================================
// GET  → the agent's own meetings (Vault self-scopes by server-derived role).
// POST → create a request. We forward ONLY agent-owned fields; tenant, broker,
//        requester, status, and expiration are server-owned by Vault and are
//        never accepted from the client. Expiration uses Vault's server-derived
//        default (we do not send expiresAt).
//
// Auth: requireAuth() gates at the portal edge (defense in depth); proxyToVault
// re-resolves the caller's bearer/cookie token and Vault re-verifies it and
// resolves role/tenant. The Portal never trusts client-supplied identity.
// ============================================================================
import { NextRequest } from "next/server";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  return proxyToVault(request, "GET", "/meetings");
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* Vault will 400 on missing fields */ }

  // Allow-list the create payload. Deliberately omits tenantId / brokerId /
  // requesterId / status / expiresAt — Vault owns those.
  const safe: Record<string, unknown> = {
    meetingType: body.meetingType,
    priority: body.priority,
    durationMin: body.durationMin,
    timezone: body.timezone,
    proposedStarts: body.proposedStarts,
    notes: typeof body.notes === "string" ? body.notes : null,
  };
  if (typeof body.idempotencyKey === "string") safe.idempotencyKey = body.idempotencyKey;

  return proxyToVault(request, "POST", "/meetings", safe);
}
