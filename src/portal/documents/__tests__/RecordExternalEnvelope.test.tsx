// ============================================================================
// AGENT PORTAL · the record-envelope surface, MOUNTED
// ============================================================================
// [XAR-2] is the one that matters: a completion nobody verified must not
// render as a signed agreement. [XAR-6] pins that recording sends nothing.
// ============================================================================

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

jest.mock("@/lib/supabase", () => ({ authFetch: jest.fn() }));
import { authFetch } from "@/lib/supabase";

import RecordExternalEnvelope, {
  type ExternalEnvelopeRow,
} from "../RecordExternalEnvelope";

const TXN = "3fbb0fac-796f-4e93-ba87-e399b55a3abf";
const FI = "35ffc269-4240-400f-9a94-efdde2063094";
// A format-valid id that is NOT any real envelope. The literal that stood here
// belongs to a different transaction entirely, and it was also the input's
// placeholder — which is how a real foreign envelope id came to be the example
// shown to the pilot agent in her own form.
const ENV = "11111111-2222-3333-4444-555555555555";

const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
const posts = () => calls.filter((c) => c.method === "POST");

let reply: { ok: boolean; status: number; json: Record<string, unknown> } = {
  ok: true, status: 200, json: { ok: true, notice: "Envelope recorded.", status: "sent" },
};

// GET /api/esign/status, shaped as Vault's EsignStatus. `null` makes the read
// FAIL, which is a third answer and not the same as "not connected".
const CONNECTED = {
  connected: true, email: "mallory.guth@hartfeltrealestate.com", needs_reconnect: false,
};
let esign: Record<string, unknown> | null = { ...CONNECTED };
// A 200 whose body does not parse. Distinct from a non-200: the component
// reaches `.catch(() => null)` and hands that null to the derivation.
let esignBodyBroken = false;

