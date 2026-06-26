/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.A — Form detail drawer tests
// ============================================================================

import type { DocumentRow, RequirementRow } from "../../types";
import type { MissingFieldsReport, TimelineEvent } from "../types";
import {
  completerRoleLabel,
  extractStatutoryFields,
  filterHistoryForFormInstance,
  filterMissingFieldsForForm,
  formDrawerCloseHref,
  formDrawerHref,
  humanSeverity,
  isBrokerTier,
  parseFormId,
  severityTone,
  severityWeight,
} from "../helpers";

function makeDoc(form_id: string, extras: Partial<DocumentRow> = {}): DocumentRow {
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
    open_in_vault_url: `https://vault.example.com/paperwork/transactions/abc#form-${form_id}`,
    ...extras,
  };
}

describe("isBrokerTier", () => {
  it.each(["broker", "admin", "office_manager"])("recognizes broker tier %s", (role) => {
    expect(isBrokerTier(role)).toBe(true);
  });
  it.each(["agent", "", null, undefined, "AGENT", "broker_tier", "user"])(
    "rejects non-broker %p",
    (role) => {
      expect(isBrokerTier(role as string)).toBe(false);
    }
  );
});

describe("parseFormId", () => {
  const docs = [makeDoc("RLHD-3x"), makeDoc("CL-11"), makeDoc("EBLA-13")];
  it("returns exact match", () => {
    expect(parseFormId("RLHD-3x", docs)).toBe("RLHD-3x");
  });
  it("returns null for unknown", () => {
    expect(parseFormId("UNKNOWN", docs)).toBe(null);
  });
  it("returns null for empty / null / undefined", () => {
    expect(parseFormId("", docs)).toBe(null);
    expect(parseFormId(null, docs)).toBe(null);
    expect(parseFormId(undefined, docs)).toBe(null);
  });
  it("rejects case-mismatch (cross-tenant safety)", () => {
    expect(parseFormId("rlhd-3x", docs)).toBe(null);
  });
  it("rejects extremely long values", () => {
    expect(parseFormId("x".repeat(100), docs)).toBe(null);
  });
  it("rejects path-traversal-shaped strings (no match in scope)", () => {
    expect(parseFormId("../etc/passwd", docs)).toBe(null);
    expect(parseFormId("RLHD-3x;DROP", docs)).toBe(null);
  });
  it("does not match prefix", () => {
    expect(parseFormId("RLHD", docs)).toBe(null);
  });
});

describe("filterMissingFieldsForForm", () => {
  const report: MissingFieldsReport = {
    items: [
      {
        transaction_path: "txn.client_email",
        severity: "high",
        completer_role: "agent",
        blocks_forms: ["RLHD-3x"],
      },
      {
        transaction_path: "facts.flood_history",
        severity: "statutory_must_be_seller",
        completer_role: "seller",
        blocks_forms: ["RLHD-3x", "CL-11"],
      },
      {
        transaction_path: "terms.lease.monthly_amount",
        severity: "medium",
        completer_role: "agent",
        blocks_forms: ["CL-11"],
      },
    ],
    statutory_count: 1,
    by_severity: {},
    by_completer_role: {},
    satisfied_statutory_paths: [],
    computed_at: "2026-06-25T00:00:00Z",
  };

  it("filters to items blocking the form", () => {
    const out = filterMissingFieldsForForm(report, "RLHD-3x");
    expect(out.map((o) => o.transaction_path).sort()).toEqual([
      "facts.flood_history",
      "txn.client_email",
    ]);
  });
  it("returns [] for null report", () => {
    expect(filterMissingFieldsForForm(null, "RLHD-3x")).toEqual([]);
  });
  it("returns [] for form not blocked by any item", () => {
    expect(filterMissingFieldsForForm(report, "EBLA-13")).toEqual([]);
  });
  it("sorts statutory first, then high → medium → low", () => {
    const out = filterMissingFieldsForForm(report, "RLHD-3x");
    expect(out[0].severity).toBe("statutory_must_be_seller");
    expect(out[1].severity).toBe("high");
  });
});

