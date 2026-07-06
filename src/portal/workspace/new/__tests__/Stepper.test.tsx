/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3A — Stepper render tests
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import Stepper from "../Stepper";

describe("Stepper", () => {
  it("renders all 7 journey nodes", () => {
    render(<Stepper current="type" />);
    for (const label of [
      "Transaction Type",
      "Property",
      "Clients & Parties",
      "Important Dates",
      "Review",
      "Create",
      "Package Review",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the current step with aria-current", () => {
    render(<Stepper current="parties" />);
    const current = screen.getByText("Clients & Parties").closest("[aria-current]");
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("offers already-visited (< current) steps as back-nav buttons", () => {
    const onStepSelect = jest.fn();
    render(<Stepper current="dates" onStepSelect={onStepSelect} />);

    // "Property" is before "dates" → clickable back-nav.
    fireEvent.click(screen.getByRole("button", { name: "Go to Property" }));
    expect(onStepSelect).toHaveBeenCalledWith("property");
  });

  it("does NOT offer the current or upcoming steps as buttons", () => {
    const onStepSelect = jest.fn();
    render(<Stepper current="property" onStepSelect={onStepSelect} />);

    // Upcoming step (review) is not a button.
    expect(
      screen.queryByRole("button", { name: "Go to Review" })
    ).not.toBeInTheDocument();
    // Terminal package node is never a button.
    expect(
      screen.queryByRole("button", { name: "Go to Package Review" })
    ).not.toBeInTheDocument();
    // The current step is not a button either.
    expect(
      screen.queryByRole("button", { name: "Go to Property" })
    ).not.toBeInTheDocument();
  });
});
