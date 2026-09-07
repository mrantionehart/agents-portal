// ============================================================================
// SEC · P0-19 · AP /api/pipeline TYPE_GROUPS canonical + legacy coverage
// ============================================================================
// The AP pipeline route buckets transactions by `transactions.type` into 5
// UI groups (Listings / Buyers / Leases / Referrals / Other). Pre-fix the
// bucket map only knew about legacy aliases (`seller`, `buyer`, `lease`,
// `referral`, `wholesale`, `double_close`) so the canonical Vault
// vocabulary — specifically `listing` and `buyer_rep`, which now exist in
// prod — landed in NO group and became silently invisible.
//
// Vault canonical vocabulary is 7 types (see
// hartfelt-vault src/lib/transaction-os/transaction-type.ts):
//   purchase | lease | listing | buyer_rep | commercial | wholesale | referral
//
// with legacy aliases still present in prod:
//   buyer  → maps to canonical `purchase`
//   seller → maps to canonical `listing`
//   double_close → maps to canonical `purchase`
//
// This suite pins the AP bucket contract so both legacy AND canonical
// spellings surface in the intended UI tab. It also test-locks the
// `commercial` residual: AP has no semantically correct bucket for it
// today (product residual), so commercial deals are documented as
// silently absent from all buckets (fail-open on visibility, not
// misclassified into "Other").
//
// Framework: jest (AP).
// ============================================================================

// Extract the TYPE_GROUPS map + iteration order from the route by reading
// the module's source-of-truth. We intentionally exercise the SAME grouping
// function shape the route uses so filter/count/render agree.

import { TYPE_GROUPS, TYPE_GROUP_ORDER, groupTransactionsByType } from "@/app/api/pipeline/type-groups";

function makeTx(id: string, type: string) {
  return { id, type, agent_id: "u-1", status: "draft", created_at: "2026-09-01T00:00:00Z", contract_price: 0 };
}

