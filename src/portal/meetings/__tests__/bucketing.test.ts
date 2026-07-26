// Pure tests: status→tab bucketing, dashboard counts, participant labels,
// create validation (future-only + 1–3 times + duration), and the defensive
// projection deny-list.
import {
  bucketMeetings,
  meetingsForTab,
  dashboardCounts,
  participantLabel,
  validateCreate,
  formatDateTime,
} from "@/src/portal/meetings/bucketing";
import { pickListItem, pickDetail } from "@/src/portal/meetings/projection";
import type { AgentMeetingListItem } from "@/src/portal/meetings/types";

const NOW = new Date("2026-08-10T12:00:00Z");
const future = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const past = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let seq = 0;
function m(over: Partial<AgentMeetingListItem> = {}): AgentMeetingListItem {
  return {
    id: `m-${++seq}`, status: "requested", meeting_type: "deal_review", priority: "normal",
    duration_min: 30, confirmed_start_at: null, timezone: "America/New_York",
    created_at: NOW.toISOString(), expires_at: future(24 * 14), ...over,
  };
}

describe("bucketMeetings", () => {
  it("requests = open + future-confirmed; upcoming = future-confirmed; history = terminal", () => {
    const list = [
      m({ status: "requested" }),
      m({ status: "alternate_proposed" }),
      m({ status: "confirmed", confirmed_start_at: future(48) }), // future confirmed → requests + upcoming
      m({ status: "confirmed", confirmed_start_at: past(2) }),    // past confirmed → neither (reconciler will complete)
      m({ status: "completed" }),
      m({ status: "cancelled" }),
      m({ status: "declined" }),
      m({ status: "expired" }),
    ];
    const b = bucketMeetings(list, NOW);
    expect(b.requests.map((x) => x.status).sort()).toEqual(["alternate_proposed", "confirmed", "requested"]);
    expect(b.upcoming).toHaveLength(1);
    expect(b.upcoming[0].status).toBe("confirmed");
    expect(b.history.map((x) => x.status).sort()).toEqual(["cancelled", "completed", "declined", "expired"]);
  });

  it("upcoming is sorted soonest-first", () => {
    const list = [
      m({ status: "confirmed", confirmed_start_at: future(72) }),
      m({ status: "confirmed", confirmed_start_at: future(2) }),
      m({ status: "confirmed", confirmed_start_at: future(24) }),
    ];
    const b = bucketMeetings(list, NOW);
    expect(b.upcoming.map((x) => x.confirmed_start_at)).toEqual([future(2), future(24), future(72)]);
  });

  it("meetingsForTab routes to the right bucket", () => {
    const list = [m({ status: "requested" }), m({ status: "confirmed", confirmed_start_at: future(5) }), m({ status: "completed" })];
    expect(meetingsForTab(list, "upcoming", NOW)).toHaveLength(1);
    expect(meetingsForTab(list, "history", NOW)).toHaveLength(1);
    expect(meetingsForTab(list, "requests", NOW).length).toBeGreaterThanOrEqual(1);
  });
});

describe("dashboardCounts", () => {
  it("pending=requested, awaitingYou=alternate_proposed, upcoming=future-confirmed", () => {
    const list = [
      m({ status: "requested" }), m({ status: "requested" }),
      m({ status: "alternate_proposed" }),
      m({ status: "confirmed", confirmed_start_at: future(3) }),
      m({ status: "confirmed", confirmed_start_at: past(3) }), // not upcoming
      m({ status: "declined" }),
    ];
    expect(dashboardCounts(list, NOW)).toEqual({ pending: 2, awaitingYou: 1, upcoming: 1 });
  });
});

describe("participantLabel", () => {
  it("maps safe roles; the requesting agent reads as 'You'", () => {
    expect(participantLabel("broker")).toBe("Broker");
    expect(participantLabel("agent")).toBe("You");
    expect(participantLabel("requester")).toBe("You");
    expect(participantLabel("office_admin")).toBe("Office Admin — Observer");
    expect(participantLabel("some_role")).toBe("Some Role");
  });
});

