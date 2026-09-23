// ============================================================================
// EASE-2.0-PLAN-SURFACE-AP-1 — gate, fetch isolation, and display filtering
// ============================================================================
// The gate tests are the ones that matter. Everything else degrades gracefully;
// a gate that fails open shows an unfinished surface to the whole brokerage.
// ============================================================================

import {
  DAILY_PLAN_COHORT_ENV,
  dailyPlanCohort,
  dailyPlanEnabledFor,
} from "../../../../app/(portal)/home/_lib/daily-plan-flags";
import {
  EMPTY_PLAN,
  MAX_PLAN_ITEMS,
  SUPPORTED_SIGNALS,
  loadDailyPlan,
  toPlanItems,
} from "../daily-plan-api";
import { planHref, planTimeLabel } from "../DailyGamePlan";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "99999999-9999-4999-8999-999999999999";

const env = (v?: string): Record<string, string | undefined> =>
  v === undefined ? {} : { [DAILY_PLAN_COHORT_ENV]: v };

const candidate = (over: Record<string, unknown> = {}) => ({
  tenant_id: "t", user_id: "u",
  signal_type: "task_overdue",
  subject_ref: { kind: "task", id: "task-1", label: "Follow up" },
  occurred_at: "2026-09-01",
  expires_at: null,
  because: "Due 2026-09-01 and still open.",
  evidence: { source_table: "brokerage_tasks", source_id: "task-1", observed_at: "2026-09-01", kind: "fact" },
  action: { label: "Open task", link: { kind: "task", id: "task-1" } },
  dedupe_key: "task_overdue:task-1",
  ...over,
});

