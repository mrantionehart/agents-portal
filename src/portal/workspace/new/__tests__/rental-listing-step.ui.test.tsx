// ============================================================================
// P4H-13 — the Rental Listing option, as a user meets it
// ============================================================================
// Runner: jest + @testing-library/react.
//
// The plumbing tests next door prove the vocabulary and the stored marker.
// This one mounts the real step and proves an agent can SEE the option and
// SELECT it — which a source assertion cannot, and which this repo's standard
// requires because the runner is available.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import TransactionTypeStep from "../TransactionTypeStep";

describe("Rental Listing in the type picker", () => {
  it("[APERL-UI-1] the option is visible, and says what instrument it is", () => {
    render(<TransactionTypeStep value={null} onSelect={jest.fn()} />);
    expect(screen.getByText("Rental Listing")).toBeInTheDocument();
    expect(
      screen.getByText(/Exclusive Right to Lease/i),
    ).toBeInTheDocument();
  });

  it("[APERL-UI-2] selecting it reports the canonical type, not the stored enum", () => {
    const onSelect = jest.fn();
    render(<TransactionTypeStep value={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("radio", { name: /Rental Listing/ }));
    // The wizard must carry `rental_listing`; collapsing to `listing` here
    // would lose the rental marker before the create route could write it.
    expect(onSelect).toHaveBeenCalledWith("rental_listing");
    expect(onSelect).not.toHaveBeenCalledWith("listing");
  });

  it("[APERL-UI-3] it reflects selection, and the SALE listing stays separate", () => {
    const { rerender } = render(
      <TransactionTypeStep value="rental_listing" onSelect={jest.fn()} />,
    );
    expect(
      screen.getByRole("radio", { name: /Rental Listing/ }),
    ).toHaveAttribute("aria-checked", "true");
    // The two are distinct controls — picking one must not check the other.
    expect(screen.getByRole("radio", { name: /^Listing/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    rerender(<TransactionTypeStep value="listing" onSelect={jest.fn()} />);
    expect(
      screen.getByRole("radio", { name: /Rental Listing/ }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("[APERL-UI-4] both listing options are reachable as separate radios", () => {
    render(<TransactionTypeStep value={null} onSelect={jest.fn()} />);
    const radios = screen.getAllByRole("radio");
    const names = radios.map((r) => r.getAttribute("aria-label") ?? r.textContent ?? "");
    expect(names.filter((n) => /Rental Listing/.test(n))).toHaveLength(1);
    expect(names.filter((n) => /^Listing/.test(n))).toHaveLength(1);
  });
});
