/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.4D — coordinator-view helper tests (pure)
// ============================================================================
// The Transaction Coordinator strip is a thin shell over these pure helpers
// (mirrors 3.1D/3.2D). Covers: directive → VM mapping, workflow-state labels,
// priority/confidence tones, readiness label, CTA label + href, recommended-tab
// mapping (documents/package/unknown→overview), top-N truncation, degraded
// derivation (confidence + errors, NOT inputs_missing alone), and leak-safety
// (a raw collection error message NEVER enters the view-model).
// ============================================================================

import {
  coordinatorPanelVM,
  workflowStateLabel,
  confidenceTone,
  confidenceLabel,
  readinessLabel,
  mapCoordinatorTab,
  ctaHref,
  isDegraded,
  degradedNotice,
  orderBlockers,
  ownerLabel,
  severityLabel,
  COORDINATOR_LABEL,
  type CoordinatorResponse,
  type TransactionDirective,
  type CoordinatorBlocker,
} from "../coordinator-view";

const SECRET = "SENTINEL-DB-ERROR-do-not-leak";

function directive(over: Partial<TransactionDirective> = {}): TransactionDirective {
  return {
    transaction_id: "txn-1",
    workflow_state: "collecting_information",
    next_action: {
      key: "complete_required_fields",
      label: "Complete required fields",
      owner: "agent",
      cta_label: "Complete Required Fields",
      tab: "documents",
      is_blocked: false,
    },
    priority: "high",
    readiness: { tier: "in_progress", score: 80, can_prepare_package: false, can_send_for_signature: false },
    blockers: [],
    risks: [],
    recommended_tab: "documents",
    recommended_cta: "Complete Required Fields",
    confidence: { level: "high", score: 0.83, reasons: ["Synthesized from 10 of 12 intelligence sources."] },
    meta: { coordinator_version: "3.4A.0" },
    ...over,
  };
}

function response(dOver: Partial<TransactionDirective> = {}, cOver: Partial<CoordinatorResponse["collection"]> = {}): CoordinatorResponse {
  return {
    directive: directive(dOver),
    collection: {
      inputs_present: ["lifecycle", "coach", "package_gates", "workspace"],
      inputs_missing: ["monitoring", "commission"],
      errors: [],
      loaded_at_ms: 1_700_000_000_000,
      collector_version: "3.4B.0",
      ...cOver,
    },
  };
}

describe("coordinator-view — labels & tones", () => {
  it("maps known workflow states to human labels, humanizes unknowns", () => {
    expect(workflowStateLabel("ready_to_send")).toBe("Ready to send");
    expect(workflowStateLabel("all_caught_up")).toBe("All caught up");
    expect(workflowStateLabel("some_future_state")).toBe("Some future state");
  });

  it("confidence tone + label", () => {
    expect(confidenceTone("high")).toBe("ok");
    expect(confidenceTone("medium")).toBe("info");
    expect(confidenceTone("low")).toBe("warn");
    // 3.5 Phase 1: confidence is the level word only — no percentages.
    expect(confidenceLabel({ level: "high", score: 0.83, reasons: [] })).toBe("High");
    expect(confidenceLabel({ level: "medium", score: 0.5, reasons: [] })).toBe("Medium");
    expect(confidenceLabel({ level: "low", score: 0.2, reasons: [] })).toBe("Low");
  });

  it("readiness label prefers tier + percent (score is already 0–100, not ×100)", () => {
    // readiness.score is on a 0–100 scale — 80 must render "80%", NOT "8000%".
    expect(readinessLabel({ tier: "in_progress", score: 80, can_prepare_package: false, can_send_for_signature: false })).toBe("In progress · 80%");
    expect(readinessLabel({ tier: "complete", score: 100, can_prepare_package: false, can_send_for_signature: false })).toBe("Complete · 100%");
    expect(readinessLabel({ tier: "in_progress", score: 0, can_prepare_package: false, can_send_for_signature: false })).toBe("In progress · 0%");
  });

  it("readiness label handles null/undefined score gracefully", () => {
    expect(readinessLabel({ tier: null, score: null, can_prepare_package: false, can_send_for_signature: false })).toBe("—");
    expect(readinessLabel({ tier: "in_progress", score: null, can_prepare_package: false, can_send_for_signature: false })).toBe("In progress");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(readinessLabel({ tier: null, score: undefined as any, can_prepare_package: false, can_send_for_signature: false })).toBe("—");
  });
});

