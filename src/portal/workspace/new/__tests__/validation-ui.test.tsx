/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3C — inline field errors + a11y wiring
// ============================================================================
// Asserts the step components render structured field errors with the a11y
// attributes (aria-invalid, aria-describedby) and inline error text.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import PropertyStep from "../PropertyStep";
import ClientsPartiesStep from "../ClientsPartiesStep";
import ImportantDatesStep from "../ImportantDatesStep";
import TransactionTypeStep from "../TransactionTypeStep";

describe("PropertyStep inline errors", () => {
  it("marks the address input invalid and links the error text", () => {
    render(
      <PropertyStep
        property={{}}
        onChange={jest.fn()}
        errors={{ address: "Property address is required." }}
      />
    );
    const input = screen.getByLabelText(/Property Address/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedby = input.getAttribute("aria-describedby");
    expect(describedby).toBeTruthy();
    // the linked node holds the error text
    expect(document.getElementById(describedby!)).toHaveTextContent(
      "Property address is required."
    );
  });

  it("no aria-invalid when there is no error", () => {
    render(<PropertyStep property={{}} onChange={jest.fn()} />);
    expect(screen.getByLabelText(/Property Address/)).not.toHaveAttribute(
      "aria-invalid"
    );
  });
});

describe("ClientsPartiesStep inline errors", () => {
  it("renders the form-level error and per-row field errors", () => {
    render(
      <ClientsPartiesStep
        parties={[{ role: "", name: "" }]}
        onChange={jest.fn()}
        errors={{
          form: "Add a Buyer.",
          rows: [{ role: "Role is required.", name: "Name or company is required." }],
        }}
      />
    );
    expect(screen.getByText("Add a Buyer.")).toBeInTheDocument();
    expect(screen.getByText("Role is required.")).toBeInTheDocument();
    expect(screen.getByText("Name or company is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("ImportantDatesStep inline errors", () => {
  it("marks the closing date invalid", () => {
    render(
      <ImportantDatesStep
        dates={{ contract_date: "2026-08-10", closing_date: "2026-08-01" }}
        transactionType="purchase"
        onChange={jest.fn()}
        errors={{ closing_date: "Closing date must be on or after the contract date." }}
      />
    );
    expect(screen.getByLabelText("Closing Date")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});

describe("TransactionTypeStep inline error", () => {
  it("marks the radiogroup invalid and shows the message", () => {
    render(
      <TransactionTypeStep
        value={null}
        onSelect={jest.fn()}
        error="Select a transaction type."
      />
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Select a transaction type.")).toBeInTheDocument();
  });
});
