// ============================================================================
// AGENT PORTAL — Meetings — defensive client-side projection (PURE)
// ============================================================================
// Rebuilds the Vault response using ONLY the agent-safe keys. Vault already
// enforces this at the source (PR #118); this is belt-and-suspenders so the
// Portal render layer can never surface a forbidden field even if the upstream
// contract regressed. Pure — safe to import anywhere (incl. jest).
// ============================================================================
import type {
  AgentMeetingListItem,
  AgentMeetingDetail,
  AgentMeetingOption,
  AgentMeetingParticipant,
  AgentMeetingHistoryEntry,
} from "./types";

export function pickListItem(r: Record<string, unknown>): AgentMeetingListItem {
  return {
    id: String(r.id ?? ""),
    status: String(r.status ?? ""),
    meeting_type: String(r.meeting_type ?? ""),
    priority: String(r.priority ?? ""),
    duration_min: Number(r.duration_min ?? 0),
    confirmed_start_at: (r.confirmed_start_at as string | null) ?? null,
    timezone: String(r.timezone ?? ""),
    created_at: String(r.created_at ?? ""),
    expires_at: (r.expires_at as string | null) ?? null,
  };
}

export function pickDetail(j: Record<string, unknown>): AgentMeetingDetail {
  const m = (j.meeting ?? {}) as Record<string, unknown>;
  const options = Array.isArray(j.options) ? (j.options as Record<string, unknown>[]) : [];
  const participants = Array.isArray(j.participants) ? (j.participants as Record<string, unknown>[]) : [];
  const history = Array.isArray(j.history) ? (j.history as Record<string, unknown>[]) : [];
  return {
    meeting: {
      id: String(m.id ?? ""),
      status: String(m.status ?? ""),
      meeting_type: String(m.meeting_type ?? ""),
      priority: String(m.priority ?? ""),
      duration_min: Number(m.duration_min ?? 0),
      notes: (m.notes as string | null) ?? null,
      timezone: String(m.timezone ?? ""),
      confirmed_start_at: (m.confirmed_start_at as string | null) ?? null,
      created_at: String(m.created_at ?? ""),
      expires_at: (m.expires_at as string | null) ?? null,
      broker_message: (m.broker_message as string | null) ?? null,
      cancel_reason: (m.cancel_reason as string | null) ?? null,
    },
    options: options.map((o): AgentMeetingOption => ({
      id: String(o.id ?? ""),
      proposed_start_at: String(o.proposed_start_at ?? ""),
      source: String(o.source ?? ""),
      is_selected: !!o.is_selected,
    })),
    participants: participants.map((p): AgentMeetingParticipant => ({ role: String(p.role ?? "") })),
    history: history.map((h): AgentMeetingHistoryEntry => ({
      action: String(h.action ?? ""),
      status_before: (h.status_before as string | null) ?? null,
      status_after: (h.status_after as string | null) ?? null,
      display_label: String(h.display_label ?? ""),
      created_at: String(h.created_at ?? ""),
    })),
    reminders: null,
  };
}
