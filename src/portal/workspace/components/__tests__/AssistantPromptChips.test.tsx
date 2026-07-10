/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION ASSISTANT 4.0D — AssistantPromptChips tests
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

// next/link → plain anchor for assertion.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import AssistantPromptChips from "../AssistantPromptChips";

describe("AssistantPromptChips", () => {
  it("renders the five chips as ?tab=ai&prompt= links (navigation only)", () => {
    render(<AssistantPromptChips transactionId="txn-9" />);

    const next = screen.getByTestId("assistant-chip-next");
    expect(next).toHaveTextContent("What should I do next?");
    expect(next).toHaveAttribute(
      "href",
      `/workspace/txn-9?tab=ai&prompt=${encodeURIComponent("What should I do next?")}`
    );

    const send = screen.getByTestId("assistant-chip-send");
    expect(send.getAttribute("href")).toContain("tab=ai&prompt=");
    expect(decodeURIComponent(send.getAttribute("href")!)).toContain("Why can't I send this package?");

    expect(screen.getByTestId("assistant-chip-waiting")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-chip-explain")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-chip-summary")).toBeInTheDocument();
  });
});
