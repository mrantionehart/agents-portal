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
  COORDINATOR_LABEL,
  type CoordinatorResponse,
  type TransactionDirective,
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
    readiness: { tier: "in_progress", score: 0.6, can_prepare_package: false, can_send_for_signature: false },
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
    expect(confidenceLabel({ level: "high", score: 0.83, reasons: [] })).toBe("83% · high");
  });

  it("readiness label prefers tier + percent", () => {
    expect(readinessLabel({ tier: "in_progress", score: 0.6, can_prepare_package: false, can_send_for_signature: false })).toBe("In progress · 60%");
    expect(readinessLabel({ tier: null, score: null, can_prepare_package: false, can_send_for_signature: false })).toBe("—");
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
    expect(vm.readiness_label).toBe("In progress · 60%");
    expect(vm.confidence_label).toBe("83% · high");
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

  it("blocked transaction surfaces top blockers + risks (truncated)", () => {
    const vm = coordinatorPanelVM(
      response({
        workflow_state: "blocked",
        priority: "critical",
        next_action: { key: "resolve_deadline", label: "Resolve overdue deadline", owner: "agent", cta_label: "Review Deadlines", tab: "timeline", is_blocked: true },
        blockers: [
          { category: "missing_fields", owner: "agent", severity: "high", reason: "3 required fields are missing", resolution: "Complete them in Paperwork", count: 3 },
          { category: "missing_signatures", owner: "client", severity: "high", reason: "2 signatures pending", resolution: "Follow up with the client" },
          { category: "deadline_breach", owner: "agent", severity: "critical", reason: "Inspection deadline passed", resolution: "Resolve or extend" },
          { category: "broker_review", owner: "broker", severity: "medium", reason: "extra blocker beyond the cap", resolution: "n/a" },
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
    expect(vm.blockers).toHaveLength(3); // capped
    expect(vm.risks).toHaveLength(2); // capped
    expect(vm.blockers[0].count).toBe(3);
    expect(vm.blockers[1].count).toBeNull();
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
