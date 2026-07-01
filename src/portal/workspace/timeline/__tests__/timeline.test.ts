/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.3.1 — Timeline tests
// ============================================================================

import type { WorkspaceCard } from "../../types";
import type { DocumentRow } from "../../../documents/types";
import type { RawHistoryEvent } from "../types";
import { toSafeTimelineCard } from "../safe-history-event";
import {
  composeTimelineState,
  type ComposeTimelineInputs,
} from "../compose-timeline";

function makeCard(over: Partial<WorkspaceCard> = {}): WorkspaceCard {
  return {
    transaction_id: "txn-1",
    transaction_type: "lease",
    property_address: "123 Main",
    client_name: "Jane",
    readiness_score: 50,
    readiness_tier: "drafting",
    stage: "Drafting",
    next_action: "Collect missing lease term",
    suggested_prompt: "Ask the landlord for the term length.",
    required_forms_count: 0,
    ready_forms_count: 0,
    signed_forms_count: 0,
    blocked_forms_count: 0,
    pending_envelopes_count: 0,
    portal_status: "none",
    risk_tier: "low",
    broker_confirmation_required: true,
    ...over,
  };
}

function base(over: Partial<ComposeTimelineInputs> = {}): ComposeTimelineInputs {
  return {
    callerRole: "agent",
    card: makeCard(),
    documents: [] as DocumentRow[],
    transactionStatus: null,
    brokerReviewStatus: null,
    closingDate: null,
    statutoryCount: 0,
    satisfiedStatutoryCount: 0,
    history: { kind: "skip" },
    paperworkPackageUrl: "https://vault.example.com/paperwork/txn-1",
    now: new Date("2026-06-26T12:00:00Z"),
    ...over,
  };
}

// ── toSafeTimelineCard ─────────────────────────────────────────────

describe("toSafeTimelineCard", () => {
  const ctx = { transactionId: "txn-1" };

  it("returns null for missing id or created_at", () => {
    expect(toSafeTimelineCard({}, ctx)).toBeNull();
    expect(toSafeTimelineCard({ id: "1" }, ctx)).toBeNull();
    expect(toSafeTimelineCard({ created_at: "x" }, ctx)).toBeNull();
  });

  it("maps audit source=system, transaction.promoted → milestone", () => {
    const c = toSafeTimelineCard(
      {
        kind: "audit",
        id: "a1",
        created_at: "2026-06-24T00:00:00Z",
        source: "system",
        field_path: "transaction.promoted",
      },
      ctx
    );
    expect(c?.kind).toBe("milestone");
    expect(c?.label).toBe("Transaction materialized");
  });

  it("maps audit source=typed → Field updated, INFO tone, no raw values", () => {
    const raw: RawHistoryEvent = {
      kind: "audit",
      id: "a2",
      created_at: "2026-06-24T01:00:00Z",
      source: "typed",
      field_path: "facts.condo",
      old_value: "broker secret note",
      new_value: "yes",
    };
    const c = toSafeTimelineCard(raw, ctx);
    expect(c?.tone).toBe("info");
    expect(c?.label).toBe("Field updated");
    expect(JSON.stringify(c)).not.toContain("broker secret note");
    expect(JSON.stringify(c)).not.toContain("yes");
  });

  it("maps audit source=party_portal → compliance OK with humanized statutory key", () => {
    const c = toSafeTimelineCard(
      {
        kind: "audit",
        id: "a3",
        created_at: "2026-06-24T02:00:00Z",
        source: "party_portal",
        field_path: "facts.flood_history",
      },
      ctx
    );
    expect(c?.kind).toBe("compliance");
    expect(c?.tone).toBe("ok");
    expect(c?.label).toContain("Flood history");
  });

  it("maps audit source=docusign → envelope kind, tone based on event", () => {
    const c1 = toSafeTimelineCard(
      {
        kind: "audit",
        id: "a4",
        created_at: "2026-06-24T03:00:00Z",
        source: "docusign",
        field_path: "envelope.completed",
      },
      ctx
    );
    expect(c1?.kind).toBe("envelope");
    expect(c1?.tone).toBe("ok");

    const c2 = toSafeTimelineCard(
      {
        kind: "audit",
        id: "a5",
        created_at: "2026-06-24T04:00:00Z",
        source: "docusign",
        field_path: "envelope.declined",
      },
      ctx
    );
    expect(c2?.tone).toBe("warn");

    const c3 = toSafeTimelineCard(
      {
        kind: "audit",
        id: "a6",
        created_at: "2026-06-24T05:00:00Z",
        source: "docusign",
        field_path: "envelope.sent",
      },
      ctx
    );
    expect(c3?.tone).toBe("info");
  });

  it("maps review action=submitted → info hourglass", () => {
    const c = toSafeTimelineCard(
      {
        kind: "review",
        id: "r1",
        created_at: "2026-06-24T06:00:00Z",
        action: "submitted",
      },
      ctx
    );
    expect(c?.kind).toBe("review");
    expect(c?.tone).toBe("info");
    expect(c?.label).toBe("Submitted for broker review");
  });

  it("maps review action=approved → ok", () => {
    const c = toSafeTimelineCard(
      {
        kind: "review",
        id: "r2",
        created_at: "2026-06-24T07:00:00Z",
        action: "approved",
      },
      ctx
    );
    expect(c?.tone).toBe("ok");
    expect(c?.label).toBe("Broker approved transaction");
  });

  it("maps review action=rejected → warn but NEVER includes raw notes", () => {
    const raw: RawHistoryEvent = {
      kind: "review",
      id: "r3",
      created_at: "2026-06-24T08:00:00Z",
      action: "rejected",
      notes: "Confidential broker context that must not leak",
      status_before: "submitted",
      status_after: "revisions_required",
    };
    const c = toSafeTimelineCard(raw, ctx);
    expect(c?.tone).toBe("warn");
    expect(c?.label).toBe("Broker requested revisions");
    expect(JSON.stringify(c)).not.toContain("Confidential broker context");
    expect(JSON.stringify(c)).not.toContain("submitted");
    expect(JSON.stringify(c)).not.toContain("revisions_required");
  });

  it("never includes notes / old_value / new_value in any output", () => {
    const events: RawHistoryEvent[] = [
      {
        kind: "audit",
        id: "a1",
        created_at: "2026-06-24T00:00:00Z",
        source: "typed",
        field_path: "facts.condo",
        old_value: "must-not-leak-A",
        new_value: "must-not-leak-B",
      },
      {
        kind: "audit",
        id: "a2",
        created_at: "2026-06-24T01:00:00Z",
        source: "broker_review",
        old_value: "must-not-leak-C",
        new_value: "must-not-leak-D",
      },
      {
        kind: "review",
        id: "r1",
        created_at: "2026-06-24T02:00:00Z",
        action: "rejected",
        notes: "must-not-leak-E",
      },
    ];
    for (const raw of events) {
      const c = toSafeTimelineCard(raw, ctx);
      const ser = JSON.stringify(c);
      expect(ser).not.toContain("must-not-leak-A");
      expect(ser).not.toContain("must-not-leak-B");
      expect(ser).not.toContain("must-not-leak-C");
      expect(ser).not.toContain("must-not-leak-D");
      expect(ser).not.toContain("must-not-leak-E");
    }
  });
});

