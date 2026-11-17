/**
 * @jest-environment jsdom
 */
// LEAD-POOL — the agent claims a pooled brokerage lead from Clients → Claim.
// The claim goes to Vault (same path as EASE); Vault decides who may claim.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/lib/supabase", () => ({ authFetch: jest.fn() }));
import { authFetch } from "@/lib/supabase";
const mockFetch = authFetch as jest.Mock;

import ClientsClient from "@/src/portal/clients/ClientsClient";
import type { ClientListItem } from "@/src/portal/clients/types";

const row = (id: string, bucket: ClientListItem["assignmentBucket"] = "dispo"): ClientListItem => ({
  id, full_name: `Lead ${id}`, email: null, phone: null, profile_type: "buyer", temperature: "warm",
  representation_status: null, preferred_channel: null, target_areas: [], updated_at: new Date().toISOString(),
  assignmentBucket: bucket,
});
const resp = (status: number, body: unknown = {}) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

beforeEach(() => mockFetch.mockReset());

describe("LEAD-POOL — Claim from the claim view", () => {
  it("the claim view shows a Claim button per pooled lead; the profiles view shows none", () => {
    const { unmount } = render(<ClientsClient items={[row("a"), row("b")]} view="claim" />);
    expect(screen.getByTestId("claim-a")).toBeEnabled();
    expect(screen.getByTestId("claim-b")).toBeEnabled();
    unmount();
    render(<ClientsClient items={[row("a", "assigned")]} view="profiles" />);
    expect(screen.queryByTestId("claim-a")).toBeNull();
  });

  it("claims through Vault's claim action, sends nothing else, and removes the row", async () => {
    mockFetch.mockImplementation(() => resp(200, { data: {} }));
    render(<ClientsClient items={[row("a"), row("b")]} view="claim" />);
    fireEvent.click(screen.getByTestId("claim-a"));
    await waitFor(() => expect(screen.getByTestId("claim-note")).toHaveTextContent("You claimed Lead a"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/client-intelligence\/a\/dispo$/);
    expect(JSON.parse(init.body)).toEqual({ action: "claim" });
    expect(screen.queryByTestId("claim-a")).toBeNull();
    expect(screen.getByTestId("claim-b")).toBeInTheDocument();
  });

  it("losing the race says another agent was first, and the row goes", async () => {
    mockFetch.mockImplementation(() => resp(409, { error: "Profile was claimed by another agent" }));
    render(<ClientsClient items={[row("a")]} view="claim" />);
    fireEvent.click(screen.getByTestId("claim-a"));
    await waitFor(() => expect(screen.getByTestId("claim-note")).toHaveTextContent("Another agent claimed this lead first"));
    expect(screen.queryByTestId("claim-a")).toBeNull();
  });

  it("a lead not offered to this agent (Vault 404) is not claimable", async () => {
    mockFetch.mockImplementation(() => resp(404, { error: "Client profile not found" }));
    render(<ClientsClient items={[row("a")]} view="claim" />);
    fireEvent.click(screen.getByTestId("claim-a"));
    await waitFor(() => expect(screen.getByTestId("claim-note")).toHaveTextContent("no longer available to you"));
  });

  it("a double tap sends ONE claim", async () => {
    let release!: () => void;
    mockFetch.mockImplementation(() => new Promise((r) => { release = () => r(resp(200)); }));
    render(<ClientsClient items={[row("a")]} view="claim" />);
    const b = screen.getByTestId("claim-a");
    fireEvent.click(b); fireEvent.click(b);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(screen.getByTestId("claim-note")).toBeInTheDocument());
  });
});
