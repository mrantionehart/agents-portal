/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.B.1 — Editable section tests
// ============================================================================

import type { RequirementRow } from "../../../types";
import type { TransactionSnapshot } from "../../types";
import {
  TERMS_PATH_ALLOWLIST_MIRROR,
  classifyField,
  deriveAgentEditableFields,
  inferInputType,
  isAllowedTermsPathMirror,
  pathLabel,
  reasonLabel,
} from "../editable-fields";
import { resolveCurrentValue } from "../value-resolver";

// ── P4H-13 — this block used to read Vault off disk, and never ran ─────────
// It parsed `process.cwd()/../vault/src/lib/paperwork/route-helpers.ts` and
// compared regex sources. That sibling directory exists in no layout this repo
// is cloned into, so the suite failed to the `vault` path rather than to a real
// mismatch — and the drift it existed to prevent happened anyway: Vault gained
// purchase.* and amendment_* and the mirror never followed.
//
// The sync is now asserted from inside each repo against one explicit
// contract, so drift fails the CI of whichever repo drifted:
//   this repo → __tests__/terms-allowlist-contract.test.ts
//   Vault     → src/lib/paperwork/__tests__/terms-allowlist-contract.test.ts
// The check below keeps a failing signal here if that file is ever deleted,
// because removing the only running guard should not be quiet.
describe("TERMS_PATH_ALLOWLIST_MIRROR — the sync guard exists and runs", () => {
  it("the contract test is present in this suite directory", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const here = path.join(__dirname, "terms-allowlist-contract.test.ts");
    expect(fs.existsSync(here)).toBe(true);
    const src = fs.readFileSync(here, "utf-8");
    // It must compare the whole mirror, not spot-check a path.
    expect(src).toContain("TERMS_PATH_ALLOWLIST_MIRROR.map((r) => r.source)");
  });

  it("and this file no longer depends on a sibling Vault checkout", () => {
    const fs = require("fs") as typeof import("fs");
    const src = fs.readFileSync(__filename, "utf-8");
    expect(src).not.toMatch(/"vault",\s*$/m);
  });
});

describe("isAllowedTermsPathMirror", () => {
  it.each([
    "lease.term.start_date",
    "lease.term.end_date",
    "lease.term.term_months",
    "lease.term.holdover_terms",
    "lease.rent.monthly_amount",
    "lease.rent.due_day_of_month",
    "lease.rent.grace_period_days",
    "lease.rent.late_fee_amount",
    "lease.rent.returned_check_fee",
    "lease.rent.where_payable",
    "lease.deposits.security_deposit_amount",
    "lease.deposits.security_deposit_holder",
    "lease.deposits.advance_rent_amount",
    "lease.deposits.last_month_rent_collected",
    "lease.pets.allowed",
    "lease.pets.deposit",
    "lease.pets.restrictions",
    "lease.utilities.paid_by_tenant",
    "lease.utilities.paid_by_landlord",
    "lease.utilities.notes",
    "lease.restrictions.smoking_allowed",
    "lease.restrictions.business_use_allowed",
    "lease.restrictions.subletting_allowed",
    "lease.restrictions.alterations_allowed",
    "lease.is_contract_to_lease",
  ])("allows %s", (path) => {
    expect(isAllowedTermsPathMirror(path)).toBe(true);
  });

  it.each([
    "",
    "purchase.price",
    "listing.commission",
    "buyer_rep.terms",
    "lease.rent.unknown_field",
    "lease.term.unknown",
    "lease.UNKNOWN.start_date",
    "../etc/passwd",
    "lease.rent.monthly_amount;DROP",
    "Lease.term.start_date", // case sensitive
  ])("rejects %p", (path) => {
    expect(isAllowedTermsPathMirror(path)).toBe(false);
  });
});

