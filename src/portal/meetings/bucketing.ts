// ============================================================================
// AGENT PORTAL — Meetings — pure bucketing, counts, labels, validation
// ============================================================================
// All functions are pure and take `now` explicitly so SSR is deterministic and
// tests are stable. No Date.now() at render — callers pass the server "now".
// ============================================================================
import {
  AGENT_MEETING_TYPES,
  MEETING_PRIORITIES,
  type AgentMeetingListItem,
  type CreateMeetingInput,
} from "./types";

export type MeetingTab = "requests" | "upcoming" | "history";

const OPEN = new Set(["requested", "alternate_proposed"]);
const TERMINAL = new Set(["completed", "cancelled", "declined", "expired"]);

function isFutureConfirmed(m: AgentMeetingListItem, now: Date): boolean {
  return m.status === "confirmed"
    && !!m.confirmed_start_at
    && new Date(m.confirmed_start_at).getTime() > now.getTime();
}

/**
 * Split the agent's own meetings into the three tabs.
 *   • requests  = requested + alternate_proposed + still-relevant confirmed
 *                 (future confirmed — the resolved outcome of an active request)
 *   • upcoming  = future confirmed only, soonest first
 *   • history   = completed / cancelled / declined / expired
 */
export function bucketMeetings(
  list: AgentMeetingListItem[],
  now: Date,
): { requests: AgentMeetingListItem[]; upcoming: AgentMeetingListItem[]; history: AgentMeetingListItem[] } {
  const requests = list.filter((m) => OPEN.has(m.status) || isFutureConfirmed(m, now));
  const upcoming = list
    .filter((m) => isFutureConfirmed(m, now))
    .sort((a, b) => new Date(a.confirmed_start_at!).getTime() - new Date(b.confirmed_start_at!).getTime());
  const history = list
    .filter((m) => TERMINAL.has(m.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { requests, upcoming, history };
}

export function meetingsForTab(
  list: AgentMeetingListItem[],
  tab: MeetingTab,
  now: Date,
): AgentMeetingListItem[] {
  const b = bucketMeetings(list, now);
  return tab === "upcoming" ? b.upcoming : tab === "history" ? b.history : b.requests;
}

export interface DashboardMeetingCounts {
  pending: number;      // requested — awaiting the broker
  awaitingYou: number;  // alternate_proposed — the agent must respond
  upcoming: number;     // future confirmed
}

/** Dashboard summary counts (agent's own meetings only). */
export function dashboardCounts(list: AgentMeetingListItem[], now: Date): DashboardMeetingCounts {
  let pending = 0, awaitingYou = 0, upcoming = 0;
  for (const m of list) {
    if (m.status === "requested") pending += 1;
    else if (m.status === "alternate_proposed") awaitingYou += 1;
    if (isFutureConfirmed(m, now)) upcoming += 1;
  }
  return { pending, awaitingYou, upcoming };
}

/** Safe participant role → display label. The viewer is the requesting agent,
 *  so their own row reads "You". Never renders an id. */
export function participantLabel(role: string): string {
  switch (role) {
    case "broker": return "Broker";
    case "agent":
    case "requester": return "You";
    case "office_admin": return "Office Admin — Observer";
    default:
      return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Deterministic absolute date-time in the meeting's timezone (hydration-safe:
 *  formatting a fixed ISO with an explicit timeZone is not clock-dependent). */
export function formatDateTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
  }
}

export function formatDate(iso: string | null | undefined, tz?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", ...(tz ? { timeZone: tz } : {}) }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
  }
}

export const MAX_DURATION_MIN = 480;

export interface CreateValidation { ok: boolean; error?: string }

/**
 * Validate a create request BEFORE sending to the proxy. Vault re-validates and
 * owns tenant/broker/requester/status/expiration — the client never supplies
 * those. This is a UX pre-check for: known type, priority, bounded duration,
 * timezone present, and 1–3 strictly-future preferred times.
 */
export function validateCreate(input: Partial<CreateMeetingInput>, now: Date): CreateValidation {
  if (!input.meetingType || !(AGENT_MEETING_TYPES as readonly string[]).includes(input.meetingType)) {
    return { ok: false, error: "Choose a meeting type." };
  }
  if (!input.priority || !(MEETING_PRIORITIES as readonly string[]).includes(input.priority)) {
    return { ok: false, error: "Choose a priority." };
  }
  if (typeof input.durationMin !== "number" || !Number.isFinite(input.durationMin) || input.durationMin <= 0 || input.durationMin > MAX_DURATION_MIN) {
    return { ok: false, error: `Duration must be between 1 and ${MAX_DURATION_MIN} minutes.` };
  }
  if (!input.timezone || typeof input.timezone !== "string") {
    return { ok: false, error: "Timezone is required." };
  }
  const times = input.proposedStarts ?? [];
  if (!Array.isArray(times) || times.length < 1 || times.length > 3) {
    return { ok: false, error: "Provide 1 to 3 preferred times." };
  }
  for (const t of times) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "One of the preferred times is invalid." };
    if (d.getTime() <= now.getTime()) return { ok: false, error: "All preferred times must be in the future." };
  }
  return { ok: true };
}
