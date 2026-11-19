/**
 * @jest-environment jsdom
 */
// ============================================================================
// LEAD-LIFECYCLE — /workspace/new started from a lead (mounted, clicked)
// ============================================================================
// Opening the wizard for a lead fills the first party from the client profile
// and carries the lead's id to the create route as `client_profile_id`, sent
// with the caller's BEARER token (the route needs it to verify the lead with
// Vault). A draft that already belongs to something else is never re-pointed.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));
jest.mock("@/lib/supabase", () => ({ authFetch: jest.fn() }));

import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/supabase";
import WizardShell from "../WizardShell";
import { WIZARD_SESSION_KEY, emptySession, setStep, type WizardSession } from "../wizard-session";

const mockAuthFetch = authFetch as jest.Mock;
const mockPush = jest.fn();
const nav: { step: string | null } = { step: null };
const realFetch = global.fetch;

const LEAD = { id: "11111111-2222-3333-4444-555555555555", full_name: "Jane Lead", email: "jane@example.com", phone: "555-0100" };

const json = (status: number, data: unknown) => ({ ok: status < 400, status, json: async () => data }) as any;

beforeEach(() => {
  window.localStorage.clear();
  mockPush.mockClear();
  mockAuthFetch.mockReset();
  nav.step = null;
  (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn(), push: mockPush });
  (useSearchParams as jest.Mock).mockReturnValue({ get: (k: string) => (k === "step" ? nav.step : null) });
  global.fetch = jest.fn(async (url: any) =>
    String(url).endsWith("/parties") ? json(201, { party: { id: "p0" } }) : json(201, { transaction: { id: "txn-cookie" } })
  ) as any;
});
afterEach(() => { global.fetch = realFetch; });

const stored = (): WizardSession => JSON.parse(window.localStorage.getItem(WIZARD_SESSION_KEY) ?? "null");
const seed = (s: WizardSession) => window.localStorage.setItem(WIZARD_SESSION_KEY, JSON.stringify(s));

it("a fresh wizard opened for a lead is linked and the client is pre-filled — no retyping", async () => {
  nav.step = "parties";
  render(<WizardShell linkClient={LEAD} />);
  expect(await screen.findByTestId("wizard-client-linked")).toHaveTextContent("Jane Lead");
  expect(await screen.findByDisplayValue("Jane Lead")).toBeInTheDocument();
  expect(screen.getByDisplayValue("jane@example.com")).toBeInTheDocument();
  await waitFor(() => expect(stored().client_profile_id).toBe(LEAD.id));
});

it("Create sends client_profile_id with the bearer-carrying fetch, then adds parties", async () => {
  seed(setStep({
    ...emptySession(), client_profile_id: LEAD.id, transaction_type: "purchase", business_line: "brokerage",
    property: { address: "22 Oak Ave" }, parties: [{ role: "buyer", name: "Jane Lead", email: "jane@example.com", signature_required: true }],
  }, "create"));
  mockAuthFetch.mockResolvedValue(json(201, { transaction: { id: "txn-lead" } }));

  render(<WizardShell linkClient={LEAD} />);
  expect(await screen.findByTestId("wizard-client-linked")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/workspace/txn-lead?tab=package"));
  expect(mockAuthFetch).toHaveBeenCalledTimes(1);
  const [url, init] = mockAuthFetch.mock.calls[0];
  expect(url).toBe("/api/transactions/create");
  const body = JSON.parse(init.body);
  expect(body.client_profile_id).toBe(LEAD.id);
  expect(body.client_name).toBe("Jane Lead");
  // the create did NOT also go out cookie-only
  const cookieCalls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
  expect(cookieCalls).not.toContain("/api/transactions/create");
  expect(cookieCalls).toContain("/api/transactions/txn-lead/parties");
});

it("a refused link (e.g. not your lead) is shown and nothing navigates", async () => {
  seed(setStep({
    ...emptySession(), client_profile_id: LEAD.id, transaction_type: "purchase", business_line: "brokerage",
    property: { address: "22 Oak Ave" }, parties: [{ role: "buyer", name: "Jane Lead", signature_required: true }],
  }, "create"));
  mockAuthFetch.mockResolvedValue(json(403, { error: "That lead is not assigned to you" }));
  render(<WizardShell linkClient={LEAD} />);
  await screen.findByTestId("wizard-step-create");
  fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
  expect(await screen.findByText(/not assigned to you/)).toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();
});

it("an unfinished draft for something else is NOT re-pointed at the lead", async () => {
  const other = { ...emptySession(), transaction_type: "listing", business_line: "brokerage" as const, property: { address: "9 Elm St" } };
  seed(other);
  render(<WizardShell linkClient={LEAD} />);
  expect(await screen.findByTestId("wizard-client-conflict")).toHaveTextContent("not linked to Jane Lead");
  await new Promise((r) => setTimeout(r, 0));
  expect(stored().client_profile_id ?? null).toBeNull();
  expect(stored().property.address).toBe("9 Elm St");
});

it("an unreadable client says so; an unlinked draft keeps the plain cookie request with no lead id", async () => {
  seed(setStep({
    ...emptySession(), transaction_type: "purchase", business_line: "brokerage", property: { address: "1 Main St" },
    parties: [{ role: "buyer", name: "Walk In", signature_required: true }],
  }, "create"));
  render(<WizardShell linkClientUnavailable />);
  expect(await screen.findByTestId("wizard-client-unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
  await waitFor(() => expect(mockPush).toHaveBeenCalled());
  expect(mockAuthFetch).not.toHaveBeenCalled();
  const create = (global.fetch as jest.Mock).mock.calls.find((c) => String(c[0]) === "/api/transactions/create")!;
  expect(JSON.parse(create[1].body)).not.toHaveProperty("client_profile_id");
});
