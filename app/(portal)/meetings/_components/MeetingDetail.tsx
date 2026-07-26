// ============================================================================
// Agent-safe meeting detail (server component). Renders ONLY the merged Vault
// agent-safe contract — no broker/tenant/actor ids, no raw notes, no reminders.
// ============================================================================
import StatusPill from "./StatusPill";
import MeetingActions from "./MeetingActions";
import {
  MEETING_TYPE_LABELS,
  PRIORITY_LABELS,
  type AgentMeetingDetail,
} from "@/src/portal/meetings/types";
import { formatDateTime, formatDate, participantLabel } from "@/src/portal/meetings/bucketing";

export default function MeetingDetail({ detail }: { detail: AgentMeetingDetail }) {
  const m = detail.meeting;
  const tz = m.timezone;
  const typeLabel = MEETING_TYPE_LABELS[m.meeting_type as keyof typeof MEETING_TYPE_LABELS] ?? m.meeting_type.replace(/_/g, " ");
  const priorityLabel = PRIORITY_LABELS[m.priority as keyof typeof PRIORITY_LABELS] ?? m.priority;
  const showExpires = ["requested", "alternate_proposed"].includes(m.status) && !!m.expires_at;

  // The broker's most-recent alternate option (for Accept). agent_request
  // options are the agent's own proposed times.
  const alternates = detail.options.filter((o) => o.source === "broker_alternate");
  const latestAlternate = alternates.length
    ? alternates.reduce((a, b) => (new Date(b.proposed_start_at).getTime() > new Date(a.proposed_start_at).getTime() ? b : a))
    : null;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-semibold text-[#F1F1F3]">{typeLabel} with your Broker</h1>
        <StatusPill status={m.status} />
      </div>
      <p className="text-xs text-[#71717A] mb-5">Requested {formatDate(m.created_at, tz)}</p>

      {/* Key facts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Fact label="Priority" value={priorityLabel} />
        <Fact label="Duration" value={`${m.duration_min} min`} />
        <Fact label="Timezone" value={tz} />
        {showExpires ? <Fact label="Expires" value={formatDate(m.expires_at, tz)} /> : <span />}
      </div>

      {/* Confirmed time */}
      {m.status === "confirmed" && m.confirmed_start_at && (
        <Panel title="Confirmed time">
          <p className="text-sm text-emerald-200">{formatDateTime(m.confirmed_start_at, tz)}</p>
        </Panel>
      )}

      {/* Broker message (from decision_note) */}
      {m.broker_message && (
        <Panel title="Message from your broker">
          <p className="text-sm text-[#E8D5A3] whitespace-pre-wrap">{m.broker_message}</p>
        </Panel>
      )}

      {/* Cancellation reason */}
      {m.cancel_reason && (
        <Panel title="Cancellation reason">
          <p className="text-sm text-[#A1A1AA] whitespace-pre-wrap">{m.cancel_reason}</p>
        </Panel>
      )}

      {/* Submitted notes */}
      {m.notes && (
        <Panel title="Your notes">
          <p className="text-sm text-[#A1A1AA] whitespace-pre-wrap">{m.notes}</p>
        </Panel>
      )}

      {/* Proposed times */}
      {detail.options.length > 0 && (
        <Panel title="Proposed times">
          <ul className="space-y-1.5">
            {detail.options.map((o) => (
              <li key={o.id} className="flex items-center gap-2 text-sm">
                <span className={o.is_selected ? "text-emerald-200" : "text-[#F1F1F3]"}>{formatDateTime(o.proposed_start_at, tz)}</span>
                <span className="text-[10px] rounded-full border px-1.5 py-0.5 border-[#252538] text-[#A1A1AA]">
                  {o.source === "broker_alternate" ? "Broker alternate" : "You proposed"}
                </span>
                {o.is_selected && <span className="text-[10px] text-emerald-300">selected</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Participants (safe role labels) */}
      {detail.participants.length > 0 && (
        <Panel title="Participants">
          <ul className="flex flex-wrap gap-2">
            {detail.participants.map((p, i) => (
              <li key={`${p.role}-${i}`} className="text-[11px] rounded-full border border-[#252538] bg-[#1a1a25] px-2 py-0.5 text-[#A1A1AA]">
                {participantLabel(p.role)}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Immutable history (requester-facing labels only) */}
      {detail.history.length > 0 && (
        <Panel title="History">
          <ol className="space-y-2">
            {detail.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#C9A84C] shrink-0" />
                <div>
                  <p className="text-sm text-[#F1F1F3]">{h.display_label}</p>
                  <p className="text-[11px] text-[#71717A]">{formatDateTime(h.created_at, tz)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {/* Actions (client) */}
      <MeetingActions id={m.id} status={m.status} alternateOptionId={latestAlternate?.id ?? null} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#71717A]">{label}</div>
      <div className="text-sm text-[#F1F1F3] mt-1 break-words">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-4 mb-4">
      <h2 className="text-xs font-medium text-[#A1A1AA] mb-2">{title}</h2>
      {children}
    </section>
  );
}
