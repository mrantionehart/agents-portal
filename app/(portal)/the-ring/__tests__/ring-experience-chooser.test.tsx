// COMM-1D — the channel chooser appears ONLY when the voice flag is on and the
// surface is practice (not assessment). With the flag off, the entry is the
// COMM-1C text experience, unchanged — this is the text-regression guard.

import { render, screen } from "@testing-library/react";

// Stub both hooks so the component renders without touching the network. We
// assert on which entry the component chooses, not on conversation behavior.
jest.mock("../_lib/use-text-practice", () => ({
  useTextPractice: () => ({
    phase: "idle",
    session: null,
    messages: [],
    coaching: null,
    enter: jest.fn(),
    begin: jest.fn(),
  }),
}));
jest.mock("../_lib/use-voice-practice", () => ({
  useVoicePractice: () => ({ phase: "idle", callState: "ready", callCopy: "", session: null, enter: jest.fn() }),
}));

import { RingExperience } from "../_components/ring-experience";

const FLAG = "NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED";
const prev = process.env[FLAG];
afterEach(() => {
  if (prev === undefined) delete process.env[FLAG];
  else process.env[FLAG] = prev;
});

describe("practice entry", () => {
  it("flag OFF → NO chooser; renders the text 'Start Practice' entry (regression)", () => {
    delete process.env[FLAG];
    render(<RingExperience />);
    expect(screen.getByRole("button", { name: /start practice/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voice call/i })).not.toBeInTheDocument();
  });

  it("flag ON + practice → shows the Voice Call / Text Conversation chooser", () => {
    process.env[FLAG] = "true";
    render(<RingExperience />);
    expect(screen.getByRole("button", { name: /voice call/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /text conversation/i })).toBeInTheDocument();
  });

  it("flag ON + ASSESSMENT → no chooser (certification stays text-only)", () => {
    process.env[FLAG] = "true";
    render(
      <RingExperience
        assessment={{ sessionId: "s1", label: "Requirement 1" }}
      />,
    );
    expect(screen.queryByRole("button", { name: /voice call/i })).not.toBeInTheDocument();
    // The assessment banner is the unique marker that we fell through to the
    // text experience in assessment mode (not the chooser).
    expect(screen.getByText(/Seller Lead Certification/i)).toBeInTheDocument();
  });
});
