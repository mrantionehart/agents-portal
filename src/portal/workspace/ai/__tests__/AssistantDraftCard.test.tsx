/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION ASSISTANT 4.0D — AssistantDraftCard tests
// ============================================================================
// Review-only: Copy / Copy to Clipboard / Edit. NO send/email/notify path.

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import AssistantDraftCard from "../AssistantDraftCard";
import type { AssistantDraft } from "../assistant-types";

const draft: AssistantDraft = {
  channel: "email",
  audience: "buyer",
  subject: "Update on your purchase",
  body: "Hi Jordan, here's the latest on your transaction.",
};

describe("AssistantDraftCard", () => {
  it("renders the draft as plain text with a review-only notice", () => {
    render(<AssistantDraftCard draft={draft} writeClipboard={async () => {}} />);
    expect(screen.getByTestId("assistant-draft-card")).toHaveTextContent("Update on your purchase");
    expect(screen.getByText(/Review only/i)).toBeInTheDocument();
  });

  it("has NO Send / Email / Notify controls", () => {
    render(<AssistantDraftCard draft={draft} writeClipboard={async () => {}} />);
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^email$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /notify/i })).toBeNull();
  });

  it("Copy writes the body; Copy to Clipboard writes subject+body", async () => {
    const writes: string[] = [];
    const writeClipboard = async (t: string) => {
      writes.push(t);
    };
    render(<AssistantDraftCard draft={draft} writeClipboard={writeClipboard} />);

    fireEvent.click(screen.getByTestId("assistant-draft-copy"));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toBe(draft.body);

    fireEvent.click(screen.getByTestId("assistant-draft-copy-clipboard"));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toContain("Subject: Update on your purchase");
    expect(writes[1]).toContain(draft.body);
  });

  it("Edit toggles an editable textarea", () => {
    render(<AssistantDraftCard draft={draft} writeClipboard={async () => {}} />);
    expect(screen.queryByTestId("assistant-draft-textarea")).toBeNull();
    fireEvent.click(screen.getByTestId("assistant-draft-edit"));
    expect(screen.getByTestId("assistant-draft-textarea")).toBeInTheDocument();
  });
});
