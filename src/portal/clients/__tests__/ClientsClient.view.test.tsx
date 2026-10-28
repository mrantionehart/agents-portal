/**
 * @jest-environment jsdom
 */
// ============================================================================
// P4H-15 — ClientsClient renders the right chrome for each view
// ============================================================================
// The agent's view of their Clients page splits into two tabs:
//   • profiles — rows they OWN. All assignment filter chips apply.
//   • claim    — the pooled unassigned-prospect pool. Every row is dispo,
//     so the assignment chips become redundant and are hidden; the row
//     still carries the "Available to claim" badge.
// ============================================================================

import { render, screen, within } from "@testing-library/react";
import ClientsClient from "@/src/portal/clients/ClientsClient";
import type { ClientListItem } from "@/src/portal/clients/types";

function row(id: string, bucket: ClientListItem["assignmentBucket"]): ClientListItem {
  return {
    id,
    full_name: `Client ${id}`,
    email: `${id}@example.com`,
    phone: null,
    profile_type: "buyer",
    temperature: "warm",
    representation_status: null,
    preferred_channel: null,
    target_areas: [],
    updated_at: new Date().toISOString(),
    assignmentBucket: bucket,
  };
}

describe("P4H-15 — ClientsClient view=profiles", () => {
  it("shows the Assigned / Claimed assignment chips (default)", () => {
    render(<ClientsClient items={[row("a", "assigned")]} view="profiles" />);
    expect(screen.getByRole("button", { name: /^All Assignments/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Assigned to Me/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claimed by Me/i })).toBeInTheDocument();
    // The old "Dispo Feed" chip is retired on this surface — pooled rows
    // live in their own tab now, not as a filter inside the owned view.
    expect(screen.queryByRole("button", { name: /Dispo Feed/i })).not.toBeInTheDocument();
  });

  it("defaults to showing all rows (no view prop)", () => {
    render(<ClientsClient items={[row("a", "assigned"), row("b", "claimed")]} />);
    expect(screen.getByRole("button", { name: /^All Assignments/i })).toBeInTheDocument();
  });
});

describe("P4H-15 — ClientsClient view=claim", () => {
  it("hides the assignment chip row (every row is pooled)", () => {
    render(
      <ClientsClient
        items={[row("x", "dispo"), row("y", "dispo")]}
        view="claim"
      />,
    );
    expect(screen.queryByRole("button", { name: /^All Assignments/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Assigned to Me/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Claimed by Me/i })).not.toBeInTheDocument();
  });

  it("still labels each row 'Available to claim'", () => {
    render(
      <ClientsClient
        items={[row("x", "dispo")]}
        view="claim"
      />,
    );
    const link = screen.getByRole("link", { name: /Client x/i });
    expect(within(link).getByText(/Available to claim/i)).toBeInTheDocument();
  });

  it("temperature and type chips still work (filters still composable)", () => {
    render(<ClientsClient items={[row("x", "dispo")]} view="claim" />);
    expect(screen.getByRole("button", { name: /^All \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All Types/i })).toBeInTheDocument();
  });
});
