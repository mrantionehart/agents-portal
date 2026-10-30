// ============================================================================
// AGENT PORTAL · the record-envelope surface, MOUNTED
// ============================================================================
// [XAR-2] is the one that matters: a completion nobody verified must not
// render as a signed agreement. [XAR-6] pins that recording sends nothing.
// ============================================================================

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import RecordExternalEnvelope, {
  type ExternalEnvelopeRow,
} from "../RecordExternalEnvelope";

const TXN = "3fbb0fac-796f-4e93-ba87-e399b55a3abf";
const FI = "35ffc269-4240-400f-9a94-efdde2063094";
const ENV = "37653a88-a887-81f9-8054-a39d821fb0c8";

const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
let reply: { ok: boolean; status: number; json: Record<string, unknown> } = {
  ok: true, status: 200, json: { ok: true, notice: "Envelope recorded.", status: "sent" },
};

beforeEach(() => {
  calls.length = 0;
  reply = { ok: true, status: 200, json: { ok: true, notice: "Envelope recorded.", status: "sent" } };
  global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return {
      ok: reply.ok,
      status: reply.status,
      json: async () => reply.json,
    } as unknown as Response;
  }) as unknown as typeof fetch;
});

const row = (over: Partial<ExternalEnvelopeRow> = {}): ExternalEnvelopeRow => ({
  id: "row-1",
  envelope_id: ENV,
  status: "sent",
  verified: true,
  sent_at: "2026-10-30T18:00:00Z",
  sending_account_email: "mallory@hartfeltrealestate.com",
  has_executed_pdf: false,
  has_certificate: false,
  ...over,
});

const mount = (over: Record<string, unknown> = {}) =>
  render(
    <RecordExternalEnvelope
      transactionId={TXN}
      formInstanceId={FI}
      formId="ERL-14"
      documentStatus="approved"
      hasPdf
      envelopes={[]}
      sendingAccountEmail="mallory@hartfeltrealestate.com"
      accessToken="tok"
      {...over}
    />,
  );

