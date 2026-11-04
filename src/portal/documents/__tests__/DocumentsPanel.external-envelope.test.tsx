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

jest.mock("@/lib/supabase", () => ({ authFetch: jest.fn() }));
import { authFetch } from "@/lib/supabase";

import DocumentsPanel from "../DocumentsPanel";
import type { DocumentRow } from "../types";

const TXN = "3fbb0fac-796f-4e93-ba87-e399b55a3abf";
const FI = "35ffc269-4240-400f-9a94-efdde2063094";
// Format-valid, and deliberately not any real envelope — the id that stood
// here belongs to another transaction entirely.
const ENV = "11111111-2222-3333-4444-555555555555";

const CONNECTED = {
  connected: true, email: "mallory.guth@hartfeltrealestate.com", needs_reconnect: false,
};
let esign: Record<string, unknown> = { ...CONNECTED };
const calls: Array<{ url: string; method?: string }> = [];

beforeEach(() => {
  calls.length = 0;
  esign = { ...CONNECTED };
  (authFetch as jest.Mock).mockImplementation(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method });
    if (String(url).includes("/api/esign/status")) {
      return { ok: true, status: 200, json: async () => esign } as unknown as Response;
    }
    return {
      ok: true, status: 200,
      json: async () => ({ ok: true, notice: "Envelope recorded." }),
    } as unknown as Response;
  });
  global.fetch = jest.fn(() => {
    throw new Error("the mounted surface must use authFetch, never a bare fetch");
  }) as unknown as typeof fetch;
});

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

  it("[XAE-4b] the record request carries THIS document's form instance id — AND auth", async () => {
    // Mounted end to end: without this, passing an empty or wrong id through
    // the panel is invisible — the component's own URL test cannot see what
    // the panel handed it, and the POST would hit a URL missing a segment.
    //
    // 🔑 2026-11-03 — THIS TEST ALREADY EXISTED AND DID NOT CATCH THE DEFECT.
    // It recorded the URL and nothing else, so a mount site that passed
    // `accessToken={null}` into a bare `fetch` produced a request with no
    // Authorization header at all, a 401 from the proxy before Vault was ever
    // asked — and a green test. Asserting the path proves the request was
    // addressed correctly, not that it could possibly succeed.
    render(
      <DocumentsPanel documents={[doc()]} error={null} transactionId={TXN} activeFormId={null} />,
    );
    const block = screen.getByTestId("external-ERL-14");
    fireEvent.click(within(block).getByTestId("open-record-form"));
    fireEvent.change(within(block).getByLabelText("DocuSign envelope ID"), {
      target: { value: ENV },
    });
    fireEvent.click(within(block).getByTestId("submit-record"));

    const posts = () => calls.filter((c) => c.method === "POST");
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url).toBe(`/api/paperwork/external-envelope/${TXN}/${FI}`);
    // The request went through authFetch, which attaches the Bearer token from
    // the cached session. Nothing is threaded in from here, so there is no
    // longer a prop at this mount site that could arrive null.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("[XAE-6] the MOUNTED surface reads the real connection — it is not told one", async () => {
    // The second half of the same defect. The panel passed
    // `sendingAccountEmail={null}`, and the form chose its sentence off that
    // prop, so a pilot agent with a live DocuSign connection was told "No
    // DocuSign account is connected". The panel now hands down no account
    // information at all and the surface asks.
    render(
      <DocumentsPanel
        documents={[doc()]}
        error={null}
        transactionId={TXN}
        activeFormId={null}
        paperworkPackageUrl=""
      />,
    );
    const block = screen.getByTestId("external-ERL-14");
    fireEvent.click(within(block).getByTestId("open-record-form"));
    await waitFor(() =>
      expect(within(block).getByTestId("connection-notice")).toHaveTextContent(
        /mallory\.guth@hartfeltrealestate\.com/,
      ),
    );
    expect(within(block).getByTestId("connection-notice")).not.toHaveTextContent(
      /No DocuSign account is connected/,
    );
    expect(calls.some((c) => c.url.includes("/api/esign/status"))).toBe(true);
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
