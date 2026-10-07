// COMM-1D — the voice entry flag is OFF by default and read at call time.

import { voicePracticeEnabled } from "../_lib/ring-flags";

describe("voicePracticeEnabled", () => {
  const prev = process.env.NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED;
    else process.env.NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED = prev;
  });

  it("defaults OFF when unset", () => {
    delete process.env.NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED;
    expect(voicePracticeEnabled()).toBe(false);
  });

  it("is OFF for any value other than the exact string 'true'", () => {
    process.env.NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED = "1";
    expect(voicePracticeEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED = "TRUE";
    expect(voicePracticeEnabled()).toBe(false);
  });

  it("is ON only for the exact string 'true'", () => {
    process.env.NEXT_PUBLIC_RING_VOICE_PRACTICE_ENABLED = "true";
    expect(voicePracticeEnabled()).toBe(true);
  });
});