describe("inferInputType", () => {
  it("infers date for *_date paths", () => {
    expect(inferInputType("lease.term.start_date")).toBe("date");
    expect(inferInputType("lease.term.end_date")).toBe("date");
  });
  it("infers number for *_amount / *_months / *_days", () => {
    expect(inferInputType("lease.rent.monthly_amount")).toBe("number");
    expect(inferInputType("lease.term.term_months")).toBe("number");
    expect(inferInputType("lease.rent.grace_period_days")).toBe("number");
    expect(inferInputType("facts.year_built")).toBe("number");
  });
  it("infers boolean for is_/has_/_allowed", () => {
    expect(inferInputType("lease.is_contract_to_lease")).toBe("boolean");
    expect(inferInputType("facts.has_hoa")).toBe("boolean");
    expect(inferInputType("lease.pets.allowed")).toBe("boolean");
    expect(inferInputType("lease.restrictions.smoking_allowed")).toBe("boolean");
  });
  it("infers text otherwise", () => {
    expect(inferInputType("txn.property_address")).toBe("text");
    expect(inferInputType("facts.notes")).toBe("text");
  });
});

describe("pathLabel", () => {
  it("turns leaf into Title Case", () => {
    expect(pathLabel("lease.rent.monthly_amount")).toBe("Monthly Amount");
    expect(pathLabel("facts.condo")).toBe("Condo");
  });
});

describe("classifyField", () => {
  it("classifies non-statutory fact as facts editable", () => {
    const r = classifyField({
      transaction_path: "facts.condo",
      severity: "high",
      completer_role: "agent",
    });
    expect(r.editable).not.toBeNull();
    expect(r.editable!.endpoint).toBe("facts");
    expect(r.editable!.key).toBe("condo");
  });
  it("classifies allowlisted term as terms editable", () => {
    const r = classifyField({
      transaction_path: "terms.lease.rent.monthly_amount",
      severity: "high",
      completer_role: "agent",
    });
    expect(r.editable).not.toBeNull();
    expect(r.editable!.endpoint).toBe("terms");
    expect(r.editable!.termPath).toBe("lease.rent.monthly_amount");
  });
  it("rejects statutory by severity", () => {
    const r = classifyField({
      transaction_path: "facts.flood_history",
      severity: "statutory_must_be_seller",
      completer_role: "seller",
    });
    expect(r.editable).toBeNull();
    expect(r.reason).toBe("statutory");
  });
  it("rejects statutory by fact-key membership even when severity is missing", () => {
    const r = classifyField({
      transaction_path: "facts.lead_paint_knowledge",
      severity: "",
      completer_role: "",
    });
    expect(r.editable).toBeNull();
    // Statutory key takes precedence
    expect(r.reason).toBe("statutory");
  });
  it.each(["seller", "buyer", "landlord", "tenant", "co_seller", "co_buyer"])(
    "rejects party role %s",
    (role) => {
      const r = classifyField({
        transaction_path: "facts.condo",
        severity: "high",
        completer_role: role,
      });
      expect(r.editable).toBeNull();
      expect(r.reason).toBe("party_only");
    }
  );
  it("rejects broker completer", () => {
    const r = classifyField({
      transaction_path: "facts.condo",
      severity: "high",
      completer_role: "broker",
    });
    expect(r.editable).toBeNull();
    expect(r.reason).toBe("broker_only");
  });
  it("rejects unknown terms path (not in allowlist mirror)", () => {
    const r = classifyField({
      transaction_path: "terms.purchase.price",
      severity: "high",
      completer_role: "agent",
    });
    expect(r.editable).toBeNull();
    expect(r.reason).toBe("unknown");
  });
  it("rejects txn.* (no agent endpoint)", () => {
    const r = classifyField({
      transaction_path: "txn.property_address",
      severity: "high",
      completer_role: "agent",
    });
    expect(r.editable).toBeNull();
    expect(r.reason).toBe("txn_col");
  });
  it("rejects parties.* (broker-only)", () => {
    const r = classifyField({
      transaction_path: "parties.landlord.email",
      severity: "high",
      completer_role: "agent",
    });
    expect(r.editable).toBeNull();
    expect(r.reason).toBe("party_field");
  });
  it("rejects empty path", () => {
    const r = classifyField({
      transaction_path: "",
      severity: "high",
      completer_role: "agent",
    });
    expect(r.editable).toBeNull();
  });
});

