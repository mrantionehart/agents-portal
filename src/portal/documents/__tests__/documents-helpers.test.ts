/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R4 — Documents helpers + boundary lint
// ============================================================================

import {
  attentionLabel,
  buildOpenInVaultUrl,
  categoryLabel,
  deriveMissingFieldsCount,
  documentCounts,
  envelopeCopy,
  lifecycleLabel,
  lifecycleTone,
  mergeDocuments,
  missingFieldsCopy,
  relativeUpdated,
  resolveStatus,
  statusLabel,
  statusTone,
} from "../helpers";
import type {
  DocumentRow,
  FormInstanceRow,
  RequirementRow,
} from "../types";

function req(over: Partial<RequirementRow> = {}): RequirementRow {
  return {
    form_id: "RLHD-3x",
    form_revision: "Rev 10/25",
    form_category: "lease",
    required: true,
    reason: "FL Statute 689.27",
    required_fields: [
      { form_field_id: "f1", label: "Tenant name", transaction_path: "parties.tenant.name", severity: "high", completer_role: "agent", required: true },
      { form_field_id: "f2", label: "Property address", transaction_path: "txn.property_address", severity: "high", completer_role: "agent", required: true },
    ],
    ...over,
  };
}

function inst(over: Partial<FormInstanceRow> = {}): FormInstanceRow {
  return {
    id: "I1",
    form_id: "RLHD-3x",
    form_revision: "Rev 10/25",
    form_category: "lease",
    status: "in_progress",
    envelope_id: null,
    completed_at: null,
    signed_party_ids: [],
    required_party_role: null,
    required_reason: null,
    storage_path: null,
    template_id: "T1",
    transaction_id: "T-TXN",
    created_at: "2026-06-24T08:00:00Z",
    updated_at: "2026-06-25T08:00:00Z",
    ...over,
  };
}

// ── AGENT.SIGN.2.5.3 — lifecycle chips ──────────────────────────────────
describe("lifecycleLabel / lifecycleTone / attentionLabel", () => {
  it("labels every lifecycle state", () => {
    expect(lifecycleLabel("draft", "not_started")).toBe("Draft");
    expect(lifecycleLabel("generated", "ready")).toBe("Generated");
    expect(lifecycleLabel("sent", "sent")).toBe("Sent");
    expect(lifecycleLabel("viewed", "sent")).toBe("Viewed");
    expect(lifecycleLabel("completed", "sent")).toBe("Completed");
    expect(lifecycleLabel("imported", "sent")).toBe("Imported");
    expect(lifecycleLabel("signed", "signed")).toBe("Signed");
  });
  it("falls back to the raw status label when lifecycle is null", () => {
    expect(lifecycleLabel(null, "blocked")).toBe("Blocked");
    expect(lifecycleLabel(null, "not_started")).toBe("Not Started");
  });
  it("assigns distinct tones for sent/viewed/signed", () => {
    expect(lifecycleTone("draft")).toBe("muted");
    expect(lifecycleTone("generated")).toBe("info");
    expect(lifecycleTone("sent")).toBe("sent");
    expect(lifecycleTone("viewed")).toBe("viewed");
    expect(lifecycleTone("completed")).toBe("progress");
    expect(lifecycleTone("imported")).toBe("progress");
    expect(lifecycleTone("signed")).toBe("ok");
    expect(lifecycleTone(null)).toBe("muted");
  });
  it("labels each attention reason", () => {
    expect(attentionLabel("import_failed")).toBe("Import failed");
    expect(attentionLabel("missing_signatures")).toBe("Missing signatures");
    expect(attentionLabel("anchor_health")).toBe("Signing boxes issue");
    expect(attentionLabel("reconnect_docusign")).toBe("Reconnect DocuSign");
    expect(attentionLabel("awaiting_info")).toBe("Awaiting info");
    expect(attentionLabel("stale_sent")).toBe("Awaiting signature");
    expect(attentionLabel(null)).toBe("Needs attention");
  });
});

