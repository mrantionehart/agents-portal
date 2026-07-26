// ============================================================================
// AGENT PORTAL — /meetings — the agent's own broker meeting requests.
// Server-rendered. Tabs: Requests / Upcoming / History (?tab=). Reads the
// merged Vault agent-safe list; Vault self-scopes to the caller's own meetings.
// ============================================================================
export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarClock, Plus, AlertCircle } from "lucide-react";
import { getPortalSession } from "@/src/portal/meetings/session";
import { fetchAgentMeetings } from "@/src/portal/meetings/api";
import { bucketMeetings, type MeetingTab } from "@/src/portal/meetings/bucketing";
import MeetingsTabs from "./_components/MeetingsTabs";
import MeetingCard from "./_components/MeetingCard";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: MeetingTab = tabParam === "upcoming" ? "upcoming" : tabParam === "history" ? "history" : "requests";

  const { session } = await getPortalSession();
  if (!session) return <Shell><SignIn /></Shell>;

  const result = await fetchAgentMeetings(session.access_token);
  if (!result.ok) return <Shell><ErrorBanner status={result.status} /></Shell>;

  const buckets = bucketMeetings(result.items, new Date());
  const counts = { requests: buckets.requests.length, upcoming: buckets.upcoming.length, history: buckets.history.length };
  const rows = tab === "upcoming" ? buckets.upcoming : tab === "history" ? buckets.history : buckets.requests;

  return (
    <Shell>
      <MeetingsTabs active={tab} counts={counts} />
      {rows.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((m) => <MeetingCard key={m.id} m={m} />)}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-training-id="portal.meetings.list">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[#C9A84C]" />
            <h1 className="text-2xl font-semibold text-[#F1F1F3]">Meetings</h1>
          </div>
          <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
            Request time with your Broker of Record and track your requests. Your broker decides;
            you can accept or decline a proposed alternate time.
          </p>
        </div>
        <Link
          href="/meetings/new"
          className="inline-flex items-center gap-2 rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-1.5 text-sm text-[#E8D5A3] hover:bg-[#C9A84C]/25 transition-colors duration-[180ms]"
        >
          <Plus className="h-4 w-4" /> Request time with the Broker
        </Link>
      </header>
      {children}
    </div>
  );
}

function EmptyState({ tab }: { tab: MeetingTab }) {
  const copy =
    tab === "upcoming"
      ? "No confirmed meetings coming up."
      : tab === "history"
      ? "No past meetings yet."
      : "No open requests. Use “Request time with the Broker” to start one.";
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-12 text-center text-sm text-[#A1A1AA]">
      {copy}
    </div>
  );
}

function SignIn() {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>Please sign in and reload this page.</div>
    </div>
  );
}

function ErrorBanner({ status }: { status: number }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        {status === 401
          ? "Please sign in to view your meetings."
          : status === 403
          ? "You don't have permission to view meetings."
          : `Couldn't load your meetings (HTTP ${status}).`}
      </div>
    </div>
  );
}
