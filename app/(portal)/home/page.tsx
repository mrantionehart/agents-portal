// ============================================================================
// AGENT PORTAL 2.0 — AP2.1E — Home Dashboard
// ============================================================================
// Server-rendered morning briefing. Reads the agent's session via
// @supabase/ssr, calls Vault's EXISTING /api/platform/workspace, and
// derives every section from the response.
//
// Zero new endpoints. Zero mutations. Zero business logic in the
// Portal — the buckets are presentational categorizations, not
// recomputes.
// ============================================================================

export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  AlertCircle,
  Bell,
  Calendar,
  ListChecks,
  Sparkles,
  Activity,
} from "lucide-react";

import { fetchWorkspaceFromVault, vaultSiteBase } from "@/src/portal/workspace/api";
import WorkspaceCard from "@/src/portal/workspace/WorkspaceCard";
import type { WorkspaceCard as WorkspaceCardData } from "@/src/portal/workspace/types";
import {
  bucketCounts,
  firstName,
  formatToday,
  greetingFor,
  prioritizeForToday,
  summarySentence,
} from "@/src/portal/home/home-helpers";

export default async function PortalHomePage() {
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
  const now = new Date();

  // Best-effort first name. Read-only lookup of the caller's profile.
  let agentName: string | null = null;
  if (session) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle<{ full_name: string | null }>();
    agentName = prof?.full_name ?? (session.user.email ?? null);
  }

  if (!session) {
    return (
      <HomeShell now={now} agentName={null}>
        <ErrorBanner status={401} message="Sign in and reload this page." />
      </HomeShell>
    );
  }

  const result = await fetchWorkspaceFromVault({
    accessToken: session.access_token,
    scope: "mine",
  });

  if (result.ok === false) {
    return (
      <HomeShell now={now} agentName={agentName}>
        <ErrorBanner status={result.status} message={result.message} />
      </HomeShell>
    );
  }

  const cards = result.items;
  const counts = bucketCounts(cards);
  const prioritized = prioritizeForToday(cards);
  const todays = prioritized.slice(0, 6);

  return (
    <HomeShell now={now} agentName={agentName}>
      {/* ── Summary sentence ───────────────────────────────────── */}
      <p className="text-base text-[#A1A1AA] mb-6 leading-relaxed max-w-2xl">
        {summarySentence(cards)}
      </p>

      {/* ── 2. Priority buckets ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <BucketCard
          label="Needs Attention"
          count={counts.needs_attention}
          tone={counts.needs_attention > 0 ? "warn" : "muted"}
          href="/workspace?status=needs_more_info"
        />
        <BucketCard
          label="Ready for Review"
          count={counts.ready_for_review}
          tone={counts.ready_for_review > 0 ? "info" : "muted"}
          href="/workspace?status=ready_for_review"
        />
        <BucketCard
          label="Ready for Signature"
          count={counts.ready_for_signature}
          tone={counts.ready_for_signature > 0 ? "ok" : "muted"}
          href="/workspace?status=ready_for_signature"
        />
        <BucketCard
          label="Waiting on Parties"
          count={counts.waiting_on_parties}
          tone={counts.waiting_on_parties > 0 ? "warn" : "muted"}
        />
      </div>

      {/* ── 3. Today's Transactions ────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-[#F1F1F3]">Today&apos;s Transactions</h2>
          <Link
            href="/workspace"
            className="text-xs text-[#A1A1AA] hover:text-[#F1F1F3]"
          >
            View all →
          </Link>
        </div>
        {todays.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {todays.map((card) => (
              <WorkspaceCard key={card.transaction_id} card={card} vaultBase={vaultBase} />
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Recent Activity (placeholder) ──────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[#F1F1F3] mb-3">Recent Activity</h2>
        <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
          <div className="flex items-start gap-3">
            <Activity className="h-4 w-4 text-[#71717A] mt-0.5" />
            <div>
              <p className="text-sm text-[#A1A1AA]">
                Activity feed is coming soon.
              </p>
              <p className="text-xs text-[#71717A] mt-1">
                Once enabled, the latest envelope signings, portal completions,
                and broker reviews from Vault will appear here. Until then, open
                a transaction to see its full timeline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Quick Actions ──────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-medium text-[#F1F1F3] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/transactions" icon={<ListChecks className="h-4 w-4" />} label="View Transactions" />
          <QuickAction href="/ai" icon={<Sparkles className="h-4 w-4" />} label="Open AI" />
          <QuickAction href="/calendar" icon={<Calendar className="h-4 w-4" />} label="View Calendar" />
          <QuickAction href="/notifications" icon={<Bell className="h-4 w-4" />} label="Notifications" />
        </div>
      </section>
    </HomeShell>
  );
}

// ── Shell + atoms ─────────────────────────────────────────────────────

function HomeShell({
  now,
  agentName,
  children,
}: {
  now: Date;
  agentName: string | null;
  children: React.ReactNode;
}) {
  const greeting = greetingFor(now.getHours());
  const today = formatToday(now);
  return (
    <div>
      <header className="mb-2">
        <div className="text-xs text-[#71717A]">{today}</div>
        <h1 className="text-2xl font-semibold text-[#F1F1F3] mt-1">
          {greeting}, {firstName(agentName)}.
        </h1>
      </header>
      {children}
    </div>
  );
}

type Tone = "ok" | "warn" | "info" | "muted";

function BucketCard({
  label,
  count,
  tone,
  href,
}: {
  label: string;
  count: number;
  tone: Tone;
  href?: string;
}) {
  const v =
    tone === "ok" ? "text-emerald-300" :
    tone === "info" ? "text-sky-300" :
    tone === "warn" ? "text-amber-300" :
    "text-[#A1A1AA]";
  const border =
    tone === "ok" ? "border-emerald-700/40" :
    tone === "info" ? "border-sky-700/40" :
    tone === "warn" ? "border-amber-700/40" :
    "border-[#1a1a2e]";

  const inner = (
    <div
      className={`rounded-lg border ${border} bg-[#11111a] p-4 hover:border-[#252538] transition-colors duration-[180ms]`}
    >
      <div className={`text-3xl font-semibold tabular-nums leading-none ${v}`}>{count}</div>
      <div className="text-xs text-[#A1A1AA] mt-2">{label}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="
        rounded-lg border border-[#1a1a2e] bg-[#11111a] p-4
        hover:border-[#252538] transition-colors duration-[180ms]
        flex items-center gap-3
      "
    >
      <span className="text-[#C9A84C]">{icon}</span>
      <span className="text-sm text-[#F1F1F3]">{label}</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-8 text-center">
      <p className="text-sm text-[#A1A1AA]">
        No active transactions to focus on right now.
      </p>
      <p className="text-xs text-[#71717A] mt-1">
        Head to <Link href="/workspace" className="text-[#E8D5A3] hover:underline">Transactions</Link> to see your full pipeline.
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
            ? "Please sign in to view your home dashboard."
            : status === 403
            ? "You don't have permission to view this dashboard."
            : `Couldn't load the dashboard (HTTP ${status}).`}
        </div>
        {message && <div className="mt-1 text-[11px] text-rose-300/80 truncate">{message}</div>}
      </div>
    </div>
  );
}