describe("mergeDocuments — carries lifecycle onto the row", () => {
  it("stamps lifecycle_status + needs_attention from the instance (req-matched)", () => {
    const rows = mergeDocuments({
      vaultBase: "https://v.x",
      transactionId: "T1",
      requirements: [req()],
      instances: [inst({ status: "sent", lifecycle: { lifecycle_status: "viewed", needs_attention: true, attention_reason: "anchor_health" } })],
    });
    const r = rows.find((x) => x.form_id === "RLHD-3x")!;
    expect(r.lifecycle_status).toBe("viewed");
    expect(r.needs_attention).toBe(true);
    expect(r.attention_reason).toBe("anchor_health");
  });

  it("defaults to null/false when the instance has no lifecycle (legacy)", () => {
    const rows = mergeDocuments({
      vaultBase: "https://v.x",
      transactionId: "T1",
      requirements: [req()],
      instances: [inst({ status: "in_progress" })],
    });
    const r = rows.find((x) => x.form_id === "RLHD-3x")!;
    expect(r.lifecycle_status).toBeNull();
    expect(r.needs_attention).toBe(false);
    expect(r.attention_reason).toBeNull();
  });

  it("carries lifecycle on orphan instances too", () => {
    const rows = mergeDocuments({
      vaultBase: "https://v.x",
      transactionId: "T1",
      requirements: [],
      instances: [inst({ form_id: "ZZZ-1", status: "signed", lifecycle: { lifecycle_status: "signed", needs_attention: false, attention_reason: null } })],
    });
    const r = rows.find((x) => x.form_id === "ZZZ-1")!;
    expect(r.lifecycle_status).toBe("signed");
  });
});

describe("buildOpenInVaultUrl", () => {
  it("anchors on the form_id", () => {
    expect(
      buildOpenInVaultUrl("https://vault.x.com", "T1", "RLHD-3x")
    ).toBe("https://vault.x.com/paperwork/transactions/T1#form-RLHD-3x");
  });
  it("strips trailing slash from base", () => {
    expect(
      buildOpenInVaultUrl("https://vault.x.com/", "T1", "EBBA-8sa")
    ).toBe("https://vault.x.com/paperwork/transactions/T1#form-EBBA-8sa");
  });
  it("URL-encodes exotic form ids", () => {
    expect(
      buildOpenInVaultUrl("https://vault.x.com", "T1", "CL-11/rev")
    ).toContain("form-CL-11%2Frev");
  });
});

describe("deriveMissingFieldsCount", () => {
  it("zero when signed/sent/ready/voided", () => {
    expect(deriveMissingFieldsCount(req(), inst({ status: "signed" }))).toBe(0);
    expect(deriveMissingFieldsCount(req(), inst({ status: "sent" }))).toBe(0);
    expect(deriveMissingFieldsCount(req(), inst({ status: "ready" }))).toBe(0);
    expect(deriveMissingFieldsCount(req(), inst({ status: "voided" }))).toBe(0);
  });
  it("counts required fields when in_progress", () => {
    expect(deriveMissingFieldsCount(req(), inst({ status: "in_progress" }))).toBe(2);
  });
  it("falls back to requirement count when no instance", () => {
    expect(deriveMissingFieldsCount(req(), null)).toBe(2);
  });
  it("treats required:false fields as not counted", () => {
    expect(
      deriveMissingFieldsCount(
        req({ required_fields: [
          { form_field_id: "f1", required: true },
          { form_field_id: "f2", required: false },
        ] }),
        null
      )
    ).toBe(1);
  });
  it("missing requirement → null", () => {
    expect(deriveMissingFieldsCount(null, inst({ status: "in_progress" }))).toBe(0);
  });
});

describe("resolveStatus", () => {
  it.each([
    ["recommended", "recommended"],
    ["required", "required"],
    ["blocked", "blocked"],
    ["in_progress", "in_progress"],
    ["ready", "ready"],
    ["sent", "sent"],
    ["signed", "signed"],
    ["voided", "voided"],
  ])("instance.status=%s → %s", (in_, expected) => {
    expect(resolveStatus(req(), inst({ status: in_ as any }))).toBe(expected);
  });
  it("no instance → not_started", () => {
    expect(resolveStatus(req(), null)).toBe("not_started");
  });
  it("unknown instance.status → in_progress (no stale leak)", () => {
    expect(resolveStatus(req(), inst({ status: "weird_state" as any }))).toBe(
      "in_progress"
    );
  });
});