describe("coordinator-view — recommended-tab navigation", () => {
  it("maps coordinator tabs to workspace hrefs", () => {
    expect(mapCoordinatorTab("documents")).toBe("documents");
    expect(mapCoordinatorTab("package")).toBe("package");
    expect(mapCoordinatorTab("commission")).toBe("commission");
  });

  it("unknown tab falls back to overview", () => {
    expect(mapCoordinatorTab("nope")).toBe("overview");
    expect(mapCoordinatorTab("")).toBe("overview");
  });

  it("ctaHref builds the in-portal ?tab= url (overview omits the param)", () => {
    expect(ctaHref("txn-1", "documents")).toBe("/workspace/txn-1?tab=documents");
    expect(ctaHref("txn-1", "package")).toBe("/workspace/txn-1?tab=package");
    expect(ctaHref("txn-1", "overview")).toBe("/workspace/txn-1");
    expect(ctaHref("txn-1", "bogus")).toBe("/workspace/txn-1"); // → overview
  });
});

describe("coordinator-view — panel VM", () => {
  it("maps a loaded directive into the panel view-model", () => {
    const vm = coordinatorPanelVM(response(), "txn-1");
    expect(vm.section_label).toBe(COORDINATOR_LABEL);
    expect(vm.primary_directive).toBe("Complete required fields");
    expect(vm.workflow_state_label).toBe("Collecting information");
    expect(vm.priority).toBe("high");
    expect(vm.priority_tone).toBe("warn");
    expect(vm.readiness_label).toBe("In progress · 80%");
    expect(vm.confidence_label).toBe("High");
    expect(vm.confidence_tone).toBe("ok");
    expect(vm.cta.label).toBe("Complete Required Fields");
    expect(vm.cta.href).toBe("/workspace/txn-1?tab=documents");
    expect(vm.cta.tab).toBe("documents");
    expect(vm.recommended_tab).toBe("documents");
  });

  it("CTA falls back to next_action fields when top-level recommended_* are empty", () => {
    const vm = coordinatorPanelVM(
      response({ recommended_cta: "", recommended_tab: "", next_action: { key: "generate_package", label: "Generate the package", owner: "agent", cta_label: "Generate Package", tab: "package", is_blocked: false } }),
      "txn-1"
    );
    expect(vm.cta.label).toBe("Generate Package");
    expect(vm.cta.href).toBe("/workspace/txn-1?tab=package");
  });

  it("blocked transaction: presentation-ordered (owner group → severity), owner/severity carried, risks capped", () => {
    const vm = coordinatorPanelVM(
      response({
        workflow_state: "blocked",
        priority: "critical",
        next_action: { key: "resolve_deadline", label: "Resolve overdue deadline", owner: "agent", cta_label: "Review Deadlines", tab: "timeline", is_blocked: true },
        blockers: [
          // deliberately NOT in presentation order: broker first, agent last
          { category: "broker_review", owner: "broker", severity: "critical", reason: "Broker must approve", resolution: "Await broker" },
          { category: "missing_signatures", owner: "client", severity: "high", reason: "2 signatures pending", resolution: "Follow up with the client" },
          { category: "missing_fields", owner: "agent", severity: "high", reason: "3 required fields are missing", resolution: "Complete them in Paperwork", count: 3 },
          { category: "deadline_breach", owner: "agent", severity: "critical", reason: "Inspection deadline passed", resolution: "Resolve or extend" },
        ],
        risks: [
          { category: "stale_sent", severity: "medium", reason: "Envelope sent 9 days ago" },
          { category: "revision_loop", severity: "high", reason: "Third revision cycle" },
          { category: "attention_overlay", severity: "low", reason: "extra risk beyond the cap" },
        ],
      }),
      "txn-1"
    );
    expect(vm.has_blockers_section).toBe(true);
    expect(vm.total_blockers).toBe(4);
    expect(vm.blockers).toHaveLength(4); // ≤ MAX_BLOCKERS=6
    expect(vm.risks).toHaveLength(2); // capped at 2
    // Owner-first, severity within group: agent(critical) → agent(high) → client(high) → broker(critical).
    expect(vm.blockers.map((b) => b.reason)).toEqual([
      "Inspection deadline passed",   // agent, critical
      "3 required fields are missing", // agent, high
      "2 signatures pending",          // client, high
      "Broker must approve",           // broker, critical — NOT on top despite critical
    ]);
    expect(vm.blockers[0].owner_label).toBe("Agent");
    expect(vm.blockers[0].severity_label).toBe("Critical");
    expect(vm.blockers[0].severity_tone).toBe("warn");
    expect(vm.blockers[2].owner_label).toBe("Client");
    expect(vm.blockers[3].owner_label).toBe("Broker");
    expect(vm.blockers[1].count).toBe(3);
    expect(vm.blockers[0].count).toBeNull();
    expect(vm.cta.is_blocked).toBe(true);
  });

  it("ready transaction has no blockers section", () => {
    const vm = coordinatorPanelVM(
      response({ workflow_state: "ready_to_send", next_action: { key: "send_documents", label: "Send documents for signature", owner: "agent", cta_label: "Send Documents", tab: "package", is_blocked: false }, blockers: [], risks: [] }),
      "txn-1"
    );
    expect(vm.has_blockers_section).toBe(false);
    expect(vm.blockers).toHaveLength(0);
  });
});

