// ============================================================================
// AGENT PORTAL 2.1 — R5 — /training Training Hub
// ============================================================================
// Server-rendered shell + initial data load. Renders the unified
// Training Hub inside the AP2 shell. Replaces the old standalone
// /training (now /training-legacy) and the standalone Resources nav
// item. Sidebar entry "Training" routes here.
//
// Three tabs (Training | Script Library | Resources) with shared
// search. Existing engines (video player, script viewer, resource
// downloads) stay on the legacy pages — every card deep-links to
// them.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, GraduationCap } from "lucide-react";

import TrainingHubClient from "@/src/portal/training/TrainingHubClient";
import { loadTrainingHub } from "@/src/portal/training/loader";
import type { HubTab } from "@/src/portal/training/types";

export default async function TrainingHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab: HubTab =
    params.tab === "scripts"
      ? "scripts"
      : params.tab === "resources"
      ? "resources"
      : "training";

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
      <Shell>
        <ErrorBanner message="Sign in and reload this page." />
      </Shell>
    );
  }

  const result = await loadTrainingHub({
    supabase,
    callerId: session.user.id,
  });

  return (
    <Shell>
      <TrainingHubClient
        training={result.training}
        scripts={result.scripts}
        resources={result.resources}
        continueWatching={result.continueWatching}
        initialTab={initialTab}
        error={result.kind === "error" ? result.message : null}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Training</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          One destination for everything you need to learn. Training modules,
          script library, and brokerage resources — all searchable here. The
          existing engines power video playback, scripts, and downloads behind
          the scenes.
        </p>
      </header>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2 mb-4">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>{message}</div>
    </div>
  );
}