describe("mergeDocuments", () => {
  it("attaches instance to requirement by form_id, preserving rule-engine order", () => {
    const rows = mergeDocuments({
      vaultBase: "https://vault.x.com",
      transactionId: "T1",
      requirements: [
        req({ form_id: "RLHD-3x" }),
        req({ form_id: "EBBA-8sa", form_category: "lease" }),
      ],
      instances: [inst({ form_id: "EBBA-8sa", status: "signed", completed_at: "2026-06-25T07:00:00Z" })],
    });
    expect(rows.map((r) => r.form_id)).toEqual(["RLHD-3x", "EBBA-8sa"]);
    expect(rows[0].has_instance).toBe(false);
    expect(rows[0].status).toBe("not_started");
    expect(rows[1].has_instance).toBe(true);
    expect(rows[1].status).toBe("signed");
    expect(rows[1].signed_at).toBe("2026-06-25T07:00:00Z");
  });
  it("picks the most-recent instance per form_id", () => {
    const rows = mergeDocuments({
      vaultBase: "https://vault.x.com",
      transactionId: "T1",
      requirements: [req({ form_id: "RLHD-3x" })],
      instances: [
        inst({ id: "older", form_id: "RLHD-3x", updated_at: "2026-06-20T08:00:00Z", status: "in_progress" }),
        inst({ id: "newer", form_id: "RLHD-3x", updated_at: "2026-06-25T08:00:00Z", status: "ready" }),
      ],
    });
    expect(rows[0].status).toBe("ready");
  });
  it("surfaces orphan instances (in DB but no rule-engine requirement)", () => {
    const rows = mergeDocuments({
      vaultBase: "https://vault.x.com",
      transactionId: "T1",
      requirements: [req({ form_id: "RLHD-3x" })],
      instances: [
        inst({ form_id: "RLHD-3x" }),
        inst({ form_id: "ORPHAN-99", status: "signed", completed_at: "2026-06-24T08:00:00Z" }),
      ],
    });
    expect(rows.map((r) => r.form_id)).toEqual(["RLHD-3x", "ORPHAN-99"]);
    expect(rows[1].status).toBe("signed");
    expect(rows[1].signed_at).toBe("2026-06-24T08:00:00Z");
  });
  it("Open-in-Vault URL anchors on form_id", () => {
    const rows = mergeDocuments({
      vaultBase: "https://vault.x.com",
      transactionId: "T1",
      requirements: [req({ form_id: "CAOT-2" })],
      instances: [],
    });
    expect(rows[0].open_in_vault_url).toBe(
      "https://vault.x.com/paperwork/transactions/T1#form-CAOT-2"
    );
  });
  it("has_envelope reflects instance.envelope_id presence (not value)", () => {
    const rows = mergeDocuments({
      vaultBase: "https://vault.x.com",
      transactionId: "T1",
      requirements: [req()],
      instances: [inst({ envelope_id: "env_abc" })],
    });
    expect(rows[0].has_envelope).toBe(true);
    // The raw envelope_id is NOT exposed on the row.
    expect((rows[0] as any).envelope_id).toBeUndefined();
  });
});

