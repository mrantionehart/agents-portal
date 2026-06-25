// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — /ai page
// ============================================================================
// Server component shell. Fetches the user's workspace cards via the
// existing Vault /api/platform/workspace endpoint (Bearer token) and
// hands them to the client AIShell. The page itself never mutates
// anything; the chat panel calls Vault /api/ai/chat directly.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, Sparkles } from "lucide-react";

import AIShell from "@/src/portal/ai/AIShell";
import { fetchWorkspaceFromVault } from "@/src/portal/workspace/api";

export default async function AIPage() {
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

  // Fetch the workspace card list. The chat panel itself does NOT need
  // these — they only power the optional transaction selector + recent
  // shortcuts on the left column.
  let result = await fetchWorkspaceFromVault({
    accessToken: session.access_token,
    scope: "mine",
  });
  if (result.ok === false) {
    // Fall back to office scope for brokers — same pattern as AP2.1B.
    if (result.status === 200 || result.status >= 400) {
      const fb = await fetchWorkspaceFromVault({
        accessToken: session.access_token,
        scope: "office",
      });
      if (fb.ok === true) result = fb;
    }
  }

  if (result.ok === false) {
    // Still render the chat — the agent can use it without context.
    return (
      <PageShell>
        <AIShell workspaceCards={[]} />
        <p className="mt-3 text-[11px] text-rose-300/70 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Could not load your transactions for the selector (HTTP {result.status}). The chat below still works without a selected deal.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AIShell workspaceCards={result.items} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function ErrorBanner({ status, message }: { status: number; message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2 mb-4">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">
          {status === 401
            ? "Please sign in to use the assistant."
            : `Couldn't reach the assistant (HTTP ${status}).`}
        </div>
        {message && <div className="mt-1 text-[11px] text-rose-300/80">{message}</div>}
      </div>
    </div>
  );
}