describe("gate — fail closed", () => {
  it("is OFF when the variable is unset", () => {
    expect(dailyPlanEnabledFor(A, env())).toBe(false);
    expect(dailyPlanCohort(env()).size).toBe(0);
  });

  it.each(["", "   ", ",", " , , "])("is OFF for the empty-ish value %p", (v) => {
    expect(dailyPlanCohort(env(v)).size).toBe(0);
    expect(dailyPlanEnabledFor(A, env(v))).toBe(false);
  });

  it("admits exactly the listed ids", () => {
    const e = env(`${A},${B}`);
    expect(dailyPlanEnabledFor(A, e)).toBe(true);
    expect(dailyPlanEnabledFor(B, e)).toBe(true);
    expect(dailyPlanEnabledFor(OUTSIDER, e)).toBe(false);
  });

  it("trims whitespace and drops empties", () => {
    expect([...dailyPlanCohort(env(`  ${A} , , ${B}  ,`))].sort()).toEqual([A, B].sort());
  });

  it("dedupes a repeated id", () => {
    expect(dailyPlanCohort(env(`${A},${A},${A}`)).size).toBe(1);
  });

  it("has no wildcard and no default-on", () => {
    for (const v of ["*", "all", "ALL", "true", "1"]) {
      expect(dailyPlanEnabledFor(A, env(v))).toBe(false);
    }
  });

  it("requires an exact match — no prefix, no case folding", () => {
    // A letter-bearing id, so the case assertion is not vacuous: the all-digit
    // fixtures above are unchanged by toUpperCase().
    const mixed = "abcdef01-2345-4678-89ab-cdef01234567";
    const e = env(mixed);
    expect(dailyPlanEnabledFor(mixed, e)).toBe(true);
    expect(dailyPlanEnabledFor(mixed.slice(0, -1), e)).toBe(false);
    expect(dailyPlanEnabledFor(mixed.toUpperCase(), e)).toBe(false);
    expect(dailyPlanEnabledFor(` ${mixed} `, e)).toBe(false);
  });

  it("refuses a missing or blank caller id", () => {
    const e = env(A);
    expect(dailyPlanEnabledFor(null, e)).toBe(false);
    expect(dailyPlanEnabledFor(undefined, e)).toBe(false);
    expect(dailyPlanEnabledFor("", e)).toBe(false);
    expect(dailyPlanEnabledFor("   ", e)).toBe(false);
  });

  it("is server-only — the cohort var carries no NEXT_PUBLIC_ prefix", () => {
    expect(DAILY_PLAN_COHORT_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
  });
});

describe("no Vault request unless gated in", () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it("makes NO request when the gate is unset or the caller is outside it", async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;

    // This mirrors the page: the gate decides, THEN the fetch happens.
    for (const [caller, e] of [[A, env()], [OUTSIDER, env(`${A},${B}`)]] as const) {
      const plan = dailyPlanEnabledFor(caller, e) ? await loadDailyPlan("tok") : EMPTY_PLAN;
      expect(plan).toEqual(EMPTY_PLAN);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("makes exactly one authenticated request for a pilot caller", async () => {
    const spy = jest.fn(async () => ({ ok: true, json: async () => ({ candidates: [] }) }));
    global.fetch = spy as unknown as typeof fetch;

    const e = env(`${A},${B}`);
    if (dailyPlanEnabledFor(A, e)) await loadDailyPlan("tok-123");

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/ease\/daily-plan$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
    // No identity may be supplied on the wire.
    expect(url).not.toMatch(/user_id|userId|tenant_id|tenantId|agent_id|agentId|\?/);
    expect(init.method ?? "GET").toBe("GET");
    expect(init.body).toBeUndefined();
  });
});

describe("display filtering", () => {
  it("keeps only signals the Portal can act on", () => {
    expect(SUPPORTED_SIGNALS).toEqual(["meeting_soon", "task_overdue", "str_match_unread"]);
  });

  it("now INCLUDES STR matches — /buildings gained a destination", () => {
    // Previously excluded: a signal with nowhere to land is a dead end. The
    // "Your Matches" section on /buildings changed that, so this assertion is
    // inverted rather than deleted.
    const items = toPlanItems([
      candidate({ signal_type: "str_match_unread", subject_ref: { kind: "str_match", id: "m1", label: "Sample Tower" } }),
      candidate(),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].signal).toBe("str_match_unread");
    expect(items[0].subjectKind).toBe("str_match");
    expect(items[0].label).toBe("Sample Tower");
  });

  it("still rejects a signal type the Portal cannot act on", () => {
    const items = toPlanItems([
      candidate({ signal_type: "some_future_signal", subject_ref: { kind: "task", id: "x", label: "X" } }),
      candidate(),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].signal).toBe("task_overdue");
  });

  it("preserves Vault's order across all three signal types", () => {
    const items = toPlanItems([
      candidate({ signal_type: "str_match_unread", subject_ref: { kind: "str_match", id: "m1", label: "Match first" } }),
      candidate({ signal_type: "meeting_soon", subject_ref: { kind: "meeting", id: "g1", label: "Meeting second" }, occurred_at: "2026-09-23T15:00:00.000Z" }),
      candidate({ subject_ref: { kind: "task", id: "t1", label: "Task third" } }),
    ]);
    expect(items.map((i) => i.label)).toEqual(["Match first", "Meeting second", "Task third"]);
  });

  it("preserves Vault's order — it does not re-rank", () => {
    const items = toPlanItems([
      candidate({ signal_type: "task_overdue", subject_ref: { kind: "task", id: "t2", label: "Second" }, occurred_at: "2026-09-02" }),
      candidate({ signal_type: "meeting_soon", subject_ref: { kind: "meeting", id: "g1", label: "Coaching" }, occurred_at: "2026-09-23T15:00:00.000Z" }),
    ]);
    expect(items.map((i) => i.label)).toEqual(["Second", "Coaching"]);
  });

  it("caps at five", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      candidate({ subject_ref: { kind: "task", id: `t${i}`, label: `T${i}` } }));
    expect(toPlanItems(many)).toHaveLength(MAX_PLAN_ITEMS);
  });

  it("drops malformed rows rather than rendering junk", () => {
    expect(toPlanItems([
      candidate({ subject_ref: { kind: "task", id: "" } }),
      candidate({ subject_ref: undefined }),
      candidate({ occurred_at: 12345 }),
      candidate({ subject_ref: { kind: "wat", id: "x", label: "x" } }),
    ])).toEqual([]);
    expect(toPlanItems(null)).toEqual([]);
    expect(toPlanItems("nope")).toEqual([]);
  });

  it("exposes no internal contract fields", () => {
    const blob = JSON.stringify(toPlanItems([candidate()]));
    for (const k of ["dedupe_key", "evidence", "signal_type", "expires_at", "source_table", "because", "tenant_id", "user_id"]) {
      expect(blob).not.toContain(k);
    }
  });

  it("carries no contact detail", () => {
    const blob = JSON.stringify(toPlanItems([candidate()]));
    expect(blob).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(blob).not.toMatch(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  });
});

describe("links", () => {
  it("sends an STR match to its highlighted row on /buildings", () => {
    const [m] = toPlanItems([
      candidate({ signal_type: "str_match_unread", subject_ref: { kind: "str_match", id: "match-9", label: "Sample Tower" } }),
    ]);
    expect(planHref(m)).toBe("/buildings?match=match-9");
  });

  it("encodes an id that would otherwise break the query string", () => {
    const [m] = toPlanItems([
      candidate({ signal_type: "str_match_unread", subject_ref: { kind: "str_match", id: "a&b=c", label: "X" } }),
    ]);
    expect(planHref(m)).toBe("/buildings?match=a%26b%3Dc");
  });

  it("sends a meeting to its own page and a task to the list", () => {
    const [meeting, task] = toPlanItems([
      candidate({ signal_type: "meeting_soon", subject_ref: { kind: "meeting", id: "g9", label: "Coaching" }, occurred_at: "2026-09-23T15:00:00.000Z" }),
      candidate(),
    ]);
    expect(planHref(meeting)).toBe("/meetings/g9");
    expect(planHref(task)).toBe("/tasks");
  });
});

describe("humanized time — never a raw ISO string", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");

  it.each([
    ["2026-09-23T15:00:00.000Z", "In 3h"],
    ["2026-09-23T12:30:00.000Z", "In 30m"],
    ["2026-09-25T12:00:00.000Z", "In 2d"],
    ["2026-09-23T09:00:00.000Z", "3h ago"],
    ["2026-09-01T12:00:00.000Z", "22d ago"],
  ])("%s → %s", (iso, expected) => {
    expect(planTimeLabel(iso, now)).toBe(expected);
  });

  it("never returns anything ISO-shaped", () => {
    for (const iso of ["2026-09-23T15:00:00.000Z", "2026-09-01"]) {
      expect(planTimeLabel(iso, now)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("handles an unparseable value without throwing", () => {
    expect(planTimeLabel("not-a-date", now)).toBe("");
  });

  it("does not report a future meeting as past — the bug in relativeTime", () => {
    expect(planTimeLabel("2026-09-23T15:00:00.000Z", now)).not.toBe("just now");
  });
});

describe("failure isolation", () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it("returns an empty plan and an error string on a non-ok response", async () => {
    global.fetch = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    expect(await loadDailyPlan("tok")).toEqual({ items: [], error: "HTTP 503" });
  });

  it("never throws when the network fails", async () => {
    global.fetch = (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    expect(await loadDailyPlan("tok")).toEqual({ items: [], error: "ECONNRESET" });
  });

  it("survives a malformed body", async () => {
    global.fetch = (async () => ({ ok: true, json: async () => ({ nope: true }) })) as unknown as typeof fetch;
    expect(await loadDailyPlan("tok")).toEqual({ items: [], error: null });
  });
});
