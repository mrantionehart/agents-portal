// ============================================================================
// TODAY B.004 · Slice 4 — Home integration tests (behavioral)
// ============================================================================
// Renders the real async Home server component with mocked server deps and
// asserts the integration: TodaySection is mounted (above readiness/widgets),
// the old "Today's Transactions" list is gone, the single fetched `cards` feed
// every consumer, one Workspace fetch, and existing content is preserved.
// TodaySection/TodayRow/bucketing internals are NOT re-tested here.
// ============================================================================
import { render, screen, within } from "@testing-library/react";
import type { DeadlineSummary, WorkspaceCard } from "../../../../src/portal/workspace/types";

// ── server-dependency mocks ──────────────────────────────────────────────────
jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
  headers: async () => ({ get: () => null }),
}));

const mockGetSession = jest.fn();
const mockMaybeSingle = jest.fn(async () => ({ data: { full_name: "Jane Agent" } }));
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getSession: mockGetSession },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
  }),
}));

const mockFetchWorkspace = jest.fn();
jest.mock("@/src/portal/workspace/api", () => ({
  fetchWorkspaceFromVault: (...args: unknown[]) => mockFetchWorkspace(...args),
}));

jest.mock("@/src/portal/home/intelligence-api", () => ({
  loadHomeIntelligence: async () => ({ news: [], radar: [], hotLeads: [], opportunities: [], errors: {} }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
import PortalHomePage from "../page";

// ── fixtures ─────────────────────────────────────────────────────────────────
function ds(days: number, overdueCount = 0): DeadlineSummary {
  return {
    next_deadline_label: "Closing",
    due_date: "2026-08-15",
    days_remaining: days,
    priority: "high",
    overdue_count: overdueCount,
    at_risk_count: 0,
    breached_count: 0,
  } as unknown as DeadlineSummary;
}
function card(id: string, days: number): WorkspaceCard {
  return {
    transaction_id: id,
    transaction_type: "buyer",
    property_address: `Prop ${id}`,
    client_name: "C",
    readiness_score: 50,
    readiness_tier: "collecting",
    stage: "escrow",
    next_action: "review",
    suggested_prompt: "",
    required_forms_count: 0,
    ready_forms_count: 0,
    signed_forms_count: 0,
    blocked_forms_count: 0,
    pending_envelopes_count: 0,
    portal_status: "none",
    risk_tier: "low",
    broker_confirmation_required: true,
    deadline_summary: ds(days),
  } as unknown as WorkspaceCard;
}

const SESSION = { data: { session: { access_token: "tok", user: { id: "u1", email: "jane@x.com" } } } };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue(SESSION);
  mockMaybeSingle.mockResolvedValue({ data: { full_name: "Jane Agent" } });
});

async function renderHome() {
  const ui = await PortalHomePage();
  return render(ui);
}

describe("Home integration — TodaySection mounted, old list retired", () => {
  it("renders TodaySection (Today work queue) and NOT the old 'Today's Transactions' list", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("o", -2), card("u", 20)] });
    await renderHome();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overdue" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Today's Transactions/i })).not.toBeInTheDocument();
  });

  it("calls fetchWorkspaceFromVault exactly once", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("t", 0)] });
    await renderHome();
    expect(mockFetchWorkspace).toHaveBeenCalledTimes(1);
    expect(mockFetchWorkspace).toHaveBeenCalledWith(expect.objectContaining({ scope: "mine" }));
  });

  it("Today appears before the readiness buckets in the document", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("o", -1)] });
    await renderHome();
    const today = screen.getByRole("heading", { name: "Today" });
    const readiness = screen.getByText("Needs Attention");
    // Today precedes readiness in DOM order
    expect(today.compareDocumentPosition(readiness) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("Home integration — existing content preserved", () => {
  it("keeps readiness buckets, an intelligence widget, Recent Activity, and Quick Actions", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("t", 0)] });
    await renderHome();
    expect(screen.getByText("Needs Attention")).toBeInTheDocument(); // readiness bucket
    expect(screen.getByText("Ready for Review")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent Activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quick Actions" })).toBeInTheDocument();
  });
});

describe("Home integration — empty + error behavior", () => {
  it("empty cards → TodaySection shows caught-up; no old transaction list", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [] });
    await renderHome();
    expect(screen.getByText(/You're caught up\./)).toBeInTheDocument();
    expect(screen.getByText("No upcoming deadlines.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Today's Transactions/i })).not.toBeInTheDocument();
  });

  it("fetch failure → error banner, no fabricated deadline content", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: false, status: 500, message: "upstream boom" });
    await renderHome();
    expect(screen.getByText(/Couldn't load the dashboard/i)).toBeInTheDocument();
    // No Today work-queue / caught-up / deadline rows fabricated on failure
    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.queryByText(/You're caught up\./)).not.toBeInTheDocument();
    // Still only one fetch attempt
    expect(mockFetchWorkspace).toHaveBeenCalledTimes(1);
  });
});

describe("Home integration (Slice 5) — Business Snapshot + final ordering", () => {
  it("renders Business Snapshot containing Production + Pipeline", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("t", 0)] });
    await renderHome();
    const biz = screen.getByRole("region", { name: "Business Snapshot" });
    expect(within(biz).getByText("Production Snapshot")).toBeInTheDocument();
    expect(within(biz).getByText("Pipeline Snapshot")).toBeInTheDocument();
  });

  it("keeps the remaining intelligence widgets (e.g. Market News)", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("t", 0)] });
    await renderHome();
    expect(screen.getByText("Market News")).toBeInTheDocument();
  });

  it("final order: Today → Business Snapshot → Readiness", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("o", -1)] });
    await renderHome();
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    const today = screen.getByRole("heading", { name: "Today" });
    const biz = screen.getByRole("heading", { name: "Business Snapshot" });
    const readiness = screen.getByText("Needs Attention");
    expect(today.compareDocumentPosition(biz) & FOLLOWING).toBeTruthy(); // Today before Business Snapshot
    expect(biz.compareDocumentPosition(readiness) & FOLLOWING).toBeTruthy(); // Business Snapshot before Readiness
  });

  it("maintains a single Workspace fetch (no new API calls)", async () => {
    mockFetchWorkspace.mockResolvedValue({ ok: true, items: [card("t", 0)] });
    await renderHome();
    expect(mockFetchWorkspace).toHaveBeenCalledTimes(1);
  });
});
