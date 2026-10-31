// ============================================================================
// P4H · the full path, from Vault's payload to the Record action
// ============================================================================
// Production, 2026-10-31. Vault: ERL-14 approved, 4/4 acknowledged.
// Agent Portal: "ERL-14 DRAFT, 9 fields outstanding, no Record action".
//
// Three symptoms from two causes. Vault's half (lifecycle `draft`) is fixed
// in hartfelt-vault [ALP-*]. This file covers the Portal's half and, more
// importantly, the WHOLE PATH: a real Vault payload through mergeDocuments
// into the mounted panel. Each previous test proved one hop and none proved
// the journey, which is how a status survived the type system and died in a
// hand-written allowlist.
//
// [ASY-1] is the regression. [ASY-5] is why it happened: the canonical list
// now has a consumer, so it cannot drift again without breaking.
// ============================================================================

import { render, screen, within } from "@testing-library/react";

import DocumentsPanel from "../DocumentsPanel";
import { mergeDocuments, resolveStatus, missingFieldsCopy, lifecycleLabel, lifecycleTone } from "../helpers";
import { KNOWN_STATUSES } from "../shared-types";
import type { FormInstanceRow, RequirementRow } from "../types";

const TXN = "3fbb0fac-796f-4e93-ba87-e399b55a3abf";
const FI = "35ffc269-4240-400f-9a94-efdde2063094";

/** Mallory's ERL-14 as Vault's GET /forms actually reports it. */
const VAULT_INSTANCE = {
  id: FI,
  form_id: "ERL-14",
  form_revision: "Rev 1/2026",
  form_category: "listing",
  status: "approved",
  transaction_id: TXN,
  updated_at: "2026-10-30T16:45:55Z",
  created_at: "2026-10-28T21:32:11Z",
  lifecycle: { lifecycle_status: "approved", needs_attention: false, attention_reason: null },
  external_envelopes: [],
} as unknown as FormInstanceRow;

/** The nine Generate requirements the rule engine still emits. */
const VAULT_REQUIREMENT: RequirementRow = {
  form_id: "ERL-14",
  form_revision: "Rev 1/2026",
  form_category: "listing",
  required: true,
  required_fields: Array.from({ length: 9 }, (_, i) => ({
    form_field_id: `f${i}`, transaction_path: `terms.listing.f${i}`, severity: "high", required: true,
  })),
};

const rows = (instances: FormInstanceRow[] = [VAULT_INSTANCE]) =>
  mergeDocuments({ vaultBase: "https://v.test", transactionId: TXN, requirements: [VAULT_REQUIREMENT], instances });

