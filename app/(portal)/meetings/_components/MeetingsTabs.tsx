// Requests / Upcoming / History tab strip (server component, ?tab= links).
// Mirrors the ClientsTabs segmented-control pattern.
import Link from "next/link";
import { CalendarClock, CalendarCheck, History } from "lucide-react";
import type { MeetingTab } from "@/src/portal/meetings/bucketing";

export default function MeetingsTabs({
  active,
  counts,
}: {
  active: MeetingTab;
  counts: { requests: number; upcoming: number; history: number };
}) {
  return (
    <nav
      aria-label="Meetings view"
      className="inline-flex rounded-md border border-[#1a1a2e] bg-[#0b0b10] p-0.5 text-xs mb-5"
    >
      <Tab href="/meetings" label="Requests" Icon={CalendarClock} count={counts.requests} active={active === "requests"} />
      <Tab href="/meetings?tab=upcoming" label="Upcoming" Icon={CalendarCheck} count={counts.upcoming} active={active === "upcoming"} />
      <Tab href="/meetings?tab=history" label="History" Icon={History} count={counts.history} active={active === "history"} />
    </nav>
  );
}

function Tab({
  href, label, Icon, count, active,
}: {
  href: string; label: string; Icon: typeof CalendarClock; count: number; active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors duration-[180ms] ${
        active
          ? "bg-[#C9A84C]/15 text-[#E8D5A3] border border-[#C9A84C]/40"
          : "text-[#A1A1AA] hover:text-[#F1F1F3] border border-transparent"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count > 0 && <span className="tabular-nums text-[10px] text-[#71717A]">({count})</span>}
    </Link>
  );
}
