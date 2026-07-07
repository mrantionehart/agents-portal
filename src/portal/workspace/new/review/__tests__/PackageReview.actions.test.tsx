/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3D — PackageReview generate/send integration
// ============================================================================
// Real orchestrator (fetch mocked) + mocked router. Covers generate outcomes,
// send success → redirect, not-connected → Connect CTA, and gate disabling.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

import PackageReview from "../PackageReview";
import type { PackageForm, PackageReviewData } from "../types";

const realFetch = global.fetch;
beforeEach(() => {
  mockPush.mockClear();
});
afterEach(() => {
  global.fetch = realFetch;
});

function mockFetch(fn: (url: string, method: string, body: any) => { ok: boolean; status: number; data: any }) {
  global.fetch = jest.fn(async (url: any, init: any) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const r = fn(String(url), method, body);
    return { ok: r.ok, status: r.status, json: async () => r.data } as any;
  }) as any;
}

function pf(over: Partial<PackageForm>): PackageForm {
  return {
    form_id: "X", label: "Form X", category: "disclosure", reason: "why",
    source: "rule_engine", required: false, optional: false, rider: false,
    locked: false, suggested: false, selected: false, ...over,
  };
}

function data(gateOver: Partial<PackageReviewData["package_plan"]["package_gates"]> = {}): PackageReviewData {
  return {
    package_plan: {
      transaction_id: "txn-1",
      type_key: "purchase",
      required_forms: [pf({ form_id: "RLHD-3x", label: "Residential Disclosure", required: true, locked: true, selected: true })],
      optional_forms: [],
      suggested_riders: [],
      searchable_forms: [],
      selection_rules: { required_locked: true, optional_selectable: true, riders_selectable: true, riders_searchable: true },
      locked_forms: ["RLHD-3x"],
      reasons: {},
      package_gates: {
        plan_available: true,
        can_prepare_package: true,
        can_send_for_signature: true,
        recommended_actions: [],
        ready_forms: ["RLHD-3x"],
        blocked_forms: [],
        ...gateOver,
      },
      blueprint: {
        transaction_id: "txn-1", type_key: "purchase",
        required: ["RLHD-3x"], optional_available: [], rider_available: [],
        optional_selected: [], rider_selected: [], all_selected: ["RLHD-3x"],
      },
      summary: { required_count: 1, optional_count: 0, optional_selected_count: 0, rider_count: 0, rider_selected_count: 0, searchable_count: 0, total_in_package: 1 },
    },
    form_status: {
      "RLHD-3x": { form_instance_id: "fi-1", status: "ready", disposition: "ready_for_review", status_label: "Ready", downloadable: false, generatable: true },
    },
  };
}

it("Generate materializes/generates and shows per-form outcomes", async () => {
  mockFetch((url) => {
    if (url.includes("/documents/fi-1/generate")) return { ok: true, status: 200, data: { ok: true, filled_count: 2 } };
    return { ok: false, status: 404, data: {} };
  });
  render(<PackageReview data={data()} transactionId="txn-1" />);

  fireEvent.click(screen.getByRole("button", { name: /Generate Package/ }));

  const outcomes = await screen.findByTestId("generate-outcomes");
  expect(within(outcomes).getByText("RLHD-3x")).toBeInTheDocument();
  expect(within(outcomes).getByRole("button", { name: /Preview/ })).toBeInTheDocument();
});

it("Send success navigates to the workspace", async () => {
  mockFetch((url) => {
    if (url.includes("/send")) return { ok: true, status: 200, data: { ok: true, envelope_id: "env-1", status: "sent" } };
    return { ok: false, status: 404, data: {} };
  });
  render(<PackageReview data={data()} transactionId="txn-1" />);

  fireEvent.click(screen.getByRole("button", { name: /Send for Signature/ }));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/workspace/txn-1"));
});

it("Send when not connected shows the Connect DocuSign CTA (no redirect)", async () => {
  mockFetch((url) => {
    if (url.includes("/send")) return { ok: false, status: 409, data: { code: "esign_not_connected" } };
    return { ok: false, status: 404, data: {} };
  });
  render(<PackageReview data={data()} transactionId="txn-1" />);

  fireEvent.click(screen.getByRole("button", { name: /Send for Signature/ }));

  expect(await screen.findByRole("button", { name: /Connect DocuSign/ })).toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();
});

it("gates disable the buttons", () => {
  render(<PackageReview data={data({ can_prepare_package: false, can_send_for_signature: false })} transactionId="txn-1" />);
  expect(screen.getByRole("button", { name: /Generate Package/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Send for Signature/ })).toBeDisabled();
});