describe("[ASY] approved survives the whole path", () => {
  it("[ASY-1] the reported defect: approved does NOT become in_progress", () => {
    const [row] = rows();
    expect(row.status).toBe("approved");
    expect(row.status).not.toBe("in_progress");
  });

  it("[ASY-2] the chip reads Approved, not Draft, and is not muted", () => {
    const [row] = rows();
    expect(lifecycleLabel(row.lifecycle_status ?? null, row.status)).toBe("Approved");
    expect(lifecycleLabel(row.lifecycle_status ?? null, row.status)).not.toBe("Draft");
    // Left at the default it rendered in the same grey as a draft, which is
    // most of why the two were indistinguishable on the row.
    expect(lifecycleTone(row.lifecycle_status ?? null)).toBe("ok");
    expect(lifecycleTone(row.lifecycle_status ?? null)).not.toBe("muted");
  });

  it("[ASY-3] the nine Generate fields are PRESERVED but do not read as blocking", () => {
    // Item 5: they must not override an approved upload. They are Vault's
    // record gaps, which is a different thing from the agreement being
    // unfinished.
    const [row] = rows();
    expect(row.missing_fields_count).toBe(9);
    const copy = missingFieldsCopy(row.missing_fields_count, row.status)!;
    expect(copy).toMatch(/not recorded in Vault/);
    expect(copy).toMatch(/the agreement is approved/);
    expect(copy).not.toMatch(/outstanding/);
    // And an unapproved document still says what it always said.
    expect(missingFieldsCopy(9, "in_progress")).toBe("9 required fields outstanding");
  });

  it("[ASY-4] MOUNTED: the Record External Envelope action is reachable", () => {
    // The symptom that actually blocked the agent. `showExternal` keys on
    // `approved`, so the dropped status hid it entirely.
    render(<DocumentsPanel documents={rows()} error={null} transactionId={TXN} activeFormId={null} />);
    const block = screen.getByTestId("external-ERL-14");
    expect(within(block).getByTestId("open-record-form")).toBeInTheDocument();
    // And the ROW says Approved, not Draft. Scoped to the row: the panel also
    // carries static summary-tile labels, and "In Progress" there is chrome,
    // not this document's status — asserting on the whole panel matched the
    // tile and sent me looking for a defect that was my assertion.
    const row = block.closest("li")!;
    expect(within(row).getByText("Approved")).toBeInTheDocument();
    expect(within(row).queryByText("Draft")).toBeNull();
    expect(within(row).queryByText("In Progress")).toBeNull();
  });

  it("[ASY-4b] an approved document is COUNTED, not invisible in every tile", () => {
    // The fourth display site, and the fourth copy of the same drift: the
    // counts switch had no case for the approval states, so an approved
    // document contributed to nothing while `total` still counted it.
    const { documentCounts } = require("../helpers") as typeof import("../helpers");
    const c = documentCounts(rows());
    expect(c.total).toBe(1);
    expect(c.ready + c.blocked + c.signed + c.in_progress + c.not_started).toBe(1);
    expect(c.ready).toBe(1);
    // An approved agreement is waiting on a send, not on the agent.
    expect(c.needs_attention).toBe(0);
  });

  it("[ASY-5] resolveStatus reads the CANONICAL list, so it cannot drift again", () => {
    // The root cause was two sources of truth: KNOWN_STATUSES existed and
    // nothing consulted it, so widening the type left the allowlist behind.
    for (const s of KNOWN_STATUSES) {
      expect(resolveStatus({ form_id: "X" }, { form_id: "X", status: s } as FormInstanceRow)).toBe(s);
    }
    // A status Vault has not got still degrades rather than leaking.
    expect(resolveStatus({ form_id: "X" }, { form_id: "X", status: "nonsense" } as FormInstanceRow))
      .toBe("in_progress");
    expect(resolveStatus({ form_id: "X" }, null)).toBe("not_started");
  });

  it("[ASY-6] an unapproved document still offers no Record action — the control", () => {
    const pending = { ...VAULT_INSTANCE, status: "pending_approval",
      lifecycle: { lifecycle_status: "pending_approval", needs_attention: false, attention_reason: null } } as unknown as FormInstanceRow;
    const [row] = rows([pending]);
    expect(row.status).toBe("pending_approval");
    render(<DocumentsPanel documents={rows([pending])} error={null} transactionId={TXN} activeFormId={null} />);
    expect(screen.queryByTestId("external-ERL-14")).toBeNull();
    expect(screen.getByText("Awaiting broker")).toBeInTheDocument();
  });

  it("[ASY-7] a recorded envelope shows its verification on the approved row", () => {
    const withEnv = {
      ...VAULT_INSTANCE,
      external_envelopes: [{
        id: "row-1", envelope_id: "aaaaaaaa-1111-2222-3333-444444444444",
        status: "completed", verified: true, sent_at: "2026-10-31T12:00:00Z",
        sending_account_email: "mallory@hartfeltrealestate.com",
        has_executed_pdf: true, has_certificate: true,
      }],
    } as unknown as FormInstanceRow;
    render(<DocumentsPanel documents={rows([withEnv])} error={null} transactionId={TXN} activeFormId={null} />);
    const block = screen.getByTestId("external-ERL-14");
    expect(within(block).getByTestId("envelope-status-row-1")).toHaveTextContent("Completed");
    expect(within(block).getByTestId("envelope-verified-row-1")).toHaveTextContent("Verified");
  });
});
