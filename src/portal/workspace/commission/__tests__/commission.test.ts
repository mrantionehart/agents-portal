/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.4.3.1 — Commission Workspace tests
// ============================================================================

import { toSafeCommissionRow, pickCurrentCommission } from "../safe-commission";
import type { RawCommissionRow } from "../safe-commission";
import {
  composeCommissionState,
  type ComposeCommissionInputs,
} from "../compose-commission";
import type { FetchCommissionResult } from "../api";
import type {
  CommissionGateVerdict,
  SafeCommissionRow,
} from "../types";

const TXN_ID = "11111111-1111-1111-1111-111111111111";
const COMM_ID = "22222222-2222-2222-2222-222222222222";

function rawCommissionFixture(
  over: Partial<RawCommissionRow> = {}
): RawCommissionRow {
  return {
    id: COMM_ID,
    transaction_id: TXN_ID,
    commission_status: "broker_approved",
    approved_at: "2026-06-20T10:00:00Z",
    paid_at: null,
    payment_method: null,
    payment_reference: "HF-RT5XKZ7Q-4821",
    commission_statement_url: null,
    // Broker-only fields — SHOULD be dropped by the safe projection:
    net_commission: 8500,
    agent_amount: 8000,
    brokerage_amount: 500,
    agent_split_pct: 80,
    gross_commission: 10000,
    cap_applied: true,
    cap_remaining_before: 5000,
    cap_remaining_after: 1500,
    stripe_payout_id: "tr_secret",
    notes: "broker only context",
    ...over,
  };
}

function safeCommissionFixture(
  over: Partial<SafeCommissionRow> = {}
): SafeCommissionRow {
  return {
    id: COMM_ID,
    transaction_id: TXN_ID,
    commission_status: "broker_approved",
    approved_at: "2026-06-20T10:00:00Z",
    paid_at: null,
    payment_method: null,
    payment_reference_tail: "4821",
    has_statement: false,
    ...over,
  };
}

function verdictFixture(
  over: Partial<CommissionGateVerdict> = {}
): CommissionGateVerdict {
  return {
    commission_id: COMM_ID,
    transaction_id: TXN_ID,
    commission_status: "broker_approved",
    payable: false,
    blockers: [],
    ts: "2026-06-26T15:00:00Z",
    ...over,
  };
}

function baseInputs(
  over: Partial<ComposeCommissionInputs> = {}
): ComposeCommissionInputs {
  return {
    fetchResult: { kind: "empty" },
    transactionStatus: null,
    brokerReviewStatus: null,
    complianceOverallStatus: null,
    closingDate: null,
    workspaceBaseUrl: `/workspace/${TXN_ID}`,
    paperworkPackageUrl: "https://vault.example.com/paperwork/" + TXN_ID,
    ...over,
  };
}

// ── safe-commission ─────────────────────────────────────────────────

describe("toSafeCommissionRow", () => {
  it("strips broker-only fields and produces safe projection", () => {
    const raw = rawCommissionFixture();
    const safe = toSafeCommissionRow(raw);
    expect(safe).toEqual({
      id: COMM_ID,
      transaction_id: TXN_ID,
      commission_status: "broker_approved",
      approved_at: "2026-06-20T10:00:00Z",
      paid_at: null,
      payment_method: null,
      payment_reference_tail: "4821",
      has_statement: false,
    });
  });

  it("never returns net_commission / agent_amount / brokerage / stripe / notes in serialized output", () => {
    const safe = toSafeCommissionRow(rawCommissionFixture());
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain("net_commission");
    expect(serialized).not.toContain("agent_amount");
    expect(serialized).not.toContain("brokerage_amount");
    expect(serialized).not.toContain("agent_split_pct");
    expect(serialized).not.toContain("gross_commission");
    expect(serialized).not.toContain("cap_applied");
    expect(serialized).not.toContain("cap_remaining");
    expect(serialized).not.toContain("stripe_payout_id");
    expect(serialized).not.toContain("tr_secret");
    expect(serialized).not.toContain("8500");
    expect(serialized).not.toContain("8000");
    expect(serialized).not.toContain("500");
    expect(serialized).not.toContain("80");
    expect(serialized).not.toContain("notes");
    expect(serialized).not.toContain("broker only context");
  });

  it("payment_reference is masked to last 4 chars only", () => {
    const safe = toSafeCommissionRow(
      rawCommissionFixture({ payment_reference: "HF-FULL-SECRET-1234" })
    );
    expect(safe?.payment_reference_tail).toBe("1234");
    expect(JSON.stringify(safe)).not.toContain("HF-FULL-SECRET");
    expect(JSON.stringify(safe)).not.toContain("SECRET");
  });

  it("returns null for missing id / transaction_id / commission_status", () => {
    expect(toSafeCommissionRow(null)).toBeNull();
    expect(toSafeCommissionRow({})).toBeNull();
    expect(toSafeCommissionRow({ id: "x" })).toBeNull();
    expect(toSafeCommissionRow({ id: "x", transaction_id: "y" })).toBeNull();
  });

  it("has_statement is boolean only (URL not exposed)", () => {
    const safe = toSafeCommissionRow(
      rawCommissionFixture({
        commission_statement_url: "https://broker-only.example/statement.pdf",
      })
    );
    expect(safe?.has_statement).toBe(true);
    expect(JSON.stringify(safe)).not.toContain("statement.pdf");
    expect(JSON.stringify(safe)).not.toContain("broker-only.example");
  });
});

