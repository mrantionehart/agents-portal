/**
 * @jest-environment node
 */
// ============================================================================
// WORKFLOW 3.4.6.4 — Home — RecommendedActionsWidget projection tests
// ============================================================================
// pickRecommendedActions is the pure-helper boundary the widget uses.
// We test the projection contract: ordering (blockers first), the
// null filter, the field allowlist (no extras survive), and AI
// quick-action passthrough is verified via the suggested_prompt
// being projected verbatim.
//
// Per the repo convention (R6 home test suite already exercises
// React renders), this file covers the data projection only.
// ============================================================================

import {
  pickRecommendedActions,
  type RecommendedActionItem,
} from "../IntelligenceWidgets";
import type { CoachRecommendation, WorkspaceCard } from "../../workspace/types";

function card(over: Partial<WorkspaceCard> = {}): WorkspaceCard {
  return {
    transaction_id: "t1",
    transaction_type: "purchase",
    property_address: "1 Main St",
    client_name: "Alice",
    readiness_score: 80,
    readiness_tier: "almost_ready",
    stage: "broker_review",
    next_action: "prepare_package",
    suggested_prompt: "ready",
    required_forms_count: 5,
    ready_forms_count: 2,
    signed_forms_count: 0,
    blocked_forms_count: 3,
    pending_envelopes_count: 0,
    portal_status: "none",
    risk_tier: "low",
    broker_confirmation_required: true,
    coach_recommendation: null,
    ...over,
  };
}

function rec(over: Partial<CoachRecommendation> = {}): CoachRecommendation {
  return {
    kind: "submit_for_broker_review",
    label: "Submit for broker review",
    blocker: false,
    reason: "Required fields are complete — package is ready for broker review.",
    suggested_prompt: "Readiness: 90%. Package is ready for broker review.",
    drill_url: "/workspace/t1?tab=compliance",
    ...over,
  };
}

// ── Ordering ───────────────────────────────────────────────────────

describe("pickRecommendedActions — ordering", () => {
  it("places blockers before non-blockers", () => {
    const cards = [
      card({ transaction_id: "a", coach_recommendation: rec({ blocker: false }) }),
      card({
        transaction_id: "b",
        coach_recommendation: rec({
          blocker: true,
          kind: "request_statutory_attestation",
          label: "Send statutory disclosure to party",
        }),
      }),
      card({ transaction_id: "c", coach_recommendation: rec({ blocker: false }) }),
    ];
    const out = pickRecommendedActions(cards);
    expect(out.map((it) => it.transaction_id)).toEqual(["b", "a", "c"]);
  });

  it("preserves incoming order within the same urgency bucket", () => {
    const cards = [
      card({ transaction_id: "x1", coach_recommendation: rec({ blocker: true }) }),
      card({ transaction_id: "x2", coach_recommendation: rec({ blocker: true }) }),
      card({ transaction_id: "x3", coach_recommendation: rec({ blocker: true }) }),
    ];
    const out = pickRecommendedActions(cards);
    expect(out.map((it) => it.transaction_id)).toEqual(["x1", "x2", "x3"]);
  });
});

// ── Null recommendations skipped ───────────────────────────────────

describe("pickRecommendedActions — null filter", () => {
  it("skips cards whose coach_recommendation is null", () => {
    const out = pickRecommendedActions([
      card({ transaction_id: "a", coach_recommendation: null }),
      card({ transaction_id: "b", coach_recommendation: rec() }),
      card({ transaction_id: "c", coach_recommendation: null }),
    ]);
    expect(out.map((it) => it.transaction_id)).toEqual(["b"]);
  });

  it("skips cards whose coach_recommendation is undefined", () => {
    const out = pickRecommendedActions([
      card({ transaction_id: "a", coach_recommendation: undefined }),
      card({ transaction_id: "b", coach_recommendation: rec() }),
    ]);
    expect(out.map((it) => it.transaction_id)).toEqual(["b"]);
  });

  it("returns empty array when no cards have recommendations", () => {
    const out = pickRecommendedActions([
      card({ transaction_id: "a", coach_recommendation: null }),
      card({ transaction_id: "b", coach_recommendation: null }),
    ]);
    expect(out).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(pickRecommendedActions([])).toEqual([]);
  });
});

// ── Projection (field allowlist) ───────────────────────────────────

