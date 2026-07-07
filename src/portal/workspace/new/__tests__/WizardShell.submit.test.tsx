/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3D — WizardShell submit integration
// ============================================================================
// The create step runs the real orchestrator (fetch mocked). Covers success +
// redirect, create failure surfaced with retry, and the pre-submit validation
// guard. No real network.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

import { useRouter, useSearchParams } from "next/navigation";
import WizardShell from "../WizardShell";
import { WIZARD_SESSION_KEY, emptySession, setStep } from "../wizard-session";

const mockUseRouter = useRouter as unknown as jest.Mock;
const mockUseSearchParams = useSearchParams as unknown as jest.Mock;
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockNav: { step: string | null } = { step: null };

const realFetch = global.fetch;

beforeEach(() => {
  window.localStorage.clear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockNav.step = null;
  mockUseRouter.mockReturnValue({ replace: mockReplace, push: mockPush });
  mockUseSearchParams.mockReturnValue({
    get: (k: string) => (k === "step" ? mockNav.step : null),
  });
});
afterEach(() => {
  global.fetch = realFetch;
});

/** Seed a valid create-step session (purchase + address + a buyer). */
function seedValidCreate() {
  window.localStorage.setItem(
    WIZARD_SESSION_KEY,
    JSON.stringify(
      setStep(
        {
          ...emptySession(),
          transaction_type: "purchase",
          property: { address: "123 Main St" },
          parties: [{ role: "buyer", name: "Jane", signature_required: true }],
        },
        "create"
      )
    )
  );
}

function mockFetch(fn: (url: string, init: any) => { ok: boolean; status: number; data: any }) {
  global.fetch = jest.fn(async (url: any, init: any) => {
    const r = fn(String(url), init);
    return { ok: r.ok, status: r.status, json: async () => r.data } as any;
  }) as any;
}

it("submits successfully → creates txn + party, redirects, clears the draft", async () => {
  seedValidCreate();
  mockFetch((url) => {
    if (url === "/api/transactions/create") return { ok: true, status: 201, data: { transaction: { id: "txn-1" } } };
    if (url.endsWith("/parties")) return { ok: true, status: 201, data: { party: { id: "p0" } } };
    return { ok: false, status: 404, data: {} };
  });

  render(<WizardShell />);
  await screen.findByTestId("wizard-step-create");

  fireEvent.click(screen.getByRole("button", { name: /Create/ }));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/workspace/txn-1"));
  // draft cleared on success (finish)
  expect(window.localStorage.getItem(WIZARD_SESSION_KEY)).toBeNull();
});

it("surfaces a create failure with a retry (no redirect, draft kept)", async () => {
  seedValidCreate();
  mockFetch((url) => {
    if (url === "/api/transactions/create") return { ok: false, status: 400, data: { error: "Server rejected it" } };
    return { ok: true, status: 201, data: { party: { id: "p0" } } };
  });

  render(<WizardShell />);
  await screen.findByTestId("wizard-step-create");

  fireEvent.click(screen.getByRole("button", { name: /Create/ }));

  expect(await screen.findByText("Server rejected it")).toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();
  // still on create; can retry
  expect(screen.getByTestId("wizard-step-create")).toBeInTheDocument();
});

it("pre-submit guard: invalid data jumps back to the offending step, no fetch", async () => {
  // create step but NO property address → property is invalid
  window.localStorage.setItem(
    WIZARD_SESSION_KEY,
    JSON.stringify(
      setStep(
        { ...emptySession(), transaction_type: "purchase", parties: [{ role: "buyer", name: "J" }] },
        "create"
      )
    )
  );
  const fetchSpy = jest.fn();
  global.fetch = fetchSpy as any;

  render(<WizardShell />);
  await screen.findByTestId("wizard-step-create");

  fireEvent.click(screen.getByRole("button", { name: /Create/ }));

  // navigated to the property step; no network call made
  expect(await screen.findByTestId("wizard-step-property")).toBeInTheDocument();
  expect(fetchSpy).not.toHaveBeenCalled();
});
