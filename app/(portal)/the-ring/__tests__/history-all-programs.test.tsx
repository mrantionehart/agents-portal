// ============================================================================
// The Ring · History lists EVERY program's rounds (Acquisition + Listing)
// ============================================================================
// Production verification found History asking Vault for Acquisition only, so
// an agent's FSBO / Divorce / Relocation (Listing) rounds never appeared. These
// mount the real page with the Vault client mocked per certification.
// ============================================================================

import { render, screen, waitFor } from "@testing-library/react";

const ACQ = "hartfelt-holdings-acquisition-certified";
const LST = "hartfelt-real-estate-listing-agent-certified";

const mockHistory = jest.fn();
jest.mock("@/lib/ring/vault-ring-client", () => {
  class RingApiError extends Error {
    constructor(public notEnabled = false) { super("x"); }
  }
  return {
    ACQUISITION_CERTIFICATION_ID: "hartfelt-holdings-acquisition-certified",
    LISTING_CERTIFICATION_ID: "hartfelt-real-estate-listing-agent-certified",
    getPracticeHistory: (id: string) => mockHistory(id),
    RingApiError,
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RingApiError: MockRingApiError } = jest.requireMock("@/lib/ring/vault-ring-client") as {
  RingApiError: new (notEnabled?: boolean) => Error;
};

import RingHistoryPage from "../history/page";

const row = (sessionId: string, scenarioLabel: string, startedAt: string, channel = "text") => ({
  sessionId, scenarioLabel, startedAt, channel, status: "ready",
  displayAttempt: 1, level: 1, turnCount: 4, durationSeconds: null, score: null, coverage: 0, reportable: false,
});

beforeEach(() => mockHistory.mockReset());

it("asks Vault for BOTH programs and lists their rounds newest-first, labelled", async () => {
  mockHistory.mockImplementation(async (id: string) =>
    id === ACQ
      ? { rows: [row("a1", "Cooperative seller", "2026-11-10T10:00:00Z", "voice")], completed: 1, trend: null }
      : { rows: [row("l1", "Relocation listing, planning ahead", "2026-11-11T23:30:00Z")], completed: 1, trend: null },
  );
  render(<RingHistoryPage />);
  expect(await screen.findByText("Relocation listing, planning ahead")).toBeInTheDocument();
  expect(screen.getByText("Cooperative seller")).toBeInTheDocument();
  expect(mockHistory.mock.calls.map((c) => c[0]).sort()).toEqual([ACQ, LST].sort());
  const items = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
  expect(items[0]).toMatch(/Relocation listing/);
  expect(items[0]).toMatch(/Listing · Practice · text/);
  expect(items[1]).toMatch(/Acquisition · Practice · voice/);
});

it("a program the agent is not assigned (403) contributes nothing — the page still renders", async () => {
  mockHistory.mockImplementation(async (id: string) => {
    if (id === LST) throw new MockRingApiError(false);
    return { rows: [row("a1", "Cooperative seller", "2026-11-10T10:00:00Z")], completed: 1, trend: null };
  });
  render(<RingHistoryPage />);
  expect(await screen.findByText("Cooperative seller")).toBeInTheDocument();
  expect(screen.queryByText(/isn.t available right now/)).not.toBeInTheDocument();
});

it("all programs dark → the existing 'not available yet' state", async () => {
  mockHistory.mockRejectedValue(new MockRingApiError(true));
  render(<RingHistoryPage />);
  await waitFor(() => expect(screen.getByText(/Practice isn.t available yet/)).toBeInTheDocument());
});

it("all programs failing for another reason → the existing error state", async () => {
  mockHistory.mockRejectedValue(new MockRingApiError(false));
  render(<RingHistoryPage />);
  await waitFor(() => expect(screen.getByText(/isn.t available right now/)).toBeInTheDocument());
});
