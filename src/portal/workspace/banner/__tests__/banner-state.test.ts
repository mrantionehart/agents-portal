/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.1 — ComplianceBanner composer tests
// ============================================================================

import {
  type BannerSignals,
  brokerReviewStatus,
  commissionEligibility,
  complianceStatus,
  composeBannerState,
} from "../compose-banner-state";

function base(over: Partial<BannerSignals> = {}): BannerSignals {
  return {
    readiness_tier: "drafting",
    required_forms_count: 0,
    ready_forms_count: 0,
    signed_forms_count: 0,
    blocked_forms_count: 0,
    pending_envelopes_count: 0,
    portal_status: "none",
    broker_confirmation_required: true,
    statutory_count: 0,
    satisfied_statutory_count: 0,
    broker_review_status: null,
    transaction_status: null,
    ...over,
  };
}

describe("complianceStatus", () => {
  it("warn — blocked + statutory open", () => {
    const r = complianceStatus(base({ blocked_forms_count: 2, statutory_count: 3 }));
    expect(r.tone).toBe("warn");
    expect(r.label).toContain("statutory");
    expect(r.label).toContain("blocked");
  });

  it("warn — blocked only", () => {
    const r = complianceStatus(base({ blocked_forms_count: 1 }));
    expect(r.tone).toBe("warn");
    expect(r.label).toBe("1 form blocked");
  });

  it("warn — blocked only plural", () => {
    const r = complianceStatus(base({ blocked_forms_count: 3 }));
    expect(r.label).toBe("3 forms blocked");
  });

  it("warn — statutory only", () => {
    const r = complianceStatus(base({ statutory_count: 2 }));
    expect(r.tone).toBe("warn");
    expect(r.label).toContain("statutory");
  });

  it("ok — all required signed", () => {
    const r = complianceStatus(
      base({ required_forms_count: 5, signed_forms_count: 5 })
    );
    expect(r.tone).toBe("ok");
    expect(r.label).toBe("All required forms signed");
  });

  it("info — all required ready (awaiting envelope)", () => {
    const r = complianceStatus(
      base({ required_forms_count: 5, ready_forms_count: 5 })
    );
    expect(r.tone).toBe("info");
    expect(r.label).toBe("All required forms ready");
  });

  it("info — partial progress", () => {
    const r = complianceStatus(
      base({
        required_forms_count: 5,
        ready_forms_count: 2,
        signed_forms_count: 1,
      })
    );
    expect(r.tone).toBe("info");
    expect(r.label).toBe("3 / 5 forms ready or signed");
  });

  it("muted — no required forms yet", () => {
    const r = complianceStatus(base());
    expect(r.tone).toBe("muted");
    expect(r.label).toBe("No required forms yet");
  });

  it("blocked priority — blocked beats ok-signed", () => {
    const r = complianceStatus(
      base({
        required_forms_count: 5,
        signed_forms_count: 5,
        blocked_forms_count: 1,
      })
    );
    expect(r.tone).toBe("warn");
    expect(r.label).toBe("1 form blocked");
  });
});

describe("brokerReviewStatus", () => {
  it.each<[string | null, string, string]>([
    ["draft", "muted", "Not yet submitted"],
    ["submitted", "info", "Awaiting broker review"],
    ["approved", "ok", "Approved by broker"],
    ["revisions_required", "warn", "Broker requested revisions"],
  ])("maps %s → %s / %s", (status, tone, label) => {
    const r = brokerReviewStatus(base({ broker_review_status: status }));
    expect(r.tone).toBe(tone);
    expect(r.label).toBe(label);
  });

  it("muted — null status", () => {
    const r = brokerReviewStatus(base({ broker_review_status: null }));
    expect(r.tone).toBe("muted");
  });

  it("muted — empty string", () => {
    const r = brokerReviewStatus(base({ broker_review_status: "" }));
    expect(r.tone).toBe("muted");
    expect(r.label).toBe("Review status unknown");
  });

  it("muted — unknown enum value", () => {
    const r = brokerReviewStatus(base({ broker_review_status: "in_orbit" }));
    expect(r.tone).toBe("muted");
    expect(r.label).toContain("in_orbit");
  });

  it("normalizes case", () => {
    const r = brokerReviewStatus(base({ broker_review_status: "APPROVED" }));
    expect(r.tone).toBe("ok");
  });
});

describe("commissionEligibility", () => {
  it("muted — not closed", () => {
    const r = commissionEligibility(base({ transaction_status: "draft" }));
    expect(r.tone).toBe("muted");
    expect(r.label).toBe("Awaiting transaction close");
  });

  it("muted — closed but no broker approval", () => {
    const r = commissionEligibility(
      base({ transaction_status: "closed", broker_review_status: "submitted" })
    );
    expect(r.tone).toBe("muted");
    expect(r.label).toBe("Awaiting broker approval");
  });

  it("warn — closed + approved but documents incomplete", () => {
    const r = commissionEligibility(
      base({
        transaction_status: "closed",
        broker_review_status: "approved",
        required_forms_count: 5,
        signed_forms_count: 3,
      })
    );
    expect(r.tone).toBe("warn");
    expect(r.label).toBe("Documents incomplete");
    expect(r.detail).toContain("3");
    expect(r.detail).toContain("5");
  });

  it("warn — docs done but statutory incomplete", () => {
    const r = commissionEligibility(
      base({
        transaction_status: "closed",
        broker_review_status: "approved",
        required_forms_count: 5,
        signed_forms_count: 5,
        statutory_count: 2,
      })
    );
    expect(r.tone).toBe("warn");
    expect(r.label).toBe("Statutory attestations incomplete");
  });

  it("info — ready for broker payout review", () => {
    const r = commissionEligibility(
      base({
        transaction_status: "closed",
        broker_review_status: "approved",
        required_forms_count: 5,
        signed_forms_count: 5,
        statutory_count: 0,
      })
    );
    expect(r.tone).toBe("info");
    expect(r.label).toBe("Ready for broker payout review");
  });

  it("muted — closed status case-insensitive", () => {
    const r = commissionEligibility(
      base({ transaction_status: "CLOSED", broker_review_status: "approved" })
    );
    // closed → keeps going, not muted
    expect(r.tone).not.toBe("muted");
  });
});

