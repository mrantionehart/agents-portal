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
    const FORBIDDEN = [
      "net_commission",
      "agent_split_pct",
      "brokerage_amount",
      "cap_applied",
      "stripe_payout_id",
      "payment_reference",
      "revision_notes",
      "coaching_notes",
      "commission_status",
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
      // No new paperwork or timeline app/api subpaths created by W3.3.1
      expect(fs.existsSync(path.join(apiDir, "paperwork"))).toBe(false);
      expect(fs.existsSync(path.join(apiDir, "timeline"))).toBe(false);
    }
  });
});
