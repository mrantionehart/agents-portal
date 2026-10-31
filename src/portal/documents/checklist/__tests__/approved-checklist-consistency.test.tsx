// ============================================================================
// P4H · the checklist and the panel must agree
// ============================================================================
// Mallory reported "still shows Draft" after the status-sync release. The
// DocumentsPanel was fixed; the ChecklistTable — which renders ABOVE it on the
// same tab — carried a THIRD hand-written copy of Vault's status vocabulary,
// so an approved agreement read "Required — Not ready yet" at the top of the
// screen while the panel below said "Approved".
//
// Fifth drifting allowlist in two days, and the reason this file asserts
// AGREEMENT between the two surfaces rather than each one alone: every
// previous test proved one surface and none proved they said the same thing.
// ============================================================================

import { mapVaultStatusToLabel, selectabilityFor } from "../checklist-logic";
import { lifecycleLabel, resolveStatus, statusLabel } from "../../helpers";
import { KNOWN_STATUSES } from "../../shared-types";
import type { FormInstanceRow } from "../../types";

const card = (status: string, over = {}) =>
  ({ status, manual_only: false, has_upload: true, ...over }) as never;

describe("[CKA] checklist status, and agreement with the panel", () => {
  it("[CKA-1] the reported defect: approved is not 'Required'", () => {
    expect(mapVaultStatusToLabel("approved")).toBe("Approved — Awaiting Signature");
    expect(mapVaultStatusToLabel("approved")).not.toBe("Required");
  });

  it("[CKA-2] the two broker-decision states say WHICH they are", () => {
    expect(mapVaultStatusToLabel("pending_approval")).toBe("Pending Broker Approval");
    expect(mapVaultStatusToLabel("changes_requested")).toBe("Changes Requested");
  });

  it("[CKA-3] signed stays DISTINCT from broker approval", () => {
    // `signed` used to render as 'Approved'. With a broker-approved document
    // labelled "Approved — Awaiting Signature", the shorter string sat on the
    // MORE advanced state — the confusion that produced the report.
    expect(mapVaultStatusToLabel("signed")).toBe("Signed");
    expect(mapVaultStatusToLabel("signed")).not.toBe(mapVaultStatusToLabel("approved"));
    expect(mapVaultStatusToLabel("sent")).toBe("Sent");
  });

  it("[CKA-4] an approved document is SELECTABLE — it is the state that is ready", () => {
    expect(selectabilityFor(card("approved")).selectable).toBe(true);
    expect(selectabilityFor(card("approved")).reason).toBeUndefined();
    // It used to fall to the catch-all and read the opposite of true.
    expect(selectabilityFor(card("approved")).reason).not.toBe("Not ready yet");
  });

  it("[CKA-5] the pending states are not selectable, and say why", () => {
    expect(selectabilityFor(card("pending_approval"))).toEqual({
      selectable: false, reason: "Pending broker approval",
    });
    expect(selectabilityFor(card("changes_requested"))).toEqual({
      selectable: false, reason: "Broker requested changes",
    });
  });

  it("[CKA-6] a manual-only form still needs its upload first — unchanged", () => {
    // The manual-only rule is checked BEFORE status, so approval must not
    // smuggle a form past it.
    expect(selectabilityFor(card("approved", { manual_only: true, has_upload: false })))
      .toEqual({ selectable: false, reason: "Upload the completed PDF first" });
    expect(selectabilityFor(card("approved", { manual_only: true, has_upload: true })).selectable)
      .toBe(true);
    // And blocked still outranks everything.
    expect(selectabilityFor(card("blocked")).selectable).toBe(false);
    expect(selectabilityFor(card("voided")).selectable).toBe(false);
  });

  it("[CKA-7] CONSISTENCY: neither surface calls Mallory's ERL-14 a draft", () => {
    // Her row: Vault status `approved`, Vault lifecycle `approved`.
    const inst = { form_id: "ERL-14", status: "approved" } as FormInstanceRow;
    const panelStatus = resolveStatus({ form_id: "ERL-14" }, inst);

    const checklist = mapVaultStatusToLabel("approved");
    const panelChip = lifecycleLabel("approved", panelStatus);
    const panelBadge = statusLabel(panelStatus);

    for (const label of [checklist, panelChip, panelBadge]) {
      expect(label).not.toMatch(/draft/i);
      expect(label).not.toBe("Required");
      expect(label).not.toBe("In Progress");
    }
    // Both surfaces name the same underlying state.
    expect(checklist).toMatch(/^Approved/);
    expect(panelChip).toMatch(/^Approved/);
    expect(panelBadge).toMatch(/^Approved/);
  });

  it("[CKA-8] every canonical status has a checklist label — no silent default", () => {
    // The root cause was a status reaching the `default` branch. Nothing in
    // the canonical vocabulary may do that any more.
    for (const s of KNOWN_STATUSES) {
      const label = mapVaultStatusToLabel(s);
      if (s === "recommended" || s === "required") {
        expect(label).toBe("Required");
      } else {
        expect(label).not.toBe("Required");
      }
    }
  });
});
