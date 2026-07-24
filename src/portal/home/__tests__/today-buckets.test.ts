// ============================================================================
// TODAY B.001 · Slice 1 — unit tests for the pure bucketing module
// ============================================================================
// These tests DEFINE THE CONTRACT before any UI exists. The module classifies
// on Vault-provided values only (days_remaining / overdue_count) — no Portal
// date math beyond the approved bucket rules.
// ============================================================================
import { bucketToday, classifyCard } from "../today-buckets";
import type { DeadlineSummary, WorkspaceCard } from "../../workspace/types";

/** Minimal DeadlineSummary; only the fields the module reads matter. */
function ds(over: Partial<DeadlineSummary> = {}): DeadlineSummary {
  return {
    next_deadline_label: "Closing",
    due_date: "2026-08-15",
    days_remaining: 5,
    priority: "high",
    overdue_count: 0,
    at_risk_count: 0,
    breached_count: 0,
    ...over,
  } as unknown as DeadlineSummary;
}

/** Minimal WorkspaceCard; only transaction_id / property_address / deadline_summary are read. */
function card(
  id: string,
  property: string | null,
  summary: DeadlineSummary | null | undefined,
): WorkspaceCard {
  return { transaction_id: id, property_address: property, deadline_summary: summary } as unknown as WorkspaceCard;
}

const ids = (cards: WorkspaceCard[]) => cards.map((c) => c.transaction_id);

describe("classifyCard — bucket rules", () => {
  it("days_remaining < 0 → overdue", () => {
    expect(classifyCard(card("t", "1 Main", ds({ days_remaining: -1 })))).toBe("overdue");
    expect(classifyCard(card("t", "1 Main", ds({ days_remaining: -30 })))).toBe("overdue");
  });

  it("days_remaining === 0 → dueToday", () => {
    expect(classifyCard(card("t", "1 Main", ds({ days_remaining: 0 })))).toBe("dueToday");
  });

  it("1 ≤ days_remaining ≤ 7 → dueThisWeek (boundaries included)", () => {
    expect(classifyCard(card("t", "x", ds({ days_remaining: 1 })))).toBe("dueThisWeek");
    expect(classifyCard(card("t", "x", ds({ days_remaining: 7 })))).toBe("dueThisWeek");
  });

  it("days_remaining > 7 → upcoming (boundary 8)", () => {
    expect(classifyCard(card("t", "x", ds({ days_remaining: 8 })))).toBe("upcoming");
    expect(classifyCard(card("t", "x", ds({ days_remaining: 400 })))).toBe("upcoming");
  });

  it("overdue_count precedence: overdue_count > 0 → overdue even when the next deadline is in the future", () => {
    expect(classifyCard(card("t", "x", ds({ overdue_count: 2, days_remaining: 5 })))).toBe("overdue");
    expect(classifyCard(card("t", "x", ds({ overdue_count: 1, days_remaining: 999 })))).toBe("overdue");
  });

  it("null / missing deadline_summary → not projectable (null)", () => {
    expect(classifyCard(card("t", "x", null))).toBeNull();
    expect(classifyCard(card("t", "x", undefined))).toBeNull();
  });

  it("null days_remaining AND no overdue signal → not projectable (null)", () => {
    expect(classifyCard(card("t", "x", ds({ days_remaining: null as unknown as number, overdue_count: 0 })))).toBeNull();
  });

  it("null days_remaining but overdue_count > 0 → overdue", () => {
    expect(classifyCard(card("t", "x", ds({ days_remaining: null as unknown as number, overdue_count: 3 })))).toBe("overdue");
  });

  it("non-finite days_remaining is treated as null", () => {
    expect(classifyCard(card("t", "x", ds({ days_remaining: NaN, overdue_count: 0 })))).toBeNull();
  });
});

