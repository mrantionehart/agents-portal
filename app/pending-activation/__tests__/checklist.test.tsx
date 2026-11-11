/**
 * @jest-environment jsdom
 */
// [ONB-AP] /pending-activation shows the joining agent's own steps from Vault,
// and falls back to the plain copy when Vault cannot answer.
import React from "react";
import { render, screen } from "@testing-library/react";

let TOKEN: string | null = "tok-1";
let PROFILE = { is_active: false, onboarding_status: "onboarding" as string | null };
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
      getSession: async () => ({ data: { session: TOKEN ? { access_token: TOKEN } : null } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: PROFILE, error: null }) }) }) }),
  }),
}));
jest.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
jest.mock("@/lib/vault-client", () => ({ VAULT_API_URL: "https://vault.test/api" }));

import PendingActivationPage from "../page";

const STEPS = [
  { key: "agreements", label: "Sign your onboarding agreements", state: "in_progress", detail: "Your agreements were sent on Nov 5, 2026. Look for the DocuSign email from HartFelt and sign it there." },
  { key: "license", label: "Licence verified", state: "done", detail: "Verified Nov 6, 2026." },
  { key: "activation", label: "Account activated", state: "waiting", detail: "Your broker activates your account after the steps above." },
];
let fetchMock: jest.Mock;
beforeEach(() => {
  TOKEN = "tok-1";
  PROFILE = { is_active: false, onboarding_status: "onboarding" };
  fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ steps: STEPS, is_active: false }) }));
  (global as any).fetch = fetchMock;
});

async function mount() {
  render(await PendingActivationPage());
}

describe("[ONB-AP] onboarding checklist", () => {
  it("renders each step with its state and the next action, calling Vault with the agent's own token", async () => {
    await mount();
    expect(screen.getByTestId("step-agreements")).toHaveAttribute("data-state", "in_progress");
    expect(screen.getByTestId("step-license")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("onboarding-next")).toHaveTextContent("Look for the DocuSign email");
    expect(fetchMock).toHaveBeenCalledWith("https://vault.test/api/onboarding/my-status", expect.objectContaining({ headers: { Authorization: "Bearer tok-1" } }));
    expect(screen.getByText(/Your broker is completing your setup/)).toBeInTheDocument();
  });
  it.each([
    ["Vault errors", () => { fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) }); }],
    ["Vault is unreachable", () => { fetchMock.mockRejectedValueOnce(new Error("down")); }],
    ["no steps", () => { fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ steps: null }) }); }],
    ["no session token", () => { TOKEN = null; }],
  ])("%s ⇒ plain copy only, no checklist", async (_l, arrange) => {
    arrange();
    await mount();
    expect(screen.queryByLabelText("Your onboarding steps")).toBeNull();
    expect(screen.getByText(/Your broker is completing your setup/)).toBeInTheDocument();
  });
  it("an active user is sent home and Vault is not asked", async () => {
    PROFILE = { is_active: true, onboarding_status: null };
    await mount();
    expect(screen.getByText("Go to Home")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
