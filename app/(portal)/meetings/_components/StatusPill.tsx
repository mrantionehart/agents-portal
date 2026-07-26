// Meeting status → labeled pill (server component). Tokens mirror the portal
// theme (gold/emerald/amber/rose/muted).
import { STATUS_LABELS, type MeetingStatus } from "@/src/portal/meetings/types";

const TONE: Record<string, string> = {
  requested: "bg-amber-900/30 text-amber-200 border-amber-700/40",
  alternate_proposed: "bg-[#C9A84C]/15 text-[#E8D5A3] border-[#C9A84C]/40",
  confirmed: "bg-emerald-900/30 text-emerald-200 border-emerald-700/40",
  completed: "bg-sky-900/30 text-sky-200 border-sky-700/40",
  cancelled: "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]",
  declined: "bg-rose-900/30 text-rose-200 border-rose-700/40",
  expired: "bg-[#1a1a25] text-[#71717A] border-[#252538]",
};

export default function StatusPill({ status }: { status: string }) {
  const label = STATUS_LABELS[status as MeetingStatus] ?? status.replace(/_/g, " ");
  const cls = TONE[status] ?? "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