describe("deriveAgentEditableFields", () => {
  const req: RequirementRow = {
    form_id: "RLHD-3x",
    required_fields: [
      // statutory — skip
      {
        transaction_path: "facts.flood_history",
        severity: "statutory_must_be_seller",
        completer_role: "seller",
      },
      // term editable
      {
        transaction_path: "terms.lease.rent.monthly_amount",
        severity: "high",
        completer_role: "agent",
      },
      // term editable
      {
        transaction_path: "terms.lease.term.start_date",
        severity: "high",
        completer_role: "agent",
      },
      // fact editable
      {
        transaction_path: "facts.condo",
        severity: "medium",
        completer_role: "agent",
      },
      // party-only — skip
      {
        transaction_path: "parties.landlord.email",
        severity: "high",
        completer_role: "broker",
      },
      // duplicate term — dedupe
      {
        transaction_path: "terms.lease.rent.monthly_amount",
        severity: "high",
        completer_role: "agent",
      },
    ],
  };

  it("includes only agent-editable, deduplicated, preserving order", () => {
    const out = deriveAgentEditableFields(req);
    expect(out.map((f) => f.transaction_path)).toEqual([
      "terms.lease.rent.monthly_amount",
      "terms.lease.term.start_date",
      "facts.condo",
    ]);
  });

  it("returns [] for null", () => {
    expect(deriveAgentEditableFields(null)).toEqual([]);
  });

  it("returns [] for requirement with no required_fields", () => {
    expect(deriveAgentEditableFields({ form_id: "X" })).toEqual([]);
  });
});

describe("reasonLabel", () => {
  it("maps every classified reason", () => {
    expect(reasonLabel("statutory")).toBe("Statutory — party portal only");
    expect(reasonLabel("party_only")).toBe("Party portal only");
    expect(reasonLabel("broker_only")).toBe("Broker only");
    expect(reasonLabel("txn_col")).toBe("Edit in Vault");
    expect(reasonLabel("party_field")).toBe("Broker only (party field)");
    expect(reasonLabel("unknown")).toBe("Read-only");
    expect(reasonLabel(null)).toBe("");
  });
});

describe("resolveCurrentValue", () => {
  const snapshot: TransactionSnapshot = {
    facts: {
      condo: { value: true, state: "entered" } as unknown as Record<string, unknown>,
      year_built: { value: 1985, state: "entered" } as unknown as Record<string, unknown>,
    },
    terms: {
      lease: {
        rent: { monthly_amount: 1500 },
        term: { start_date: "2026-01-01" },
        is_contract_to_lease: false,
      },
    },
    broker_review_status: "draft",
  };

  it("reads facts.<key>.value", () => {
    expect(resolveCurrentValue(snapshot, "facts.condo")).toBe(true);
    expect(resolveCurrentValue(snapshot, "facts.year_built")).toBe(1985);
  });
  it("reads nested terms", () => {
    expect(resolveCurrentValue(snapshot, "terms.lease.rent.monthly_amount")).toBe(1500);
    expect(resolveCurrentValue(snapshot, "terms.lease.term.start_date")).toBe(
      "2026-01-01"
    );
    expect(resolveCurrentValue(snapshot, "terms.lease.is_contract_to_lease")).toBe(false);
  });
  it("returns null for missing keys", () => {
    expect(resolveCurrentValue(snapshot, "facts.nonexistent")).toBe(null);
    expect(resolveCurrentValue(snapshot, "terms.lease.nonexistent")).toBe(null);
  });
  it("returns null for unsupported prefixes", () => {
    expect(resolveCurrentValue(snapshot, "txn.property_address")).toBe(null);
    expect(resolveCurrentValue(snapshot, "parties.landlord.email")).toBe(null);
    expect(resolveCurrentValue(snapshot, "facts_hearsay.flood_history")).toBe(null);
  });
  it("returns null for null snapshot or empty path", () => {
    expect(resolveCurrentValue(null, "facts.condo")).toBe(null);
    expect(resolveCurrentValue(snapshot, "")).toBe(null);
  });
});

// ── Boundary lint — read-only editor module respects every Vault gate ─

