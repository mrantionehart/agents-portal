/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION ASSISTANT 4.0E.2 — rich AssistantDraftCard tests
// ============================================================================
// Rich draft: title / audience / channel / subject / body / confidence /
// warnings / collapsible facts_used. Copy / Copy to Clipboard / Copy Subject /
// Copy Body / Edit. Audience fallback. NO send/email/notify path.

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import AssistantDraftCard from "../AssistantDraftCard";
import type { AssistantDraft } from "../assistant-types";

function draft(over: Partial<AssistantDraft> = {}): AssistantDraft {
  return {
    title: "Buyer follow-up",
    audience: "buyer",
    channel: "email",
    subject: "Update on your purchase",
    body: "Hi Jordan, here's the latest on your transaction.",
    facts_used: [{ source: "Coordinator", fact: "Workflow state is awaiting_party_attestation" }],
    confidence: "high",
    warnings: [],
    ...over,
  };
}

describe("AssistantDraftCard — rich rendering", () => {
  it("renders title, meta, subject, body, confidence — plain text, review-only", () => {
    render(<AssistantDraftCard draft={draft()} writeClipboard={async () => {}} />);
    expect(screen.getByTestId("assistant-draft-title")).toHaveTextContent("Buyer follow-up");
    expect(screen.getByTestId("assistant-draft-meta")).toHaveTextContent("email · to buyer");
    expect(screen.getByTestId("assistant-draft-subject")).toHaveTextContent("Update on your purchase");
    expect(screen.getByTestId("assistant-draft-body")).toHaveTextContent("Hi Jordan");
    expect(screen.getByTestId("assistant-draft-confidence")).toHaveTextContent("Confidence High");
    expect(screen.getByText(/Review only/i)).toBeInTheDocument();
  });

  it("renders warnings only when present", () => {
    const { rerender } = render(<AssistantDraftCard draft={draft()} writeClipboard={async () => {}} />);
    expect(screen.queryByTestId("assistant-draft-warnings")).toBeNull();
    rerender(<AssistantDraftCard draft={draft({ warnings: ["Verify details before using."] })} writeClipboard={async () => {}} />);
    expect(screen.getByTestId("assistant-draft-warnings")).toHaveTextContent("Verify details");
  });

  it("facts_used is collapsed by default, expands with friendly source names", () => {
    render(<AssistantDraftCard draft={draft()} writeClipboard={async () => {}} />);
    expect(screen.queryByTestId("assistant-draft-facts")).toBeNull();
    fireEvent.click(screen.getByTestId("assistant-draft-facts-toggle"));
    const facts = screen.getByTestId("assistant-draft-facts");
    expect(facts).toHaveTextContent("Deal status"); // friendly label for Coordinator
    expect(facts).not.toHaveTextContent("Coordinator");
  });

  it("renders facts_used and body as escaped plain text (no HTML/markdown)", () => {
    const d = draft({ body: "See <b>this</b> and **bold**", facts_used: [{ source: "Coordinator", fact: "<img src=x onerror=alert(1)>" }] });
    const { container } = render(<AssistantDraftCard draft={d} writeClipboard={async () => {}} />);
    const body = screen.getByTestId("assistant-draft-body");
    expect(body.textContent).toContain("<b>this</b>");
    expect(body.textContent).toContain("**bold**");
    expect(body.querySelector("b")).toBeNull();
    fireEvent.click(screen.getByTestId("assistant-draft-facts-toggle"));
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("AssistantDraftCard — copy controls", () => {
  it("Copy=body, Copy to Clipboard=subject+body, Copy Subject=subject, Copy Body=body", async () => {
    const writes: string[] = [];
    const d = draft();
    render(<AssistantDraftCard draft={d} writeClipboard={async (t) => { writes.push(t); }} />);

    fireEvent.click(screen.getByTestId("assistant-draft-copy"));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toBe(d.body);

    fireEvent.click(screen.getByTestId("assistant-draft-copy-clipboard"));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toContain("Subject: Update on your purchase");
    expect(writes[1]).toContain(d.body);

    fireEvent.click(screen.getByTestId("assistant-draft-copy-subject"));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]).toBe(d.subject);

    fireEvent.click(screen.getByTestId("assistant-draft-copy-body"));
    await waitFor(() => expect(writes).toHaveLength(4));
    expect(writes[3]).toBe(d.body);
  });

  it("Edit toggles a textarea", () => {
    render(<AssistantDraftCard draft={draft()} writeClipboard={async () => {}} />);
    expect(screen.queryByTestId("assistant-draft-textarea")).toBeNull();
    fireEvent.click(screen.getByTestId("assistant-draft-edit"));
    expect(screen.getByTestId("assistant-draft-textarea")).toBeInTheDocument();
  });

  it("has NO Send / Email / Notify / SMS control", () => {
    const card = render(<AssistantDraftCard draft={draft()} writeClipboard={async () => {}} />).getByTestId("assistant-draft-card");
    expect(within(card).queryByRole("button", { name: /send|email|notify|sms/i })).toBeNull();
  });
});

describe("AssistantDraftCard — audience fallback (4.0E.2)", () => {
  it("shows the inferred audience when Vault returned internal", () => {
    render(<AssistantDraftCard draft={draft({ audience: "internal" })} expectedAudience="buyer" writeClipboard={async () => {}} />);
    expect(screen.getByTestId("assistant-draft-meta")).toHaveTextContent("to buyer");
  });
  it("NEVER overrides an explicit non-internal audience from Vault", () => {
    render(<AssistantDraftCard draft={draft({ audience: "seller" })} expectedAudience="buyer" writeClipboard={async () => {}} />);
    expect(screen.getByTestId("assistant-draft-meta")).toHaveTextContent("to seller");
  });
});