describe("validateCreate", () => {
  const base = { meetingType: "deal_review" as const, priority: "normal" as const, durationMin: 30, timezone: "America/New_York" };
  it("accepts 1–3 future times", () => {
    expect(validateCreate({ ...base, proposedStarts: [future(2)] }, NOW).ok).toBe(true);
    expect(validateCreate({ ...base, proposedStarts: [future(2), future(4), future(6)] }, NOW).ok).toBe(true);
  });
  it("rejects zero or >3 times", () => {
    expect(validateCreate({ ...base, proposedStarts: [] }, NOW).ok).toBe(false);
    expect(validateCreate({ ...base, proposedStarts: [future(1), future(2), future(3), future(4)] }, NOW).ok).toBe(false);
  });
  it("rejects a past/now time", () => {
    expect(validateCreate({ ...base, proposedStarts: [past(1)] }, NOW).ok).toBe(false);
    expect(validateCreate({ ...base, proposedStarts: [NOW.toISOString()] }, NOW).ok).toBe(false);
  });
  it("rejects unknown type, bad priority, and out-of-range duration", () => {
    expect(validateCreate({ ...base, meetingType: "exam_preparation" as never, proposedStarts: [future(2)] }, NOW).ok).toBe(false);
    expect(validateCreate({ ...base, priority: "nope" as never, proposedStarts: [future(2)] }, NOW).ok).toBe(false);
    expect(validateCreate({ ...base, durationMin: 0, proposedStarts: [future(2)] }, NOW).ok).toBe(false);
    expect(validateCreate({ ...base, durationMin: 9999, proposedStarts: [future(2)] }, NOW).ok).toBe(false);
  });
  it("requires a timezone", () => {
    expect(validateCreate({ ...base, timezone: "", proposedStarts: [future(2)] }, NOW).ok).toBe(false);
  });
});

describe("formatDateTime — deterministic (hydration-safe)", () => {
  it("same ISO + tz always formats identically", () => {
    const a = formatDateTime(future(2), "America/New_York");
    const b = formatDateTime(future(2), "America/New_York");
    expect(a).toBe(b);
    expect(a).not.toBe("—");
    expect(formatDateTime(null, "UTC")).toBe("—");
  });
});

describe("defensive projection — deny-list stripped", () => {
  const DENY = ["tenant_id","broker_id","requesting_agent_id","decided_by","cancelled_by","decision_note","confirmed_option_id","proposed_by","participant_id","notify_eligible","deactivated_at","actor_id","actor_role","note","updated_at"];
  function keys(v: unknown, acc: Set<string> = new Set()): Set<string> {
    if (Array.isArray(v)) for (const x of v) keys(x, acc);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { acc.add(k); keys(x, acc); }
    return acc;
  }
  it("pickListItem keeps only safe keys even if upstream leaks", () => {
    const item = pickListItem({ id: "1", status: "requested", meeting_type: "deal_review", priority: "high", duration_min: 30, timezone: "UTC", created_at: "x", expires_at: "y", broker_id: "LEAK", tenant_id: "LEAK", updated_at: "LEAK" });
    expect(DENY.filter((k) => keys(item).has(k))).toEqual([]);
  });
  it("pickDetail rebuilds an agent-safe object with no deny-list key", () => {
    const detail = pickDetail({
      meeting: { id: "1", status: "confirmed", meeting_type: "coaching", priority: "normal", duration_min: 30, notes: "mine", timezone: "UTC", confirmed_start_at: "z", created_at: "c", expires_at: "e", broker_message: "hi", cancel_reason: null, tenant_id: "LEAK", broker_id: "LEAK", decided_by: "LEAK", decision_note: "LEAK" },
      options: [{ id: "o1", proposed_start_at: "t", source: "broker_alternate", is_selected: true, proposed_by: "LEAK" }],
      participants: [{ role: "office_admin", participant_id: "LEAK", notify_eligible: true }],
      history: [{ action: "confirmed", status_before: "requested", status_after: "confirmed", display_label: "Broker confirmed the meeting", created_at: "c", actor_id: "LEAK", actor_role: "LEAK", note: "LEAK" }],
      reminders: [{ kind: "t_minus_24h" }],
    });
    expect(DENY.filter((k) => keys(detail).has(k))).toEqual([]);
    expect(detail.meeting.broker_message).toBe("hi");
    expect(detail.reminders).toBeNull();
    expect(detail.participants).toEqual([{ role: "office_admin" }]);
  });
});
