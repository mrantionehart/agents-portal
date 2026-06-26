/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.2 — Compliance tab tests
// ============================================================================

import type { DocumentRow, RequirementRow } from "../../../documents/types";
import type { MissingFieldsItem } from "../../../documents/details/types";
import {
  composeComplianceTabState,
  type ComposeComplianceInputs,
} from "../compose-compliance-tab";
import {
  AGENT_SAFE_CHECK_IDS,
  toSafePayoutReadiness,
} from "../safe-payout-readiness";
import type { WorkspaceCard } from "../../types";

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

function makeDoc(form_id: string, over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    form_id,
    form_revision: null,
    form_category: null,
    reason: null,
    status: "in_progress",
    missing_fields_count: 0,
    has_envelope: false,
    signed_at: null,
    updated_at: null,
    has_instance: false,
    open_in_vault_url: `https://vault.example.com/p/${form_id}`,
    ...over,
  };
}

function base(
  over: Partial<ComposeComplianceInputs> = {}
): ComposeComplianceInputs {
  return {
    card: makeCard(),
    missingItems: [],
    satisfiedStatutoryPaths: [],
    statutoryCount: 0,
    documents: [],
    requirements: [],
    transactionStatus: null,
    brokerReviewStatus: null,
    closingDate: null,
    payoutReadiness: null,
    paperworkPackageUrl: "https://vault.example.com/paperwork/txn-1",
    ...over,
  };
}

// ── toSafePayoutReadiness ───────────────────────────────────────────

describe("toSafePayoutReadiness", () => {
  it("returns blocked + score=0 for empty input", () => {
    const r = toSafePayoutReadiness({});
    expect(r.overallStatus).toBe("blocked");
    expect(r.score).toBe(0);
    Object.values(r.gates).forEach((s) => expect(s).toBe("not_tracked"));
  });
  it("preserves only the 7 allowlisted check ids", () => {
    const raw = {
      status: "partial",
      score: 67.5,
      checks: [
        { id: "transaction_status_valid", status: "ok" },
        { id: "closing_date_present", status: "warning" },
        { id: "compliance_checklist_complete", status: "blocked" },
        { id: "documents_uploaded", status: "ok" },
        { id: "agent_profile_complete", status: "ok" },
        { id: "agent_payout_method", status: "not_tracked" },
        { id: "tax_info_w9", status: "not_tracked" },
        // disallowed — must be dropped
        { id: "approval_exists", status: "blocked" },
        { id: "approval_status_correct", status: "blocked" },
        { id: "ledger_snapshot_is_latest", status: "blocked" },
        { id: "brokerage_commission_math_confirmed", status: "blocked" },
        { id: "cap_ledger_materialized", status: "blocked" },
        { id: "no_stale_projection_warning", status: "blocked" },
        { id: "no_unresolved_revision_request", status: "blocked" },
      ],
      blockers: ["Broker note that must not leak"],
      warnings: ["Broker warning that must not leak"],
    };
    const r = toSafePayoutReadiness(raw);
    expect(r.overallStatus).toBe("partial");
    expect(r.score).toBe(68); // rounded
    expect(r.gates.transaction_status_valid).toBe("ok");
    expect(r.gates.closing_date_present).toBe("warning");
    expect(r.gates.compliance_checklist_complete).toBe("blocked");
    expect(r.gates.documents_uploaded).toBe("ok");
    // Disallowed IDs do not appear in the safe shape (its type doesn't include them).
    // Confirm by serializing and checking we don't carry broker text.
    const ser = JSON.stringify(r);
    expect(ser).not.toContain("approval_exists");
    expect(ser).not.toContain("approval_status_correct");
    expect(ser).not.toContain("ledger_snapshot");
    expect(ser).not.toContain("brokerage_commission_math");
    expect(ser).not.toContain("cap_ledger");
    expect(ser).not.toContain("stale_projection");
    expect(ser).not.toContain("revision_request");
    expect(ser).not.toContain("must not leak");
  });
  it("clamps score 0..100 and rounds", () => {
    expect(toSafePayoutReadiness({ score: 150 }).score).toBe(100);
    expect(toSafePayoutReadiness({ score: -10 }).score).toBe(0);
    expect(toSafePayoutReadiness({ score: 33.4 }).score).toBe(33);
    expect(toSafePayoutReadiness({ score: 33.5 }).score).toBe(34);
  });
  it("coerces invalid gate status to not_tracked", () => {
    const r = toSafePayoutReadiness({
      checks: [{ id: "transaction_status_valid", status: "garbage" }],
    });
    expect(r.gates.transaction_status_valid).toBe("not_tracked");
  });
  it("coerces invalid overall status to blocked", () => {
    expect(toSafePayoutReadiness({ status: "weird" }).overallStatus).toBe("blocked");
  });
  it("exports exactly 7 allowed check ids", () => {
    expect(AGENT_SAFE_CHECK_IDS).toHaveLength(7);
    expect([...AGENT_SAFE_CHECK_IDS].sort()).toEqual([
      "agent_payout_method",
      "agent_profile_complete",
      "closing_date_present",
      "compliance_checklist_complete",
      "documents_uploaded",
      "tax_info_w9",
      "transaction_status_valid",
    ]);
  });
});