describe("documentCounts", () => {
  function row(over: Partial<DocumentRow> = {}): DocumentRow {
    return {
      form_id: "X",
      form_revision: null,
      form_category: null,
      reason: null,
      status: "not_started",
      missing_fields_count: 0,
      has_envelope: false,
      signed_at: null,
      updated_at: null,
      has_instance: false,
      open_in_vault_url: "https://x.x/",
      ...over,
    };
  }
  it("counts each bucket + computes needs_attention", () => {
    const rows: DocumentRow[] = [
      row({ status: "ready" }),
      row({ status: "ready" }),
      row({ status: "blocked" }),
      row({ status: "signed" }),
      row({ status: "sent" }),
      row({ status: "in_progress", missing_fields_count: 3 }),
      row({ status: "not_started", missing_fields_count: 2 }),
      row({ status: "not_started", missing_fields_count: 0 }),
    ];
    const c = documentCounts(rows);
    expect(c.total).toBe(8);
    expect(c.ready).toBe(2);
    expect(c.blocked).toBe(1);
    expect(c.signed).toBe(2); // signed + sent
    expect(c.in_progress).toBe(1);
    expect(c.not_started).toBe(2);
    expect(c.needs_attention).toBe(3); // 1 blocked + 1 in_progress w/ missing + 1 not_started w/ missing
  });
  it("empty → all zeros", () => {
    expect(documentCounts([])).toEqual({
      total: 0,
      ready: 0,
      blocked: 0,
      signed: 0,
      in_progress: 0,
      not_started: 0,
      needs_attention: 0,
    });
  });
});

describe("missingFieldsCopy", () => {
  it.each([
    [0, "ready", null],
    [null, "in_progress", null],
    [1, "in_progress", "1 required field outstanding"],
    [3, "in_progress", "3 required fields outstanding"],
    [2, "blocked", "2 required fields blocked on party attestation"],
    [1, "blocked", "1 required field blocked on party attestation"],
  ])("count=%s status=%s → %s", (count, status, expected) => {
    expect(missingFieldsCopy(count as number | null, status as DocumentRow["status"]))
      .toBe(expected);
  });
});

describe("envelopeCopy", () => {
  function r(over: Partial<DocumentRow>) {
    return {
      form_id: "X",
      form_revision: null,
      form_category: null,
      reason: null,
      status: "in_progress" as DocumentRow["status"],
      missing_fields_count: 0,
      has_envelope: false,
      signed_at: null,
      updated_at: null,
      has_instance: true,
      open_in_vault_url: "https://x.x",
      ...over,
    };
  }
  it("no envelope → null", () => {
    expect(envelopeCopy(r({ has_envelope: false }))).toBeNull();
  });
  it("signed → 'Envelope signed'", () => {
    expect(envelopeCopy(r({ has_envelope: true, status: "signed" }))).toBe("Envelope signed");
  });
  it("sent → 'Envelope sent — awaiting signatures'", () => {
    expect(envelopeCopy(r({ has_envelope: true, status: "sent" }))).toBe("Envelope sent — awaiting signatures");
  });
  it("other → generic 'Envelope present'", () => {
    expect(envelopeCopy(r({ has_envelope: true, status: "in_progress" }))).toBe("Envelope present");
  });
});

describe("statusLabel + statusTone + categoryLabel", () => {
  it("status labels for every value", () => {
    expect(statusLabel("ready")).toBe("Ready");
    expect(statusLabel("blocked")).toBe("Blocked");
    expect(statusLabel("signed")).toBe("Signed");
    expect(statusLabel("sent")).toBe("Sent");
    expect(statusLabel("in_progress")).toBe("In Progress");
    expect(statusLabel("voided")).toBe("Voided");
    expect(statusLabel("recommended")).toBe("Recommended");
    expect(statusLabel("required")).toBe("Required");
    expect(statusLabel("not_started")).toBe("Not Started");
  });
  it("status tones", () => {
    expect(statusTone("signed")).toBe("ok");
    expect(statusTone("sent")).toBe("ok");
    expect(statusTone("blocked")).toBe("warn");
    expect(statusTone("ready")).toBe("info");
    expect(statusTone("in_progress")).toBe("info");
    expect(statusTone("not_started")).toBe("muted");
  });
  it.each([
    ["lease", "Lease"],
    ["purchase", "Purchase"],
    ["listing", "Listing"],
    ["buyer_rep", "Buyer Rep"],
    ["addendum", "Addendum"],
    ["disclosure", "Disclosure"],
    ["custom_thing", "custom_thing"],
    [null, "—"],
  ])("categoryLabel %s → %s", (input, expected) => {
    expect(categoryLabel(input as string | null)).toBe(expected);
  });
});

