/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION ASSISTANT 4.0D — AIAssistantPanel tests
// ============================================================================
// RTL. Injected fetch + getToken. Covers: send + grounded render, confidence
// label (no %), collapsible evidence (friendly sources, no internal terms),
// navigation-only suggested actions, warnings, draft card, error states,
// auto-send-once + URL strip + no-resend, no-duplicate-requests, and the
// no-markdown / no-HTML-injection guarantees.

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
}));

import AIAssistantPanel from "../AIAssistantPanel";
import type { AssistantEnvelope } from "../ai/assistant-types";

function envelope(over: Partial<AssistantEnvelope> = {}): AssistantEnvelope {
  return {
    request_id: "req-1",
    context_version: "4.0B.1",
    directive_version: "3.4A",
    assistant_version: "4.0C.0",
    answer: "You're waiting on broker approval.",
    sources: ["Coordinator"],
    evidence: [{ source: "Coordinator", fact: "Workflow state is awaiting_broker" }],
    confidence: "high",
    suggested_actions: [],
    draft: null,
    warnings: [],
    ...over,
  };
}

function okFetch(env: AssistantEnvelope) {
  return jest.fn(async () => ({ ok: true, status: 200, json: async () => env })) as unknown as typeof fetch;
}
function errFetch(status: number, code: string) {
  return jest.fn(async () => ({ ok: false, status, json: async () => ({ error: { code } }) })) as unknown as typeof fetch;
}

const getToken = async () => "tkn";

beforeEach(() => {
  mockPush.mockClear();
});

async function type(text: string) {
  fireEvent.change(screen.getByTestId("assistant-input"), { target: { value: text } });
}

describe("send + grounded render", () => {
  it("renders the answer and a High confidence label (no percentage)", async () => {
    render(<AIAssistantPanel transactionId="txn-1" fetchImpl={okFetch(envelope())} getToken={getToken} />);
    await type("who are we waiting on?");
    fireEvent.click(screen.getByTestId("assistant-send"));

    await screen.findByTestId("msg-answer");
    expect(screen.getByTestId("msg-answer")).toHaveTextContent("You're waiting on broker approval.");
    const conf = screen.getByTestId("assistant-confidence");
    expect(conf).toHaveTextContent("Confidence High");
    expect(conf.textContent).not.toMatch(/\d/);
  });

  it("evidence is collapsed by default and hides internal engine names when expanded", async () => {
    render(<AIAssistantPanel transactionId="txn-1" fetchImpl={okFetch(envelope())} getToken={getToken} />);
    await type("why?");
    fireEvent.click(screen.getByTestId("assistant-send"));
    await screen.findByTestId("msg-answer");

    // collapsed
    expect(screen.queryByTestId("assistant-evidence")).toBeNull();
    fireEvent.click(screen.getByTestId("assistant-evidence-toggle"));
    const ev = screen.getByTestId("assistant-evidence");
    expect(ev).toHaveTextContent("Deal status"); // friendly
    expect(ev).not.toHaveTextContent("Coordinator"); // never the internal name
    // hide again
    fireEvent.click(screen.getByTestId("assistant-evidence-toggle"));
    expect(screen.queryByTestId("assistant-evidence")).toBeNull();
  });

  it("suggested actions render as navigation-only buttons", async () => {
    const env = envelope({ suggested_actions: [{ label: "Open the package", tab: "package" }] });
    render(<AIAssistantPanel transactionId="txn-1" fetchImpl={okFetch(env)} getToken={getToken} />);
    await type("next?");
    fireEvent.click(screen.getByTestId("assistant-send"));
    await screen.findByTestId("msg-answer");

    fireEvent.click(screen.getByTestId("assistant-action"));
    expect(mockPush).toHaveBeenCalledWith("/workspace/txn-1?tab=package");
  });

  it("renders warnings when present", async () => {
    const env = envelope({ warnings: ["Deadline data was unavailable; dates may be incomplete."] });
    render(<AIAssistantPanel transactionId="txn-1" fetchImpl={okFetch(env)} getToken={getToken} />);
    await type("summary");
    fireEvent.click(screen.getByTestId("assistant-send"));
    await screen.findByTestId("msg-answer");
    expect(screen.getByTestId("assistant-warnings")).toHaveTextContent("Deadline data was unavailable");
  });

  it("renders a review-only draft card when a draft is returned", async () => {
    const env = envelope({ draft: { channel: "email", audience: "buyer", subject: "Update", body: "Hi there." } });
    render(<AIAssistantPanel transactionId="txn-1" fetchImpl={okFetch(env)} getToken={getToken} />);
    await type("draft an email to the buyer");
    fireEvent.click(screen.getByTestId("assistant-send"));
    await screen.findByTestId("msg-answer");
    const card = screen.getByTestId("assistant-draft-card");
    expect(card).toBeInTheDocument();
    // the draft card itself has NO send/email/notify control
    expect(within(card).queryByRole("button", { name: /send|email|notify/i })).toBeNull();
  });
});

