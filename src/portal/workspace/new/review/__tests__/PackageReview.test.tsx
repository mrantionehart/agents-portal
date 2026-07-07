/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3C — PackageReview render tests
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

import PackageReview from "../PackageReview";
import type { PackageForm, PackageReviewData } from "../types";

function pf(over: Partial<PackageForm>): PackageForm {
  return {
    form_id: "X",
    label: "Form X",
    category: "disclosure",
    reason: "Because the statute says so.",
    source: "rule_engine",
    required: false,
    optional: false,
    rider: false,
    locked: false,
    suggested: false,
    selected: false,
    ...over,
  };
}

function data(over: Partial<PackageReviewData["package_plan"]> = {}): PackageReviewData {
  const plan = {
    transaction_id: "txn-1",
    type_key: "purchase",
    required_forms: [
      pf({ form_id: "RLHD-3x", label: "Residential Disclosure", required: true, locked: true, selected: true, reason: "FL Statute 475." }),
    ],
    optional_forms: [
      pf({ form_id: "CDS-1", label: "Compensation Disclosure", optional: true, category: "compensation", reason: "Optional: document compensation." }),
    ],
    suggested_riders: [
      pf({ form_id: "CR-7x_A", label: "Condominium Rider", rider: true, suggested: true, category: "addendum", reason: "Rider: condo terms." }),
    ],
    searchable_forms: [
      { form_id: "EXTRA-1", label: "Extra Disclosure", category: "disclosure" },
      { form_id: "ZZ-9", label: "Zebra Form", category: "addendum" },
    ],
    selection_rules: { required_locked: true, optional_selectable: true, riders_selectable: true, riders_searchable: true },
    locked_forms: ["RLHD-3x"],
    reasons: {},
    package_gates: {
      plan_available: true,
      can_prepare_package: false,
      can_send_for_signature: false,
      recommended_actions: ["prepare_for_broker_review"],
      ready_forms: [],
      blocked_forms: ["RLHD-3x"],
    },
    blueprint: {
      transaction_id: "txn-1", type_key: "purchase",
      required: ["RLHD-3x"], optional_available: ["CDS-1"], rider_available: ["CR-7x_A"],
      optional_selected: [], rider_selected: [], all_selected: ["RLHD-3x"],
    },
    summary: {
      required_count: 1, optional_count: 1, optional_selected_count: 0,
      rider_count: 1, rider_selected_count: 0, searchable_count: 2, total_in_package: 1,
    },
    ...over,
  };
  const form_status = {
    "RLHD-3x": { form_instance_id: "fi1", status: "blocked", disposition: "blocked", status_label: "Blocked", downloadable: false, generatable: false },
    "CDS-1": { form_instance_id: "fi2", status: "ready", disposition: "ready_for_review", status_label: "Ready for review", downloadable: true, generatable: true },
  };
  return { package_plan: plan, form_status };
}

describe("PackageReview", () => {
  it("renders required (locked), optional, riders, reasons + status", () => {
    render(<PackageReview data={data()} transactionId="txn-1" />);

    expect(screen.getByTestId("package-review")).toBeInTheDocument();
    // required form: label + reason + status, no checkbox (locked)
    expect(screen.getByText("Residential Disclosure")).toBeInTheDocument();
    expect(screen.getByText("FL Statute 475.")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    // optional + rider present
    expect(screen.getByText("Compensation Disclosure")).toBeInTheDocument();
    expect(screen.getByText("Condominium Rider")).toBeInTheDocument();
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
  });

  it("required forms are locked (no checkbox), optional are selectable", () => {
    render(<PackageReview data={data()} transactionId="txn-1" />);
    // no checkbox to add/remove the required form
    expect(screen.queryByRole("checkbox", { name: /Residential Disclosure/ })).not.toBeInTheDocument();
    // optional form has a checkbox
    expect(screen.getByRole("checkbox", { name: /Compensation Disclosure/ })).toBeInTheDocument();
  });

  it("selecting an optional form updates the in-package count", () => {
    render(<PackageReview data={data()} transactionId="txn-1" />);
    expect(screen.getByText("1 in package")).toBeInTheDocument(); // required only

    fireEvent.click(screen.getByRole("checkbox", { name: /Add Compensation Disclosure/ }));
    expect(screen.getByText("2 in package")).toBeInTheDocument();
  });

  it("search filters the registry pool and can add a form", () => {
    render(<PackageReview data={data()} transactionId="txn-1" />);
    // both searchable forms shown initially
    expect(screen.getByText("Extra Disclosure")).toBeInTheDocument();
    expect(screen.getByText("Zebra Form")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search forms"), { target: { value: "zebra" } });
    expect(screen.queryByText("Extra Disclosure")).not.toBeInTheDocument();
    expect(screen.getByText("Zebra Form")).toBeInTheDocument();

    // adding a searched form bumps the package count
    expect(screen.getByText("1 in package")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add Zebra Form/ }));
    expect(screen.getByText("2 in package")).toBeInTheDocument();
  });

  it("renders the gates strip + recommended actions", () => {
    render(<PackageReview data={data()} transactionId="txn-1" />);
    expect(screen.getByText("Not ready to prepare")).toBeInTheDocument();
    expect(screen.getByText(/Prepare the package for broker review/i)).toBeInTheDocument();
  });

  it("Generate is disabled when can_prepare_package is false", () => {
    render(<PackageReview data={data()} transactionId="txn-1" />);
    expect(screen.getByRole("button", { name: /Generate Package/ })).toBeDisabled();
  });

  it("Generate is enabled when the gate allows preparation", () => {
    const d = data({
      package_gates: {
        plan_available: true, can_prepare_package: true, can_send_for_signature: false,
        recommended_actions: [], ready_forms: ["RLHD-3x"], blocked_forms: [],
      },
    });
    render(<PackageReview data={d} transactionId="txn-1" />);
    expect(screen.getByRole("button", { name: /Generate Package/ })).toBeEnabled();
  });
});
