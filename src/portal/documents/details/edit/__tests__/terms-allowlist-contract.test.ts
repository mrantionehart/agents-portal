// ============================================================================
// P4H-13 — the terms allowlist contract, guarded WITHOUT a sibling checkout
// ============================================================================
// Runner: jest.
//
// `editable.test.ts` already claims to compare this mirror with Vault's
// TERMS_PATH_ALLOWLIST "byte-for-byte". It reads
// `process.cwd()/../vault/src/lib/paperwork/route-helpers.ts` — a sibling
// directory named exactly `vault`, which exists in no layout this repo is
// cloned into. So that test has never run green, and the drift it existed to
// prevent happened anyway: Vault gained purchase.* and amendment_* and this
// mirror never followed.
//
// A cross-repo file read cannot be the guard. Both repos now assert the same
// explicit contract from inside their own suite, so drift fails the CI of
// whichever repo drifted. The literal below is duplicated in Vault
// (src/lib/paperwork/__tests__/terms-allowlist-contract.test.ts) on purpose:
// duplication that two tests enforce beats one test that cannot run.
//
// CHANGING THE ALLOWLIST IS A TWO-REPO CHANGE: the pattern goes in Vault's
// route-helpers.ts, Vault's copy of this list, this mirror, and this list.
// Both suites fail until all four agree.
// ============================================================================

import {
  TERMS_PATH_ALLOWLIST_MIRROR,
  isAllowedTermsPathMirror,
  classifyField,
} from "../editable-fields";

/** The contract. Order matters — compared as a sequence. */
const TERMS_ALLOWLIST_CONTRACT: readonly string[] = [
  "^lease\\.term\\.(start_date|end_date|term_months|holdover_terms)$",
  "^lease\\.rent\\.(monthly_amount|due_day_of_month|grace_period_days|late_fee_amount|returned_check_fee|where_payable)$",
  "^lease\\.deposits\\.(security_deposit_amount|security_deposit_holder|advance_rent_amount|last_month_rent_collected)$",
  "^lease\\.pets\\.(allowed|deposit|restrictions)$",
  "^lease\\.utilities\\.(paid_by_tenant|paid_by_landlord|notes)$",
  "^lease\\.restrictions\\.(smoking_allowed|business_use_allowed|subletting_allowed|alterations_allowed)$",
  "^lease\\.is_contract_to_lease$",
  "^buyer_rep\\.(effective_date|expiration_date|geographic_area|compensation_pct|compensation_flat_fee|brokerage_relationship)$",
  "^purchase\\.inspection\\.period_days$",
  "^purchase\\.appraisal\\.(contingency_days|cure_window_days)$",
  "^purchase\\.seller_financing\\.(principal_amount|interest_rate|term_months)$",
  "^purchase\\.buyer_property\\.(address|target_close_date)$",
  "^amendment_(terms|date)$",
  "^listing\\.(effective_date|listing_expiration_date|commission_pct|co_op_pct)$",
  "^listing\\.rental\\.rent_amount$",
  "^listing\\.listing_kind$",
  "^listing\\.rental\\.(rent_basis|season_from|season_to)$",
  "^listing\\.rental\\.(advance_rent|security_deposit|pet_deposit)$",
  "^listing\\.rental\\.(credit_report_fee|association_application_fee)$",
  "^listing\\.compensation\\.(rent_period_pct|gross_value_pct|first_month_pct|other)$",
  "^listing\\.compensation\\.(payment_timing|remit_days|payment_days|other_terms)$",
  "^listing\\.brokerage_relationship$",
  "^listing\\.owners\\.[01]\\.(name|email|phone|address)$",
];

describe("the mirror matches the contract", () => {
  it("[APTAC-1] every pattern, in order", () => {
    expect(TERMS_PATH_ALLOWLIST_MIRROR.map((r) => r.source)).toEqual([
      ...TERMS_ALLOWLIST_CONTRACT,
    ]);
  });

  it("[APTAC-2] the count is pinned — a silent addition cannot slip through", () => {
    expect(TERMS_PATH_ALLOWLIST_MIRROR).toHaveLength(23);
  });

  it("[APTAC-3] this guard needs NO sibling checkout, which is the whole point", () => {
    // If this suite ever starts reading another repo off disk, the drift it
    // exists to catch becomes invisible again.
    const src = require("fs").readFileSync(__filename, "utf-8");
    expect(src).not.toMatch(/readFileSync\([^)]*\.\.[\\/]+vault/);
  });
});

