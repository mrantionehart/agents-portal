// ============================================================================
// AGENT PORTAL 2.1 — R2A — /workspace/portals
// ============================================================================
// Server-rendered. Reads the agent's session via @supabase/ssr, then
// fetches deal portals via the EXISTING Vault /api/deal-portals/advisor
// endpoint (Bearer token). No new endpoints, no new DB writes.
//
// Replaces the legacy /deal-portals page UX within the AP2 shell.
// The legacy URL is retired via next.config.js redirect (see same
// commit). The Vault security model (R2 audit, SEC.3A tenant scope)
// is enforced server-side and unchanged.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, Share2 } from "lucide-react";

import PortalsClient from "@/src/portal/portals/PortalsClient";
import { fetchDealPortals } from "@/src/portal/portals/api";

export default async function PortalsPage() {
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
        <ErrorBanner status={401} message="Sign in to view your deal portals." />
      </PageShell>
    );
  }

  const result = await fetchDealPortals({ accessToken: session.access_token });

  if (result.kind === "error") {
    return (
      <PageShell>
        <ErrorBanner status={result.status} message={result.message} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PortalsClient items={result.items} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Deal Portals</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          Share curated property portals with your clients. View counts and
          recent activity update automatically as clients open the link.
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
            ? "Please sign in to view your deal portals."
            : status === 403
            ? "You don't have permission to view deal portals."
            : `Couldn't load deal portals (HTTP ${status}).`}
        </div>
        {message && (
          <div className="mt-1 text-[11px] text-rose-300/80 truncate">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