// ── Workflow 3.4.4.1 — commission audit event mapping ───────────────

describe("toSafeTimelineCard — W3.4.4.1 commission lifecycle events", () => {
  const ctx = { transactionId: "txn-1" };

  function mapAt(fieldPath: string, source = "broker_review") {
    return toSafeTimelineCard(
      {
        kind: "audit",
        // Stable ID that does NOT echo the field_path back into the
        // serialized output (some assertions scan the whole card JSON
        // for leak markers).
        id: "row-" + Math.abs(hashString(fieldPath)).toString(16),
        created_at: "2026-06-26T10:00:00Z",
        source,
        field_path: fieldPath,
      },
      ctx
    );
  }

  function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  it("maps commission.calculated → kind='commission', tone='info', label='Commission calculated'", () => {
    const c = mapAt("commission.calculated");
    expect(c?.kind).toBe("commission");
    expect(c?.tone).toBe("info");
    expect(c?.iconName).toBe("pencil");
    expect(c?.label).toBe("Commission calculated");
    expect(c?.drillHref).toBe("/workspace/txn-1?tab=commission");
  });

  it("maps commission.compliance_checked → kind='commission', tone='info', shield icon", () => {
    const c = mapAt("commission.compliance_checked");
    expect(c?.kind).toBe("commission");
    expect(c?.iconName).toBe("shield");
    expect(c?.label).toBe("Commission compliance check");
  });

  it("maps commission.approved → tone='ok', check-circle-2 icon", () => {
    const c = mapAt("commission.approved");
    expect(c?.kind).toBe("commission");
    expect(c?.tone).toBe("ok");
    expect(c?.iconName).toBe("check-circle-2");
    expect(c?.label).toBe("Broker approved commission");
  });

  it("maps commission.paid → tone='ok', label='Commission paid'", () => {
    const c = mapAt("commission.paid");
    expect(c?.kind).toBe("commission");
    expect(c?.tone).toBe("ok");
    expect(c?.label).toBe("Commission paid");
  });

  it("maps commission.pay.blocked → tone='warn', alert-triangle, distinct label", () => {
    const c = mapAt("commission.pay.blocked");
    expect(c?.kind).toBe("commission");
    expect(c?.tone).toBe("warn");
    expect(c?.iconName).toBe("alert-triangle");
    expect(c?.label).toBe("Commission payment blocked");
  });

  it("maps commission.deleted → tone='muted', alert-circle", () => {
    const c = mapAt("commission.deleted");
    expect(c?.kind).toBe("commission");
    expect(c?.tone).toBe("muted");
    expect(c?.iconName).toBe("alert-circle");
    expect(c?.label).toBe("Commission deleted");
  });

  it("unknown commission.* defaults to generic safe card (no field_path leak)", () => {
    const c = mapAt("commission.something_new");
    expect(c?.kind).toBe("commission");
    expect(c?.label).toBe("Commission updated");
    const ser = JSON.stringify(c);
    expect(ser).not.toContain("something_new");
  });

  it("commission events take precedence over the generic broker_review handler", () => {
    // A row with source='broker_review' and field_path starting with
    // 'commission.' must NOT fall through to "Broker updated field".
    const c = mapAt("commission.calculated", "broker_review");
    expect(c?.label).not.toBe("Broker updated field");
    expect(c?.label).toBe("Commission calculated");
  });

  it("SAFETY: never renders raw notes / old_value / new_value when row carries them", () => {
    const raw: RawHistoryEvent = {
      kind: "audit",
      id: "x",
      created_at: "2026-06-26T10:00:00Z",
      source: "broker_review",
      field_path: "commission.paid",
      old_value: "must-not-leak-Z1",
      new_value: "must-not-leak-Z2",
      notes: "must-not-leak-Z3" as any,
    };
    const c = toSafeTimelineCard(raw, ctx);
    const ser = JSON.stringify(c);
    expect(ser).not.toContain("must-not-leak-Z1");
    expect(ser).not.toContain("must-not-leak-Z2");
    expect(ser).not.toContain("must-not-leak-Z3");
  });

  it("SAFETY: never renders amounts / Stripe IDs / statutory keys in commission cards", () => {
    const FORBIDDEN_FIELDS = [
      "net_commission",
      "agent_amount",
      "brokerage_amount",
      "agent_split_pct",
      "cap_applied",
      "cap_remaining",
      "stripe_payout_id",
      "payment_reference",
      "revision_notes",
      "coaching_notes",
      "flood_history",
      "prior_insurance_claim",
      "lead_paint_knowledge",
    ];
    const cards = [
      "commission.calculated",
      "commission.compliance_checked",
      "commission.approved",
      "commission.paid",
      "commission.pay.blocked",
      "commission.deleted",
    ].map((f) => mapAt(f));
    const ser = JSON.stringify(cards);
    for (const f of FORBIDDEN_FIELDS) {
      expect(ser).not.toContain(f);
    }
  });
});