describe("pickCurrentCommission", () => {
  it("returns null for empty / invalid input", () => {
    expect(pickCurrentCommission(null, TXN_ID)).toBeNull();
    expect(pickCurrentCommission([], TXN_ID)).toBeNull();
  });

  it("filters by transaction_id", () => {
    const r = pickCurrentCommission(
      [
        rawCommissionFixture({ transaction_id: "other", id: "c-other" }),
        rawCommissionFixture({ id: "c-mine" }),
      ],
      TXN_ID
    );
    expect(r?.id).toBe("c-mine");
  });

  it("prefers higher-status row (paid > broker_approved > calculated > pending)", () => {
    const r = pickCurrentCommission(
      [
        rawCommissionFixture({ id: "c-pending", commission_status: "pending_calculation" }),
        rawCommissionFixture({ id: "c-approved", commission_status: "broker_approved" }),
        rawCommissionFixture({ id: "c-paid", commission_status: "paid" }),
      ],
      TXN_ID
    );
    expect(r?.id).toBe("c-paid");
  });
});

// ── composer — empty / error / OK paths ─────────────────────────────

describe("composeCommissionState — empty", () => {
  it("renders 'Commission not yet calculated' empty state with all gate rows muted", () => {
    const s = composeCommissionState(baseInputs());
    expect(s.isEmpty).toBe(true);
    expect(s.commission).toBeNull();
    expect(s.stageLabel).toBe("Commission not yet calculated");
    expect(s.stageTone).toBe("muted");
    expect(s.gateRows).toHaveLength(7);
    expect(s.gateRows.every((r) => r.tone === "muted")).toBe(true);
    expect(s.payable).toBe(false);
    expect(s.paymentHistory).toBeNull();
    expect(s.drillLinks.paperworkPackage).toContain("vault.example.com");
  });
});

describe("composeCommissionState — error", () => {
  it("renders error state with the message + still shows muted gate rows", () => {
    const s = composeCommissionState(
      baseInputs({
        fetchResult: { kind: "error", message: "HTTP 500" },
      })
    );
    expect(s.isEmpty).toBe(true);
    expect(s.stageLabel).toBe("Commission unavailable");
    expect(s.gateFetchError).toBe("HTTP 500");
  });
});