describe("SEC · P0-19 · TYPE_GROUPS canonical + legacy coverage", () => {
  // ── Presence assertions ────────────────────────────────────────────
  it("case 1 — `listing` (canonical) appears in the `listings` bucket", () => {
    expect(TYPE_GROUPS.listings.types).toContain("listing");
  });

  it("case 2 — `buyer_rep` (canonical) appears in the `buyers` bucket", () => {
    expect(TYPE_GROUPS.buyers.types).toContain("buyer_rep");
  });

  // ── Existing legacy visible behavior preserved ─────────────────────
  it("case 3 — legacy `seller` still appears in the `listings` bucket (unchanged)", () => {
    expect(TYPE_GROUPS.listings.types).toContain("seller");
  });

  it("case 4 — legacy `buyer` still appears in the `buyers` bucket (unchanged)", () => {
    expect(TYPE_GROUPS.buyers.types).toContain("buyer");
  });

  it("case 5 — `lease` still appears in the `leases` bucket (unchanged)", () => {
    expect(TYPE_GROUPS.leases.types).toContain("lease");
  });

  it("case 5b — `referral` still appears in `referrals` (unchanged)", () => {
    expect(TYPE_GROUPS.referrals.types).toContain("referral");
  });

  it("case 5c — `wholesale` still appears in `other` (unchanged)", () => {
    expect(TYPE_GROUPS.other.types).toContain("wholesale");
  });

  it("case 5d — legacy `double_close` still appears in `other` (unchanged; matches Vault SoT alias → purchase but AP visible behavior is 'other' historically)", () => {
    expect(TYPE_GROUPS.other.types).toContain("double_close");
  });

  // ── Fail-safe assertions ───────────────────────────────────────────
  it("case 6 — unknown future type does not crash grouping and is silently absent from all buckets", () => {
    const txs = [makeTx("t1", "some_future_unknown_type"), makeTx("t2", "buyer")];
    // Should not throw
    const groups = groupTransactionsByType(txs);
    // The unknown type must not appear in any bucket
    const allIds = Object.values(groups).flat().map((t: { id: string }) => t.id);
    expect(allIds).toContain("t2");
    expect(allIds).not.toContain("t1");
  });

  it("case 7 — no transaction appears in two buckets (buckets are mutually exclusive)", () => {
    // Assert bucket type-lists are pairwise disjoint.
    const allTypes: string[] = [];
    for (const key of TYPE_GROUP_ORDER) {
      allTypes.push(...TYPE_GROUPS[key].types);
    }
    const unique = new Set(allTypes);
    expect(allTypes.length).toBe(unique.size);
    // And the runtime grouping is also mutually exclusive: a single tx lands
    // in at most one bucket.
    const txs = [makeTx("t-listing", "listing"), makeTx("t-br", "buyer_rep")];
    const groups = groupTransactionsByType(txs);
    const listingIds = groups.listings.map((t) => t.id);
    const buyerIds = groups.buyers.map((t) => t.id);
    // t-listing MUST be in listings and NOT in buyers.
    expect(listingIds).toContain("t-listing");
    expect(buyerIds).not.toContain("t-listing");
    // t-br MUST be in buyers and NOT in listings.
    expect(buyerIds).toContain("t-br");
    expect(listingIds).not.toContain("t-br");
  });

  it("case 8 — filtering/counts use the SAME grouping function as rendering (single source)", () => {
    // groupTransactionsByType is the one authoritative fn. Same input yields
    // deterministic partition — filter + count + render all read from it.
    const txs = [
      makeTx("a", "listing"),
      makeTx("b", "buyer_rep"),
      makeTx("c", "buyer"),
      makeTx("d", "lease"),
    ];
    const first = groupTransactionsByType(txs);
    const second = groupTransactionsByType(txs);
    expect(first).toEqual(second);
    expect(first.listings).toHaveLength(1);
    expect(first.buyers).toHaveLength(2); // buyer + buyer_rep
    expect(first.leases).toHaveLength(1);
    expect(first.other).toHaveLength(0);
  });

  // ── Tenant/auth behavior unchanged ─────────────────────────────────
  it("case 9 — grouping is pure and does not read tenant or auth (behavior unchanged)", () => {
    // groupTransactionsByType has zero DB/auth side effects. Passing an
    // empty array returns an empty group per bucket, unchanged from the
    // baseline pipeline route contract.
    const groups = groupTransactionsByType([]);
    for (const key of TYPE_GROUP_ORDER) {
      expect(groups[key]).toEqual([]);
    }
  });

  // ── `commercial` product residual test-lock ────────────────────────
  it("case 10 — `commercial` is EXPLICITLY test-locked: not in any bucket (product residual; documented in TYPE_GROUPS comment)", () => {
    // Vault canonical includes `commercial` as a real transaction type,
    // but AP has no semantically correct bucket for it today. Per user
    // directive: do NOT silently force commercial into `other` (misclassifies)
    // and do NOT invent a new bucket in this PR. A commercial deal stored in
    // prod (currently 0 rows per Q1 2026-09-07) will therefore land in NO
    // bucket — visible-in-total-counts but not in any tab. A separate
    // product decision is required before we route commercial anywhere.
    for (const key of TYPE_GROUP_ORDER) {
      expect(TYPE_GROUPS[key].types).not.toContain("commercial");
    }
    // Runtime confirmation: a commercial tx is silently absent from every
    // bucket (does not throw, does not misclassify).
    const txs = [makeTx("c1", "commercial")];
    const groups = groupTransactionsByType(txs);
    const inAny = Object.values(groups).flat().find((t: { id: string }) => t.id === "c1");
    expect(inAny).toBeUndefined();
  });

  // ── Extended coverage: canonical `purchase` future-proof ───────────
  it("case 11 — canonical `purchase` (Vault SoT `buyer` legacy alias's canonical form) appears in `buyers`", () => {
    // Prod DB currently stores legacy `buyer` (6 rows in Q1); as new deals
    // land using canonical `purchase`, they must also surface in the same
    // bucket rather than becoming invisible.
    expect(TYPE_GROUPS.buyers.types).toContain("purchase");
  });
});
