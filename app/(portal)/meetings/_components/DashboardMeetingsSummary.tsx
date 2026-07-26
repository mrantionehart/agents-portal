// ============================================================================
// Home dashboard "Meetings" summary (server component). Three server-computed
// counts — Pending requests / Awaiting your response / Upcoming — linking to
// /meetings. No render-time Date.now(): the counts are computed on the server
// from the page's `now` and passed in as plain numbers.
// ============================================================================
import Link from "next/link";
import { CalendarClock, ArrowRight } from "lucide-react";
import type { DashboardMeetingCounts } from "@/src/portal/meetings/bucketing";

export default function DashboardMeetingsSummary({ counts }: { counts: DashboardMeetingCounts | null }) {
  return (
    <section className="mb-8" aria-label="Meetings summary">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#C9A84C]" />
          <h2 className="text-sm font-medium text-[#F1F1F3]">Meetings</h2>
        </div>
        <Link href="/meetings" className="inline-flex items-center gap-1 text-xs text-[#E8D5A3] hover:text-[#C9A84C]">
          Open Meetings <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {counts === null ? (
        <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-4 py-4 text-sm text-[#71717A]">
          Meeting summary is unavailable right now. <Link href="/meetings" className="text-[#E8D5A3] hover:text-[#C9A84C]">Open Meetings →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Pending requests" count={counts.pending} href="/meetings" tone="muted" />
          <Stat label="Awaiting your response" count={counts.awaitingYou} href="/meetings" tone={counts.awaitingYou > 0 ? "gold" : "muted"} />
          <Stat label="Upcoming meetings" count={counts.upcoming} href="/meetings?tab=upcoming" tone={counts.upcoming > 0 ? "ok" : "muted"} />
        </div>
      )}
    </section>
  );
}

function Stat({ label, count, href, tone }: { label: string; count: number; href: string; tone: "gold" | "ok" | "muted" }) {
  const color = tone === "gold" ? "text-[#E8D5A3]" : tone === "ok" ? "text-emerald-300" : "text-[#A1A1AA]";
  const border = tone === "gold" ? "border-[#C9A84C]/40" : tone === "ok" ? "border-emerald-700/40" : "border-[#1a1a2e]";
  return (
    <Link href={href} className={`block rounded-lg border ${border} bg-[#11111a] p-4 hover:border-[#252538] transition-colors duration-[180ms]`}>
      <div className={`text-3xl font-semibold tabular-nums leading-none ${color}`}>{count}</div>
      <div className="text-xs text-[#A1A1AA] mt-2">{label}</div>
    </Link>
  );
}
