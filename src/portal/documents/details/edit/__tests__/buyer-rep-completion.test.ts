/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS — buyer-rep field completion (portal)
// ============================================================================
// The per-form editor now completes buyer-rep terms + buyer party-contact
// fields so buyer-rep packages can reach "ready". Broker identity is
// auto-derived (not agent-editable). Package Review surfaces a "Complete
// required fields" CTA via formNeedsCompletion.
// ============================================================================

import {
  classifyField,
  isAllowedTermsPathMirror,
} from "../editable-fields";
import { resolveCurrentValue } from "../value-resolver";
import { formNeedsCompletion } from "../../../../workspace/new/review/package-view";
import type { TransactionSnapshot } from "../../types";
import type { FormStatusMap } from "../../../../workspace/new/review/types";

const spec = (over: Record<string, unknown> = {}) => ({
  form_field_id: "x",
  transaction_path: "terms.buyer_rep.compensation_pct",
  label: "Compensation %",
  severity: "high",
  completer_role: "agent",
  required: true,
  ...over,
});

describe("isAllowedTermsPathMirror — buyer_rep", () => {
  it("accepts buyer_rep term paths", () => {
    expect(isAllowedTermsPathMirror("buyer_rep.compensation_pct")).toBe(true);
    expect(isAllowedTermsPathMirror("buyer_rep.brokerage_relationship")).toBe(true);
  });
  it("rejects unknown buyer_rep leaf", () => {
    expect(isAllowedTermsPathMirror("buyer_rep.mystery")).toBe(false);
  });
});

describe("classifyField — buyer_rep terms", () => {
  it("classifies terms.buyer_rep.compensation_pct as an editable number term", () => {
    const { editable } = classifyField(spec() as never);
    expect(editable).toMatchObject({
      endpoint: "terms",
      termPath: "buyer_rep.compensation_pct",
      inputType: "number",
    });
  });
  it("classifies effective_date as a date term", () => {
    const { editable } = classifyField(
      spec({ transaction_path: "terms.buyer_rep.effective_date" }) as never
    );
    expect(editable).toMatchObject({ endpoint: "terms", inputType: "date" });
  });

  it("renders brokerage_relationship as a select of the canonical XFA tokens", () => {
    const { editable } = classifyField(
      spec({ transaction_path: "terms.buyer_rep.brokerage_relationship" }) as never
    );
    expect(editable?.inputType).toBe("select");
    expect(editable?.options?.map((o) => o.value)).toEqual([
      "single_agent",
      "transaction_broker",
      "no_brokerage_relationship",
    ]);
  });
});

describe("classifyField — party contact", () => {
  it("makes buyer contact fields agent-editable via the party endpoint", () => {
    const { editable } = classifyField(
      spec({ transaction_path: "parties[role=buyer].phone", severity: "medium" }) as never
    );
    expect(editable).toMatchObject({
      endpoint: "party",
      partyRole: "buyer",
      partyField: "phone",
    });
  });

  it("does NOT make broker name editable (auto-derived)", () => {
    const { editable, reason } = classifyField(
      spec({ transaction_path: "parties[role=broker].name" }) as never
    );
    expect(editable).toBeNull();
    expect(reason).toBe("party_field");
  });

  it("does NOT make seller contact editable (party portal)", () => {
    const { editable, reason } = classifyField(
      spec({ transaction_path: "parties[role=seller].email" }) as never
    );
    expect(editable).toBeNull();
    expect(reason).toBe("party_field");
  });
});

describe("resolveCurrentValue — party contact seeding", () => {
  const snapshot: TransactionSnapshot = {
    facts: null,
    terms: null,
    broker_review_status: "draft",
    parties: [
      { role: "buyer", name: "Test 123", email: "e@x.com", phone: "555-1212", mailing_address: null },
    ],
  };
  it("seeds buyer phone from the snapshot parties", () => {
    expect(resolveCurrentValue(snapshot, "parties[role=buyer].phone")).toBe("555-1212");
  });
  it("returns null when no party of the role exists", () => {
    expect(resolveCurrentValue(snapshot, "parties[role=broker].name")).toBeNull();
  });
});

describe("formNeedsCompletion", () => {
  const map = (status: string): FormStatusMap =>
    ({
      "F-1": {
        status,
        disposition: "d",
        status_label: status,
        downloadable: false,
        generatable: false,
      },
    }) as unknown as FormStatusMap;

  it.each(["recommended", "blocked", "required", "in_progress", "not_started"])(
    "needs completion when status is %s",
    (s) => {
      expect(formNeedsCompletion("F-1", map(s))).toBe(true);
    }
  );
  it.each(["ready", "signed", "sent", "voided"])(
    "does not need completion when status is %s",
    (s) => {
      expect(formNeedsCompletion("F-1", map(s))).toBe(false);
    }
  );
  it("needs completion when the form has no instance", () => {
    expect(formNeedsCompletion("MISSING", {} as FormStatusMap)).toBe(true);
  });
});
