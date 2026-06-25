// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Calendar (read-only deadlines)
// ============================================================================
// Server-rendered, derived purely from the existing Vault
// /api/platform/workspace endpoint. No new APIs, no writes, no
// migrations. WorkspaceCard does NOT currently carry date fields —
// every card lands in the "no date data yet" placeholder bucket until
// Vault enriches the workspace response. The page render is wired so
// adding date-aware grouping later is a single helper change.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, Calendar as CalendarIcon } from "lucide-react";

import { fetchWorkspaceFromVault, vaultSiteBase } from "@/src/portal/workspace/api";
import WorkspaceCard from "@/src/portal/workspace/WorkspaceCard";
import {
  groupCardsByBucket,
  isCalendarEmpty,
  type CalendarItem,
} from "@/src/portal/calendar/calendar-helpers";

export default async function CalendarPage() {
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
  const vaultBase = vaultSiteBase();

  if (!session) {
    return (
      <Shell>
        <ErrorBanner status={401} message="Sign in and reload this page." />
      </Shell>
    );
  }

  const result = await fetchWorkspaceFromVault({
    accessToken: session.access_token,
    scope: "mine",
  });

  if (result.ok === false) {
    return (
      <Shell>
        <ErrorBanner status={result.status} message={result.message} />
      </Shell>
    );
  }

  const groups = groupCardsByBucket(result.items);
  const empty = isCalendarEmpty(groups.counts);

  return (
    <Shell>
      {empty ? (
        <EmptyState />
      ) : (
        <>
          <Section
            title="Today"
            count={groups.counts.today}
            items={groups.today}
            vaultBase={vaultBase}
          />
          <Section
            title="This Week"
            count={groups.counts.this_week}
            items={groups.this_week}
            vaultBase={vaultBase}
          />
          <Section
            title="Upcoming"
            count={groups.counts.upcoming}
            items={groups.upcoming}
            vaultBase={vaultBase}
          />
          {groups.counts.no_date_data > 0 && (
            <section className="mb-2">
              <header className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-medium text-[#F1F1F3]">Active Deals</h2>
                <span className="text-[10px] tracking-wider uppercase text-[#71717A]">
                  No date data yet
                </span>
              </header>
              <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-4 mb-3 text-xs text-[#A1A1AA] leading-relaxed">
                Calendar deadlines aren&apos;t in the current Vault workspace card
                shape. Until Vault surfaces contract / closing / inspection
                dates, your active deals show up here so the calendar surface
                stays useful. Open any deal to see its full timeline in the
                Transaction Workspace.
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {groups.no_date_data.map((item) => (
                  <WorkspaceCard
                    key={item.card.transaction_id}
                    card={item.card}
                    vaultBase={vaultBase}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="mt-6 text-[11px] text-[#71717A]">
        Read-only calendar. The Portal does not create events, send reminders,
        or sync with external calendars. Vault is the source of truth for
        every deadline.
      </p>
    </Shell>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Calendar</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          Deadlines and active deals. Derived from your live workspace data.
        </p>
      </header>
      {children}
    </div>
  );
}

function Section({
  title,
  count,
  items,
  vaultBase,
}: {
  title: string;
  count: number;
  items: CalendarItem[];
  vaultBase: string;
}) {
  if (count === 0) return null;
  return (
    <section className="mb-6">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium text-[#F1F1F3]">{title}</h2>
        <span className="text-xs text-[#71717A] tabular-nums">{count}</span>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.map((item) => (
          <WorkspaceCard
            key={item.card.transaction_id}
            card={item.card}
            vaultBase={vaultBase}
          />
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-8 text-center">
      <CalendarIcon className="h-6 w-6 text-[#71717A] mx-auto mb-2" aria-hidden />
      <p className="text-sm text-[#A1A1AA]">No deadlines on the horizon.</p>
      <p className="text-xs text-[#71717A] mt-1 max-w-md mx-auto leading-relaxed">
        Active deals will surface here as contract / closing / inspection dates
        flow into Vault. In the meantime, open the{" "}
        <a href="/workspace" className="text-[#E8D5A3] hover:underline">
          Transactions
        </a>{" "}
        view for the full pipeline.
      </p>
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
            ? "Please sign in to view your calendar."
            : status === 403
            ? "You don't have permission to view this calendar."
            : `Couldn't load the calendar (HTTP ${status}).`}
        </div>
        {message && <div className="mt-1 text-[11px] text-rose-300/80 truncate">{message}</div>}
      </div>
    </div>
  );
}
