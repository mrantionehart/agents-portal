/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.4D — CoordinatorPanel component tests
// ============================================================================
// Covers: loading, loaded, blocked, ready, CTA navigation (push + refresh),
// recommended-tab navigation, degraded collector (subtle, count-only),
// confidence display, unavailable state (non-200 / throw → workspace unblocked),
// leak safety (raw collection error message never rendered), the P1 fix (default
// token path uses the lock-free getAccessToken helper, NOT getSession), and the
// hang backstop (token/fetch timeout → unavailable; spinner always terminates).
//
// The panel fetches independently; we inject `fetchImpl` + `getToken` (the
// established SubmitForReview injectable-fetch idiom) and mock next/navigation.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import CoordinatorPanel from "../components/CoordinatorPanel";
import type { CoordinatorResponse, TransactionDirective } from "../coordinator-view";

const SECRET = "SENTINEL-DB-ERROR-do-not-leak";
const getToken = async () => "test-token";
const NEVER = () => new Promise<never>(() => {}); // resolves never — simulates a hang

function directive(over: Partial<TransactionDirective> = {}): TransactionDirective {
  return {
    transaction_id: "txn-1",
    workflow_state: "collecting_information",
    next_action: {
      key: "complete_required_fields",
      label: "Complete required fields",
      owner: "agent",
      cta_label: "Complete Required Fields",
      tab: "documents",
      is_blocked: false,
    },
    priority: "high",
    readiness: { tier: "in_progress", score: 80, can_prepare_package: false, can_send_for_signature: false },
    blockers: [],
    risks: [],
    recommended_tab: "documents",
    recommended_cta: "Complete Required Fields",
    confidence: { level: "high", score: 0.83, reasons: [] },
    meta: { coordinator_version: "3.4A.0" },
    ...over,
  };
}

function response(dOver: Partial<TransactionDirective> = {}, cOver: Partial<CoordinatorResponse["collection"]> = {}): CoordinatorResponse {
  return {
    directive: directive(dOver),
    collection: {
      inputs_present: ["lifecycle", "coach", "package_gates", "workspace"],
      inputs_missing: ["monitoring", "commission"],
      errors: [],
      loaded_at_ms: 1_700_000_000_000,
      collector_version: "3.4B.0",
      ...cOver,
    },
  };
}

function okFetch(body: CoordinatorResponse): typeof fetch {
  return jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}
function failFetch(status: number): typeof fetch {
  return jest.fn(async () => ({ ok: false, status, json: async () => ({ error: "nope" }) })) as unknown as typeof fetch;
}
function throwFetch(): typeof fetch {
  return jest.fn(async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockPush.mockClear();
  mockRefresh.mockClear();
});