// ── Workflow 3.4.4.1 — composer broker-skip behavior ────────────────

describe("composeTimelineState — W3.4.4.1 broker tier skips synthesis", () => {
  function safeCommission() {
    return {
      id: "comm-1",
      transaction_id: "txn-1",
      commission_status: "broker_approved",
      approved_at: "2026-06-20T10:00:00Z",
      paid_at: null,
      payment_method: null,
      payment_reference_tail: null,
      has_statement: false,
    };
  }
  function verdict() {
    return {
      commission_id: "comm-1",
      transaction_id: "txn-1",
      commission_status: "broker_approved",
      payable: true,
      blockers: [],
      ts: "2026-06-26T10:00:00Z",
    };
  }

  it("broker tier (kind='broker') does NOT add synthesized commission cards (Vault /history is authoritative)", () => {
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "broker", cards: [] },
        commission: {
          kind: "ok",
          commission: safeCommission(),
          verdict: verdict(),
          verdictError: null,
        },
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const ids = r.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids.some((id) => id.startsWith("commission:"))).toBe(false);
  });

  it("agent tier (kind='skip') KEEPS synthesized commission cards (degraded fallback)", () => {
    const r = composeTimelineState(
      base({
        commission: {
          kind: "ok",
          commission: safeCommission(),
          verdict: verdict(),
          verdictError: null,
        },
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const ids = r.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids.some((id) => id.startsWith("commission:"))).toBe(true);
  });

  it("broker tier still renders kind='commission' cards that came via /history (no duplicates from synthesis)", () => {
    const historyCard = {
      id: "h-paid",
      occurred_at: "2026-06-22T10:00:00Z",
      kind: "commission" as const,
      tone: "ok" as const,
      iconName: "check-circle-2" as const,
      label: "Commission paid",
    };
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "broker", cards: [historyCard] },
        commission: {
          kind: "ok",
          commission: safeCommission(),
          verdict: verdict(),
          verdictError: null,
        },
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const commissionCards = r.groups
      .flatMap((g) => g.cards)
      .filter((c) => c.kind === "commission");
    expect(commissionCards.length).toBe(1);
    expect(commissionCards[0].id).toBe("h-paid");
    // No synthesized "commission:paid" card alongside
    expect(
      commissionCards.some((c) => c.id.startsWith("commission:"))
    ).toBe(false);
  });

  it("broker tier with /history error STILL skips synthesis (composer treats history.kind!='broker' as agent)", () => {
    // When /history errors, fetcher returns kind='error' which the
    // composer treats as agent path. Synthesis comes back as the
    // degraded fallback — this is by design (W3.3.1 behavior preserved).
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "error", message: "HTTP 500" },
        commission: {
          kind: "ok",
          commission: safeCommission(),
          verdict: verdict(),
          verdictError: null,
        },
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const ids = r.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids.some((id) => id.startsWith("commission:"))).toBe(true);
  });
});

// ── composeTimelineState ────────────────────────────────────────────

