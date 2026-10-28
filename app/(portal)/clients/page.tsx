// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Clients Index
// ============================================================================
// Server-rendered. Reads `client_profiles` directly via the existing
// Supabase client; same access-check semantics AP2.1D uses. No new
// endpoints, no writes, no DB migrations.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, Users } from "lucide-react";

import ClientsClient from "@/src/portal/clients/ClientsClient";
import { loadClientList } from "@/src/portal/clients/loader";
import { fetchIntakes, fetchLeads } from "@/src/portal/leads/api";
import { sanitizeIntake, sanitizeLead } from "@/src/portal/leads/helpers";
import ClientsTabs from "@/src/portal/clients/ClientsTabs";
import LeadsClient from "@/src/portal/leads/LeadsClient";

export default async function ClientsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  // P4H-15 — three tabs: "profiles" (clients the caller owns), "claim"
  // (unassigned pooled prospects — the dispo feed, surfaced as its own
  // bucket instead of mixed into the owned list), and "leads" (unchanged).
  const tab: "profiles" | "claim" | "leads" =
    params.tab === "leads"
      ? "leads"
      : params.tab === "claim"
      ? "claim"
      : "profiles";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(_n: string, _v: string, _o: CookieOptions) { /* read-only */ },
        remove(_n: string, _o: CookieOptions) { /* read-only */ },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return (
      <PageShell tab={tab}>
        <ErrorBanner status={401} message="Sign in and reload this page." />
      </PageShell>
    );
  }

  if (tab === "leads") {
    // Forward cookies to same-origin proxies. Both endpoints
    // enforce SEC.3A tenant scope; 404/empty stays existence-safe.
    const hdrs = await headers();
    const cookieHeader =
      hdrs.get("cookie") ??
      cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
    const host = hdrs.get("host") ?? "agents.hartfeltrealestate.com";
    const proto = hdrs.get("x-forwarded-proto") ?? "https";
    const baseUrl = `${proto}://${host}`;

    const [leadsRes, intakesRes] = await Promise.all([
      fetchLeads({ baseUrl, cookieHeader }),
      fetchIntakes({ baseUrl, cookieHeader }),
    ]);

    const callerId = session.user.id;
    const leads = (leadsRes.leads ?? []).map((r) => sanitizeLead(r, callerId));
    const intakes = (intakesRes.intakes ?? []).map((r) =>
      sanitizeIntake(r, callerId)
    );

    const errorParts: string[] = [];
    if (leadsRes.kind === "error") errorParts.push(`leads ${leadsRes.message}`);
    if (intakesRes.kind === "error") errorParts.push(`intakes ${intakesRes.message}`);
    const error = errorParts.length ? errorParts.join(" · ") : null;

    return (
      <PageShell tab={tab}>
        <LeadsClient leads={leads} intakes={intakes} error={error} />
      </PageShell>
    );
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string | null }>();
  const callerRole = prof?.role ?? "agent";

  const result = await loadClientList({
    supabase,
    callerId: session.user.id,
    callerRole,
  });

  if (result.kind === "error") {
    return (
      <PageShell tab={tab}>
        <ErrorBanner status={result.status} message={result.message} />
      </PageShell>
    );
  }

  // P4H-15 — partition the loaded list by `assignmentBucket`:
  //
  //   • "profiles" tab shows rows the caller OWNS — assigned-to-me,
  //     claimed-by-me, and (for broker tier) rows visible by role but
  //     not pooled. The pooled unassigned-prospect ("dispo") rows are
  //     routed to their own tab so they can't be mistaken for a
  //     caller's own clients.
  //   • "claim" tab shows ONLY the pooled unassigned-prospect rows.
  //
  // The server-side policy is unchanged; this is a client-visible
  // partition of the SAME result set, labelled the way the agent sees it.
  const ownedItems = result.items.filter((r) => r.assignmentBucket !== "dispo");
  const claimableItems = result.items.filter((r) => r.assignmentBucket === "dispo");

  if (tab === "claim") {
    return (
      <PageShell tab={tab}>
        <ClaimableHeader count={claimableItems.length} />
        <ClientsClient items={claimableItems} view="claim" />
      </PageShell>
    );
  }

  return (
    <PageShell tab={tab}>
      <ClientsClient items={ownedItems} view="profiles" />
    </PageShell>
  );
}

/** Short banner explaining what the Available-to-Claim tab is, so an
 *  agent who lands there doesn't wonder why the names aren't theirs. */
function ClaimableHeader({ count }: { count: number }) {
  return (
    <div
      role="note"
      className="rounded-md border border-[#C9A84C]/30 bg-[#C9A84C]/5 px-3 py-2 text-xs text-[#E8D5A3] mb-4"
    >
      <div className="font-medium">
        {count === 1
          ? "1 unassigned prospect available to claim"
          : `${count} unassigned prospects available to claim`}
      </div>
      <div className="text-[#A1A1AA] mt-0.5">
        These are pooled brokerage leads. Open one to review and claim it;
        your Client Profiles tab only lists clients already assigned to you.
      </div>
    </div>
  );
}

function PageShell({
  tab,
  children,
}: {
  tab: "profiles" | "leads";
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Clients</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          Read-only client intelligence. Switch between profiles and leads,
          filter, search, and open detail for preferences and context.
        </p>
      </header>
      <ClientsTabs active={tab} />
      {children}
    </div>
  );
}

function ErrorBanner({ status, message }: { status: number; message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2 mb-4">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">
          {status === 401
            ? "Please sign in to view your clients."
            : status === 403
            ? "You don't have permission to view this list."
            : `Couldn't load clients (HTTP ${status}).`}
        </div>
        {message && <div className="mt-1 text-[11px] text-rose-300/80 truncate">{message}</div>}
      </div>
    </div>
  );
}
