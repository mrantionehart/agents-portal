/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3B — Wizard step component tests
// ============================================================================
// Each step is a pure props component: it reads a slice of WizardSession and
// reports edits through callbacks. These tests assert the edit contracts,
// add/remove parties, conditional lease fields, review rendering, label↔input
// a11y association, and responsive grid classes. No API, no navigation.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import TransactionTypeStep from "../TransactionTypeStep";
import PropertyStep from "../PropertyStep";
import ClientsPartiesStep from "../ClientsPartiesStep";
import ImportantDatesStep from "../ImportantDatesStep";
import ReviewStep from "../ReviewStep";
import { PARTY_ROLE_OPTIONS } from "../party-roles";
import { TRANSACTION_TYPE_OPTIONS } from "../transaction-types";
import { emptySession, type WizardPartyDraft } from "../wizard-session";

describe("TransactionTypeStep", () => {
  it("renders the 7 canonical types (not the legacy 6)", () => {
    render(<TransactionTypeStep value={null} onSelect={jest.fn()} />);
    for (const label of [
      "Purchase",
      "Lease",
      "Listing",
      "Buyer Rep",
      "Commercial",
      "Wholesale",
      "Referral",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(TRANSACTION_TYPE_OPTIONS).toHaveLength(7);
    // no legacy-only labels
    expect(screen.queryByText("Double Close")).not.toBeInTheDocument();
  });

  it("selects a type via onSelect and reflects aria-checked", () => {
    const onSelect = jest.fn();
    const { rerender } = render(
      <TransactionTypeStep value={null} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Listing/ }));
    expect(onSelect).toHaveBeenCalledWith("listing");

    rerender(<TransactionTypeStep value="listing" onSelect={onSelect} />);
    expect(screen.getByRole("radio", { name: /Listing/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("uses a responsive grid", () => {
    const { container } = render(
      <TransactionTypeStep value={null} onSelect={jest.fn()} />
    );
    expect(container.querySelector(".sm\\:grid-cols-2")).toBeTruthy();
    expect(container.querySelector(".lg\\:grid-cols-3")).toBeTruthy();
  });
});

describe("PropertyStep", () => {
  it("associates labels with inputs (a11y) and edits the session", () => {
    const onChange = jest.fn();
    render(<PropertyStep property={{}} onChange={onChange} />);

    // getByLabelText only works when htmlFor/id are wired.
    const addr = screen.getByLabelText(/Property Address/);
    fireEvent.change(addr, { target: { value: "123 Main St" } });
    expect(onChange).toHaveBeenCalledWith({ address: "123 Main St" });

    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Miami" },
    });
    expect(onChange).toHaveBeenCalledWith({ city: "Miami" });
  });

  it("toggles HOA", () => {
    const onChange = jest.fn();
    render(<PropertyStep property={{}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Property has an HOA"));
    expect(onChange).toHaveBeenCalledWith({ has_hoa: true });
  });

  it("uses a responsive grid for city/state/zip", () => {
    const { container } = render(
      <PropertyStep property={{}} onChange={jest.fn()} />
    );
    expect(container.querySelector(".sm\\:grid-cols-3")).toBeTruthy();
  });
});

describe("ClientsPartiesStep", () => {
  it("shows the empty state and adds a party", () => {
    const onChange = jest.fn();
    render(<ClientsPartiesStep parties={[]} onChange={onChange} />);
    expect(screen.getByText("No parties added yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add Party/ }));
    // one new party, signature_required defaults true
    expect(onChange).toHaveBeenCalledWith([{ signature_required: true }]);
  });

  it("offers exactly the 14 roles", () => {
    render(
      <ClientsPartiesStep
        parties={[{ signature_required: true }]}
        onChange={jest.fn()}
      />
    );
    const select = screen.getByLabelText("Role") as HTMLSelectElement;
    // 14 roles + the "Select a role…" placeholder option
    expect(select.querySelectorAll("option")).toHaveLength(
      PARTY_ROLE_OPTIONS.length + 1
    );
    expect(screen.getByRole("option", { name: "Escrow" })).toBeInTheDocument();
    // a non-schema role is NOT offered
    expect(
      screen.queryByRole("option", { name: "Attorney" })
    ).not.toBeInTheDocument();
  });

  it("edits a party field and the signature flag", () => {
    const onChange = jest.fn();
    const parties: WizardPartyDraft[] = [{ role: "buyer", signature_required: true }];
    render(<ClientsPartiesStep parties={parties} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Jane Buyer" },
    });
    expect(onChange).toHaveBeenCalledWith([
      { role: "buyer", signature_required: true, name: "Jane Buyer" },
    ]);

    fireEvent.click(screen.getByLabelText("Signature required"));
    expect(onChange).toHaveBeenCalledWith([
      { role: "buyer", signature_required: false },
    ]);
  });

  it("removes a party", () => {
    const onChange = jest.fn();
    render(
      <ClientsPartiesStep
        parties={[{ role: "buyer" }, { role: "seller" }]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove party 1" }));
    expect(onChange).toHaveBeenCalledWith([{ role: "seller" }]);
  });
});

describe("ImportantDatesStep", () => {
  it("shows contract/closing for non-lease types", () => {
    render(
      <ImportantDatesStep
        dates={{}}
        transactionType="purchase"
        onChange={jest.fn()}
      />
    );
    expect(screen.getByLabelText("Contract Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Closing Date")).toBeInTheDocument();
    expect(screen.queryByLabelText("Lease Start")).not.toBeInTheDocument();
  });

  it("shows lease start/end for lease type", () => {
    const onChange = jest.fn();
    render(
      <ImportantDatesStep dates={{}} transactionType="lease" onChange={onChange} />
    );
    expect(screen.getByLabelText("Lease Start")).toBeInTheDocument();
    expect(screen.getByLabelText("Lease End")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contract Date")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Lease Start"), {
      target: { value: "2026-08-01" },
    });
    expect(onChange).toHaveBeenCalledWith({ lease_start: "2026-08-01" });
  });
});

describe("ReviewStep", () => {
  it("renders a read-only summary of the session", () => {
    const session = {
      ...emptySession(),
      transaction_type: "purchase",
      property: { address: "123 Main St", city: "Miami", state: "FL", zip: "33101" },
      dates: { contract_date: "2026-07-10", closing_date: "2026-08-10" },
      parties: [{ role: "buyer", name: "Jane Buyer", email: "j@x.com" }],
    };
    render(<ReviewStep session={session} />);

    expect(screen.getByTestId("wizard-review")).toBeInTheDocument();
    expect(screen.getByText("Purchase")).toBeInTheDocument();
    expect(screen.getByText("123 Main St")).toBeInTheDocument();
    expect(screen.getByText("Miami, FL, 33101")).toBeInTheDocument();
    expect(screen.getByText("2026-07-10")).toBeInTheDocument();
    // party summarized by role label
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.getByText(/Jane Buyer/)).toBeInTheDocument();
    // has no Create button (creation is 3.3B.3D)
    expect(
      screen.queryByRole("button", { name: /Create/ })
    ).not.toBeInTheDocument();
  });

  it("shows lease dates when the type is lease", () => {
    const session = {
      ...emptySession(),
      transaction_type: "lease",
      dates: { lease_start: "2026-09-01", lease_end: "2027-09-01" },
    };
    render(<ReviewStep session={session} />);
    expect(screen.getByText("Lease Start")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
    expect(screen.queryByText("Contract Date")).not.toBeInTheDocument();
  });
});
