// ============================================================================
// AGENT PORTAL 2.1 — R2B — Deal Portal feedback proxy
// ============================================================================
// Read-only summary of `deal_portal_feedback` for the agent's own portals.
//
// Vault's GET /api/deal-portal/feedback enforces the same role / ownership
// / tenant gates, but it's cookie-authenticated (designed for the Vault
// dashboard same-origin caller). Agents Portal talks to Vault cross-origin
// with a Bearer token, so cookies don't transit. Rather than modify Vault,
// re-implement the exact same gates here using service-role + SEC.3A
// tenant-scope helpers.
//
// Returned shape is the EXACT same shape Vault returns — aggregation
// rules (favorites / comments / respondents) match line-for-line so a
// future migration to the Vault endpoint is a no-op for the UI.
//
// NO writes. NO email/SMS. NO recipient logging. Read-only.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminClient, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

const BROKER_TIER = ["broker", "admin", "office_manager"];
const PLATFORM_SUPER_ADMIN_EMAIL = "mrhart@hartfeltmg.com";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id: portalId } = await params;
  if (!portalId) {
    return NextResponse.json({ error: "portal_id required" }, { status: 400 });
  }

  const svc = adminClient("r2b-deal-portal-feedback-read", {
    userId: user.id,
    context: "/api/broker/deal-portals/[id]/feedback",
  });

  // Caller profile — tenant + super-admin flag.
  const { data: callerProfile } = await svc
    .from("profiles")
    .select("role, email, tenant_id")
    .eq("id", user.id)
    .single();
  if (!callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 401 });
  }
  const isPlatformSuperAdmin =
    (callerProfile.email as string | null) === PLATFORM_SUPER_ADMIN_EMAIL;
  if (!isPlatformSuperAdmin && !callerProfile.tenant_id) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Portal + tenant + ownership gates. Same 404 for cross-tenant,
  // missing, or role-rejected — no existence leak.
  const { data: portal } = await svc
    .from("deal_portals")
    .select("id, title, created_by, tenant_id")
    .eq("id", portalId)
    .single();
  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const role = (callerProfile.role as string | null) ?? "agent";
  const isBrokerTier = BROKER_TIER.includes(role);
  const isOwner = portal.created_by === user.id;
  if (!isPlatformSuperAdmin && !isBrokerTier && !isOwner) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }
  if (
    !isPlatformSuperAdmin &&
    portal.tenant_id !== callerProfile.tenant_id
  ) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Fetch feedback rows in reverse chrono.
  const { data: feedback, error: fbErr } = await svc
    .from("deal_portal_feedback")
    .select("*")
    .eq("portal_id", portalId)
    .order("created_at", { ascending: false });
  if (fbErr) {
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }

  // Aggregate — identical shape to Vault.
  type ByPropertyEntry = {
    title: string;
    favorites: number;
    comments: Array<{
      name: string;
      email: string;
      comment: string;
      date: string;
    }>;
    respondents: string[];
  };
  const byProperty: Record<string, ByPropertyEntry> = {};
  for (const fb of feedback || []) {
    if (!byProperty[fb.property_title]) {
      byProperty[fb.property_title] = {
        title: fb.property_title,
        favorites: 0,
        comments: [],
        respondents: [],
      };
    }
    const entry = byProperty[fb.property_title];
    if (fb.is_favorite) entry.favorites++;
    if (fb.comment) {
      entry.comments.push({
        name: fb.client_name || "Anonymous",
        email: fb.client_email || "",
        comment: fb.comment,
        date: fb.created_at,
      });
    }
    const email = fb.client_email || "unknown";
    if (!entry.respondents.includes(email)) {
      entry.respondents.push(email);
    }
  }

  const allRespondents = [
    ...new Set(
      (feedback || [])
        .map((f: { client_email: string | null }) => f.client_email)
        .filter((e): e is string => Boolean(e))
    ),
  ];

  return NextResponse.json({
    portal_id: portalId,
    portal_title: portal.title,
    total_responses: allRespondents.length,
    respondents: allRespondents,
    properties: Object.values(byProperty).sort(
      (a, b) => b.favorites - a.favorites
    ),
    raw: feedback,
  });
}
