// ============================================================================
// AGENT PORTAL 2.1 — R3B — Client intakes read proxy
// ============================================================================
// Read-only mirror of Vault's GET /api/intakes for the agents-portal
// /clients Leads tab.
//
// Vault's existing endpoint enforces the same SEC.3A scope
// (agent_id → profiles.tenant_id), but it's cookie-authenticated
// (designed for the Vault dashboard same-origin caller). Agents Portal
// talks to Vault cross-origin with Bearer, so cookies don't transit.
// Rather than modify Vault, re-implement the exact same scope here on
// service role + SEC.3A helpers. Response envelope `{ intakes: [...] }`
// mirrors Vault line-for-line.
//
// NO writes. NO email/SMS. NO claim/assign/convert. Read-only.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminClient, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

const BROKER_TIER = ["broker", "admin", "office_manager"];
const PLATFORM_SUPER_ADMIN_EMAIL = "mrhart@hartfeltmg.com";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const svc = adminClient("r3b-intakes-tenant-scope", {
    userId: user.id,
    context: "/api/broker/intakes",
  });

  // Caller scope.
  const { data: callerProfile } = await svc
    .from("profiles")
    .select("role, email, tenant_id")
    .eq("id", user.id)
    .single();
  if (!callerProfile) {
    return NextResponse.json({ intakes: [] });
  }
  const role = (callerProfile.role as string | null) ?? "agent";
  const email = callerProfile.email as string | null;
  const tenantId = (callerProfile.tenant_id as string | null) ?? null;
  const isPlatformSuperAdmin = email === PLATFORM_SUPER_ADMIN_EMAIL;
  const isBrokerTier = BROKER_TIER.includes(role);

  // Same SEC.3A scope Vault's GET /api/intakes uses (just translated
  // to service-role + an in-app filter, since RLS on client_intakes
  // isn't tenant-aware).
  let query = svc
    .from("client_intakes")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isBrokerTier) {
    // Agents see only their own intakes (already tenant-isolated by
    // virtue of agent_id being unique per user).
    query = query.eq("agent_id", user.id);
  } else if (!isPlatformSuperAdmin) {
    // Brokers see intakes whose owning agent is in their tenant.
    if (!tenantId) {
      return NextResponse.json({ intakes: [] });
    }
    const { data: tenantUsers } = await svc
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenantId);
    const tenantUserIds = (tenantUsers ?? []).map(
      (r: { id: string }) => r.id as string
    );
    if (tenantUserIds.length === 0) {
      return NextResponse.json({ intakes: [] });
    }
    query = query.in("agent_id", tenantUserIds);
  }
  // Platform super-admin: no filter, sees all intakes.

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: intakes, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch intakes" },
      { status: 500 }
    );
  }

  return NextResponse.json({ intakes: intakes ?? [] });
}
