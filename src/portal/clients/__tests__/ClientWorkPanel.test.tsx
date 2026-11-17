/**
 * @jest-environment jsdom
 */
// ============================================================================
// LEAD-LIFECYCLE — working a claimed lead from its profile (mounted, clicked)
// ============================================================================
// Every action goes to an EXISTING endpoint and is keyed to the profile:
// follow-ups → Vault /api/crm/followups (client_profile_id / clientProfileId),
// transactions → the Portal's /api/transactions/create (client_profile_id).
// Nothing sends an owner, agent or tenant.
// ============================================================================
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/lib/supabase", () => ({ authFetch: jest.fn() }));
import { authFetch } from "@/lib/supabase";
const mockFetch = authFetch as jest.Mock;

import ClientWorkPanel from "@/src/portal/clients/ClientWorkPanel";

const CLIENT = { id: "cp-1", full_name: "Jane Lead", email: "jane@example.com", phone: "555-0100" };
const resp = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

let tasks: Array<Record<string, unknown>> = [];
const calls: Array<{ url: string; method: string; body: any }> = [];

function vault() {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });
    if (url.includes("/crm/followups") && method === "GET") return resp(200, { tasks });
    if (url.includes("/crm/followups") && method === "POST") {
      tasks.push({ id: `t${tasks.length + 1}`, title: `${body.type} follow-up`, description: body.notes ?? null,
        due_at: body.dueDate, status: "pending", bucket: "upcoming" });
      return resp(201, { task: tasks.at(-1) });
    }
    if (url.includes("/crm/followups") && method === "PATCH") {
      const t = tasks.find((x) => x.id === body.taskId)!;
      t.status = body.status; t.description = body.notes;
      return resp(200, { task: t });
    }
    if (url === "/api/transactions/create") return resp(201, { transaction: { id: "tx-9" } });
    return resp(404, {});
  });
}

beforeEach(() => { mockFetch.mockReset(); tasks = []; calls.length = 0; vault(); });

describe("ClientWorkPanel — follow-ups, contact log and appointments", () => {
  it("lists this client's follow-ups only (filtered by client_profile_id), overdue marked", async () => {
    tasks = [{ id: "t1", title: "Call Jane", description: null, due_at: "2026-11-01T15:00:00Z", status: "pending", bucket: "overdue" }];
    render(<ClientWorkPanel client={CLIENT} transactions={[]} />);
    expect(await screen.findByTestId("followup-t1")).toHaveTextContent("Overdue");
    expect(calls[0].url).toMatch(/\/crm\/followups\?client_profile_id=cp-1/);
  });

  it("adds a MEETING follow-up for this client (the lead appointment)", async () => {
    render(<ClientWorkPanel client={CLIENT} transactions={[]} />);
    await screen.findByTestId("followups-empty");
    fireEvent.change(screen.getByTestId("followup-type"), { target: { value: "meeting" } });
    fireEvent.change(screen.getByTestId("followup-due"), { target: { value: "2026-11-20T10:30" } });
    fireEvent.change(screen.getByTestId("followup-notes"), { target: { value: "Listing consultation at the house" } });
    fireEvent.click(screen.getByTestId("followup-add"));
    await waitFor(() => expect(screen.getByTestId("followups-note")).toHaveTextContent("Follow-up added."));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ clientProfileId: "cp-1", type: "meeting", dueDate: new Date("2026-11-20T10:30").toISOString(), notes: "Listing consultation at the house" });
    for (const k of ["agentId", "assignedAgentId", "tenantId", "agent_id"]) expect(post.body).not.toHaveProperty(k);
    expect(await screen.findByTestId("followup-t1")).toBeInTheDocument();
  });

  it("completing a follow-up logs the outcome against the same task (contact history)", async () => {
    tasks = [{ id: "t1", title: "Call Jane", description: null, due_at: "2026-11-20T15:00:00Z", status: "pending", bucket: "upcoming" }];
    render(<ClientWorkPanel client={CLIENT} transactions={[]} />);
    fireEvent.click(await screen.findByTestId("followup-complete-t1"));
    fireEvent.change(screen.getByTestId("followup-outcome-t1"), { target: { value: "Spoke 10 min, wants to list in spring" } });
    fireEvent.click(screen.getByTestId("followup-save-t1"));
    await waitFor(() => expect(screen.getByTestId("followups-done")).toHaveTextContent("Spoke 10 min, wants to list in spring"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ taskId: "t1", status: "completed", notes: "Spoke 10 min, wants to list in spring" });
  });

  it("a missing date is stopped on the page, and a failed load is said, not shown as empty", async () => {
    render(<ClientWorkPanel client={CLIENT} transactions={[]} />);
    await screen.findByTestId("followups-empty");
    fireEvent.click(screen.getByTestId("followup-add"));
    expect(await screen.findByTestId("followups-error")).toHaveTextContent("Choose when");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});

describe("ClientWorkPanel — transactions", () => {
  it("lists this client's transactions and starts a new one carrying the profile — no re-typing", async () => {
    render(<ClientWorkPanel client={CLIENT} transactions={[{ id: "tx-1", property_address: "1 Main St", type: "buyer", status: "active" }]} />);
    expect(screen.getByTestId("transactions-list")).toHaveTextContent("1 Main St");
    fireEvent.change(screen.getByTestId("transaction-type"), { target: { value: "seller" } });
    fireEvent.change(screen.getByTestId("transaction-address"), { target: { value: "22 Oak Ave" } });
    fireEvent.click(screen.getByTestId("transaction-start"));
    await waitFor(() => expect(screen.getByTestId("transaction-created")).toBeInTheDocument());
    expect(calls.find((c) => c.url === "/api/transactions/create")!.body).toEqual({
      type: "seller", business_line: "brokerage", property_address: "22 Oak Ave",
      client_name: "Jane Lead", client_email: "jane@example.com", client_phone: "555-0100", client_profile_id: "cp-1",
    });
    expect(screen.getByTestId("transactions-list")).toHaveTextContent("22 Oak Ave");
  });

  it("a double click starts ONE transaction; the route's own error is shown", async () => {
    let release!: () => void;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/transactions/create") return new Promise((r) => { release = () => r(resp(403, { error: "This client is not assigned to you" })); });
      return resp(200, { tasks: [] });
    });
    render(<ClientWorkPanel client={CLIENT} transactions={[]} />);
    fireEvent.change(screen.getByTestId("transaction-address"), { target: { value: "22 Oak Ave" } });
    const b = screen.getByTestId("transaction-start");
    fireEvent.click(b); fireEvent.click(b);
    expect(mockFetch.mock.calls.filter((c) => c[0] === "/api/transactions/create")).toHaveLength(1);
    release();
    expect(await screen.findByTestId("transaction-error")).toHaveTextContent("not assigned to you");
  });

  it("offers the full wizard for THIS client — only the id travels in the link", () => {
    render(<ClientWorkPanel client={CLIENT} transactions={[]} />);
    const a = screen.getByTestId("transaction-wizard-link");
    expect(a).toHaveAttribute("href", "/workspace/new?client=cp-1");
    expect(a.getAttribute("href")).not.toMatch(/Jane|example\.com|555/);
  });

  it("an unreadable transaction list says so instead of 'none'", () => {
    render(<ClientWorkPanel client={CLIENT} transactions={null} />);
    expect(screen.getByTestId("transactions-unreadable")).toBeInTheDocument();
  });
});