describe("composeBannerState", () => {
  it("returns all 3 pills", () => {
    const r = composeBannerState(base());
    expect(r.compliance).toBeTruthy();
    expect(r.brokerReview).toBeTruthy();
    expect(r.commission).toBeTruthy();
  });

  it("happy path — all green", () => {
    const r = composeBannerState(
      base({
        required_forms_count: 5,
        signed_forms_count: 5,
        broker_review_status: "approved",
        transaction_status: "closed",
        statutory_count: 0,
      })
    );
    expect(r.compliance.tone).toBe("ok");
    expect(r.brokerReview.tone).toBe("ok");
    expect(r.commission.tone).toBe("info");
  });

  it("brand new transaction — all muted/info", () => {
    const r = composeBannerState(base());
    expect(r.compliance.tone).toBe("muted");
    expect(r.brokerReview.tone).toBe("muted");
    expect(r.commission.tone).toBe("muted");
  });
});

// ────────────────────────────────────────────────────────────────────
// Role safety + boundary lint
// ────────────────────────────────────────────────────────────────────

describe("Workflow 3.2.C.1 boundary lint — role safety + endpoint scope", () => {
  const FILES = [
    "src/portal/workspace/banner/compose-banner-state.ts",
    "src/portal/workspace/tabs/ComplianceBanner.tsx",
    "src/portal/workspace/tabs/WorkspaceShell.tsx",
    "app/(portal)/workspace/[transactionId]/page.tsx",
  ];

  // Strip line + block comments before scanning so forward-reference
  // documentation (e.g. "W3.3 will enforce these gates at /api/commissions/pay")
  // doesn't trip the lint. Vault paths are still asserted absent from
  // actual code.
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }

  it("no /api/commissions calls anywhere in scope (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = stripComments(
        fs.readFileSync(path.join(process.cwd(), f), "utf-8")
      );
      expect(src).not.toMatch(/\/api\/commissions/);
      expect(src).not.toMatch(/commissionApi|commissionsClient/);
    }
  });

  it("no /api/stripe calls anywhere in scope (code)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = stripComments(
        fs.readFileSync(path.join(process.cwd(), f), "utf-8")
      );
      expect(src).not.toMatch(/\/api\/stripe/);
      expect(src).not.toMatch(/\bstripe[A-Z]/);
    }
  });

  it("no mutation HTTP methods anywhere in W3.2.C.1 scope", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    }
  });

  it("no Supabase write chains", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.insert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.update\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.upsert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.delete\(/);
      expect(src).not.toMatch(/\.rpc\(['"]/);
    }
  });

  it("composer input type does NOT carry broker-only fields", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/banner/compose-banner-state.ts"),
      "utf-8"
    );
    // Strip top-of-file SAFETY CONTRACT comment block before scanning.
    // The comment intentionally names forbidden fields to document why
    // they are excluded.
    const codeOnly = src.replace(/^\/\/[\s\S]*?(?=\nexport |\nimport |\n[a-zA-Z])/m, "");
    // The composer's input type and code must NEVER reference broker-only fields.
    const FORBIDDEN_FIELDS = [
      "net_commission",
      "agent_split_pct",
      "brokerage_amount",
      "cap_applied",
      "stripe_payout_id",
      "payment_reference",
      "revision_notes",
      "coaching_notes",
      "agent_cap_tracking",
      "commission_status",
    ];
    for (const field of FORBIDDEN_FIELDS) {
      expect(codeOnly.includes(field)).toBe(false);
    }
  });

  it("ComplianceBanner JSX contains no forbidden action labels", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/ComplianceBanner.tsx"),
      "utf-8"
    );
    const FORBIDDEN_LABELS = [
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
    ];
    for (const label of FORBIDDEN_LABELS) {
      expect(src.includes(label)).toBe(false);
    }
  });

  it("ComplianceBanner has no <button onClick=…> handlers", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/ComplianceBanner.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/<button[\s\S]{0,500}?onClick=/);
  });

  it("page-level fetcher only calls /missing-fields (no commissions, no stripe)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    // The new fetchMissingFieldsSafely should reference /paperwork/.../missing-fields
    expect(src).toMatch(/missing-fields/);
    // And the page MUST NOT hit any commissions or stripe URL
    expect(src).not.toMatch(/\/api\/commissions/);
    expect(src).not.toMatch(/\/api\/stripe/);
    expect(src).not.toMatch(/payout-readiness/);
  });

  it("page preserves cross-tenant notFound + parse safety", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/notFound\(\)/);
    expect(src).toMatch(/parseFormId/);
    expect(src).toMatch(/parseTab/);
    expect(src).toMatch(/scope:\s*['"]office['"]/);
  });

  it("composer is pure — no fetch / no fs / no DOM", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/banner/compose-banner-state.ts"),
      "utf-8"
    );
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/import.*['"]fs['"]/);
    expect(src).not.toMatch(/document\./);
    expect(src).not.toMatch(/window\./);
    expect(src).not.toMatch(/^["']use client["']/m);
  });
});
