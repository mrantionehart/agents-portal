// ============================================================================
// AGENT PORTAL · the external-envelope entry point is REACHABLE
// ============================================================================
// This repo's standard: a component that exists but is not mounted is not a
// feature, and a source assertion does not prove it mounts. So this renders
// the real DocumentsPanel and asks whether an agent looking at an APPROVED
// document can actually get to the record action.
//
// [XAE-2] is the control: an unapproved document must NOT offer it.
// ============================================================================

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import DocumentsPanel from "../DocumentsPanel";
import type { DocumentRow } from "../types";

const TXN = "3fbb0fac-796f-4e93-ba87-e399b55a3abf";
const FI = "35ffc269-4240-400f-9a94-efdde2063094";
const ENV = "37653a88-a887-81f9-8054-a39d821fb0c8";

const doc = (over: Partial<DocumentRow> = {}): DocumentRow =>
  ({
    form_id: "ERL-14",
    form_revision: "Rev 1/2026",
    form_category: "listing",
    reason: null,
    status: "approved",
    missing_fields_count: 0,
    has_envelope: false,
    signed_at: null,
    updated_at: "2026-10-30T18:00:00Z",
    required: true,
    downloadable: true,
    form_instance_id: FI,
    lifecycle_status: "generated",
    needs_attention: false,
    attention_reason: null,
    ...over,
  }) as unknown as DocumentRow;

describe("[XAE] the external-envelope entry point in DocumentsPanel", () => {
  it("[XAE-1] an APPROVED document reaches the record action", () => {
    render(
      <DocumentsPanel documents={[doc()]} error={null} transactionId={TXN} activeFormId={null} />,
    );
    const block = screen.getByTestId("external-ERL-14");
    expect(block).toBeInTheDocument();
    expect(within(block).getByTestId("open-record-form")).toBeInTheDocument();
    expect(block).toHaveTextContent(/Vault cannot send ERL-14 for signature/);
    expect(block).toHaveTextContent(/Recording never sends anything/);
  });

  it("[XAE-2] an unapproved document does NOT offer it — the control", () => {
    render(
      <DocumentsPanel
        documents={[doc({ status: "pending_approval" })]}
        error={null}
        transactionId={TXN}
        activeFormId={null}
      />,
    );
    expect(screen.queryByTestId("external-ERL-14")).toBeNull();
    expect(screen.queryByTestId("open-record-form")).toBeNull();
  });

  it("[XAE-3] a recorded envelope's status and verification show in the panel", () => {
    render(
      <DocumentsPanel
        documents={[
          doc({
            external_envelopes: [
              {
                id: "row-1", envelope_id: ENV, status: "completed", verified: true,
                sent_at: "2026-10-30T18:00:00Z",
                sending_account_email: "mallory@hartfeltrealestate.com",
                has_executed_pdf: true, has_certificate: true,
              },
            ],
          } as Partial<DocumentRow>),
        ]}
        error={null}
        transactionId={TXN}
        activeFormId={null}
      />,
    );
    const block = screen.getByTestId("external-ERL-14");
    expect(within(block).getByTestId("envelope-status-row-1")).toHaveTextContent("Completed");
    expect(within(block).getByTestId("envelope-verified-row-1")).toHaveTextContent("Verified");
    // Requirement 10: one envelope, and no way to record a second.
    expect(within(block).queryByTestId("open-record-form")).toBeNull();
    expect(within(block).getByTestId("refresh-row-1")).toBeInTheDocument();
  });

  it("[XAE-4] an UNVERIFIED record is never shown as a signed agreement", () => {
    render(
      <DocumentsPanel
        documents={[
          doc({
            external_envelopes: [
              {
                id: "row-9", envelope_id: ENV, status: "completed", verified: false,
                sent_at: null, sending_account_email: null,
                has_executed_pdf: false, has_certificate: false,
              },
            ],
          } as Partial<DocumentRow>),
        ]}
        error={null}
        transactionId={TXN}
        activeFormId={null}
      />,
    );
    const block = screen.getByTestId("external-ERL-14");
    expect(within(block).getByTestId("envelope-verified-row-9")).toHaveTextContent("UNVERIFIED");
    expect(within(block).getByTestId("envelope-status-row-9").className).not.toMatch(/emerald/);
    expect(block).toHaveTextContent(/not that it was signed/);
  });

  it("[XAE-4b] the record request carries THIS document's form instance id", async () => {
    // Mounted end to end: without this, passing an empty or wrong id through
    // the panel is invisible — the component's own URL test cannot see what
    // the panel handed it, and the POST would hit a URL missing a segment.
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: unknown) => {
      calls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ ok: true, notice: "Envelope recorded." }) } as unknown as Response;
    }) as unknown as typeof fetch;

    render(
      <DocumentsPanel documents={[doc()]} error={null} transactionId={TXN} activeFormId={null} />,
    );
    const block = screen.getByTestId("external-ERL-14");
    fireEvent.click(within(block).getByTestId("open-record-form"));
    fireEvent.change(within(block).getByLabelText("DocuSign envelope ID"), {
      target: { value: ENV },
    });
    fireEvent.click(within(block).getByTestId("submit-record"));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toBe(
      `/api/paperwork/external-envelope/${TXN}/${FI}`,
    );
  });

  it("[XAE-5] the panel offers no send control anywhere", () => {
    const { container } = render(
      <DocumentsPanel documents={[doc()]} error={null} transactionId={TXN} activeFormId={null} />,
    );
    const block = screen.getByTestId("external-ERL-14");
    for (const b of Array.from(block.querySelectorAll("button"))) {
      const t = (b.textContent ?? "").toLowerCase();
      expect(t).not.toContain("send");
      expect(t).not.toContain("resend");
    }
    // And nothing anywhere in the panel links at a send surface.
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect((a.getAttribute("href") ?? "").toLowerCase()).not.toMatch(/\/send\b/);
    }
  });
});