describe("coordinator-view — orderBlockers (presentation only)", () => {
  const B = (owner: string, severity: string, reason: string): CoordinatorBlocker =>
    ({ category: "x", owner, severity: severity as CoordinatorBlocker["severity"], reason, resolution: "r" });

  it("orders by owner group: agent → client → broker → third party → system", () => {
    const input = [B("system", "critical", "sys"), B("broker", "critical", "brk"), B("third_party", "critical", "3p"), B("client", "critical", "cli"), B("agent", "critical", "agt")];
    expect(orderBlockers(input).map((b) => b.reason)).toEqual(["agt", "cli", "brk", "3p", "sys"]);
  });

  it("orders by severity within a group: critical → high → medium → low", () => {
    const input = [B("agent", "low", "lo"), B("agent", "critical", "cr"), B("agent", "medium", "me"), B("agent", "high", "hi")];
    expect(orderBlockers(input).map((b) => b.reason)).toEqual(["cr", "hi", "me", "lo"]);
  });

  it("owner group beats severity: a low agent blocker leads a critical broker blocker", () => {
    const input = [B("broker", "critical", "brk-crit"), B("agent", "low", "agt-low")];
    expect(orderBlockers(input).map((b) => b.reason)).toEqual(["agt-low", "brk-crit"]);
  });

  it("party maps into the Client group and is stable within it", () => {
    const input = [B("broker", "high", "brk"), B("party", "high", "party"), B("client", "high", "client")];
    // client + party share group 2; stable tie-break preserves input order (party before client here)
    expect(orderBlockers(input).map((b) => b.reason)).toEqual(["party", "client", "brk"]);
    expect(ownerLabel("party")).toBe("Client");
    expect(ownerLabel("client")).toBe("Client");
  });

  it("is a stable sort and does NOT mutate the input array", () => {
    const input = [B("agent", "high", "a1"), B("agent", "high", "a2"), B("client", "high", "c1")];
    const snapshot = input.map((b) => b.reason);
    const out = orderBlockers(input);
    expect(out.map((b) => b.reason)).toEqual(["a1", "a2", "c1"]); // stable within agent/high
    expect(input.map((b) => b.reason)).toEqual(snapshot); // input untouched
    expect(out).not.toBe(input);
  });

  it("unknown owner sorts last; severityLabel/ownerLabel capitalize", () => {
    const input = [B("mystery", "critical", "unk"), B("agent", "low", "agt")];
    expect(orderBlockers(input).map((b) => b.reason)).toEqual(["agt", "unk"]);
    expect(severityLabel("high")).toBe("High");
    expect(ownerLabel("third_party")).toBe("Third Party");
  });

  it("VM caps blockers at 6 and reports the true total for '+N more'", () => {
    const many = Array.from({ length: 9 }, (_, i) => B("agent", "high", `b${i}`));
    const vm = coordinatorPanelVM(response({ blockers: many }), "txn-1");
    expect(vm.total_blockers).toBe(9);
    expect(vm.blockers).toHaveLength(6);
  });
});

describe("coordinator-view — degraded state & leak safety", () => {
  it("is NOT degraded on a healthy high-confidence directive with some inputs missing", () => {
    const res = response({}, { inputs_missing: ["monitoring", "commission", "envelope"], errors: [] });
    expect(isDegraded(res)).toBe(false);
    expect(degradedNotice(res)).toBeNull();
  });

  it("IS degraded when confidence is low", () => {
    const res = response({ confidence: { level: "low", score: 0.2, reasons: ["few inputs"] } });
    expect(isDegraded(res)).toBe(true);
    expect(degradedNotice(res)).toMatch(/Limited data/);
  });

  it("IS degraded when the collection recorded errors", () => {
    const res = response({}, { errors: [{ source: "coach", message: SECRET }] });
    expect(isDegraded(res)).toBe(true);
  });

  it("degraded notice is COUNT-only — never a raw collection error message", () => {
    const res = response(
      { confidence: { level: "low", score: 0.1, reasons: [SECRET] } },
      { errors: [{ source: "coach", message: SECRET }] }
    );
    const notice = degradedNotice(res);
    expect(notice).not.toContain(SECRET);

    const vm = coordinatorPanelVM(res, "txn-1");
    // The entire serialized view-model must not carry the raw error message.
    expect(JSON.stringify(vm)).not.toContain(SECRET);
  });
});
