/**
 * @jest-environment jsdom
 */
// ============================================================================
// /pending-activation page · copy variants + affordance
// ============================================================================
// This page is authenticated (middleware `/login`-redirects unauth) but
// EXEMPT from the is_active gate so inactive users can reach it without
// looping.
//
// Copy is driven off profiles.onboarding_status:
//   'onboarding' → "Your broker is completing your setup. …"
//   anything else (suspended, null, etc.) → "Your account is currently inactive. …"
// Active user gets an affordance to /home, no redirect loop from here.
// No internal pipeline details are exposed.
// ============================================================================
import React from "react";
import { render, screen } from "@testing-library/react";

// The page is a server component. We test the rendered output by importing
// the module and calling it as a function with the mocked profile.

let PROFILE: {
  id: string;
  is_active: boolean | null;
  onboarding_status: string | null;
} | null = null;
let AUTHED_ID: string | null = null;
type ProfileMode = "row" | "no-row" | "error";
let PROFILE_MODE: ProfileMode = "row";

jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: AUTHED_ID
            ? { id: AUTHED_ID, email: "test@hartfeltrealestate.com" }
            : null,
        },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            if (PROFILE_MODE === "error") throw new Error("network");
            if (PROFILE_MODE === "no-row") return { data: null, error: { code: "PGRST116", message: "no rows" } };
            return {
              data: PROFILE
                ? {
                    is_active: PROFILE.is_active,
                    onboarding_status: PROFILE.onboarding_status,
                  }
                : null,
              error: null,
            };
          },
        }),
      }),
    }),
  }),
}));
jest.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

import PendingActivationPage from "@/app/pending-activation/page";

async function renderPage() {
  // Server components in jest — call the async factory and render the vnode.
  const el = await PendingActivationPage();
  render(el as React.ReactElement);
}

beforeEach(() => {
  PROFILE = null;
  AUTHED_ID = "u-1";
  PROFILE_MODE = "row";
});

describe("/pending-activation · copy variants", () => {
  it("inactive onboarding user → shows the onboarding copy", async () => {
    PROFILE = { id: "u-1", is_active: false, onboarding_status: "onboarding" };
    await renderPage();
    // The exact copy per Correction 1:
    expect(
      screen.getByText(
        /Your broker is completing your setup\. Your Agent Portal will unlock once your account is activated\./i
      )
    ).toBeInTheDocument();
    // Does NOT leak internal pipeline details
    expect(screen.queryByText(/pipeline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new_agent_onboarding/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/promotion_history/i)).not.toBeInTheDocument();
  });

  it("inactive suspended user (onboarding_status='suspended') → shows the suspended copy", async () => {
    PROFILE = { id: "u-1", is_active: false, onboarding_status: "suspended" };
    await renderPage();
    expect(
      screen.getByText(
        /Your account is currently inactive\. Contact your broker for assistance\./i
      )
    ).toBeInTheDocument();
  });

  it("inactive user with null onboarding_status → shows the suspended (fallback) copy", async () => {
    PROFILE = { id: "u-1", is_active: false, onboarding_status: null };
    await renderPage();
    expect(
      screen.getByText(/Your account is currently inactive\./i)
    ).toBeInTheDocument();
  });

  it("active user reaching this page → sees a link back to /home (no auto-redirect loop)", async () => {
    PROFILE = { id: "u-1", is_active: true, onboarding_status: "active" };
    await renderPage();
    // A link/CTA back to the portal. Use accessible role query so the exact
    // copy can shift without breaking the invariant.
    const home = screen.getByRole("link", { name: /home|dashboard|portal/i });
    expect(home).toBeInTheDocument();
    expect(home.getAttribute("href")).toBe("/home");
  });

  it("is_active=null (row present) → renders Copy B (deny; does NOT fall through to active UX)", async () => {
    PROFILE = { id: "u-1", is_active: null, onboarding_status: null };
    await renderPage();
    expect(
      screen.getByText(/Your account is currently inactive\./i)
    ).toBeInTheDocument();
    // Explicitly assert the "active" affordance is NOT rendered.
    expect(screen.queryByRole("link", { name: /home|dashboard|portal/i })).toBeNull();
  });

  it("profile row missing → renders Copy B safely (no protected content, no crash)", async () => {
    PROFILE = null;
    PROFILE_MODE = "no-row";
    await renderPage();
    expect(
      screen.getByText(/Your account is currently inactive\./i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /home|dashboard|portal/i })).toBeNull();
  });

  it("profile lookup DB error → renders Copy B safely (no protected content, no leaked error)", async () => {
    PROFILE_MODE = "error";
    await renderPage();
    expect(
      screen.getByText(/Your account is currently inactive\./i)
    ).toBeInTheDocument();
    // No portal-return affordance under error
    expect(screen.queryByRole("link", { name: /home|dashboard|portal/i })).toBeNull();
    // No error / stack / raw exception surfaced
    expect(screen.queryByText(/network/i)).toBeNull();
    expect(screen.queryByText(/error/i)).toBeNull();
  });
});