describe("Workflow 3.2.B.1 boundary lint", () => {
  const FILES = [
    "src/portal/documents/details/edit/editable-fields.ts",
    "src/portal/documents/details/edit/value-resolver.ts",
    "src/portal/documents/details/edit/use-form-field-patch.ts",
    "src/portal/documents/details/edit/FormEditableSection.tsx",
    "src/portal/documents/details/api.ts",
    "src/portal/documents/details/FormDetailDrawer.tsx",
  ];

  it("no Supabase mutation chains in any editor file", async () => {
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

  it("editor module only writes via paperworkApi (no raw PATCH)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const hook = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/edit/use-form-field-patch.ts"),
      "utf-8"
    );
    // Must use the existing client wrappers — no raw fetch / method:PATCH
    expect(hook).toMatch(/paperworkApi\.patchTransactionFact/);
    expect(hook).toMatch(/paperworkApi\.patchTransactionTerm/);
    expect(hook).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    expect(hook).not.toMatch(/\bfetch\(/);
  });

  it("hook only proposes new_state='entered' (agent role server-enforced)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const hook = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/edit/use-form-field-patch.ts"),
      "utf-8"
    );
    expect(hook).toMatch(/new_state:\s*["']entered["']/);
    expect(hook).not.toMatch(/new_state:\s*["']reviewed["']/);
    expect(hook).not.toMatch(/new_state:\s*["']attested["']/);
    expect(hook).not.toMatch(/new_state:\s*["']heard["']/);
  });

  it("no forbidden labels in editor JSX", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const FORBIDDEN = [
      ">Generate PDF<",
      ">Send Envelope<",
      ">Send envelope<",
      ">Approve<",
      ">Reject<",
      ">Release Commission<",
      ">Pay Commission<",
      ">Close Transaction<",
      ">Send Invite<",
      ">Submit for Broker Review<",
    ];
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      for (const label of FORBIDDEN) {
        expect(src.includes(label)).toBe(false);
      }
    }
  });

  it("FormEditableSection enforces UPL L4 lock", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/edit/FormEditableSection.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/LOCKED_REVIEW_STATUSES/);
    expect(src).toMatch(/submitted/);
    expect(src).toMatch(/approved/);
    expect(src).toMatch(/reviewLocked/);
  });

  it("no new app/api routes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const apiDir = path.join(process.cwd(), "app", "api");
    if (fs.existsSync(apiDir)) {
      // AGENT.SIGN.1C intentionally added app/api/paperwork/checklist (the
      // Vault-powered checklist source). LEASE-WALKTHROUGH-1 intentionally
      // added app/api/paperwork/walkthroughs — four forwarders with NO rules
      // of their own; Vault owns the checklist, the validation, the duplicate
      // guard and the signer rules, and a browser cannot reach it
      // cross-origin. Guard that nothing ELSE was created under
      // app/api/paperwork.
      //
      // P4H-13 intentionally added app/api/paperwork/compliance-review — one
      // GET forwarder with no rule of its own. Vault owns the verdict and
      // decides which audience sees the approval card; a second place that
      // could compute a verdict is a second place that could disagree with
      // the first.
      //
      // P4H intentionally added app/api/paperwork/external-envelope — two
      // forwarders with NO rules of their own. Vault cannot SEND an
      // externally produced ERL-14 (it is the only form with a strict
      // signature-anchor gate, and the rule matches nothing on such a
      // document), so the agreement goes out through the agent's own DocuSign
      // and is recorded. Vault owns every decision on that record: the
      // approval state, the checksum binding, the duplicate refusal, and —
      // the one that matters — reading the envelope back from the SENDING
      // account to decide whether it is verified. A second place that could
      // decide "verified" is a second place that could call an unsigned
      // agreement executed.
      const pwDir = path.join(apiDir, "paperwork");
      if (fs.existsSync(pwDir)) {
        expect(fs.readdirSync(pwDir).sort()).toEqual([
          "checklist",
          "compliance-review",
          "external-envelope",
          "walkthroughs",
        ]);
      }
    }
  });

  it("api.ts adds the GET /paperwork/transactions/[id] fetch (no PATCH)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/paperwork\/transactions\/\$\{[^}]+\}`/);
    // No new writes from server fetcher
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("client-only files declare 'use client'", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const clientFiles = [
      "src/portal/documents/details/edit/use-form-field-patch.ts",
      "src/portal/documents/details/edit/FormEditableSection.tsx",
    ];
    for (const f of clientFiles) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).toMatch(/^["']use client["']/m);
    }
  });

  it("server-side helpers do NOT declare 'use client'", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const serverFiles = [
      "src/portal/documents/details/edit/editable-fields.ts",
      "src/portal/documents/details/edit/value-resolver.ts",
    ];
    for (const f of serverFiles) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/^["']use client["']/m);
    }
  });
});