// ── composeComplianceTabState ───────────────────────────────────────

describe("composeComplianceTabState — readiness header", () => {
  it("mirrors card readiness fields", () => {
    const r = composeComplianceTabState(
      base({
        card: makeCard({
          readiness_score: 78,
          readiness_tier: "ready_for_review",
          stage: "Almost done",
          next_action: "Submit for review",
          suggested_prompt: "Click submit",
        }),
      })
    );
    expect(r.readiness.score).toBe(78);
    expect(r.readiness.tier).toBe("ready_for_review");
    expect(r.readiness.stage).toBe("Almost done");
    expect(r.readiness.nextAction).toBe("Submit for review");
  });
});

describe("composeComplianceTabState — blockers", () => {
  it("surfaces statutory missing items", () => {
    const r = composeComplianceTabState(
      base({
        missingItems: [
          {
            transaction_path: "facts.flood_history",
            severity: "statutory_must_be_seller",
            completer_role: "seller",
            blocks_forms: ["RLHD-3x"],
          },
        ] as MissingFieldsItem[],
      })
    );
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0].key).toBe("statutory:facts.flood_history");
    expect(r.blockers[0].label).toContain("Flood history");
  });
  it("surfaces high-severity non-statutory with CTA", () => {
    const r = composeComplianceTabState(
      base({
        missingItems: [
          {
            transaction_path: "terms.lease.rent.monthly_amount",
            severity: "high",
            completer_role: "agent",
            blocks_forms: ["RLHD-3x"],
            label: "Monthly rent",
          },
        ] as MissingFieldsItem[],
      })
    );
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0].cta).toBeTruthy();
    expect(r.blockers[0].cta!.href).toContain("form=RLHD-3x");
  });
  it("includes blocked forms even when no missing-field item exists", () => {
    const r = composeComplianceTabState(
      base({
        documents: [makeDoc("CDS-1", { status: "blocked" })],
      })
    );
    expect(r.blockers.find((b) => b.key.startsWith("form-blocked:CDS-1"))).toBeTruthy();
  });
  it("surfaces revisions_required as a blocker", () => {
    const r = composeComplianceTabState(
      base({ brokerReviewStatus: "revisions_required" })
    );
    expect(r.blockers.find((b) => b.key === "broker:revisions")).toBeTruthy();
  });
  it("dedupes by key", () => {
    const r = composeComplianceTabState(
      base({
        missingItems: [
          {
            transaction_path: "facts.flood_history",
            severity: "statutory_must_be_seller",
            completer_role: "seller",
            blocks_forms: ["RLHD-3x"],
          },
          {
            transaction_path: "facts.flood_history",
            severity: "statutory_must_be_seller",
            completer_role: "seller",
            blocks_forms: ["RLHD-3x"],
          },
        ] as MissingFieldsItem[],
      })
    );
    expect(r.blockers.filter((b) => b.key === "statutory:facts.flood_history"))
      .toHaveLength(1);
  });
  it("empty when no blockers", () => {
    expect(composeComplianceTabState(base()).blockers).toEqual([]);
  });
});