describe("relativeUpdated", () => {
  const now = new Date("2026-06-25T08:00:00Z");
  it("just now / m / h / d / older", () => {
    expect(relativeUpdated("2026-06-25T07:59:50Z", now)).toBe("just now");
    expect(relativeUpdated("2026-06-25T07:30:00Z", now)).toBe("30m ago");
    expect(relativeUpdated("2026-06-25T03:00:00Z", now)).toBe("5h ago");
    expect(relativeUpdated("2026-06-23T08:00:00Z", now)).toBe("2d ago");
    expect(relativeUpdated("garbage", now)).toBe("—");
    expect(relativeUpdated(null, now)).toBe("—");
  });
});

describe("R4 boundary lint — read-only, no mutations, no send/generate/approve", () => {
  it("documents api.ts only hits the one Vault Bearer endpoint", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    const fetches = [...src.matchAll(/fetch\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(fetches.length).toBe(1);
    expect(fetches[0].includes("/paperwork/transactions/")).toBe(true);
    expect(fetches[0].includes("/forms")).toBe(true);
    // Bearer only.
    expect(src).toMatch(/Authorization:\s*`Bearer/);
    // GET only — no POST/PUT/PATCH/DELETE in the fetcher.
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("DocumentsPanel + helpers + page are read-only", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/documents/helpers.ts",
      "src/portal/documents/DocumentsPanel.tsx",
      "src/portal/documents/types.ts",
      "app/(portal)/workspace/[transactionId]/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      // No Supabase DB writes (anchor on .from(...) chains so we don't
      // false-positive on Map.delete / Set.delete / etc.).
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.insert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.update\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.upsert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.delete\(/);
      expect(src).not.toMatch(/\.rpc\(['"]/);
      // No mutating HTTP verbs.
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    }
  });

  it("DocumentsPanel never shows Generate / Download / Send / Approve / Attest affordances", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/documents/DocumentsPanel.tsx"),
      "utf-8"
    );
    // Strip the top-of-file comment block before checking — that block
    // is allowed to mention forbidden actions in the "Read-only — NO …"
    // declarative comment.
    const codeOnly = src.replace(/^\/\/[\s\S]*?(?=\n[a-zA-Z])/, "");
    // No CTA button copy for mutating actions.
    expect(codeOnly).not.toMatch(/>\s*Generate PDF\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Download(?:\s+PDF)?\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Send Envelope\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Approve\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Request Attestation\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Create Portal\s*</i);
    // No handler names for the same.
    expect(codeOnly).not.toMatch(
      /\b(handleGenerate|handleDownload|handleSend|handleApprove|handleAttest|onSendEnvelope|onApprove)\b/i
    );
    // No POST body shape.
    expect(codeOnly).not.toMatch(/action:\s*['"](generate|download|send|approve|attest)['"]/i);
    // No <button onClick=…> handlers at all in this panel — the only
    // interactive elements are <a href> Vault deep-links.
    expect(codeOnly).not.toMatch(/<button[\s\S]*?onClick=/);
  });

  it("no email/SMS/push send anywhere in R4 surfaces", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/documents/api.ts",
      "src/portal/documents/helpers.ts",
      "src/portal/documents/DocumentsPanel.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/sendgrid|twilio|onesignal|firebase\/messaging|resend|mailgun/i);
      expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
    }
  });

  it("documented raw envelope_id is never carried on the row", () => {
    // Type-level check via the merge function: row never carries envelope_id.
    const rows = mergeDocuments({
      vaultBase: "https://x",
      transactionId: "T",
      requirements: [],
      instances: [
        {
          id: "i",
          form_id: "F",
          status: "sent",
          envelope_id: "env_should_not_leak",
          transaction_id: "T",
          created_at: "2026-06-25T08:00:00Z",
          updated_at: "2026-06-25T08:00:00Z",
        },
      ],
    });
    expect(rows.length).toBe(1);
    expect(rows[0].has_envelope).toBe(true);
    expect((rows[0] as any).envelope_id).toBeUndefined();
    // Serialize the row and confirm the raw envelope_id never appears.
    expect(JSON.stringify(rows[0])).not.toContain("env_should_not_leak");
  });
});
