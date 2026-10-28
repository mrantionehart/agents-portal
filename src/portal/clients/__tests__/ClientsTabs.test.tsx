/**
 * @jest-environment jsdom
 */
// ============================================================================
// P4H-15 — ClientsTabs renders three tabs, the new one in the middle
// ============================================================================
// Pooled unassigned-prospect rows ("dispo") are now a sibling tab
// ("Available to Claim"), not a filter chip inside "Client Profiles".
// This test pins the tab inventory and the hrefs so a refactor can't
// quietly fold the new tab back into the Profiles list.
// ============================================================================

import { render, screen } from "@testing-library/react";
import ClientsTabs from "@/src/portal/clients/ClientsTabs";

describe("P4H-15 — ClientsTabs", () => {
  it("renders three tabs: Client Profiles, Available to Claim, Leads", () => {
    render(<ClientsTabs active="profiles" />);
    expect(screen.getByRole("link", { name: /client profiles/i })).toHaveAttribute(
      "href",
      "/clients",
    );
    expect(screen.getByRole("link", { name: /available to claim/i })).toHaveAttribute(
      "href",
      "/clients?tab=claim",
    );
    expect(screen.getByRole("link", { name: /leads/i })).toHaveAttribute(
      "href",
      "/clients?tab=leads",
    );
  });

  it("marks the active tab with aria-current and leaves the others blank", () => {
    render(<ClientsTabs active="claim" />);
    expect(screen.getByRole("link", { name: /available to claim/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /client profiles/i })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: /leads/i })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
