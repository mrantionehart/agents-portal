/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.1D — lifecycle-view helper tests (pure)
// ============================================================================
// The Transaction Stage indicator is a thin shell over these pure helpers
// (no React test infra in this repo). Covers: present → renders, null → hides,
// current/next labels, readiness, priority styling, next action, blocker count,
// and no-PII/token in the view-model.
// ============================================================================

import {
  hasLifecycle,
  lifecycleChipVM,
  readinessLabel,
  readinessTone,
  priorityTone,
  TRANSACTION_STAGE_LABEL,
} from "../lifecycle-view";
import type { CardLifecycle } from "../types";

function lc(over: Partial<CardLifecycle> = {}): CardLifecycle {
  return {
    current_stage: "escrow",
    current_stage_label: "Escrow",
    next_stage: "inspections",
    next_stage_label: "Inspections",
    stage_readiness: { tier: "in_progress", satisfied_count: 1, total_count: 2, percent: 50, can_advance: false },
    blockers: [{ class: "deadline", key: "earnest_money_due", label: "Earnest money deposited", severity: "high", reason: "deadline pending" }],
    warnings: [],
    next_action: { class: "deadline", key: "earnest_money_due", label: "Resolve: Earnest money deposited", priority: "high" },
    priority: "high",
    ...over,
  };
}

describe("hasLifecycle — present vs hidden", () => {
  it("true when a real lifecycle is present", () => {
    expect(hasLifecycle(lc())).toBe(true);
  });
  it("false (hides) when null / undefined / empty", () => {
    expect(hasLifecycle(null)).toBe(false);
    expect(hasLifecycle(undefined)).toBe(false);
    expect(hasLifecycle({ ...lc(), current_stage_label: "" } as CardLifecycle)).toBe(false);
  });
});

describe("lifecycleChipVM — renders the contract fields", () => {
  it("section label is 'Transaction Stage' (distinct from paperwork stage)", () => {
    expect(lifecycleChipVM(lc()).section_label).toBe(TRANSACTION_STAGE_LABEL);
    expect(TRANSACTION_STAGE_LABEL).toBe("Transaction Stage");
  });
  it("current + next stage labels", () => {
    const vm = lifecycleChipVM(lc());
    expect(vm.current_stage_label).toBe("Escrow");
    expect(vm.next_stage_label).toBe("Inspections");
  });
  it("terminal stage → next label null", () => {
    expect(lifecycleChipVM(lc({ next_stage: null, next_stage_label: null })).next_stage_label).toBeNull();
  });
  it("readiness label prefers percent, else tier label", () => {
    expect(lifecycleChipVM(lc()).readiness_label).toBe("50% ready");
    const noPct = lc({ stage_readiness: { tier: "blocked", satisfied_count: 0, total_count: 2, percent: undefined as any, can_advance: false } });
    expect(readinessLabel(noPct)).toBe("Blocked");
  });
  it("priority + next_action + blocker count", () => {
    const vm = lifecycleChipVM(lc());
    expect(vm.priority).toBe("high");
    expect(vm.next_action_label).toBe("Resolve: Earnest money deposited");
    expect(vm.blocker_count).toBe(1);
  });
  it("no blockers → count 0; no next_action label → null", () => {
    const vm = lifecycleChipVM(lc({ blockers: [], next_action: { class: "advance", key: "inspections", label: "", priority: "low" } }));
    expect(vm.blocker_count).toBe(0);
    expect(vm.next_action_label).toBeNull();
  });
});

describe("priority + readiness styling", () => {
  it("priority tone: critical/high → warn, medium → info, low → muted", () => {
    expect(priorityTone("critical")).toBe("warn");
    expect(priorityTone("high")).toBe("warn");
    expect(priorityTone("medium")).toBe("info");
    expect(priorityTone("low")).toBe("muted");
    expect(priorityTone("nonsense")).toBe("muted");
  });
  it("readiness tone by tier", () => {
    expect(readinessTone("complete")).toBe("ok");
    expect(readinessTone("ready_to_advance")).toBe("ok");
    expect(readinessTone("in_progress")).toBe("info");
    expect(readinessTone("blocked")).toBe("warn");
    expect(readinessTone("not_started")).toBe("muted");
  });
});

describe("no PII / token leakage", () => {
  it("the view-model carries only labels/counts/priorities", () => {
    const s = JSON.stringify(lifecycleChipVM(lc())).toLowerCase();
    expect(s).not.toMatch(/@|\$[0-9]|token|ssn|email|reason/);
  });
});