describe("filterHistoryForFormInstance", () => {
  const events: TimelineEvent[] = [
    {
      kind: "audit",
      id: "a1",
      created_at: "2026-06-24T00:00:00Z",
      actor_id: "u1",
      form_instance_id: "fi-1",
      field_path: "txn.client_email",
      source: "typed",
    },
    {
      kind: "audit",
      id: "a2",
      created_at: "2026-06-24T01:00:00Z",
      actor_id: "u1",
      form_instance_id: "fi-2",
      field_path: "facts.flood_history",
      source: "party_portal",
    },
    {
      kind: "review",
      id: "r1",
      created_at: "2026-06-24T02:00:00Z",
      actor_id: "u1",
      action: "approved",
    },
  ];
  it("filters to form_instance_id (audit only)", () => {
    expect(filterHistoryForFormInstance(events, "fi-1")).toHaveLength(1);
    expect(filterHistoryForFormInstance(events, "fi-1")[0].id).toBe("a1");
  });
  it("excludes review events", () => {
    const result = filterHistoryForFormInstance(events, "fi-1");
    expect(result.every((e) => e.kind === "audit")).toBe(true);
  });
  it("returns [] when no form_instance_id", () => {
    expect(filterHistoryForFormInstance(events, null)).toEqual([]);
  });
  it("returns [] when events is null", () => {
    expect(filterHistoryForFormInstance(null, "fi-1")).toEqual([]);
  });
});

describe("extractStatutoryFields", () => {
  const req: RequirementRow = {
    form_id: "RLHD-3x",
    required_fields: [
      {
        transaction_path: "facts.flood_history",
        severity: "statutory_must_be_seller",
        completer_role: "seller",
      },
      {
        transaction_path: "facts.lead_paint_knowledge",
        severity: "statutory_must_be_seller",
        completer_role: "seller",
      },
      {
        transaction_path: "txn.client_email",
        severity: "high",
        completer_role: "agent",
      },
    ],
  };
  const report: MissingFieldsReport = {
    items: [],
    statutory_count: 0,
    by_severity: {},
    by_completer_role: {},
    satisfied_statutory_paths: ["facts.flood_history"],
    computed_at: "2026-06-25T00:00:00Z",
  };

  it("includes statutory specs", () => {
    const out = extractStatutoryFields(req, report);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.transaction_path)).toEqual([
      "facts.flood_history",
      "facts.lead_paint_knowledge",
    ]);
  });
  it("excludes non-statutory specs", () => {
    const out = extractStatutoryFields(req, report);
    expect(out.find((s) => s.transaction_path === "txn.client_email")).toBeUndefined();
  });
  it("flags satisfaction from report.satisfied_statutory_paths", () => {
    const out = extractStatutoryFields(req, report);
    expect(out.find((s) => s.transaction_path === "facts.flood_history")?.satisfied).toBe(true);
    expect(out.find((s) => s.transaction_path === "facts.lead_paint_knowledge")?.satisfied).toBe(false);
  });
  it("treats null report as no satisfied paths", () => {
    const out = extractStatutoryFields(req, null);
    expect(out.every((s) => s.satisfied === false)).toBe(true);
  });
  it("returns [] for null requirement", () => {
    expect(extractStatutoryFields(null, report)).toEqual([]);
  });
});

describe("severityWeight / humanSeverity / severityTone", () => {
  it("orders statutory first", () => {
    expect(severityWeight("statutory_must_be_seller")).toBeLessThan(severityWeight("high"));
    expect(severityWeight("high")).toBeLessThan(severityWeight("medium"));
    expect(severityWeight("medium")).toBeLessThan(severityWeight("low"));
    expect(severityWeight("low")).toBeLessThan(severityWeight("info"));
  });
  it("humanSeverity maps statutory variants", () => {
    expect(humanSeverity("statutory_must_be_landlord")).toBe("Statutory");
    expect(humanSeverity("statutory_must_be_tenant")).toBe("Statutory");
    expect(humanSeverity("high")).toBe("High");
    expect(humanSeverity("unknown")).toBe("Info");
  });
  it("severityTone treats statutory + high as warn", () => {
    expect(severityTone("statutory_must_be_seller")).toBe("warn");
    expect(severityTone("high")).toBe("warn");
    expect(severityTone("medium")).toBe("info");
    expect(severityTone("info")).toBe("muted");
  });
});