describe("the rental-listing paths an ERL-14 needs are offered", () => {
  for (const path of [
    "listing.effective_date",
    "listing.listing_expiration_date",
    "listing.commission_pct",
    "listing.co_op_pct",
    "listing.rental.rent_amount",
  ]) {
    it(`[APTAC-4] accepts ${path}`, () => {
      expect(isAllowedTermsPathMirror(path)).toBe(true);
    });
  }

  it("[APTAC-5] a sale's list_price is still not writable", () => {
    expect(isAllowedTermsPathMirror("listing.list_price")).toBe(false);
  });

  it("[APTAC-6] near-misses are refused, not accepted as prefixes", () => {
    for (const bad of [
      "listing",
      "listing.",
      "listing.rental",
      "listing.rental.rent",
      "listing.effective_date.x",
      "Listing.effective_date",
      "../listing.effective_date",
      "",
    ]) {
      expect(isAllowedTermsPathMirror(bad)).toBe(false);
    }
  });

  it("[APTAC-7] the catch-up families now work too", () => {
    expect(isAllowedTermsPathMirror("purchase.inspection.period_days")).toBe(true);
    expect(isAllowedTermsPathMirror("amendment_terms")).toBe(true);
  });

  it("[APTAC-8] previously-allowed families are untouched", () => {
    expect(isAllowedTermsPathMirror("lease.term.start_date")).toBe(true);
    expect(isAllowedTermsPathMirror("buyer_rep.effective_date")).toBe(true);
    expect(isAllowedTermsPathMirror("purchase.price")).toBe(false);
  });
});

describe("the agent can complete the landlord's contact details", () => {
  // The ERL rule asks the AGENT for the landlord's signing email. Before this,
  // AGENT_EDITABLE_PARTY_ROLES was buyer-side only, so the Portal offered no
  // way to enter a field the agent's own review then blocked them on.
  // Vault's agent party PATCH already accepts any valid party role, so this
  // widens only what the Portal offers.
  for (const role of ["landlord", "co_landlord"]) {
    for (const field of ["name", "email"]) {
      it(`[APTAC-9] ${role}.${field} is agent-editable via the party endpoint`, () => {
        const r = classifyField({
          transaction_path: `parties[role=${role}].${field}`,
          severity: "high",
          completer_role: "agent",
        });
        expect(r.editable).not.toBeNull();
        expect(r.editable!.endpoint).toBe("party");
        expect(r.editable!.partyRole).toBe(role);
        expect(r.editable!.partyField).toBe(field);
      });
    }
  }

  it("[APTAC-10] buyer-side stays editable — nothing was traded away", () => {
    const r = classifyField({
      transaction_path: "parties[role=buyer].email",
      severity: "high",
      completer_role: "agent",
    });
    expect(r.editable).not.toBeNull();
    expect(r.editable!.endpoint).toBe("party");
  });

  // Deliberate: party-portal work, and this release does not change it. One
  // `it` per role so a failure names the role — jest's expect() takes ONE
  // argument, so the vitest-style label I first used threw rather than
  // annotating.
  for (const role of ["seller", "tenant", "co_seller", "co_tenant"]) {
    it(`[APTAC-11] ${role} is still NOT agent-editable here`, () => {
      const r = classifyField({
        transaction_path: `parties[role=${role}].email`,
        severity: "high",
        completer_role: "agent",
      });
      expect(r.editable).toBeNull();
      expect(r.reason).toBe("party_field");
    });
  }

  it("[APTAC-12] a non-agent completer gets nothing, whatever the role", () => {
    const r = classifyField({
      transaction_path: "parties[role=landlord].email",
      severity: "high",
      completer_role: "landlord",
    });
    expect(r.editable).toBeNull();
  });
});
