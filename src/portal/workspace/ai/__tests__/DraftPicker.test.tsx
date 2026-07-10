/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION ASSISTANT 4.0E.2 — DraftPicker tests
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import DraftPicker from "../DraftPicker";
import { DRAFT_MENU } from "../assistant-view";

describe("DraftPicker", () => {
  it("opens a grouped menu of all 10 draft types", () => {
    render(<DraftPicker onSelect={() => {}} />);
    expect(screen.queryByTestId("draft-picker-menu")).toBeNull();
    fireEvent.click(screen.getByTestId("draft-picker-button"));
    expect(screen.getByTestId("draft-picker-menu")).toBeInTheDocument();
    // groups
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Brokerage")).toBeInTheDocument();
    expect(screen.getByText("Internal")).toBeInTheDocument();
    // all 10 options present
    const total = DRAFT_MENU.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(10);
    for (const g of DRAFT_MENU) {
      for (const it of g.items) {
        expect(screen.getByTestId(`draft-option-${it.type}`)).toHaveTextContent(it.label);
      }
    }
  });

  it("selecting an option calls onSelect with the explicit draft_type and closes", () => {
    const picked: string[] = [];
    render(<DraftPicker onSelect={(t) => picked.push(t)} />);
    fireEvent.click(screen.getByTestId("draft-picker-button"));
    fireEvent.click(screen.getByTestId("draft-option-buyer_follow_up"));
    expect(picked).toEqual(["buyer_follow_up"]);
    expect(screen.queryByTestId("draft-picker-menu")).toBeNull(); // closed after pick
  });

  it("is disabled while busy", () => {
    render(<DraftPicker onSelect={() => {}} disabled />);
    expect(screen.getByTestId("draft-picker-button")).toBeDisabled();
  });
});
