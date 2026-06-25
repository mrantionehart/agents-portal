// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Clients Index
// ============================================================================
// Server-rendered. Reads `client_profiles` directly via the existing
// Supabase client; same access-check semantics AP2.1D uses. No new
// endpoints, no writes, no DB migrations.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, Users } from "lucide-react";

import ClientsClient from "@/src/portal/clients/ClientsClient";
import { loadClientList } from "@/src/portal/clients/loader";

export default async function ClientsIndexPage() {
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
      <PageShell>
        <ErrorBanner status={401} message="Sign in and reload this page." />
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
      <PageShell>
        <ErrorBanner status={result.status} message={result.message} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ClientsClient items={result.items} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Clients</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          Read-only client intelligence. Filter, search, and open a profile to
          see preferences and context.
        </p>
      </header>
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