describe("bucketToday — grouping", () => {
  it("groups a mixed set into the four buckets and excludes non-projectable cards", () => {
    const cards = [
      card("overdue", "A", ds({ days_remaining: -3 })),
      card("today", "B", ds({ days_remaining: 0 })),
      card("week", "C", ds({ days_remaining: 4 })),
      card("upcoming", "D", ds({ days_remaining: 20 })),
      card("nosum", "E", null),
      card("nodate", "F", ds({ days_remaining: null as unknown as number, overdue_count: 0 })),
      card("oc", "G", ds({ overdue_count: 2, days_remaining: 10 })),
    ];
    const b = bucketToday(cards);
    expect(ids(b.overdue).sort()).toEqual(["oc", "overdue"]);
    expect(ids(b.dueToday)).toEqual(["today"]);
    expect(ids(b.dueThisWeek)).toEqual(["week"]);
    expect(ids(b.upcoming)).toEqual(["upcoming"]);
    // nosum + nodate excluded entirely
    const all = [...b.overdue, ...b.dueToday, ...b.dueThisWeek, ...b.upcoming].map((c) => c.transaction_id);
    expect(all).not.toContain("nosum");
    expect(all).not.toContain("nodate");
  });

  it("empty categories return empty arrays (never undefined)", () => {
    const b = bucketToday([card("u", "A", ds({ days_remaining: 30 }))]);
    expect(b.overdue).toEqual([]);
    expect(b.dueToday).toEqual([]);
    expect(b.dueThisWeek).toEqual([]);
    expect(b.upcoming.map((c) => c.transaction_id)).toEqual(["u"]);
  });

  it("empty input → all four buckets empty", () => {
    const b = bucketToday([]);
    expect(b).toEqual({ overdue: [], dueToday: [], dueThisWeek: [], upcoming: [] });
  });
});

describe("bucketToday — ordering", () => {
  it("overdue: most-overdue first (days_remaining ascending)", () => {
    const cards = [
      card("a", "A", ds({ days_remaining: -1 })),
      card("b", "B", ds({ days_remaining: -30 })),
      card("c", "C", ds({ days_remaining: -5 })),
    ];
    expect(ids(bucketToday(cards).overdue)).toEqual(["b", "c", "a"]);
  });

  it("upcoming/week: soonest first", () => {
    const cards = [
      card("far", "A", ds({ days_remaining: 40 })),
      card("near", "B", ds({ days_remaining: 9 })),
      card("mid", "C", ds({ days_remaining: 20 })),
    ];
    expect(ids(bucketToday(cards).upcoming)).toEqual(["near", "mid", "far"]);
  });

  it("tie-break by priority (critical → low) when days equal", () => {
    const cards = [
      card("low", "A", ds({ days_remaining: 3, priority: "low" })),
      card("crit", "B", ds({ days_remaining: 3, priority: "critical" })),
      card("med", "C", ds({ days_remaining: 3, priority: "medium" })),
    ];
    expect(ids(bucketToday(cards).dueThisWeek)).toEqual(["crit", "med", "low"]);
  });

  it("tie-break by property_address when days and priority equal", () => {
    const cards = [
      card("z", "Zebra St", ds({ days_remaining: 2, priority: "high" })),
      card("a", "Apple Ave", ds({ days_remaining: 2, priority: "high" })),
    ];
    expect(ids(bucketToday(cards).dueThisWeek)).toEqual(["a", "z"]);
  });

  it("overdue_count-only rows (null days) sort after dated overdue rows", () => {
    const cards = [
      card("dated", "A", ds({ days_remaining: -2 })),
      card("ocOnly", "B", ds({ days_remaining: null as unknown as number, overdue_count: 5 })),
    ];
    expect(ids(bucketToday(cards).overdue)).toEqual(["dated", "ocOnly"]);
  });
});

describe("purity / determinism", () => {
  it("does not mutate the input array or its cards", () => {
    const input = [card("b", "B", ds({ days_remaining: 5 })), card("a", "A", ds({ days_remaining: -1 }))];
    const snapshot = ids(input);
    bucketToday(input);
    expect(ids(input)).toEqual(snapshot); // input order unchanged
  });

  it("same input → identical output (deterministic)", () => {
    const cards = [
      card("a", "A", ds({ days_remaining: -1 })),
      card("b", "B", ds({ days_remaining: 0 })),
      card("c", "C", ds({ days_remaining: 5 })),
      card("d", "D", ds({ days_remaining: 30 })),
    ];
    expect(bucketToday(cards)).toEqual(bucketToday(cards.slice()));
  });
});
