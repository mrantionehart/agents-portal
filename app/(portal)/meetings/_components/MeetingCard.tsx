// A single meeting row/card in a tab list (server component). Agent-centric:
// "<Type> with your Broker · <status> · <time>". Links to the detail page.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import StatusPill from "./StatusPill";
import { MEETING_TYPE_LABELS, PRIORITY_LABELS, type AgentMeetingListItem } from "@/src/portal/meetings/types";
import { formatDateTime, formatDate } from "@/src/portal/meetings/bucketing";

export default function MeetingCard({ m }: { m: AgentMeetingListItem }) {
  const typeLabel = MEETING_TYPE_LABELS[m.meeting_type as keyof typeof MEETING_TYPE_LABELS] ?? m.meeting_type.replace(/_/g, " ");
  const priorityLabel = PRIORITY_LABELS[m.priority as keyof typeof PRIORITY_LABELS] ?? m.priority;
  const when = m.status === "confirmed" && m.confirmed_start_at
    ? `Confirmed for ${formatDateTime(m.confirmed_start_at, m.timezone)}`
    : `Requested ${formatDate(m.created_at, m.timezone)}`;

  return (
    <li>
      <Link
        href={`/meetings/${m.id}`}
        className="block rounded-lg border border-[#1a1a2e] bg-[#11111a] p-4 hover:border-[#252538] transition-colors duration-[180ms]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[#F1F1F3]">{typeLabel} with your Broker</span>
              <StatusPill status={m.status} />
            </div>
            <p className="mt-1 text-xs text-[#A1A1AA]">
              {when}
              <span className="text-[#71717A]"> · {m.duration_min} min · {priorityLabel} priority</span>
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#71717A] mt-0.5" aria-hidden />
        </div>
      </Link>
    </li>
  );
}