describe("CoordinatorPanel", () => {
  it("loading — shows a height-preserving skeleton (no spinner text, no layout-shift copy)", () => {
    const pending = (jest.fn(() => new Promise(() => {})) as unknown) as typeof fetch;
    const { container } = render(<CoordinatorPanel transactionId="txn-1" fetchImpl={pending} getToken={getToken} />);
    // Skeleton present, aria-busy, and reserves the panel container.
    expect(screen.getByTestId("coordinator-skeleton")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /Transaction Coordinator loading/ })).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    // No text spinner copy anymore.
    expect(screen.queryByText(/Loading coordinator/)).not.toBeInTheDocument();
  });

  it("loaded — renders the directive fields", async () => {
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(response())} getToken={getToken} />);
    expect(await screen.findByText("Complete required fields")).toBeInTheDocument();
    expect(screen.getByText("Collecting information")).toBeInTheDocument();
    expect(screen.getByText(/Readiness: In progress · 80%/)).toBeInTheDocument();
  });

  it("confidence display — shows the level word only, no percentage", async () => {
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(response())} getToken={getToken} />);
    expect(await screen.findByText(/Confidence High/)).toBeInTheDocument();
    // Confidence no longer carries a percentage (readiness still may).
    expect(screen.queryByText(/Confidence \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/100% · high/)).not.toBeInTheDocument();
  });

  it("CTA is a primary gold button (navigation only)", async () => {
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(response())} getToken={getToken} />);
    const cta = await screen.findByRole("button", { name: /Complete Required Fields/ });
    // Filled gold primary button (not a text link).
    expect(cta.className).toMatch(/bg-\[#C9A84C\]/);
  });

  it("blocked transaction — single blocker: severity + owner chips, resolution, risk, no toggle", async () => {
    const res = response({
      workflow_state: "blocked",
      priority: "critical",
      next_action: { key: "resolve_deadline", label: "Resolve overdue deadline", owner: "agent", cta_label: "Review Deadlines", tab: "timeline", is_blocked: true },
      blockers: [{ category: "missing_fields", owner: "agent", severity: "high", reason: "3 required fields are missing", resolution: "Complete them in Paperwork", count: 3 }],
      risks: [{ category: "stale_sent", severity: "medium", reason: "Envelope sent 9 days ago" }],
    });
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(res)} getToken={getToken} />);
    expect(await screen.findByText(/3 required fields are missing/)).toBeInTheDocument();
    expect(screen.getByText(/Complete them in Paperwork/)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();   // severity chip
    expect(screen.getByText("Agent")).toBeInTheDocument();  // owner chip
    expect(screen.getByText(/Envelope sent 9 days ago/)).toBeInTheDocument(); // risk unaffected
    // single blocker → no collapse toggle
    expect(screen.queryByText(/more blocker/)).not.toBeInTheDocument();
  });

  it("multi-blocker — collapsed shows only the top (owner-ordered) blocker + '+ N more'", async () => {
    const res = response({
      workflow_state: "blocked",
      blockers: [
        { category: "broker_review", owner: "broker", severity: "critical", reason: "Broker must approve", resolution: "Await broker" },
        { category: "missing_fields", owner: "agent", severity: "high", reason: "Fields missing", resolution: "Complete them" },
        { category: "missing_signatures", owner: "client", severity: "medium", reason: "Signatures pending", resolution: "Nudge client" },
      ],
      risks: [],
    });
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(res)} getToken={getToken} />);
    // Top blocker is the agent one (owner-first), NOT the critical broker one.
    expect(await screen.findByText(/Fields missing/)).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    // Others hidden while collapsed.
    expect(screen.queryByText(/Broker must approve/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Signatures pending/)).not.toBeInTheDocument();
    // Toggle shows the remaining count.
    expect(screen.getByRole("button", { name: /\+ 2 more blockers/ })).toBeInTheDocument();
  });

  it("multi-blocker — expand reveals the rest (owner-ordered) + 'Show less'", async () => {
    const res = response({
      workflow_state: "blocked",
      blockers: [
        { category: "broker_review", owner: "broker", severity: "critical", reason: "Broker must approve", resolution: "Await broker" },
        { category: "missing_fields", owner: "agent", severity: "high", reason: "Fields missing", resolution: "Complete them" },
        { category: "missing_signatures", owner: "client", severity: "medium", reason: "Signatures pending", resolution: "Nudge client" },
      ],
      risks: [],
    });
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(res)} getToken={getToken} />);
    fireEvent.click(await screen.findByRole("button", { name: /\+ 2 more blockers/ }));
    // Now all three visible, and the broker (critical) is ordered LAST.
    expect(screen.getByText(/Fields missing/)).toBeInTheDocument();
    expect(screen.getByText(/Signatures pending/)).toBeInTheDocument();
    expect(screen.getByText(/Broker must approve/)).toBeInTheDocument();
    expect(screen.getByText("Broker")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show less/ })).toBeInTheDocument();
  });

  it("ready transaction — no blockers, CTA reflects the ready action", async () => {
    const res = response({
      workflow_state: "ready_to_send",
      next_action: { key: "send_documents", label: "Send documents for signature", owner: "agent", cta_label: "Send Documents", tab: "package", is_blocked: false },
      recommended_cta: "Send Documents",
      recommended_tab: "package",
      blockers: [],
      risks: [],
    });
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(res)} getToken={getToken} />);
    expect(await screen.findByText("Send documents for signature")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Documents/ })).toBeInTheDocument();
  });

  it("CTA navigation — click pushes the recommended-tab href and refreshes", async () => {
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(response())} getToken={getToken} />);
    const cta = await screen.findByRole("button", { name: /Complete Required Fields/ });
    fireEvent.click(cta);
    expect(mockPush).toHaveBeenCalledWith("/workspace/txn-1?tab=documents");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("recommended-tab navigation — package routes to ?tab=package", async () => {
    const res = response({ recommended_tab: "package", recommended_cta: "Generate Package", next_action: { key: "generate_package", label: "Generate the package", owner: "agent", cta_label: "Generate Package", tab: "package", is_blocked: false } });
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(res)} getToken={getToken} />);
    const cta = await screen.findByRole("button", { name: /Generate Package/ });
    fireEvent.click(cta);
    expect(mockPush).toHaveBeenCalledWith("/workspace/txn-1?tab=package");
  });

  it("degraded collector — shows a subtle count-only notice, no raw message", async () => {
    const res = response(
      { confidence: { level: "low", score: 0.15, reasons: [SECRET] } },
      { inputs_present: ["lifecycle"], errors: [{ source: "coach", message: SECRET }] }
    );
    const { container } = render(<CoordinatorPanel transactionId="txn-1" fetchImpl={okFetch(res)} getToken={getToken} />);
    expect(await screen.findByText(/Limited data — 1 of 12 signals available/)).toBeInTheDocument();
    expect(container.textContent).not.toContain(SECRET);
  });

  it("unavailable — non-200 renders the fallback strip, workspace unblocked", async () => {
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={failFetch(500)} getToken={getToken} />);
    expect(await screen.findByText(/Coordinator temporarily unavailable/)).toBeInTheDocument();
  });

  it("unavailable — a thrown fetch degrades quietly (no crash)", async () => {
    render(<CoordinatorPanel transactionId="txn-1" fetchImpl={throwFetch()} getToken={getToken} />);
    expect(await screen.findByText(/Coordinator temporarily unavailable/)).toBeInTheDocument();
  });

  // ── P1 FIX: hang backstop — the spinner must always terminate ───────────────
  it("token retrieval hangs → timeout → unavailable (spinner terminates)", async () => {
    render(
      <CoordinatorPanel transactionId="txn-1" getToken={NEVER} fetchImpl={okFetch(response())} timeoutMs={50} />
    );
    expect(await screen.findByText(/Coordinator temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading coordinator/)).not.toBeInTheDocument();
  });

  it("fetch hangs → timeout → unavailable (spinner terminates)", async () => {
    const hangingFetch = (jest.fn(() => new Promise(() => {})) as unknown) as typeof fetch;
    render(
      <CoordinatorPanel transactionId="txn-1" getToken={getToken} fetchImpl={hangingFetch} timeoutMs={50} />
    );
    expect(await screen.findByText(/Coordinator temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading coordinator/)).not.toBeInTheDocument();
  });

  it("a fast success beats the timeout → directive still renders (no false unavailable)", async () => {
    render(
      <CoordinatorPanel transactionId="txn-1" getToken={getToken} fetchImpl={okFetch(response())} timeoutMs={5000} />
    );
    expect(await screen.findByText("Complete required fields")).toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/)).not.toBeInTheDocument();
  });
});

// ── P1 FIX source contract ──────────────────────────────────────────────────
// The default token path lazily import()s "@/lib/supabase", which is NOT
// resolvable under the jest `@/`→src alias (lib/ is at the repo root), so the
// default path can't be exercised at runtime here. Assert the fix at the source
// level instead (mirrors the SubmitForReview forward-route source contract):
// the panel MUST use the lock-free getAccessToken helper and MUST NOT call the
// hanging supabase.auth.getSession().
describe("CoordinatorPanel — token retrieval source contract (P1 fix)", () => {
  const src = readFileSync(join(__dirname, "../components/CoordinatorPanel.tsx"), "utf8");

  it("uses the lock-free getAccessToken helper", () => {
    expect(src).toMatch(/getAccessToken/);
    expect(src).toMatch(/import\(["']@\/lib\/supabase["']\)/);
  });

  it("never calls supabase.auth.getSession()", () => {
    expect(src).not.toMatch(/getSession/);
  });

  it("bounds the load with a timeout so the spinner always terminates", () => {
    expect(src).toMatch(/setTimeout/);
    expect(src).toMatch(/timeoutMs/);
  });
});