describe("composeCommissionState — OK path", () => {
  function okInput(over: {
    verdict?: CommissionGateVerdict | null;
    commission?: SafeCommissionRow;
    verdictError?: string | null;
    rest?: Partial<ComposeCommissionInputs>;
  }): ComposeCommissionInputs {
    return baseInputs({
      fetchResult: {
        kind: "ok",
        commission: over.commission ?? safeCommissionFixture(),
        verdict: over.verdict ?? verdictFixture({ payable: true }),
        verdictError: over.verdictError ?? null,
      },
      ...over.rest,
    });
  }

  it("all-pass verdict → stage='Ready for broker payout', payable=true, 7/7", () => {
    const s = composeCommissionState(okInput({}));
    expect(s.payable).toBe(true);
    expect(s.stageLabel).toBe("Ready for broker payout");
    expect(s.stageTone).toBe("ok");
    expect(s.readinessScore).toEqual({ passing: 7, total: 7 });
    expect(s.gateRows.every((r) => r.tone === "ok")).toBe(true);
    expect(s.blockers).toEqual([]);
  });

  it("multi-blocker verdict → emits all 7 blockers; gate rows match", () => {
    const verdict = verdictFixture({
      payable: false,
      blockers: [
        { key: "transaction_not_closed", label: "Transaction status must be closed", current: "active" },
        { key: "broker_review_not_approved", label: "Broker review must be approved", current: "submitted" },
        { key: "compliance_not_passed", label: "Compliance check must be passed", current: "issues_found" },
        { key: "required_checklist_incomplete", label: "Required checklist items remaining", remaining: 3, total_required: 8 },
        { key: "required_forms_incomplete", label: "Required Florida forms not yet signed", remaining: 2, total_required: 7 },
        { key: "signatures_incomplete", label: "Envelopes awaiting signatures", remaining: 1 },
        { key: "statutory_attestations_incomplete", label: "Statutory disclosures awaiting party portal attestation", remaining: 4 },
      ],
    });
    const s = composeCommissionState(okInput({ verdict }));
    expect(s.payable).toBe(false);
    expect(s.readinessScore.passing).toBe(0);
    expect(s.gateRows.every((r) => r.tone === "warn")).toBe(true);
    expect(s.blockers).toHaveLength(7);
    expect(s.stageLabel).toMatch(/Approved — blocked by 7/);
  });

  it("partial blockers → readiness score reflects passing count", () => {
    const verdict = verdictFixture({
      blockers: [
        { key: "transaction_not_closed", label: "Transaction status must be closed", current: "active" },
        { key: "signatures_incomplete", label: "Envelopes awaiting signatures", remaining: 1 },
      ],
    });
    const s = composeCommissionState(okInput({ verdict }));
    expect(s.readinessScore.passing).toBe(5);
    const warnRows = s.gateRows.filter((r) => r.tone === "warn").map((r) => r.key);
    expect(warnRows).toEqual(["transaction_not_closed", "signatures_incomplete"]);
  });

  it("commission_status='paid' → stage='Commission paid', payment history present", () => {
    const s = composeCommissionState(
      okInput({
        commission: safeCommissionFixture({
          commission_status: "paid",
          paid_at: "2026-06-24T12:00:00Z",
          payment_method: "ach",
          payment_reference_tail: "9921",
          has_statement: true,
        }),
        verdict: verdictFixture({ commission_status: "paid", payable: false }),
      })
    );
    expect(s.stageLabel).toBe("Commission paid");
    expect(s.stageTone).toBe("ok");
    expect(s.paymentHistory).toEqual({
      paidAt: "2026-06-24T12:00:00Z",
      methodLabel: "ACH direct deposit",
      referenceTail: "9921",
      hasStatement: true,
    });
  });

  it("commission_status='calculated' → stage='Commission in workflow'", () => {
    const s = composeCommissionState(
      okInput({
        commission: safeCommissionFixture({ commission_status: "calculated" }),
        verdict: verdictFixture({ commission_status: "calculated", payable: false }),
      })
    );
    expect(s.stageLabel).toBe("Commission in workflow");
    expect(s.stageTone).toBe("info");
  });

  it("commission_status='disputed' → stage='Commission disputed', tone=warn", () => {
    const s = composeCommissionState(
      okInput({
        commission: safeCommissionFixture({ commission_status: "disputed" }),
        verdict: verdictFixture({ commission_status: "disputed", payable: false }),
      })
    );
    expect(s.stageLabel).toBe("Commission disputed");
    expect(s.stageTone).toBe("warn");
  });

  it("broker review tone reflects status enum", () => {
    const matrix: Array<[string, "ok" | "warn" | "info" | "muted"]> = [
      ["approved", "ok"],
      ["revisions_required", "warn"],
      ["submitted", "info"],
      ["draft", "muted"],
    ];
    for (const [status, expected] of matrix) {
      const s = composeCommissionState(
        okInput({ rest: { brokerReviewStatus: status } })
      );
      expect(s.brokerReviewTone).toBe(expected);
    }
  });

  it("compliance tone reflects status enum", () => {
    const matrix: Array<[string, "ok" | "warn" | "muted"]> = [
      ["passed", "ok"],
      ["issues_found", "warn"],
      ["failed", "warn"],
      ["pending", "muted"],
    ];
    for (const [status, expected] of matrix) {
      const s = composeCommissionState(
        okInput({ rest: { complianceOverallStatus: status } })
      );
      expect(s.complianceTone).toBe(expected);
    }
  });

  it("closingDateLabel reads 'Closed <date>' when status=closed", () => {
    const s = composeCommissionState(
      okInput({
        rest: { closingDate: "2026-06-24", transactionStatus: "closed" },
      })
    );
    expect(s.closingDateLabel).toMatch(/^Closed Jun 24, 2026$/);
  });

  it("closingDateLabel reads 'Scheduled closing: <date>' when status != closed", () => {
    const s = composeCommissionState(
      okInput({
        rest: { closingDate: "2026-08-15", transactionStatus: "active" },
      })
    );
    expect(s.closingDateLabel).toMatch(/^Scheduled closing: Aug 15, 2026$/);
  });

  it("paymentHistory is null when commission has not been paid", () => {
    const s = composeCommissionState(okInput({}));
    expect(s.paymentHistory).toBeNull();
  });

  it("gate drill links route to local workspace tabs (no broker-only Vault routes)", () => {
    const s = composeCommissionState(okInput({}));
    for (const r of s.gateRows) {
      if (r.drillHref) {
        expect(r.drillHref.startsWith(`/workspace/${TXN_ID}`)).toBe(true);
        expect(r.drillHref).not.toContain("/api/");
        expect(r.drillHref).not.toContain("commissions");
      }
    }
  });
});