beforeEach(() => {
  calls.length = 0;
  reply = { ok: true, status: 200, json: { ok: true, notice: "Envelope recorded.", status: "sent" } };
  esign = { ...CONNECTED };
  esignBodyBroken = false;
  (authFetch as jest.Mock).mockImplementation(async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (String(url).includes("/api/esign/status")) {
      if (esignBodyBroken) {
        return {
          ok: true, status: 200,
          json: async () => { throw new Error("unparseable body"); },
        } as unknown as Response;
      }
      if (esign === null) return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
      return { ok: true, status: 200, json: async () => esign } as unknown as Response;
    }
    return {
      ok: reply.ok,
      status: reply.status,
      json: async () => reply.json,
    } as unknown as Response;
  });
  // A bare fetch is the defect this surface shipped with. If one reappears the
  // suite should say so, not quietly succeed on a global the component should
  // never touch.
  global.fetch = jest.fn(() => {
    throw new Error("the component must use authFetch, never a bare fetch");
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
      {...over}
    />,
  );

/** Open the form and wait for the status read to settle. Asserting while it
 *  still says "Checking…" is how a connection test passes without ever having
 *  put the question. */
const openForm = async () => {
  fireEvent.click(screen.getByTestId("open-record-form"));
  await waitFor(() =>
    expect(screen.getByTestId("connection-notice")).not.toHaveTextContent(
      /Checking your DocuSign connection/,
    ),
  );
};

describe("[XAR] record external envelope", () => {
  it("[XAR-1] an approved document offers the form; an unapproved one explains", () => {
    mount();
    expect(screen.getByTestId("open-record-form")).toBeInTheDocument();
    expect(screen.queryByTestId("record-blocked")).toBeNull();

    render(
      <RecordExternalEnvelope
        transactionId={TXN} formInstanceId={FI} formId="ERL-14"
        documentStatus="pending_approval" hasPdf envelopes={[]}
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
    await openForm();
    fireEvent.change(screen.getByLabelText("DocuSign envelope ID"), {
      target: { value: "nope" },
    });
    fireEvent.click(screen.getByTestId("submit-record"));
    await waitFor(() =>
      expect(screen.getByTestId("record-error")).toHaveTextContent(/does not look like/),
    );
    expect(posts()).toHaveLength(0);
  });

  it("[XAR-6] recording POSTs the ID in the BODY, and never to a send surface", async () => {
    mount();
    await openForm();
    fireEvent.change(screen.getByLabelText("DocuSign envelope ID"), {
      target: { value: ENV },
    });
    fireEvent.click(screen.getByTestId("submit-record"));
    // Wait for the NOTICE, not the call count: the fetch is recorded before
    // the awaited json resolves, so a call-count wait lands mid-update.
    await waitFor(() =>
      expect(screen.getByTestId("record-notice")).toBeInTheDocument(),
    );
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body).toEqual({ envelope_id: ENV });
    expect(posts()[0].url).toContain("/api/paperwork/external-envelope/");
    // No send surface, which is also what the nav contract forbids.
    expect(posts()[0].url).not.toMatch(/\/send\b/);
    expect(screen.getByTestId("record-notice")).toHaveTextContent("Envelope recorded.");
  });

  it("[XAR-7] with no connected account the form says it will be UNVERIFIED", async () => {
    esign = { connected: false, email: null, needs_reconnect: false };
    mount();
    await openForm();
    expect(screen.getByTestId("connection-notice")).toHaveTextContent(
      /recorded as UNVERIFIED — a record that you sent it, not that it was signed/,
    );
  });

  it("[XAR-8] with an account it names which one it will check against", async () => {
    mount();
    await openForm();
    expect(screen.getByTestId("connection-notice")).toHaveTextContent(
      /mallory\.guth@hartfeltrealestate\.com/,
    );
    expect(screen.getByTestId("connection-notice")).toHaveTextContent(
      /it will not be recorded/,
    );
    // It ASKED. The sentence used to come from a prop, and the prop was null.
    expect(calls.some((c) => c.url.includes("/api/esign/status"))).toBe(true);
  });

  it("[XAR-9] Vault's refusal is shown VERBATIM, not replaced", async () => {
    // "that envelope is not in the connected account" and "DocuSign could not
    // be reached" mean different things to do; a generic message loses that.
    reply = {
      ok: false, status: 422,
      json: { error: "DocuSign does not have that envelope in the connected account.", code: "not_owned_by_sender" },
    };
    mount();
    await openForm();
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
  // ── the registration blocker, as the pilot agent met it ───────────────────
  // Reported 2026-11-03: the form answered "Unauthorized" and, underneath it,
  // "No DocuSign account connected". Her production row said `connected`, with
  // an access token five days expired. Neither sentence was true as written,
  // and both came from the SAME cause — the mount site passed a hardcoded null
  // for the token and for the email, so one request went out with no
  // Authorization header and the other sentence was chosen with no data.

  it("[XAR-13] a connected account whose token EXPIRED says so, and names the remedy", async () => {
    // Verbatim shape of Mallory's production row: connected AND stale.
    esign = {
      connected: true,
      email: "mallory.guth@hartfeltrealestate.com",
      needs_reconnect: true,
      reconnect_reason: "token_expired",
    };
    mount();
    await openForm();
    const notice = screen.getByTestId("connection-notice");
    // Not "no account is connected" — she has one.
    expect(notice).not.toHaveTextContent(/No DocuSign account is connected/);
    expect(notice).toHaveTextContent(/has expired/);
    expect(notice).toHaveTextContent(/mallory\.guth@hartfeltrealestate\.com/);
    // A state the agent can act on is worth nothing without the action.
    expect(notice).toHaveTextContent(/Settings/);
  });

  it("[XAR-14] a status read that FAILS claims neither connected nor disconnected", async () => {
    esign = null; // the GET answers 503
    mount();
    await openForm(); // settles OFF "Checking…", so this cannot pass vacuously
    const notice = screen.getByTestId("connection-notice");
    expect(notice).toHaveTextContent(/could not check your DocuSign connection/);
    // It asked, and the answer was "could not tell" — not the default.
    expect(calls.some((c) => c.url.includes("/api/esign/status"))).toBe(true);
    // The failure mode that produced this report was asserting the negative
    // from an absence of data. Not knowing is its own answer.
    expect(notice).not.toHaveTextContent(/No DocuSign account is connected/);
    expect(notice).not.toHaveTextContent(/will check this against your connected/);
    // And it still does not block the recording.
    expect(screen.getByTestId("submit-record")).not.toBeDisabled();
  });

  it("[XAR-15] every request carries auth — authFetch, never a bare fetch", async () => {
    mount();
    await openForm();
    fireEvent.change(screen.getByLabelText("DocuSign envelope ID"), {
      target: { value: ENV },
    });
    fireEvent.click(screen.getByTestId("submit-record"));
    await waitFor(() =>
      expect(screen.getByTestId("record-notice")).toBeInTheDocument(),
    );
    // The POST went through authFetch, which attaches the Bearer token from
    // the cached session. A bare fetch would have thrown (see beforeEach), and
    // in production it simply sent no header at all and came back 401.
    expect(authFetch as jest.Mock).toHaveBeenCalled();
    expect(posts()).toHaveLength(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("[XAR-16] the example id shown to the agent is not a real envelope", async () => {
    mount();
    await openForm();
    const input = screen.getByLabelText("DocuSign envelope ID") as HTMLInputElement;
    // It must not be a usable id at all: the one that stood here belonged to
    // another transaction, and a placeholder is read as an example to follow.
    expect(input.placeholder).not.toMatch(/^[0-9a-f]{8}-/i);
    expect(input.placeholder).toMatch(/^x+-x+-x+-x+-x+$/);
  });
  it("[XAR-17] a 200 with an unreadable body is UNKNOWN, not 'no account'", async () => {
    // The route answered. The body did not parse, so the component's
    // `.catch(() => null)` hands a null to the derivation — and 'none' there
    // would reprint the exact sentence this whole fix removed.
    esignBodyBroken = true;
    mount();
    await openForm();
    const notice = screen.getByTestId("connection-notice");
    expect(notice).toHaveTextContent(/could not check your DocuSign connection/);
    expect(notice).not.toHaveTextContent(/No DocuSign account is connected/);
  });
});
