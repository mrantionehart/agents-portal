/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.2D — deadline-view helper tests (pure)
// ============================================================================
// The Deadline section is a thin shell over these pure helpers (mirrors 3.1D's
// pure-test approach). Covers: present → renders, null/empty → hides, next label
// (never the raw key), due-date + days formatting, overdue / at-risk, priority
// styling consistent with Transaction Stage, and no-PII in the view-model.
// ============================================================================

import {
  hasDeadlineSummary,
  deadlineChipVM,
  daysRemainingLabel,
  dueDateLabel,
  DEADLINE_LABEL,
} from "../deadline-view";
import { priorityTone } from "../lifecycle-view";
import type { DeadlineSummary } from "../types";

function ds(over: Partial<DeadlineSummary> = {}): DeadlineSummary {
  return {
    next_deadline: "closing_date",
    next_deadline_label: "Closing",
    due_date: "2026-07-10",
    days_remaining: 4,
    priority: "high",
    overdue_count: 0,
    at_risk_count: 0,
    breached_count: 0,
    blocker_count: 0,
    warning_count: 0,
    ...over,
  };
}

describe("hasDeadlineSummary — visibility guard", () => {
  it("null / undefined → hidden", () => {
    expect(hasDeadlineSummary(null)).toBe(false);
    expect(hasDeadlineSummary(undefined)).toBe(false);
  });
  it("present with a next deadline → shown", () => {
    expect(hasDeadlineSummary(ds())).toBe(true);
  });
  it("no next deadline AND all counts 0 → hidden (uncluttered)", () => {
    expect(hasDeadlineSummary(ds({ next_deadline: null, next_deadline_label: null, due_date: null, days_remaining: null }))).toBe(false);
  });
  it("no next deadline but a nonzero count → shown", () => {
    expect(hasDeadlineSummary(ds({ next_deadline_label: null, overdue_count: 2 }))).toBe(true);
  });
});

describe("daysRemainingLabel", () => {
  it("0 → Due today; positive → left; negative → overdue; non-number → null", () => {
    expect(daysRemainingLabel(0)).toBe("Due today");
    expect(daysRemainingLabel(1)).toBe("1 day left");
    expect(daysRemainingLabel(4)).toBe("4 days left");
    expect(daysRemainingLabel(-1)).toBe("1 day overdue");
    expect(daysRemainingLabel(-3)).toBe("3 days overdue");
    expect(daysRemainingLabel(null)).toBeNull();
  });
});

describe("dueDateLabel", () => {
  it("formats YYYY-MM-DD → 'Mon D'; invalid/null → null", () => {
    expect(dueDateLabel("2026-07-10")).toBe("Jul 10");
    expect(dueDateLabel("2026-01-05T00:00:00Z")).toBe("Jan 5");
    expect(dueDateLabel(null)).toBeNull();
    expect(dueDateLabel("not-a-date")).toBeNull();
    expect(dueDateLabel("2026-13-40")).toBeNull();
  });
});

describe("deadlineChipVM", () => {
  it("maps the safe fields; uses next_deadline_label, NEVER the raw key", () => {
    const vm = deadlineChipVM(ds({ next_deadline: "closing_date", next_deadline_label: "Closing" }));
    expect(vm.section_label).toBe(DEADLINE_LABEL);
    expect(vm.next_deadline_label).toBe("Closing");
    expect(vm.due_date_label).toBe("Jul 10");
    expect(vm.days_label).toBe("4 days left");
    expect(JSON.stringify(vm)).not.toContain("closing_date"); // the internal key is never surfaced
  });

  it("priority tone matches Transaction Stage (reused priorityTone)", () => {
    for (const p of ["critical", "high", "medium", "low"] as const) {
      expect(deadlineChipVM(ds({ priority: p })).priority_tone).toBe(priorityTone(p));
    }
    expect(deadlineChipVM(ds({ priority: "low" })).priority_tone).toBe("muted");
    expect(deadlineChipVM(ds({ priority: "critical" })).priority_tone).toBe("warn");
  });

  it("days tone is warn when due today / overdue, else muted", () => {
    expect(deadlineChipVM(ds({ days_remaining: 5 })).days_tone).toBe("muted");
    expect(deadlineChipVM(ds({ days_remaining: 0 })).days_tone).toBe("warn");
    expect(deadlineChipVM(ds({ days_remaining: -2 })).days_tone).toBe("warn");
  });

  it("surfaces overdue / at-risk counts", () => {
    const vm = deadlineChipVM(ds({ overdue_count: 2, at_risk_count: 1 }));
    expect(vm.overdue_count).toBe(2);
    expect(vm.at_risk_count).toBe(1);
  });

  it("exposes NO PII / engine internals (no confidence/tenant/owner/metadata/key)", () => {
    const vm = deadlineChipVM(ds());
    const json = JSON.stringify(vm).toLowerCase();
    expect(json).not.toMatch(/confidence|tenant|owner|metadata|closing_date|transaction_id|@|\$[0-9]/);
  });
});