describe("composeComplianceTabState — warnings", () => {
  it("closing date missing", () => {
    const r = composeComplianceTabState(base({ closingDate: null }));
    expect(r.warnings.find((w) => w.key === "closing-date-missing")).toBeTruthy();
  });
  it("pre-close staging", () => {
    const r = composeComplianceTabState(
      base({ transactionStatus: "approved", closingDate: "2026-12-31" })
    );
    expect(r.warnings.find((w) => w.key === "pre-close")).toBeTruthy();
  });
  it("payout-readiness not_tracked items surface as warnings", () => {
    const r = composeComplianceTabState(
      base({
        closingDate: "2026-12-31",
        payoutReadiness: toSafePayoutReadiness({
          status: "partial",
          score: 50,
          checks: [
            { id: "agent_payout_method", status: "not_tracked" },
            { id: "tax_info_w9", status: "not_tracked" },
          ],
        }),
      })
    );
    expect(r.warnings.find((w) => w.key === "payout-method")).toBeTruthy();
    expect(r.warnings.find((w) => w.key === "tax-info")).toBeTruthy();
  });
});

describe("composeComplianceTabState — required forms", () => {
  it("maps each document to a row with drawer href + Vault href", () => {
    const r = composeComplianceTabState(
      base({
        documents: [
          makeDoc("RLHD-3x", { status: "ready" }),
          makeDoc("CL-11", { status: "signed" }),
        ],
        requirements: [
          { form_id: "RLHD-3x", reason: "FL §83.512" },
          { form_id: "CL-11" },
        ] as RequirementRow[],
      })
    );
    expect(r.requiredForms).toHaveLength(2);
    expect(r.requiredForms[0].form_id).toBe("RLHD-3x");
    expect(r.requiredForms[0].reason).toBe("FL §83.512");
    expect(r.requiredForms[0].drawerHref).toContain("form=RLHD-3x");
    expect(r.requiredForms[1].status).toBe("signed");
  });
});

describe("composeComplianceTabState — statutory disclosures", () => {
  it("only surfaces statutory keys referenced in missing OR satisfied", () => {
    const r = composeComplianceTabState(
      base({
        missingItems: [
          {
            transaction_path: "facts.flood_history",
            severity: "statutory_must_be_seller",
            completer_role: "seller",
            blocks_forms: ["RLHD-3x"],
          },
        ] as MissingFieldsItem[],
        satisfiedStatutoryPaths: ["facts.lead_paint_knowledge"],
      })
    );
    expect(r.statutory.map((s) => s.transaction_path).sort()).toEqual([
      "facts.flood_history",
      "facts.lead_paint_knowledge",
    ]);
    expect(r.statutory.find((s) => s.transaction_path === "facts.lead_paint_knowledge")!.satisfied).toBe(true);
    expect(r.statutory.find((s) => s.transaction_path === "facts.flood_history")!.satisfied).toBe(false);
  });
});

describe("composeComplianceTabState — broker review", () => {
  it.each<[string | null, string, string]>([
    ["draft", "muted", "Not yet submitted"],
    ["submitted", "info", "Awaiting broker review"],
    ["approved", "ok", "Approved by broker"],
    ["revisions_required", "warn", "Broker requested revisions"],
  ])("maps %s → %s / %s", (status, tone, label) => {
    const r = composeComplianceTabState(base({ brokerReviewStatus: status }));
    expect(r.brokerReview.pill.tone).toBe(tone);
    expect(r.brokerReview.pill.label).toBe(label);
  });
  it("null status → muted", () => {
    expect(
      composeComplianceTabState(base({ brokerReviewStatus: null })).brokerReview.pill.tone
    ).toBe("muted");
  });
});

describe("composeComplianceTabState — envelope summary", () => {
  it("derives counts from card", () => {
    const r = composeComplianceTabState(
      base({
        card: makeCard({
          pending_envelopes_count: 2,
          signed_forms_count: 3,
          ready_forms_count: 5,
        }),
      })
    );
    expect(r.envelope.pending).toBe(2);
    expect(r.envelope.signed).toBe(3);
    expect(r.envelope.ready_awaiting_send).toBe(3);
  });
  it("clamps ready_awaiting_send to >= 0", () => {
    const r = composeComplianceTabState(
      base({
        card: makeCard({ pending_envelopes_count: 5, ready_forms_count: 2 }),
      })
    );
    expect(r.envelope.ready_awaiting_send).toBe(0);
  });
});

