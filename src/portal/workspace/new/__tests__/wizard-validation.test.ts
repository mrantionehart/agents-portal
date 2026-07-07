/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.3B.3C — wizard validation rules (pure)
// ============================================================================

import {
  validateStep,
  isStepComplete,
  isValidEmail,
  type StepValidation,
} from "../wizard-validation";
import {
  emptySession,
  type WizardSession,
  type WizardPartyDraft,
} from "../wizard-session";

function session(over: Partial<WizardSession> = {}): WizardSession {
  return { ...emptySession(), ...over };
}
function party(over: Partial<WizardPartyDraft> = {}): WizardPartyDraft {
  return { role: "buyer", name: "Jane", ...over };
}

describe("isValidEmail", () => {
  it.each(["a@b.co", "jane.doe@example.com", "x+y@sub.domain.io"])(
    "accepts %s",
    (e) => expect(isValidEmail(e)).toBe(true)
  );
  it.each(["", "  ", "nope", "a@b", "a b@c.com", "@x.com", "a@.com"])(
    "rejects %s",
    (e) => expect(isValidEmail(e)).toBe(false)
  );
});

describe("type step", () => {
  it("requires a transaction type", () => {
    const r = validateStep("type", session({ transaction_type: null }));
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.transaction_type).toBeTruthy();
    expect(r.messages.length).toBeGreaterThan(0);
  });
  it("valid once a type is chosen", () => {
    expect(validateStep("type", session({ transaction_type: "purchase" })).valid).toBe(true);
  });
});

describe("property step", () => {
  it("requires an address", () => {
    const r = validateStep("property", session({ property: {} }));
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.property?.address).toBeTruthy();
  });
  it("is valid with an address (city/state/zip/year/HOA optional)", () => {
    expect(
      validateStep("property", session({ property: { address: "123 Main" } })).valid
    ).toBe(true);
  });
  it("treats a whitespace-only address as missing", () => {
    expect(
      validateStep("property", session({ property: { address: "   " } })).valid
    ).toBe(false);
  });
});

describe("parties step — required parties by type", () => {
  const cases: Array<[string, WizardPartyDraft[], boolean]> = [
    ["purchase", [party({ role: "buyer" })], true],
    ["purchase", [party({ role: "seller" })], false], // no buyer
    ["buyer_rep", [party({ role: "buyer" })], true],
    ["listing", [party({ role: "seller" })], true],
    ["listing", [party({ role: "buyer" })], false], // no seller
    ["lease", [party({ role: "landlord" }), party({ role: "tenant" })], true],
    ["lease", [party({ role: "landlord" })], false], // missing tenant
    ["commercial", [party({ role: "buyer" })], true], // any 1 party
    ["commercial", [], false], // ≥1 required
    ["wholesale", [party({ role: "seller" })], true],
    ["referral", [party({ role: "agent" })], true],
    ["referral", [], false],
  ];
  it.each(cases)("%s with given parties → valid=%s", (type, parties, valid) => {
    expect(
      validateStep("parties", session({ transaction_type: type, parties })).valid
    ).toBe(valid);
  });

  it("reports the missing required role in the form error", () => {
    const r = validateStep(
      "parties",
      session({ transaction_type: "lease", parties: [party({ role: "landlord" })] })
    );
    expect(r.fieldErrors.parties?.form).toMatch(/Tenant/);
  });
});

describe("parties step — per-party field rules", () => {
  it("requires a role", () => {
    const r = validateStep(
      "parties",
      session({ transaction_type: "commercial", parties: [{ role: "", name: "X" }] })
    );
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.parties?.rows?.[0].role).toBeTruthy();
  });
  it("requires name OR company", () => {
    const noneR = validateStep(
      "parties",
      session({ transaction_type: "commercial", parties: [{ role: "buyer" }] })
    );
    expect(noneR.fieldErrors.parties?.rows?.[0].name).toBeTruthy();

    const companyOnly = validateStep(
      "parties",
      session({
        transaction_type: "commercial",
        parties: [{ role: "buyer", company: "Acme LLC" }],
      })
    );
    expect(companyOnly.valid).toBe(true);
  });
  it("validates email only when present", () => {
    const bad = validateStep(
      "parties",
      session({
        transaction_type: "commercial",
        parties: [party({ email: "not-email" })],
      })
    );
    expect(bad.fieldErrors.parties?.rows?.[0].email).toBeTruthy();

    const ok = validateStep(
      "parties",
      session({
        transaction_type: "commercial",
        parties: [party({ email: "jane@example.com" })],
      })
    );
    expect(ok.valid).toBe(true);
  });
});

describe("dates step", () => {
  it("is valid when empty (dates optional)", () => {
    expect(validateStep("dates", session({ dates: {} })).valid).toBe(true);
  });
  it("closing must be >= contract when both present", () => {
    const bad = validateStep(
      "dates",
      session({ dates: { contract_date: "2026-08-10", closing_date: "2026-08-01" } })
    );
    expect(bad.valid).toBe(false);
    expect(bad.fieldErrors.dates?.closing_date).toBeTruthy();

    expect(
      validateStep(
        "dates",
        session({ dates: { contract_date: "2026-08-01", closing_date: "2026-08-10" } })
      ).valid
    ).toBe(true);
    // equal is allowed
    expect(
      validateStep(
        "dates",
        session({ dates: { contract_date: "2026-08-01", closing_date: "2026-08-01" } })
      ).valid
    ).toBe(true);
  });
  it("only checks ordering when BOTH dates present", () => {
    expect(
      validateStep("dates", session({ dates: { contract_date: "2026-08-10" } })).valid
    ).toBe(true);
  });
  it("lease_end must be >= lease_start when both present", () => {
    const bad = validateStep(
      "dates",
      session({ dates: { lease_start: "2026-09-01", lease_end: "2026-08-01" } })
    );
    expect(bad.valid).toBe(false);
    expect(bad.fieldErrors.dates?.lease_end).toBeTruthy();
  });
});

describe("review step", () => {
  it("is always valid", () => {
    expect(validateStep("review", session()).valid).toBe(true);
  });
});

describe("error object shape + isStepComplete", () => {
  it("returns the structured StepValidation shape", () => {
    const r: StepValidation = validateStep(
      "property",
      session({ property: {} })
    );
    expect(r).toEqual({
      valid: false,
      fieldErrors: { property: { address: expect.any(String) } },
      messages: [expect.any(String)],
    });
  });
  it("isStepComplete mirrors validateStep().valid", () => {
    expect(isStepComplete("type", session({ transaction_type: null }))).toBe(false);
    expect(isStepComplete("type", session({ transaction_type: "purchase" }))).toBe(true);
  });
});