// ── Boundary lint over the W3.4.3.1 sources ─────────────────────────

describe("Workflow 3.4.3.1 boundary lint", () => {
  const FILES = [
    "src/portal/workspace/commission/types.ts",
    "src/portal/workspace/commission/safe-commission.ts",
    "src/portal/workspace/commission/api.ts",
    "src/portal/workspace/commission/compose-commission.ts",
    "src/portal/workspace/tabs/CommissionTab.tsx",
    "app/(portal)/workspace/[transactionId]/page.tsx",
  ];

  function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  async function loadAll() {
    const fs = await import("fs");
    const path = await import("path");
    const out: Record<string, { raw: string; code: string }> = {};
    for (const f of FILES) {
      const raw = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      out[f] = { raw, code: stripComments(raw) };
    }
    return out;
  }

  it("no calls to /api/commissions/pay anywhere in scope (code)", async () => {
    const files = await loadAll();
    for (const f of Object.keys(files)) {
      expect(files[f].code.includes("/api/commissions/pay")).toBe(false);
    }
  });

  it("no calls to /api/commissions/approve / calculate / delete / compliance-check (code)", async () => {
    const files = await loadAll();
    const FORBIDDEN_ENDPOINTS = [
      "/api/commissions/approve",
      "/api/commissions/calculate",
      "/api/commissions/delete",
      "/api/commissions/compliance-check",
      "/api/commissions/generate-statement",
    ];
    for (const f of Object.keys(files)) {
      for (const e of FORBIDDEN_ENDPOINTS) {
        expect(files[f].code.includes(e)).toBe(false);
      }
    }
  });

  it("no calls to /api/stripe in scope (code)", async () => {
    const files = await loadAll();
    for (const f of Object.keys(files)) {
      expect(files[f].code.includes("/api/stripe")).toBe(false);
    }
  });

  it("no mutation HTTP methods", async () => {
    const files = await loadAll();
    for (const f of Object.keys(files)) {
      expect(files[f].raw).not.toMatch(
        /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/
      );
    }
  });

  it("no Supabase write chains anywhere in scope", async () => {
    const files = await loadAll();
    for (const f of Object.keys(files)) {
      expect(files[f].raw).not.toMatch(
        /\.from\([^)]+\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\(/
      );
      expect(files[f].raw).not.toMatch(/\.rpc\(['"]/);
    }
  });

  it("commission api.ts is the ONLY scope file that references /api/commissions/* endpoints", async () => {
    const files = await loadAll();
    // api.ts must reference exactly the 2 read-only endpoints we need.
    const apiCode = files["src/portal/workspace/commission/api.ts"].code;
    expect(apiCode).toContain("/commissions/get");
    expect(apiCode).toContain("/commissions/");
    expect(apiCode).toContain("gate-verdict");
    // Every other file in scope must NOT reference /api/commissions or /commissions/.
    for (const f of [
      "src/portal/workspace/commission/types.ts",
      "src/portal/workspace/commission/safe-commission.ts",
      "src/portal/workspace/commission/compose-commission.ts",
      "src/portal/workspace/tabs/CommissionTab.tsx",
    ]) {
      const c = files[f].code;
      expect(c.includes("/api/commissions")).toBe(false);
      expect(c.includes("/commissions/get")).toBe(false);
      expect(c.includes("gate-verdict")).toBe(false);
    }
  });

  it("api.ts requires 'server-only'", async () => {
    const files = await loadAll();
    expect(files["src/portal/workspace/commission/api.ts"].raw).toMatch(
      /import\s+["']server-only["']/
    );
  });

  it("composer + safe-commission + types are pure (no fetch / DOM / 'use client')", async () => {
    const files = await loadAll();
    const pure = [
      "src/portal/workspace/commission/types.ts",
      "src/portal/workspace/commission/safe-commission.ts",
      "src/portal/workspace/commission/compose-commission.ts",
    ];
    for (const f of pure) {
      const r = files[f].raw;
      expect(r).not.toMatch(/\bfetch\(/);
      expect(r).not.toMatch(/window\./);
      expect(r).not.toMatch(/document\./);
      expect(r).not.toMatch(/^["']use client["']/m);
    }
  });

  it("no broker-only field NAMES in composer / types / safe-commission code", async () => {
    const files = await loadAll();
    const FORBIDDEN_FIELDS = [
      "net_commission",
      "agent_amount",
      "brokerage_amount",
      "agent_split_pct",
      "gross_commission",
      "cap_applied",
      "cap_remaining_before",
      "cap_remaining_after",
      "stripe_payout_id",
      "revision_notes",
      "coaching_notes",
      "approved_by",
    ];
    const checkedFiles = [
      "src/portal/workspace/commission/types.ts",
      "src/portal/workspace/commission/compose-commission.ts",
    ];
    for (const f of checkedFiles) {
      const code = files[f].code;
      for (const field of FORBIDDEN_FIELDS) {
        expect(code.includes(field)).toBe(false);
      }
    }
    // safe-commission.ts INTENTIONALLY names broker-only fields on the
    // RAW input type for documentation + tree-shaking the drop. Code in
    // it never reads those keys — assert no `raw.<field>` reads.
    const safeCode = files["src/portal/workspace/commission/safe-commission.ts"].code;
    for (const field of FORBIDDEN_FIELDS) {
      expect(safeCode).not.toMatch(new RegExp(`raw\\.${field}`));
    }
  });

  it("no forbidden action labels in CommissionTab.tsx", async () => {
    const files = await loadAll();
    const tab = files["src/portal/workspace/tabs/CommissionTab.tsx"].raw;
    const FORBIDDEN_LABELS = [
      ">Pay<",
      ">Approve<",
      ">Reject<",
      ">Release Commission<",
      ">Pay Commission<",
      ">Release Payout<",
      ">Pay Agent<",
      ">Close Transaction<",
      ">Generate PDF<",
      ">Generate Statement<",
      ">Override<",
      ">Refresh<",
    ];
    for (const label of FORBIDDEN_LABELS) {
      expect(tab.includes(label)).toBe(false);
    }
  });

  it("CommissionTab has no <button onClick=…>", async () => {
    const files = await loadAll();
    expect(
      files["src/portal/workspace/tabs/CommissionTab.tsx"].raw
    ).not.toMatch(/<button[\s\S]{0,500}?onClick=/);
  });

  it("page preserves cross-tenant safety helpers (notFound, parseTab, parseFormId, office scope)", async () => {
    const files = await loadAll();
    const page = files["app/(portal)/workspace/[transactionId]/page.tsx"].raw;
    expect(page).toMatch(/notFound\(\)/);
    expect(page).toMatch(/parseTab/);
    expect(page).toMatch(/parseFormId/);
    expect(page).toMatch(/scope:\s*['"]office['"]/);
  });

  it("page only composes Commission state when tab='commission'", async () => {
    const files = await loadAll();
    const page = files["app/(portal)/workspace/[transactionId]/page.tsx"].raw;
    expect(page).toMatch(/activeTab\s*===\s*["']commission["']/);
  });

  it("no new app/api routes added by W3.4.3.1", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const apiDir = path.join(process.cwd(), "app", "api");
    if (fs.existsSync(apiDir)) {
      expect(fs.existsSync(path.join(apiDir, "commissions"))).toBe(false);
      expect(fs.existsSync(path.join(apiDir, "stripe"))).toBe(false);
    }
  });
});