describe("composeTimelineState — broker path", () => {
  it("uses /history cards when kind='broker'", () => {
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: {
          kind: "broker",
          cards: [
            {
              id: "h1",
              occurred_at: "2026-06-26T11:00:00Z",
              kind: "review",
              tone: "ok",
              iconName: "check-circle-2",
              label: "Broker approved transaction",
            },
          ],
        },
      })
    );
    expect(r.callerRoleClass).toBe("broker");
    expect(r.isDegraded).toBe(false);
    expect(r.totalCount).toBe(1);
    expect(r.filterChips.length).toBeGreaterThan(0);
  });

  it("falls back to milestones when broker fetch errored", () => {
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "error", message: "HTTP 500" },
        card: makeCard({ required_forms_count: 5, signed_forms_count: 2 }),
      })
    );
    expect(r.callerRoleClass).toBe("agent");
    expect(r.isDegraded).toBe(true);
    expect(r.historyFetchError).toBe("HTTP 500");
    expect(r.totalCount).toBeGreaterThan(0);
  });
});

describe("composeTimelineState — agent path (degraded milestone view)", () => {
  it("classifies as agent + degraded when history is skip", () => {
    const r = composeTimelineState(base());
    expect(r.callerRoleClass).toBe("agent");
    expect(r.isDegraded).toBe(true);
    expect(r.filterChips).toHaveLength(0);
  });

  it("emits closing-date milestone when closingDate set", () => {
    const r = composeTimelineState(base({ closingDate: "2026-08-15" }));
    const ids = r.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids).toContain("milestone:closing-date");
  });

  it("emits closing-date 'Transaction closed' when status=closed", () => {
    const r = composeTimelineState(
      base({ closingDate: "2026-08-15", transactionStatus: "closed" })
    );
    const close = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "milestone:closing-date");
    expect(close?.label).toBe("Transaction closed");
    expect(close?.tone).toBe("ok");
  });

  it("emits broker-review milestone with correct tone for each status", () => {
    const matrix: Array<[string, string]> = [
      ["draft", "muted"],
      ["submitted", "info"],
      ["approved", "ok"],
      ["revisions_required", "warn"],
    ];
    for (const [status, tone] of matrix) {
      const r = composeTimelineState(base({ brokerReviewStatus: status }));
      const milestone = r.groups
        .flatMap((g) => g.cards)
        .find((c) => c.id === "milestone:broker-review");
      expect(milestone?.tone).toBe(tone);
    }
  });

  it("emits forms summary milestone when required > 0", () => {
    const r = composeTimelineState(
      base({
        card: makeCard({ required_forms_count: 5, signed_forms_count: 5 }),
      })
    );
    const m = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "milestone:forms-summary");
    expect(m?.tone).toBe("ok");
    expect(m?.label).toContain("5 of 5");
  });

  it("emits statutory milestone when any statutory present", () => {
    const r = composeTimelineState(
      base({ statutoryCount: 3, satisfiedStatutoryCount: 1 })
    );
    const m = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "milestone:statutory");
    expect(m?.label).toContain("1 of 4");
    expect(m?.tone).toBe("warn");
  });

  it("emits envelopes milestone when pending or signed > 0", () => {
    const r = composeTimelineState(
      base({ card: makeCard({ pending_envelopes_count: 2 }) })
    );
    const m = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "milestone:envelopes");
    expect(m?.label).toContain("2 envelopes");
  });

  it("always emits stage milestone last (anchored to now)", () => {
    const r = composeTimelineState(base());
    const stages = r.groups
      .flatMap((g) => g.cards)
      .filter((c) => c.id === "milestone:stage");
    expect(stages.length).toBe(1);
  });
});

describe("composeTimelineState — day grouping", () => {
  it("groups cards by day with Today/Yesterday labels", () => {
    const now = new Date("2026-06-26T12:00:00Z");
    const cards = [
      {
        id: "c1",
        occurred_at: "2026-06-26T11:00:00Z", // Today
        kind: "audit" as const,
        tone: "info" as const,
        iconName: "pencil" as const,
        label: "today event",
      },
      {
        id: "c2",
        occurred_at: "2026-06-25T11:00:00Z", // Yesterday
        kind: "audit" as const,
        tone: "info" as const,
        iconName: "pencil" as const,
        label: "yesterday event",
      },
      {
        id: "c3",
        occurred_at: "2026-06-23T11:00:00Z", // Mon, Jun 23
        kind: "audit" as const,
        tone: "info" as const,
        iconName: "pencil" as const,
        label: "older event",
      },
    ];
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "broker", cards },
        now,
      })
    );
    expect(r.groups[0].label).toBe("Today");
    expect(r.groups[1].label).toBe("Yesterday");
    expect(r.groups[2].label).toMatch(/Jun 23/);
    // Newest day first
    expect(r.groups[0].dateKey > r.groups[1].dateKey).toBe(true);
  });

  it("sorts cards DESC by occurred_at within a day", () => {
    const now = new Date("2026-06-26T23:59:00Z");
    const cards = [
      {
        id: "early",
        occurred_at: "2026-06-26T01:00:00Z",
        kind: "audit" as const,
        tone: "info" as const,
        iconName: "pencil" as const,
        label: "early",
      },
      {
        id: "late",
        occurred_at: "2026-06-26T22:00:00Z",
        kind: "audit" as const,
        tone: "info" as const,
        iconName: "pencil" as const,
        label: "late",
      },
    ];
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "broker", cards },
        now,
      })
    );
    expect(r.groups[0].cards[0].id).toBe("late");
    expect(r.groups[0].cards[1].id).toBe("early");
  });

  it("drops cards with invalid occurred_at", () => {
    const now = new Date("2026-06-26T12:00:00Z");
    const cards = [
      {
        id: "bad",
        occurred_at: "not-a-date",
        kind: "audit" as const,
        tone: "info" as const,
        iconName: "pencil" as const,
        label: "bad",
      },
      {
        id: "good",
        occurred_at: "2026-06-26T11:00:00Z",
        kind: "audit" as const,
        tone: "info" as const,
        iconName: "pencil" as const,
        label: "good",
      },
    ];
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "broker", cards },
        now,
      })
    );
    const allIds = r.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(allIds).toContain("good");
    expect(allIds).not.toContain("bad");
  });
});

