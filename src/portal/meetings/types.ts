// ============================================================================
// AGENT PORTAL — Meetings — agent-safe contract types
// ============================================================================
// These mirror the MERGED Vault agent-safe response (PR #118, prod SHA
// f24362b). The Portal consumes ONLY these fields; Vault enforces the
// projection at the source (broker/tenant/actor ids, decided_by/cancelled_by,
// raw notes, reminders, notify routing are never returned to an agent).
//
// Pure types + enums only — no JSX, no Tailwind, safe to live under src/.
// ============================================================================

/** Licensed-agent meeting types — the ONLY types an agent may request.
 *  Mirrors Vault's server-side MEETING_TYPES allow-list. Recruit-only types
 *  (exam_preparation, accountability_check_in, …) are intentionally absent. */
export const AGENT_MEETING_TYPES = [
  "deal_review",
  "coaching",
  "one_on_one",
  "transaction_help",
  "compliance",
  "general",
] as const;
export type AgentMeetingType = (typeof AGENT_MEETING_TYPES)[number];

export const MEETING_TYPE_LABELS: Record<AgentMeetingType, string> = {
  deal_review: "Deal Review",
  coaching: "Coaching",
  one_on_one: "One-on-One",
  transaction_help: "Transaction Help",
  compliance: "Compliance",
  general: "General",
};

export function isAgentMeetingType(v: unknown): v is AgentMeetingType {
  return typeof v === "string" && (AGENT_MEETING_TYPES as readonly string[]).includes(v);
}

export const MEETING_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type MeetingPriority = (typeof MEETING_PRIORITIES)[number];
export const PRIORITY_LABELS: Record<MeetingPriority, string> = {
  low: "Low", normal: "Normal", high: "High", urgent: "Urgent",
};

export type MeetingStatus =
  | "requested" | "alternate_proposed" | "confirmed"
  | "completed" | "cancelled" | "declined" | "expired";

export const STATUS_LABELS: Record<MeetingStatus, string> = {
  requested: "Requested",
  alternate_proposed: "Alternate Proposed",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Expired",
};

/** Agent-safe LIST item (GET /api/meetings). */
export interface AgentMeetingListItem {
  id: string;
  status: string;
  meeting_type: string;
  priority: string;
  duration_min: number;
  confirmed_start_at: string | null;
  timezone: string;
  created_at: string;
  expires_at: string | null;
}

export interface AgentMeetingOption {
  id: string;
  proposed_start_at: string;
  /** 'agent_request' | 'broker_alternate' — no proposer identity. */
  source: string;
  is_selected: boolean;
}

/** Vault returns participants as safe role labels only. */
export interface AgentMeetingParticipant {
  role: string; // 'broker' | 'agent' | 'office_admin' | ...
}

export interface AgentMeetingHistoryEntry {
  action: string;
  status_before: string | null;
  status_after: string | null;
  display_label: string;
  created_at: string;
}

/** Agent-safe DETAIL (GET /api/meetings/[id]). */
export interface AgentMeetingDetail {
  meeting: {
    id: string;
    status: string;
    meeting_type: string;
    priority: string;
    duration_min: number;
    notes: string | null;
    timezone: string;
    confirmed_start_at: string | null;
    created_at: string;
    expires_at: string | null;
    broker_message: string | null;
    cancel_reason: string | null;
  };
  options: AgentMeetingOption[];
  participants: AgentMeetingParticipant[];
  history: AgentMeetingHistoryEntry[];
  reminders: null;
}

/** Payload the create form sends to the Portal proxy (which forwards to Vault).
 *  Deliberately EXCLUDES tenant/broker/requester/status/expiration — those are
 *  server-owned by Vault and must never be client-supplied. */
export interface CreateMeetingInput {
  meetingType: AgentMeetingType;
  priority: MeetingPriority;
  durationMin: number;
  timezone: string;
  proposedStarts: string[]; // 1–3 future ISO datetimes
  notes?: string | null;
  idempotencyKey?: string;
}