describe("error handling", () => {
  it.each([
    [401, "unauthorized", /sign in/i],
    [403, "forbidden", /access/i],
    [404, "not_found", /removed/i],
    [429, "assistant_rate_limited", /moment/i],
    [503, "assistant_unavailable", /unavailable/i],
  ] as Array<[number, string, RegExp]>)("status %s renders a friendly bubble, no raw error", async (status, code, needle) => {
    render(<AIAssistantPanel transactionId="txn-1" fetchImpl={errFetch(status, code)} getToken={getToken} />);
    await type("hi");
    fireEvent.click(screen.getByTestId("assistant-send"));
    const err = await screen.findByTestId("msg-error");
    expect(err.textContent).toMatch(needle);
    expect(err.textContent).not.toMatch(/stack|Error:|HTTP/);
  });
});

describe("auto-send from ?prompt=", () => {
  it("auto-sends exactly once, strips the URL, and does not resend on rerender", async () => {
    const replaceSpy = jest.spyOn(window.history, "replaceState");
    const fetchImpl = okFetch(envelope());
    const { rerender } = render(
      <AIAssistantPanel transactionId="txn-1" initialPrompt="What should I do next?" fetchImpl={fetchImpl} getToken={getToken} />
    );

    await screen.findByTestId("msg-answer");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // the user's prompt is echoed
    expect(screen.getByTestId("msg-user")).toHaveTextContent("What should I do next?");
    // URL stripped of ?prompt
    expect(replaceSpy).toHaveBeenCalledWith(null, "", "/workspace/txn-1?tab=ai");

    // rerender with the SAME prompt prop → must NOT resend
    rerender(
      <AIAssistantPanel transactionId="txn-1" initialPrompt="What should I do next?" fetchImpl={fetchImpl} getToken={getToken} />
    );
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    replaceSpy.mockRestore();
  });
});

describe("no duplicate requests", () => {
  it("a second submit while busy is ignored (single fetch)", async () => {
    let resolve!: (v: unknown) => void;
    const pending = new Promise((r) => (resolve = r));
    const fetchImpl = jest.fn(() => pending) as unknown as typeof fetch;

    render(<AIAssistantPanel transactionId="txn-1" fetchImpl={fetchImpl} getToken={getToken} />);
    await type("hi");
    const form = screen.getByTestId("assistant-send").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form); // second, while busy — must be ignored
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    // still exactly one after settling — no delayed duplicate
    await act(async () => {
      resolve({ ok: true, status: 200, json: async () => envelope() });
      await pending;
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("no markdown / no HTML injection", () => {
  it("renders answer + evidence as escaped plain text (no markup executes)", async () => {
    const env = envelope({
      answer: "Look at <b>this</b> and **bold** and <script>alert(1)</script>",
      evidence: [{ source: "Coordinator", fact: "<img src=x onerror=alert(1)>" }],
    });
    const { container } = render(<AIAssistantPanel transactionId="txn-1" fetchImpl={okFetch(env)} getToken={getToken} />);
    await type("x");
    fireEvent.click(screen.getByTestId("assistant-send"));
    await screen.findByTestId("msg-answer");

    const answer = screen.getByTestId("msg-answer");
    // literal, escaped text — markup did NOT become elements
    expect(answer.textContent).toContain("<b>this</b>");
    expect(answer.textContent).toContain("**bold**");
    expect(answer.querySelector("b")).toBeNull();
    expect(answer.querySelector("strong")).toBeNull();
    expect(container.querySelector("script")).toBeNull();

    fireEvent.click(screen.getByTestId("assistant-evidence-toggle"));
    const ev = screen.getByTestId("assistant-evidence");
    expect(ev.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(ev.querySelector("img")).toBeNull();
  });
});
