// ============================================================================
// Listing Agent Ring — theme × tier picker + overview entry (Agent Portal)
// ============================================================================
// Pins the agent-facing integration: the Listing Ring is reachable from the
// Ring overview, and the practice surface lets an agent choose FSBO / Divorce /
// Relocation × Beginner / Intermediate / Advanced — each tile starting that
// exact scenario on the LISTING program (never the Acquisition default).
// ============================================================================

import { render, screen, fireEvent } from "@testing-library/react";

const mockEnter = jest.fn();
jest.mock("../_lib/use-text-practice", () => ({
  useTextPractice: () => ({
    phase: "idle",
    session: null,
    messages: [],
    coaching: null,
    enter: mockEnter,
    begin: jest.fn(),
  }),
}));
const mockVoiceEnter = jest.fn();
jest.mock("../_lib/use-voice-practice", () => ({
  useVoicePractice: () => ({ phase: "idle", callState: "ready", callCopy: "", session: null, enter: mockVoiceEnter }),
}));
jest.mock("@/lib/ring/vault-ring-client", () => ({
  ACQUISITION_CERTIFICATION_ID: "hartfelt-holdings-acquisition-certified",
  LISTING_CERTIFICATION_ID: "hartfelt-real-estate-listing-agent-certified",
  getCertificationProgress: jest.fn(() => Promise.reject(new Error("no-net"))),
}));

import { RingExperience } from "../_components/ring-experience";
import { LISTING_THEMES } from "../_lib/listing-themes";
import TheRingOverviewPage from "../page";

const VOICE_FLAG = "NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED";
const prevVoice = process.env[VOICE_FLAG];
afterEach(() => {
  mockEnter.mockClear();
  mockVoiceEnter.mockClear();
  if (prevVoice === undefined) delete process.env[VOICE_FLAG];
  else process.env[VOICE_FLAG] = prevVoice;
});

function renderListing() {
  return render(
    <RingExperience certificationId="hartfelt-real-estate-listing-agent-certified" themes={LISTING_THEMES} />,
  );
}

describe("Listing Ring — theme × tier picker", () => {
  it("shows all three themes, each with Beginner / Intermediate / Advanced", () => {
    renderListing();
    for (const theme of ["FSBO", "Divorce", "Relocation"]) {
      expect(screen.getByTestId(`theme-${theme.toLowerCase()}`)).toBeInTheDocument();
    }
    // Each theme offers all three tiers (9 tiles total).
    expect(screen.getAllByRole("button", { name: /Beginner/i })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /Intermediate/i })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /Advanced/i })).toHaveLength(3);
  });

  it("clicking 'FSBO — Advanced' starts that exact scenario at level 3", () => {
    renderListing();
    fireEvent.click(screen.getByRole("button", { name: "FSBO — Advanced" }));
    expect(mockEnter).toHaveBeenCalledTimes(1);
    expect(mockEnter).toHaveBeenCalledWith(3, "lst-s22-fsbo-skeptical");
  });

  it("clicking 'Divorce — Beginner' starts that exact scenario at level 1", () => {
    renderListing();
    fireEvent.click(screen.getByRole("button", { name: "Divorce — Beginner" }));
    expect(mockEnter).toHaveBeenCalledWith(1, "lst-s23-divorce-cooperative");
  });

  it("clicking 'Relocation — Intermediate' starts that exact scenario at level 2", () => {
    renderListing();
    fireEvent.click(screen.getByRole("button", { name: "Relocation — Intermediate" }));
    expect(mockEnter).toHaveBeenCalledWith(2, "lst-s21-relocation");
  });

  it("voice flag OFF: no channel chooser — straight to the (text) theme picker", () => {
    delete process.env[VOICE_FLAG];
    renderListing();
    expect(screen.queryByRole("button", { name: /voice call/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("listing-theme-picker")).toBeInTheDocument();
  });

  // RING-VOICE-THEME-1 — Vault's voice prepare now honours the tile pick.
  it("voice flag ON: Voice Call → the same theme picker → that exact scenario on VOICE", () => {
    process.env[VOICE_FLAG] = "true";
    renderListing();
    fireEvent.click(screen.getByRole("button", { name: /voice call/i }));
    expect(screen.getByTestId("voice-theme-entry")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Divorce — Advanced" }));
    expect(mockVoiceEnter).toHaveBeenCalledWith(3, "lst-s20-divorce-sensitive");
    expect(mockEnter).not.toHaveBeenCalled();
  });

  it("voice flag ON: Text Conversation → theme picker → that exact scenario on TEXT", () => {
    process.env[VOICE_FLAG] = "true";
    renderListing();
    fireEvent.click(screen.getByRole("button", { name: /text conversation/i }));
    fireEvent.click(screen.getByRole("button", { name: "FSBO — Beginner" }));
    expect(mockEnter).toHaveBeenCalledWith(1, "lst-s03-fsbo-prospecting");
    expect(mockVoiceEnter).not.toHaveBeenCalled();
  });

  it("voice picker can switch back to text", () => {
    process.env[VOICE_FLAG] = "true";
    renderListing();
    fireEvent.click(screen.getByRole("button", { name: /voice call/i }));
    fireEvent.click(screen.getByRole("button", { name: /switch to text conversation/i }));
    expect(screen.queryByTestId("voice-theme-entry")).not.toBeInTheDocument();
    expect(screen.getByTestId("listing-theme-picker")).toBeInTheDocument();
  });

  it("every tile in the catalogue resolves to a listing scenario id", () => {
    const ids = LISTING_THEMES.flatMap((t) => t.tiles.map((tile) => tile.scenarioId));
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
    for (const id of ids) expect(id).toMatch(/^lst-s\d+-/);
  });
});

describe("Ring overview — Listing Agent entry", () => {
  it("offers a 'Listing Agent Practice' card linking to /the-ring/listing", () => {
    render(<TheRingOverviewPage />);
    const link = screen.getByRole("link", { name: /Listing Agent Practice/i });
    expect(link).toHaveAttribute("href", "/the-ring/listing");
  });
});