describe("formDrawerHref / formDrawerCloseHref", () => {
  it("builds drawer href with tab + form params", () => {
    expect(formDrawerHref("abc-123", "RLHD-3x")).toBe(
      "/workspace/abc-123?tab=documents&form=RLHD-3x"
    );
  });
  it("URL-encodes form_id", () => {
    expect(formDrawerHref("abc-123", "CRSP-17_H")).toBe(
      "/workspace/abc-123?tab=documents&form=CRSP-17_H"
    );
  });
  it("close href keeps tab", () => {
    expect(formDrawerCloseHref("abc-123")).toBe("/workspace/abc-123?tab=documents");
  });
});

describe("completerRoleLabel", () => {
  it("maps known roles", () => {
    expect(completerRoleLabel("agent")).toBe("Agent");
    expect(completerRoleLabel("broker")).toBe("Broker");
    expect(completerRoleLabel("buyer")).toBe("Party · Buyer");
    expect(completerRoleLabel("co_seller")).toBe("Party · Seller");
    expect(completerRoleLabel("landlord")).toBe("Party · Landlord");
    expect(completerRoleLabel("tenant")).toBe("Party · Tenant");
  });
  it("returns — for null", () => {
    expect(completerRoleLabel(null)).toBe("—");
    expect(completerRoleLabel(undefined)).toBe("—");
  });
});

// ── Boundary lint — read-only drawer module ─────────────────────────

describe("Workflow 3.2.A boundary lint — read-only", () => {
  const FILES = [
    "src/portal/documents/details/types.ts",
    "src/portal/documents/details/helpers.ts",
    "src/portal/documents/details/api.ts",
    "src/portal/documents/details/FormDetailDrawer.tsx",
    "src/portal/documents/DocumentsPanel.tsx",
    "src/portal/workspace/tabs/DocumentsTab.tsx",
  ];

  it("no Supabase mutation chains", async () => {
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

  it("no PATCH / POST / PUT / DELETE methods (read-only)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    }
  });

  it("no forbidden action labels (drawer is read-only)", async () => {
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
      ">Request Attestation<",
      ">Send Invite<",
    ];
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      for (const label of FORBIDDEN) {
        expect(src.includes(label)).toBe(false);
      }
    }
  });

  it("no <button onClick=…> handlers (server-rendered only)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/<button[\s\S]{0,500}?onClick=/);
    }
  });

  it("FormDetailDrawer uses next/link Link for close (no JS)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/FormDetailDrawer.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+Link\s+from\s+["']next\/link["']/);
    expect(src).toMatch(/<Link[\s\S]*?href=\{closeHref\}/);
  });

  it("api.ts hits only the 3 allowlisted Vault read endpoints", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/api.ts"),
      "utf-8"
    );
    // Each endpoint must appear at least once
    expect(src).toMatch(/missing-fields/);
    expect(src).toMatch(/form-instances\/\$\{[^}]+\}\/envelope/);
    expect(src).toMatch(/transactions\/\$\{[^}]+\}\/history/);
    // No other paperwork endpoints
    expect(src).not.toMatch(/\/forms`/);
    expect(src).not.toMatch(/\/recompute/);
    expect(src).not.toMatch(/\/submit-review/);
    expect(src).not.toMatch(/\/approve/);
    expect(src).not.toMatch(/\/reject/);
    expect(src).not.toMatch(/\/generate/);
    expect(src).not.toMatch(/\/send/);
    expect(src).not.toMatch(/\/portal\//);
  });

  it("api.ts requires server-only import", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  it("api.ts skips broker-only fetches when caller is agent", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/details/api.ts"),
      "utf-8"
    );
    // broker gate must appear before envelope/history fetches
    expect(src).toMatch(/isBrokerTier/);
    expect(src).toMatch(/broker\s*&&\s*input\.formInstanceId/);
    expect(src).toMatch(/broker\n?\s*\?\s*safeFetchHistory/);
  });

  it("page preserves cross-tenant notFound + form scope safety", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/notFound\(\)/);
    expect(src).toMatch(/parseFormId\(/);
    expect(src).toMatch(/searchParams/);
    expect(src).toMatch(/activeTab\s*===\s*["']documents["']/);
  });
});
