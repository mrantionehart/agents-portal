// COMM-1D — the voice call SEQUENCE, proven without a browser or provider.
// The invariant that matters: a denied microphone never reaches join, so there
// is no provider call and nothing is spent.

import {
  startPracticeCall,
  isRetryableCallState,
  PRACTICE_CALL_COPY,
  type CallConnectionMaterial,
  type PracticeCallState,
} from "../_lib/practice-call-machine";

function deps(over: Partial<Parameters<typeof startPracticeCall>[0]> = {}) {
  const states: PracticeCallState[] = [];
  const base = {
    requestMicrophone: jest.fn(async () => true),
    join: jest.fn(async (): Promise<CallConnectionMaterial | null> => ({ accessToken: "tok" })),
    connect: jest.fn(async () => {}),
    onState: (s: PracticeCallState) => states.push(s),
  };
  const d = { ...base, ...over };
  return { d, states };
}

describe("startPracticeCall sequencing", () => {
  it("mic → join → connect on the happy path, settling in connecting", async () => {
    const { d, states } = deps();
    const r = await startPracticeCall(d, { sessionId: "s1", from: "ready" });
    expect(r).toEqual({ state: "connecting", joinRequested: true });
    expect(states).toEqual(["requesting_microphone", "connecting"]);
    expect(d.join).toHaveBeenCalledWith("s1");
    expect(d.connect).toHaveBeenCalledWith({ accessToken: "tok" });
  });

  it("DENIED microphone stops before join — no provider call, no spend", async () => {
    const { d } = deps({ requestMicrophone: jest.fn(async () => false) });
    const r = await startPracticeCall(d, { sessionId: "s1", from: "ready" });
    expect(r).toEqual({ state: "microphone_denied", joinRequested: false });
    expect(d.join).not.toHaveBeenCalled();
    expect(d.connect).not.toHaveBeenCalled();
  });

  it("a thrown microphone request is treated as denied (no join)", async () => {
    const { d } = deps({ requestMicrophone: jest.fn(async () => { throw new Error("no"); }) });
    const r = await startPracticeCall(d, { sessionId: "s1", from: "ready" });
    expect(r.state).toBe("microphone_denied");
    expect(d.join).not.toHaveBeenCalled();
  });

  it("join returning null → provider_unavailable, connect never called", async () => {
    const { d } = deps({ join: jest.fn(async () => null) });
    const r = await startPracticeCall(d, { sessionId: "s1", from: "ready" });
    expect(r).toEqual({ state: "provider_unavailable", joinRequested: true });
    expect(d.connect).not.toHaveBeenCalled();
  });

  it("connect throwing → provider_unavailable (join WAS requested)", async () => {
    const { d } = deps({ connect: jest.fn(async () => { throw new Error("transport"); }) });
    const r = await startPracticeCall(d, { sessionId: "s1", from: "ready" });
    expect(r).toEqual({ state: "provider_unavailable", joinRequested: true });
  });

  it("a second click while live is NOT a second call", async () => {
    const { d } = deps();
    const r = await startPracticeCall(d, { sessionId: "s1", from: "live" });
    expect(r).toEqual({ state: "live", joinRequested: false });
    expect(d.requestMicrophone).not.toHaveBeenCalled();
    expect(d.join).not.toHaveBeenCalled();
  });

  it("can restart from ended / provider_unavailable / microphone_denied", async () => {
    for (const from of ["ended", "provider_unavailable", "microphone_denied"] as const) {
      const { d } = deps();
      const r = await startPracticeCall(d, { sessionId: "s1", from });
      expect(r.joinRequested).toBe(true);
      expect(d.join).toHaveBeenCalled();
    }
  });
});

describe("retryable states + copy", () => {
  it("only settled states are retryable", () => {
    expect(isRetryableCallState("ended")).toBe(true);
    expect(isRetryableCallState("provider_unavailable")).toBe(true);
    expect(isRetryableCallState("microphone_denied")).toBe(true);
    expect(isRetryableCallState("live")).toBe(false);
    expect(isRetryableCallState("connecting")).toBe(false);
  });

  it("no copy line blames the learner for an infrastructure state", () => {
    expect(PRACTICE_CALL_COPY.provider_unavailable).toMatch(/Nothing was recorded/i);
    expect(PRACTICE_CALL_COPY.microphone_denied).toMatch(/microphone/i);
  });
});