// ── Workflow 3.4.3.2 — commission lifecycle ─────────────────────────

import type { FetchCommissionResult } from "../../commission/api";
import type {
  CommissionGateVerdict,
  SafeCommissionRow,
} from "../../commission/types";

function safeCommissionFx(
  over: Partial<SafeCommissionRow> = {}
): SafeCommissionRow {
  return {
    id: "comm-1",
    transaction_id: "txn-1",
    commission_status: "broker_approved",
    approved_at: "2026-06-20T10:00:00Z",
    paid_at: null,
    payment_method: null,
    payment_reference_tail: "4821",
    has_statement: false,
    ...over,
  };
}

function verdictFx(
  over: Partial<CommissionGateVerdict> = {}
): CommissionGateVerdict {
  return {
    commission_id: "comm-1",
    transaction_id: "txn-1",
    commission_status: "broker_approved",
    payable: true,
    blockers: [],
    ts: "2026-06-26T12:00:00Z",
    ...over,
  };
}

function okFetch(
  commission: SafeCommissionRow,
  verdict: CommissionGateVerdict | null = verdictFx()
): FetchCommissionResult {
  return { kind: "ok", commission, verdict, verdictError: null };
}

describe("composeTimelineState — commission lifecycle (W3.4.3.2)", () => {
  it("emits NO commission cards when fetch is empty", () => {
    const r = composeTimelineState(
      base({
        commission: { kind: "empty" },
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const ids = r.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids.filter((id) => id.startsWith("commission:"))).toEqual([]);
  });

  it("emits NO commission cards when fetch errored", () => {
    const r = composeTimelineState(
      base({
        commission: { kind: "error", message: "HTTP 500" },
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const ids = r.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids.filter((id) => id.startsWith("commission:"))).toEqual([]);
  });

  it("'Commission calculated' card emits when status >= calculated", () => {
    const r = composeTimelineState(
      base({
        commission: okFetch(safeCommissionFx({ commission_status: "calculated" })),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const card = r.groups.flatMap((g) => g.cards).find((c) => c.id === "commission:calculated");
    expect(card).toBeTruthy();
    expect(card!.kind).toBe("commission");
    expect(card!.tone).toBe("info");
    expect(card!.iconName).toBe("pencil");
    expect(card!.drillHref).toBe("/workspace/txn-1?tab=commission");
  });

  it("'Awaiting broker approval' fires for calculated and compliance_check only", () => {
    for (const status of ["calculated", "compliance_check"]) {
      const r = composeTimelineState(
        base({
          commission: okFetch(safeCommissionFx({ commission_status: status })),
          workspaceBaseUrl: "/workspace/txn-1",
        })
      );
      const card = r.groups
        .flatMap((g) => g.cards)
        .find((c) => c.id === "commission:awaiting");
      expect(card?.tone).toBe("info");
      expect(card?.iconName).toBe("hourglass");
    }
    // Should NOT fire for broker_approved
    const rApproved = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({ commission_status: "broker_approved" })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const ids = rApproved.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids).not.toContain("commission:awaiting");
  });

  it("'Broker approved' uses real approved_at timestamp", () => {
    const r = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({
            commission_status: "broker_approved",
            approved_at: "2026-06-20T15:30:00Z",
          })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const card = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "commission:approved");
    expect(card?.tone).toBe("ok");
    expect(card?.iconName).toBe("check-circle-2");
    expect(card?.occurred_at).toBe("2026-06-20T15:30:00Z");
  });

  it("'Payment blocked' fires only when status='broker_approved' AND verdict has blockers", () => {
    // Case A — fires: approved + blockers
    const rA = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({ commission_status: "broker_approved" }),
          verdictFx({
            payable: false,
            blockers: [
              { key: "transaction_not_closed", label: "Transaction must be closed" },
              { key: "compliance_not_passed", label: "Compliance must pass" },
            ],
          })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const cardA = rA.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "commission:blocked");
    expect(cardA?.tone).toBe("warn");
    expect(cardA?.detail).toMatch(/2 gates? not yet clear/);

    // Case B — does NOT fire: approved + payable=true
    const rB = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({ commission_status: "broker_approved" }),
          verdictFx({ payable: true, blockers: [] })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const idsB = rB.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(idsB).not.toContain("commission:blocked");

    // Case C — does NOT fire: status=paid even with stale blockers
    const rC = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({
            commission_status: "paid",
            paid_at: "2026-06-22T12:00:00Z",
            payment_method: "ach",
          }),
          verdictFx({ payable: false, blockers: [{ key: "compliance_not_passed", label: "x" }] })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const idsC = rC.groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(idsC).not.toContain("commission:blocked");
  });

  it("'Payment processing' fires only when status='payment_processing'", () => {
    const r = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({ commission_status: "payment_processing" })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const card = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "commission:processing");
    expect(card?.tone).toBe("info");
  });

  it("'Commission paid' uses real paid_at + humanized payment-method detail", () => {
    const r = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({
            commission_status: "paid",
            paid_at: "2026-06-22T12:00:00Z",
            payment_method: "ach",
          })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const card = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "commission:paid");
    expect(card?.tone).toBe("ok");
    expect(card?.iconName).toBe("check-circle-2");
    expect(card?.occurred_at).toBe("2026-06-22T12:00:00Z");
    expect(card?.detail).toBe("Paid via ACH direct deposit.");
  });

  it("'Commission disputed' fires only when status='disputed'", () => {
    const r = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({ commission_status: "disputed" })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const card = r.groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === "commission:disputed");
    expect(card?.tone).toBe("warn");
    expect(card?.iconName).toBe("alert-triangle");
  });

  it("cards sort chronologically alongside other timeline events (agent tier — synthesis path)", () => {
    // After W3.4.4.1 the broker tier skips synthesis (avoids duplicates
    // with /history). The chronological-merge contract still applies on
    // the AGENT tier where synthesis is the degraded fallback.
    // For this test we use agent tier (default in `base()`) and merge
    // synthesized commission cards alongside a synthetic milestone.
    const r = composeTimelineState(
      base({
        // Inject a "paperwork-event" via the agent milestone path by
        // closingDate (it's the only history-like event the agent path
        // emits with a real timestamp).
        closingDate: "2026-06-21T10:00:00Z",
        transactionStatus: "closed",
        commission: okFetch(
          safeCommissionFx({
            commission_status: "paid",
            approved_at: "2026-06-20T10:00:00Z",
            paid_at: "2026-06-22T10:00:00Z",
            payment_method: "ach",
          })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const ordered = r.groups.flatMap((g) =>
      g.cards.map((c) => ({ id: c.id, at: c.occurred_at }))
    );
    const positions = {
      paid: ordered.findIndex((c) => c.id === "commission:paid"),
      closing: ordered.findIndex((c) => c.id === "milestone:closing-date"),
      approved: ordered.findIndex((c) => c.id === "commission:approved"),
    };
    // Cards across days flatten in DESC order:
    //   paid (6/22) → closing-date (6/21) → approved (6/20)
    expect(positions.paid).toBeLessThan(positions.closing);
    expect(positions.closing).toBeLessThan(positions.approved);
  });

  it("cards group by day via existing groupByDay (no commission-specific logic)", () => {
    const r = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({
            commission_status: "paid",
            approved_at: "2026-06-20T10:00:00Z",
            paid_at: "2026-06-26T10:00:00Z",
            payment_method: "ach",
          })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    // Paid card on 6/26 (Today), Approved on 6/20 (older)
    const todayGroup = r.groups.find((g) => g.label === "Today");
    expect(todayGroup?.cards.some((c) => c.id === "commission:paid")).toBe(true);
    const olderGroup = r.groups.find((g) => g.dateKey === "2026-06-20");
    expect(olderGroup?.cards.some((c) => c.id === "commission:approved")).toBe(
      true
    );
  });

  it("Commission filter chip is present in broker tier (6th chip)", () => {
    const r = composeTimelineState(
      base({
        callerRole: "broker",
        history: { kind: "broker", cards: [] },
        commission: okFetch(
          safeCommissionFx({ commission_status: "calculated" })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    expect(r.filterChips.length).toBe(6);
    expect(r.filterChips.map((c) => c.key)).toContain("commission");
  });

  it("SAFETY: serialized commission cards never leak amount/Stripe/notes seed strings", () => {
    const r = composeTimelineState(
      base({
        commission: okFetch(
          safeCommissionFx({
            commission_status: "paid",
            paid_at: "2026-06-22T12:00:00Z",
            payment_method: "ach",
            payment_reference_tail: "4821",
            has_statement: true,
          }),
          verdictFx({
            payable: false,
            blockers: [
              { key: "compliance_not_passed", label: "compliance fail", current: "issues_found" },
            ],
          })
        ),
        workspaceBaseUrl: "/workspace/txn-1",
      })
    );
    const commissionCards = r.groups
      .flatMap((g) => g.cards)
      .filter((c) => c.kind === "commission");
    const ser = JSON.stringify(commissionCards);
    const FORBIDDEN = [
      "net_commission",
      "agent_amount",
      "brokerage_amount",
      "agent_split_pct",
      "cap_applied",
      "cap_remaining",
      "stripe_payout_id",
      "payment_reference",   // raw full-length reference must not leak; tail-only allowed but lives in SafeCommissionRow not in cards
      "revision_notes",
      "coaching_notes",
      "flood_history",
    ];
    for (const f of FORBIDDEN) {
      expect(ser).not.toContain(f);
    }
  });
});

// ── Boundary lint ───────────────────────────────────────────────────

describe("Workflow 3.3.1 boundary lint", () => {
  const FILES = [
    "src/portal/workspace/timeline/types.ts",
    "src/portal/workspace/timeline/safe-history-event.ts",
    "src/portal/workspace/timeline/api.ts",
    "src/portal/workspace/timeline/compose-timeline.ts",
    "src/portal/workspace/tabs/TimelineTab.tsx",
    "app/(portal)/workspace/[transactionId]/page.tsx",
  ];

  function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  it("no /api/commissions calls in scope (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = stripComments(
        fs.readFileSync(path.join(process.cwd(), f), "utf-8")
      );
      expect(src).not.toMatch(/\/api\/commissions/);
    }
  });

  it("no /api/stripe calls in scope (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = stripComments(
        fs.readFileSync(path.join(process.cwd(), f), "utf-8")
      );
      expect(src).not.toMatch(/\/api\/stripe/);
    }
  });

  it("no mutation HTTP methods", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    }
  });

  it("no Supabase write chains in timeline module", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const W331_FILES = FILES.slice(0, 5);
    for (const f of W331_FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.insert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.update\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.upsert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.delete\(/);
      expect(src).not.toMatch(/\.rpc\(['"]/);
    }
  });

  it("api.ts is the ONLY file that hits /history, and only inside isBrokerTier gate", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const apiSrc = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/timeline/api.ts"),
      "utf-8"
    );
    // Hits /history
    expect(apiSrc).toMatch(/\/paperwork\/transactions\/\$\{[^}]+\}\/history/);
    // Has isBrokerTier gate BEFORE the fetch
    expect(apiSrc).toMatch(/isBrokerTier/);
    expect(apiSrc).toMatch(/if\s*\(\s*!isBrokerTier[\s\S]{0,200}?return\s*\{\s*kind:\s*['"]skip['"]/);
    // Other timeline files MUST NOT reference /history at all (code)
    for (const f of [
      "src/portal/workspace/timeline/compose-timeline.ts",
      "src/portal/workspace/timeline/safe-history-event.ts",
      "src/portal/workspace/timeline/types.ts",
      "src/portal/workspace/tabs/TimelineTab.tsx",
    ]) {
      const src = stripComments(
        fs.readFileSync(path.join(process.cwd(), f), "utf-8")
      );
      expect(src).not.toMatch(/\/history/);
    }
  });

  it("no broker-only field names in composer / types / safe-event (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const composerFiles = [
      "src/portal/workspace/timeline/types.ts",
      "src/portal/workspace/timeline/safe-history-event.ts",
      "src/portal/workspace/timeline/compose-timeline.ts",
    ];
    // W3.4.3.2 — commission_status is a SAFE-projection enum field
    // (introduced via SafeCommissionRow in W3.4.3.1). It is read by
    // the lifecycle synthesizer and is intentionally NOT forbidden.
    // The remaining names ARE broker-only — never appear here.
    const FORBIDDEN = [
      "net_commission",
      "agent_amount",
      "agent_split_pct",
      "brokerage_amount",
      "cap_applied",
      "cap_remaining_before",
      "cap_remaining_after",
      "stripe_payout_id",
      "payment_reference", // raw full string; tail-only via SafeCommissionRow is OK
      "revision_notes",
      "coaching_notes",
    ];
    for (const f of composerFiles) {
      const src = stripComments(
        fs.readFileSync(path.join(process.cwd(), f), "utf-8")
      );
      for (const field of FORBIDDEN) {
        expect(src.includes(field)).toBe(false);
      }
    }
  });

  it("TimelineTab has no forbidden action labels", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/TimelineTab.tsx"),
      "utf-8"
    );
    const FORBIDDEN = [
      ">Generate PDF<",
      ">Send Envelope<",
      ">Send envelope<",
      ">Approve<",
      ">Reject<",
      ">Release Commission<",
      ">Pay Commission<",
      ">Pay Agent<",
      ">Release Payout<",
      ">Close Transaction<",
      ">Refresh<",
    ];
    for (const label of FORBIDDEN) {
      expect(src.includes(label)).toBe(false);
    }
  });

  it("TimelineTab has no <button onClick=…>", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/TimelineTab.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/<button[\s\S]{0,500}?onClick=/);
  });

  it("composer + types + safe-event are pure (no fetch / DOM / 'use client')", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pureFiles = [
      "src/portal/workspace/timeline/types.ts",
      "src/portal/workspace/timeline/safe-history-event.ts",
      "src/portal/workspace/timeline/compose-timeline.ts",
    ];
    for (const f of pureFiles) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\bfetch\(/);
      expect(src).not.toMatch(/window\./);
      expect(src).not.toMatch(/document\./);
      expect(src).not.toMatch(/^["']use client["']/m);
    }
  });

  it("api.ts requires 'server-only'", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/timeline/api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  it("page preserves cross-tenant safety", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/notFound\(\)/);
    expect(src).toMatch(/parseTab/);
    expect(src).toMatch(/parseFormId/);
    expect(src).toMatch(/scope:\s*['"]office['"]/);
  });

  it("page only composes TimelineTab state when tab='timeline'", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/activeTab\s*===\s*["']timeline["']/);
  });

  it("no new app/api/* routes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const apiDir = path.join(process.cwd(), "app", "api");
    if (fs.existsSync(apiDir)) {
      // W3.3.1 created no timeline route. AGENT.SIGN.1C intentionally added
      // app/api/paperwork/checklist; guard nothing else under paperwork.
      const pwDir = path.join(apiDir, "paperwork");
      if (fs.existsSync(pwDir)) {
        expect(fs.readdirSync(pwDir).sort()).toEqual(["checklist"]);
      }
      expect(fs.existsSync(path.join(apiDir, "timeline"))).toBe(false);
    }
  });
});

