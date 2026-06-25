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
  const tab: "profiles" | "leads" = params.tab === "leads" ? "leads" : "profiles";

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

  return (
    <PageShell tab={tab}>
      <ClientsClient items={result.items} />
    </PageShell>
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