describe("composeComplianceTabState — readiness gates", () => {
  it("composed 4 gates always present", () => {
    const r = composeComplianceTabState(base());
    const keys = r.gates.map((g) => g.key);
    expect(keys).toContain("transaction-closed");
    expect(keys).toContain("broker-review-approved");
    expect(keys).toContain("required-forms-complete");
    expect(keys).toContain("statutory-complete");
  });
  it("transaction-closed → ok when status=closed", () => {
    const r = composeComplianceTabState(base({ transactionStatus: "closed" }));
    expect(r.gates.find((g) => g.key === "transaction-closed")!.status).toBe("ok");
  });
  it("appends 6 payout-readiness gates when available", () => {
    const r = composeComplianceTabState(
      base({
        payoutReadiness: toSafePayoutReadiness({ status: "ready", score: 100 }),
      })
    );
    const prKeys = r.gates.filter((g) => g.key.startsWith("payout-readiness:"));
    expect(prKeys).toHaveLength(6);
  });
  it("no payout-readiness gates when fetch failed", () => {
    const r = composeComplianceTabState(base({ payoutReadiness: null }));
    expect(r.gates.filter((g) => g.key.startsWith("payout-readiness:")))
      .toHaveLength(0);
    expect(r.payoutReadinessDegraded).toBe(true);
  });
});

// ── Boundary lint ───────────────────────────────────────────────────

describe("Workflow 3.2.C.2 boundary lint — read-only + safety", () => {
  const FILES = [
    "src/portal/workspace/compliance/types.ts",
    "src/portal/workspace/compliance/safe-payout-readiness.ts",
    "src/portal/workspace/compliance/api.ts",
    "src/portal/workspace/compliance/compose-compliance-tab.ts",
    "src/portal/workspace/tabs/ComplianceTab.tsx",
    "app/(portal)/workspace/[transactionId]/page.tsx",
  ];

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }

  it("no /api/commissions calls (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = stripComments(fs.readFileSync(path.join(process.cwd(), f), "utf-8"));
      expect(src).not.toMatch(/\/api\/commissions/);
    }
  });

  it("no /api/stripe calls (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = stripComments(fs.readFileSync(path.join(process.cwd(), f), "utf-8"));
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

  it("no Supabase write chains in W3.2.C.2 files", async () => {
    const fs = await import("fs");
    const path = await import("path");
    // Excludes page.tsx which has the existing SELECT chain
    const W32C2_FILES = FILES.slice(0, 5);
    for (const f of W32C2_FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.insert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.update\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.upsert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.delete\(/);
      expect(src).not.toMatch(/\.rpc\(['"]/);
    }
  });

  it("no broker-only field names in composer / safe-projection / types (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const composerFiles = [
      "src/portal/workspace/compliance/types.ts",
      "src/portal/workspace/compliance/safe-payout-readiness.ts",
      "src/portal/workspace/compliance/compose-compliance-tab.ts",
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
      const src = stripComments(fs.readFileSync(path.join(process.cwd(), f), "utf-8"));
      for (const field of FORBIDDEN) {
        expect(src.includes(field)).toBe(false);
      }
    }
  });

  it("no forbidden action labels in ComplianceTab JSX", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/ComplianceTab.tsx"),
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

  it("ComplianceTab has no <button onClick=…>", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/ComplianceTab.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/<button[\s\S]{0,500}?onClick=/);
  });

  it("composer is pure — no fetch / DOM / 'use client'", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const composerFiles = [
      "src/portal/workspace/compliance/safe-payout-readiness.ts",
      "src/portal/workspace/compliance/compose-compliance-tab.ts",
    ];
    for (const f of composerFiles) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\bfetch\(/);
      expect(src).not.toMatch(/window\./);
      expect(src).not.toMatch(/document\./);
      expect(src).not.toMatch(/^["']use client["']/m);
    }
  });

  it("api.ts requires 'server-only' and hits only /payout-readiness", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/compliance/api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).toMatch(/payout-readiness/);
    expect(src).not.toMatch(/\/api\/commissions/);
    expect(src).not.toMatch(/\/api\/stripe/);
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("page preserves cross-tenant safety (parseTab + parseFormId + notFound + office scope)", async () => {
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

  it("page only composes ComplianceTab state when tab is active", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/activeTab\s*===\s*["']compliance["']/);
  });
});