describe("[XAR] record external envelope", () => {
  it("[XAR-1] an approved document offers the form; an unapproved one explains", () => {
    mount();
    expect(screen.getByTestId("open-record-form")).toBeInTheDocument();
    expect(screen.queryByTestId("record-blocked")).toBeNull();

    render(
      <RecordExternalEnvelope
        transactionId={TXN} formInstanceId={FI} formId="ERL-14"
        documentStatus="pending_approval" hasPdf envelopes={[]}
        sendingAccountEmail={null} accessToken="tok"
      />,
    );
    expect(screen.getByTestId("record-blocked")).toHaveTextContent(
      /broker has to approve this document/,
    );
  });

  it("[XAR-2] an UNVERIFIED completion never reads as a signed agreement", () => {
    mount({ envelopes: [row({ status: "completed", verified: false })] });
    const badge = screen.getByTestId("envelope-verified-row-1");
    expect(badge).toHaveTextContent("UNVERIFIED");
    // Not the good tone — a green "Completed" is the thing to prevent.
    const status = screen.getByTestId("envelope-status-row-1");
    expect(status.className).not.toMatch(/emerald/);
    expect(status.className).toMatch(/amber/);
    expect(screen.getByTestId("envelope-row-1")).toHaveTextContent(
      /not that it was signed/,
    );
    // And no artifact line is claimed for it.
    expect(screen.queryByTestId("artifacts-row-1")).toBeNull();
  });

  it("[XAR-3] a verified completion shows both artifacts' state", () => {
    mount({
      envelopes: [row({ status: "completed", verified: true, has_executed_pdf: true, has_certificate: true })],
    });
    expect(screen.getByTestId("envelope-status-row-1").className).toMatch(/emerald/);
    expect(screen.getByTestId("artifacts-row-1")).toHaveTextContent("Executed document stored");
    expect(screen.getByTestId("artifacts-row-1")).toHaveTextContent("certificate of completion stored");
  });

  it("[XAR-4] all six statuses render with their own label", () => {
    for (const [status, label] of [
      ["sent", "Sent"], ["delivered", "Delivered"], ["completed", "Completed"],
      ["declined", "Declined"], ["voided", "Voided"], ["expired", "Expired"],
    ] as const) {
      const { unmount } = mount({ envelopes: [row({ status, verified: true })] });
      expect(screen.getByTestId("envelope-status-row-1")).toHaveTextContent(label);
      unmount();
    }
  });

  it("[XAR-5] a malformed ID is caught locally — no request is made", async () => {
    mount();
    fireEvent.click(screen.getByTestId("open-record-form"));
    fireEvent.change(screen.getByLabelText("DocuSign envelope ID"), {
      target: { value: "nope" },
    });
    fireEvent.click(screen.getByTestId("submit-record"));
    await waitFor(() =>
      expect(screen.getByTestId("record-error")).toHaveTextContent(/does not look like/),
    );
    expect(calls).toHaveLength(0);
  });

  it("[XAR-6] recording POSTs the ID in the BODY, and never to a send surface", async () => {
    mount();
    fireEvent.click(screen.getByTestId("open-record-form"));
    fireEvent.change(screen.getByLabelText("DocuSign envelope ID"), {
      target: { value: ENV },
    });
    fireEvent.click(screen.getByTestId("submit-record"));
    // Wait for the NOTICE, not the call count: the fetch is recorded before
    // the awaited json resolves, so a call-count wait lands mid-update.
    await waitFor(() =>
      expect(screen.getByTestId("record-notice")).toBeInTheDocument(),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ envelope_id: ENV });
    expect(calls[0].url).toContain("/api/paperwork/external-envelope/");
    // No send surface, which is also what the nav contract forbids.
    expect(calls[0].url).not.toMatch(/\/send\b/);
    expect(screen.getByTestId("record-notice")).toHaveTextContent("Envelope recorded.");
  });

  it("[XAR-7] with no connected account the form says it will be UNVERIFIED", () => {
    mount({ sendingAccountEmail: null });
    fireEvent.click(screen.getByTestId("open-record-form"));
    expect(screen.getByTestId("record-form")).toHaveTextContent(
      /recorded as UNVERIFIED — a record that you sent it, not that it was signed/,
    );
  });

  it("[XAR-8] with an account it names which one it will check against", () => {
    mount();
    fireEvent.click(screen.getByTestId("open-record-form"));
    expect(screen.getByTestId("record-form")).toHaveTextContent(
      /mallory@hartfeltrealestate\.com/,
    );
    expect(screen.getByTestId("record-form")).toHaveTextContent(/it will not be recorded/);
  });

  it("[XAR-9] Vault's refusal is shown VERBATIM, not replaced", async () => {
    // "that envelope is not in the connected account" and "DocuSign could not
    // be reached" mean different things to do; a generic message loses that.
    reply = {
      ok: false, status: 422,
      json: { error: "DocuSign does not have that envelope in the connected account.", code: "not_owned_by_sender" },
    };
    mount();
    fireEvent.click(screen.getByTestId("open-record-form"));
    fireEvent.change(screen.getByLabelText("DocuSign envelope ID"), { target: { value: ENV } });
    fireEvent.click(screen.getByTestId("submit-record"));
    await waitFor(() =>
      expect(screen.getByTestId("record-error")).toHaveTextContent(
        "DocuSign does not have that envelope in the connected account.",
      ),
    );
  });

  it("[XAR-10] a recorded envelope offers Refresh and NOT a second record", () => {
    mount({ envelopes: [row()] });
    expect(screen.getByTestId("refresh-row-1")).toBeInTheDocument();
    // Requirement 9 on screen: the record button is gone once one exists.
    expect(screen.queryByTestId("open-record-form")).toBeNull();
  });

  it("[XAR-11] Refresh asks Vault and reports what DocuSign said", async () => {
    reply = { ok: true, status: 200, json: { ok: true, status: "completed", verified: true } };
    mount({ envelopes: [row()] });
    fireEvent.click(screen.getByTestId("refresh-row-1"));
    await waitFor(() =>
      expect(screen.getByTestId("record-notice")).toBeInTheDocument(),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/paperwork/external-envelope/refresh/row-1");
    expect(calls[0].body).toBeUndefined();
    expect(screen.getByTestId("record-notice")).toHaveTextContent(/fully executed/);
  });

  it("[XAR-12] the surface offers no way to send anything", () => {
    const { container } = mount({ envelopes: [row()] });
    const labels = Array.from(container.querySelectorAll("button")).map(
      (b) => (b.textContent ?? "").toLowerCase(),
    );
    for (const l of labels) {
      expect(l).not.toContain("send");
      expect(l).not.toContain("resend");
      expect(l).not.toContain("remind");
    }
  });
});