// ============================================================================
// W3.4.6.4 — coach.* timeline event mapping
// ============================================================================
// The mapper short-circuits on field_path prefix 'coach.' BEFORE the
// generic source switch and emits cards with kind='coach'. Vault has
// not yet started dispatching paperwork_audit_log rows with this
// field_path, so these tests are forward-compat: they prove the
// mapper is ready for the future emission without coupling to a
// specific Coach event taxonomy. Same precedent as W3.4.4.1
// commission.* short-circuit landed before Vault emitted those.

describe("W3.4.6.4 — coach.* timeline mapping", () => {
  const ctx = { transactionId: "t-coach-1" };

  it("maps a known coach.* field_path to kind='coach' with a Portal-owned label", () => {
    const card = toSafeTimelineCard(
      {
        kind: "audit",
        id: "evt-1",
        created_at: "2026-06-29T12:00:00Z",
        field_path: "coach.recommendation_emitted",
        source: "broker_review",
      },
      ctx
    );
    expect(card).not.toBeNull();
    expect(card?.kind).toBe("coach");
    expect(card?.label).toBe("Coach recommendation emitted");
    expect(card?.tone).toBe("info");
    // Drill href is local /workspace/<id> only; never external.
    expect(card?.drillHref).toBe(`/workspace/${ctx.transactionId}`);
    // Source preserved for broker-tier filter chips.
    expect(card?.source).toBe("broker_review");
  });

  it("falls back to a safe generic label for unknown coach.* field_paths", () => {
    const card = toSafeTimelineCard(
      {
        kind: "audit",
        id: "evt-2",
        created_at: "2026-06-29T12:05:00Z",
        field_path: "coach.future_event_we_dont_know_yet",
        source: "broker_review",
      },
      ctx
    );
    expect(card).not.toBeNull();
    expect(card?.kind).toBe("coach");
    expect(card?.label).toBe("Coach activity");
    // The unknown-suffix path MUST NOT render the raw field_path string
    // — that would surface internal taxonomy.
    expect(card?.label).not.toContain("future_event_we_dont_know_yet");
    expect(card?.label).not.toContain("coach.");
  });

  it("does NOT include forbidden tokens in the rendered card (safety)", () => {
    const card = toSafeTimelineCard(
      {
        kind: "audit",
        id: "evt-3",
        created_at: "2026-06-29T12:10:00Z",
        field_path: "coach.recommendation_emitted",
        source: "broker_review",
        // Hostile extras the mapper MUST NOT propagate. We never parse
        // new_value, so this is double-belt-and-suspenders.
        new_value: {
          net_commission: "leak-net",
          stripe_payout_id: "leak-stripe",
          flood_history: "leaked",
          client_email: "leak@example.com",
        },
      } as never,
      ctx
    );
    expect(card).not.toBeNull();
    const ser = JSON.stringify(card);
    for (const f of [
      "net_commission",
      "stripe_payout_id",
      "flood_history",
      "lead_paint",
      "client_email",
      "leak-net",
      "leak-stripe",
      "leak@example.com",
      "transaction_path",
    ]) {
      expect(ser).not.toContain(f);
    }
    expect(ser).not.toMatch(/facts\./);
    expect(ser).not.toMatch(/terms\./);
  });

  it("commission.* events still route to kind='commission' (no regression)", () => {
    // Sanity: coach.* short-circuit must NOT poach commission.* events.
    const c = toSafeTimelineCard(
      {
        kind: "audit",
        id: "evt-4",
        created_at: "2026-06-29T12:15:00Z",
        field_path: "commission.calculated",
        source: "broker_review",
      },
      ctx
    );
    expect(c?.kind).toBe("commission");
    expect(c?.label).toBe("Commission calculated");
  });
});
