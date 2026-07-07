/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.3C — package-view pure helper tests
// ============================================================================

import {
  formStatusLabel,
  formStatusTone,
  computeDisplayBlueprint,
  filterSearchable,
  gatesView,
  actionLabel,
} from "../package-view";
import type { FormStatusMap, PackageForm, SearchableForm } from "../types";

const status: FormStatusMap = {
  "A-1": { form_instance_id: "fi1", status: "ready", disposition: "ready_for_review", status_label: "Ready for review", downloadable: true, generatable: true },
  "B-2": { form_instance_id: "fi2", status: "blocked", disposition: "blocked", status_label: "Blocked", downloadable: false, generatable: false },
  "C-3": { form_instance_id: "fi3", status: "sent", disposition: "sent_for_signature", status_label: "Sent", downloadable: false, generatable: false },
};

describe("formStatusLabel / formStatusTone", () => {
  it("labels known forms and falls back to Not added", () => {
    expect(formStatusLabel("A-1", status)).toBe("Ready for review");
    expect(formStatusLabel("ZZ", status)).toBe("Not added");
  });
  it("maps status → tone", () => {
    expect(formStatusTone("A-1", status)).toBe("ok"); // ready
    expect(formStatusTone("B-2", status)).toBe("danger"); // blocked
    expect(formStatusTone("C-3", status)).toBe("info"); // sent
    expect(formStatusTone("ZZ", status)).toBe("muted"); // not added
  });
});

function form(id: string): PackageForm {
  return {
    form_id: id, label: id, category: "disclosure", reason: "because",
    source: "rule_engine", required: true, optional: false, rider: false,
    locked: true, suggested: true, selected: true,
  };
}

describe("computeDisplayBlueprint", () => {
  it("unions required ∪ optional ∪ rider (sorted, deduped)", () => {
    const bp = computeDisplayBlueprint(
      [form("R1"), form("R2")],
      new Set(["O1"]),
      new Set(["Rd1", "R1"]) // R1 overlaps required → deduped
    );
    expect(bp.required).toEqual(["R1", "R2"]);
    expect(bp.optional_selected).toEqual(["O1"]);
    expect(bp.all_selected).toEqual(["O1", "R1", "R2", "Rd1"]);
    expect(bp.total_in_package).toBe(4);
  });
  it("required-only when nothing selected", () => {
    const bp = computeDisplayBlueprint([form("R1")], new Set(), new Set());
    expect(bp.all_selected).toEqual(["R1"]);
    expect(bp.total_in_package).toBe(1);
  });
});

describe("filterSearchable", () => {
  const pool: SearchableForm[] = [
    { form_id: "CDS-1", label: "Compensation Disclosure", category: "compensation" },
    { form_id: "CR-7x", label: "Condominium Rider", category: "addendum" },
  ];
  it("empty query returns all", () => {
    expect(filterSearchable(pool, "")).toHaveLength(2);
  });
  it("matches id / label / category case-insensitively", () => {
    expect(filterSearchable(pool, "condo").map((f) => f.form_id)).toEqual(["CR-7x"]);
    expect(filterSearchable(pool, "COMPENSATION").map((f) => f.form_id)).toEqual(["CDS-1"]);
    expect(filterSearchable(pool, "cds").map((f) => f.form_id)).toEqual(["CDS-1"]);
  });
});

describe("gatesView / actionLabel", () => {
  it("projects the gates strip", () => {
    const v = gatesView({
      plan_available: true,
      can_prepare_package: true,
      can_send_for_signature: false,
      recommended_actions: ["prepare_for_broker_review"],
      ready_forms: ["A", "B"],
      blocked_forms: ["C"],
    });
    expect(v.can_prepare_package).toBe(true);
    expect(v.prepare_label).toBe("Ready to prepare package");
    expect(v.ready_count).toBe(2);
    expect(v.blocked_count).toBe(1);
  });
  it("prepare label reflects a not-ready gate", () => {
    const v = gatesView({
      plan_available: true, can_prepare_package: false, can_send_for_signature: false,
      recommended_actions: [], ready_forms: [], blocked_forms: [],
    });
    expect(v.prepare_label).toBe("Not ready to prepare");
  });
  it("humanizes action keys", () => {
    expect(actionLabel("prepare_for_broker_review")).toMatch(/broker review/i);
    expect(actionLabel("continue_collection")).toMatch(/collecting/i);
    expect(actionLabel("weird_key")).toBe("weird key");
  });
});
