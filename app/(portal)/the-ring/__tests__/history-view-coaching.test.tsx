// ============================================================================
// RING-COACHING-HISTORY-1 — History → "View Coaching" reopens SAVED coaching
// ============================================================================
// Mounts the real History page. The Vault client is mocked at its boundary:
// getPracticeHistory supplies rows, getSavedCoaching supplies what Vault's
// read-only result routes return. Nothing here can grade or complete a round.
// ============================================================================

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const ACQ = "hartfelt-holdings-acquisition-certified";
const LST = "hartfelt-real-estate-listing-agent-certified";

const mockHistory = jest.fn();
const mockSaved = jest.fn();
jest.mock("@/lib/ring/vault-ring-client", () => {
  class RingApiError extends Error {
    constructor(public status = 404, public notEnabled = false) { super("x"); }
  }
  return {
    ACQUISITION_CERTIFICATION_ID: "hartfelt-holdings-acquisition-certified",
    LISTING_CERTIFICATION_ID: "hartfelt-real-estate-listing-agent-certified",
    getPracticeHistory: (id: string) => mockHistory(id),
    getSavedCoaching: (...a: unknown[]) => mockSaved(...a),
    RingApiError,
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RingApiError: MockRingApiError } = jest.requireMock("@/lib/ring/vault-ring-client") as {
  RingApiError: new (status?: number, notEnabled?: boolean) => Error;
};

import RingHistoryPage from "../history/page";

const COACHING = {
  strengths: ["Polite opener"],
  improvements: ["State your name and company first"],
  missedOpportunities: ["Ask how the sale is going"],
  coaching: ["Lead with the reason for the call"],
};

const row = (o: Partial<Record<string, unknown>> & { sessionId: string; status: string }) => ({
  scenarioLabel: "For-sale-by-owner outreach",
  startedAt: "2026-11-12T03:12:00Z",
  channel: "voice",
  displayAttempt: 1,
  level: 1,
  turnCount: 19,
  durationSeconds: 90,
  score: null,
  coverage: 0,
  reportable: false,
  ...o,
});

function listingOnly(rows: unknown[]) {
  mockHistory.mockImplementation(async (id: string) =>
    id === LST ? { rows, completed: rows.length, trend: null } : { rows: [], completed: 0, trend: null },
  );
}

beforeEach(() => {
  mockHistory.mockReset();
  mockSaved.mockReset();
});

it("offers View Coaching only on rounds whose coaching is ready", async () => {
  listingOnly([
    row({ sessionId: "ready-1", status: "ready", scenarioLabel: "Ready round" }),
    row({ sessionId: "eval-1", status: "evaluating", scenarioLabel: "Evaluating round" }),
    row({ sessionId: "void-1", status: "no_result", scenarioLabel: "Void round" }),
    row({ sessionId: "live-1", status: "in_progress", scenarioLabel: "Live round" }),
  ]);
  render(<RingHistoryPage />);
  await screen.findByText("Ready round");
  const items = screen.getAllByRole("listitem");
  const byLabel = (t: string) => items.find((li) => li.textContent?.includes(t))!;
  expect(within(byLabel("Ready round")).getByRole("button", { name: "View Coaching" })).toBeEnabled();
  for (const t of ["Evaluating round", "Void round", "Live round"]) {
    expect(within(byLabel(t)).queryByRole("button", { name: /coaching/i })).toBeNull();
  }
  expect(within(byLabel("Void round")).getByText(/no result/i)).toBeInTheDocument();
});

it("reopens a VOICE round's saved coaching with scenario, difficulty, channel, date and result", async () => {
  listingOnly([row({ sessionId: "cb38", status: "ready", level: 1 })]);
  mockSaved.mockResolvedValue({ status: "ready", sessionId: "cb38", coaching: COACHING });
  render(<RingHistoryPage />);
  fireEvent.click(await screen.findByRole("button", { name: "View Coaching" }));

  expect(mockSaved).toHaveBeenCalledWith(LST, "cb38", "voice");
  const panel = await screen.findByTestId("coaching-panel");
  await within(panel).findByText("Polite opener");
  for (const heading of ["What you did well", "Areas for improvement", "Missed opportunities", "Coaching recommendations"]) {
    expect(within(panel).getByText(heading)).toBeInTheDocument();
  }
  expect(within(panel).getByText("State your name and company first")).toBeInTheDocument();
  expect(within(panel).getByText("Ask how the sale is going")).toBeInTheDocument();
  expect(within(panel).getByText("Lead with the reason for the call")).toBeInTheDocument();
  expect(within(panel).getByText("For-sale-by-owner outreach")).toBeInTheDocument();
  expect(within(panel).getByText("Beginner")).toBeInTheDocument();
  expect(within(panel).getByText("voice")).toBeInTheDocument();
  expect(within(panel).getByText(/2026/)).toBeInTheDocument();
  // Not reportable ⇒ no number, and the reason instead.
  expect(within(panel).getByText(/No score/)).toBeInTheDocument();

  // Toggle closes it.
  fireEvent.click(screen.getByRole("button", { name: "Hide Coaching" }));
  expect(screen.queryByTestId("coaching-panel")).toBeNull();
});

it("a TEXT round reads the text route and shows a reportable score", async () => {
  listingOnly([row({ sessionId: "t1", status: "ready", channel: "text", level: 3, score: 22.6, reportable: true })]);
  mockSaved.mockResolvedValue({ status: "ready", sessionId: "t1", coaching: COACHING });
  render(<RingHistoryPage />);
  fireEvent.click(await screen.findByRole("button", { name: "View Coaching" }));
  expect(mockSaved).toHaveBeenCalledWith(LST, "t1", "text");
  const panel = await screen.findByTestId("coaching-panel");
  expect(await within(panel).findByText("Score 22.6")).toBeInTheDocument();
  expect(within(panel).getByText("Advanced")).toBeInTheDocument();
});

it("coaching still being prepared reads as pending, not as an error", async () => {
  listingOnly([row({ sessionId: "p1", status: "ready" })]);
  mockSaved.mockResolvedValue({ status: "analyzing", sessionId: "p1", pollAfterMs: 2500 });
  render(<RingHistoryPage />);
  fireEvent.click(await screen.findByRole("button", { name: "View Coaching" }));
  expect(await screen.findByText(/still being prepared/)).toBeInTheDocument();
  expect(screen.queryByText("What you did well")).toBeNull();
});

it.each([
  ["Vault refuses (not the caller's round / other tenant → 404)", () => mockSaved.mockRejectedValue(new MockRingApiError(404))],
  ["Vault forbids (403)", () => mockSaved.mockRejectedValue(new MockRingApiError(403))],
  ["evaluation failed", () => mockSaved.mockResolvedValue({ status: "failed", sessionId: "x", retryable: false })],
  ["a ready answer without a coaching object", () => mockSaved.mockResolvedValue({ status: "ready", sessionId: "x" })],
])("%s → 'not available', and nothing else leaks", async (_label, arrange) => {
  listingOnly([row({ sessionId: "x", status: "ready" })]);
  arrange();
  render(<RingHistoryPage />);
  fireEvent.click(await screen.findByRole("button", { name: "View Coaching" }));
  expect(await screen.findByText(/Coaching isn.t available for this round/)).toBeInTheDocument();
  expect(screen.queryByText("What you did well")).toBeNull();
});

it("rounds from both programs each reopen against their OWN certification", async () => {
  mockHistory.mockImplementation(async (id: string) => ({
    rows: [row({ sessionId: id === ACQ ? "a1" : "l1", status: "ready", scenarioLabel: id === ACQ ? "Acq round" : "Lst round" })],
    completed: 1,
    trend: null,
  }));
  mockSaved.mockResolvedValue({ status: "ready", sessionId: "a1", coaching: COACHING });
  render(<RingHistoryPage />);
  await screen.findByText("Acq round");
  const acq = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("Acq round"))!;
  fireEvent.click(within(acq).getByRole("button", { name: "View Coaching" }));
  await waitFor(() => expect(mockSaved).toHaveBeenCalledWith(ACQ, "a1", "voice"));
});