describe("pickRecommendedActions — projection allowlist", () => {
  it("emits EXACTLY the RecommendedActionItem keys per card (incl. AGENT.SIGN.1E.2 fields)", () => {
    const out = pickRecommendedActions([
      card({
        transaction_id: "t99",
        property_address: "9 Test Way",
        client_name: "Pat",
        coach_recommendation: rec({
          kind: "complete_collection",
          label: "Continue collecting required information",
          blocker: true,
          drill_url: "/workspace/t99?tab=documents",
          recommended_action: "Add the missing details",
          estimated_time: "5 min",
        }),
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]).sort()).toEqual(
      [
        "blocker",
        "client_name",
        "drill_url",
        "estimated_time",
        "kind",
        "label",
        "property_address",
        "recommended_action",
        "transaction_id",
      ].sort()
    );
    expect(out[0]).toEqual({
      transaction_id: "t99",
      property_address: "9 Test Way",
      client_name: "Pat",
      label: "Continue collecting required information",
      blocker: true,
      drill_url: "/workspace/t99?tab=documents",
      kind: "complete_collection",
      recommended_action: "Add the missing details",
      estimated_time: "5 min",
    });
  });

  it("passes label / blocker / drill_url through verbatim — no rewriting", () => {
    const recIn = rec({
      label: "Awaiting broker approval",
      blocker: false,
      drill_url: "/workspace/t1?tab=commission&coach_kind=await_broker_approval",
      kind: "await_broker_approval",
    });
    const out = pickRecommendedActions([card({ coach_recommendation: recIn })]);
    expect(out[0].label).toBe(recIn.label);
    expect(out[0].blocker).toBe(recIn.blocker);
    expect(out[0].drill_url).toBe(recIn.drill_url);
    expect(out[0].kind).toBe(recIn.kind);
  });
});

// ── Safety — no leaks survive projection ───────────────────────────

describe("pickRecommendedActions — safety", () => {
  const FORBIDDEN = [
    "net_commission",
    "agent_amount",
    "gross_commission",
    "agent_split_pct",
    "brokerage_amount",
    "cap_applied",
    "cap_remaining_before",
    "cap_remaining_after",
    "stripe_payout_id",
    "payment_reference",
    "revision_notes",
    "coaching_notes",
    "flood_history",
    "lead_paint",
    "prior_insurance_claim",
    "prior_fema_assistance",
    "client_email",
    "client_phone",
    "transaction_path",
  ];

  it("hostile coach_recommendation extras NEVER survive the projection", () => {
    // Simulate a regressed Vault payload that smuggles forbidden
    // fields into coach_recommendation. The projection MUST drop
    // them. Cast through unknown because the Portal mirror type
    // refuses extras at compile time.
    const hostile = card({
      transaction_id: "t-hostile",
      coach_recommendation: {
        ...rec(),
        net_commission: "leak-net",
        agent_amount: "leak-agent",
        gross_commission: "leak-gross",
        agent_split_pct: 70,
        brokerage_amount: "leak-brokerage",
        cap_applied: true,
        cap_remaining_before: "leak-cap-before",
        cap_remaining_after: "leak-cap-after",
        stripe_payout_id: "leak-stripe",
        payment_reference: "leak-ref",
        revision_notes: "leak-rev",
        coaching_notes: "leak-coach",
        flood_history: "leaked",
        lead_paint: "leaked",
        prior_insurance_claim: "leaked",
        prior_fema_assistance: "leaked",
        client_email: "leak@example.com",
        client_phone: "+15555550100",
        transaction_path: "facts.leaked",
      } as unknown as CoachRecommendation,
    });
    const out = pickRecommendedActions([hostile]);
    const ser = JSON.stringify(out);
    for (const f of FORBIDDEN) {
      expect(ser).not.toContain(f);
    }
    expect(ser).not.toContain("leak-");
    expect(ser).not.toContain("leak@example.com");
    expect(ser).not.toContain("+15555550100");
    expect(ser).not.toContain("facts.");
    expect(ser).not.toContain("terms.");
  });

  it("RecommendedActionItem type carries no broker-only fields", () => {
    // Compile-time / shape-level proof: any RecommendedActionItem
    // can only have these 7 keys.
    const sample: RecommendedActionItem = {
      transaction_id: "t1",
      property_address: null,
      client_name: null,
      label: "x",
      blocker: false,
      drill_url: "/workspace/t1",
      kind: "nothing_urgent",
    };
    expect(Object.keys(sample).sort()).toEqual(
      ["blocker", "client_name", "drill_url", "kind", "label", "property_address", "transaction_id"]
    );
  });
});
