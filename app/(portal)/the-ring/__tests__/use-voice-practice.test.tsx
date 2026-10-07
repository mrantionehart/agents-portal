// COMM-1D — the voice hook flow: prepare → briefing → mic → join → connect →
// live → end → complete → coaching. Network + provider are mocked; we assert the
// phase machine and that completion reuses the shared coaching shape.

import { act, renderHook, waitFor } from "@testing-library/react";

// The client module is statically imported by the hook, so its mock factory
// must be self-contained (referencing an outer const would hit the TDZ, since
// ES imports are hoisted above const initialization). We read the jest.fn()s
// back through the namespace import after the fact.
jest.mock("@/lib/ring/vault-ring-client", () => ({
  __esModule: true,
  prepareVoice: jest.fn(),
  joinVoice: jest.fn(),
  completeVoice: jest.fn(),
  getVoiceResult: jest.fn(),
  getVoiceTranscript: jest.fn(),
  RingApiError: class RingApiError extends Error {
    notEnabled: boolean; code: string | null; status: number;
    constructor(status: number, code: string | null, notEnabled: boolean) {
      super(code ?? "err"); this.status = status; this.code = code; this.notEnabled = notEnabled;
    }
  },
  ACQUISITION_CERTIFICATION_ID: "cert-acq",
}));

// Controllable Retell web client. The SDK is imported DYNAMICALLY inside the
// hook's connect(), so this factory runs lazily — `mock`-prefixed outer vars are
// safe (and required by jest's hoist guard) here.
const mockHandlers: Record<string, (p?: unknown) => void> = {};
const mockStartCall = jest.fn(async () => {});
const mockStopCall = jest.fn();
jest.mock("retell-client-js-sdk", () => ({
  RetellWebClient: class {
    on(ev: string, h: (p?: unknown) => void) { mockHandlers[ev] = h; }
    startCall = mockStartCall;
    stopCall = mockStopCall;
    mute = jest.fn();
    unmute = jest.fn();
  },
}));

import * as clientModule from "@/lib/ring/vault-ring-client";
import { useVoicePractice } from "../_lib/use-voice-practice";

const client = clientModule as unknown as {
  prepareVoice: jest.Mock;
  joinVoice: jest.Mock;
  completeVoice: jest.Mock;
  getVoiceResult: jest.Mock;
  getVoiceTranscript: jest.Mock;
  RingApiError: new (s: number, c: string | null, n: boolean) => Error;
};
const handlers = mockHandlers;
const startCall = mockStartCall;
const stopCall = mockStopCall;

beforeAll(() => {
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: jest.fn(async () => ({ getTracks: () => [{ stop: jest.fn() }] })) },
  });
});
beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  client.prepareVoice.mockReset();
  client.joinVoice.mockReset();
  client.completeVoice.mockReset();
  client.getVoiceResult.mockReset();
  client.getVoiceTranscript.mockReset();
  startCall.mockClear();
  stopCall.mockClear();
});

const COACHING = { strengths: ["s"], improvements: [], missedOpportunities: [], coaching: ["c"] };

it("prepare moves to briefing with the session", async () => {
  client.prepareVoice.mockResolvedValue({ sessionId: "s1", scenarioLabel: "Motivated seller", reused: false, level: 2 });
  const { result } = renderHook(() => useVoicePractice("cert-acq"));
  await act(async () => { await result.current.enter(2); });
  expect(result.current.phase).toBe("briefing");
  expect(result.current.session).toEqual({ sessionId: "s1", scenarioLabel: "Motivated seller", level: 2 });
  expect(client.prepareVoice).toHaveBeenCalledWith("cert-acq", 2);
});

it("startCall runs mic → join → connect and goes live on call_started", async () => {
  client.prepareVoice.mockResolvedValue({ sessionId: "s1", scenarioLabel: "L", reused: false, level: null });
  client.joinVoice.mockResolvedValue({ sessionId: "s1", accessToken: "tok", scenarioLabel: "L", reused: false, callId: "c1" });
  const { result } = renderHook(() => useVoicePractice("cert-acq"));
  await act(async () => { await result.current.enter(null); });
  await act(async () => { result.current.startCall(); });
  expect(result.current.phase).toBe("in_call");
  expect(client.joinVoice).toHaveBeenCalledWith("cert-acq", "s1");
  expect(startCall).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "tok", callId: "c1" }));
  await act(async () => { handlers["call_started"]?.(); });
  expect(result.current.callState).toBe("live");
});

it("call_ended → complete (ready) → done with the shared coaching + transcript", async () => {
  client.prepareVoice.mockResolvedValue({ sessionId: "s1", scenarioLabel: "L", reused: false, level: null });
  client.joinVoice.mockResolvedValue({ sessionId: "s1", accessToken: "tok", scenarioLabel: "L", reused: false });
  client.completeVoice.mockResolvedValue({ status: "ready", sessionId: "s1", coaching: COACHING });
  client.getVoiceTranscript.mockResolvedValue({ sessionId: "s1", scenarioLabel: "L", turns: [{ idx: 0, role: "learner", content: "hi" }] });
  const { result } = renderHook(() => useVoicePractice("cert-acq"));
  await act(async () => { await result.current.enter(null); });
  await act(async () => { result.current.startCall(); });
  await act(async () => { handlers["call_started"]?.(); });
  await act(async () => { handlers["call_ended"]?.(); });
  expect(result.current.callState).toBe("ended");
  await act(async () => { await result.current.complete(); });
  expect(result.current.phase).toBe("done");
  expect(result.current.coaching).toEqual(COACHING);
  await waitFor(() => expect(result.current.transcript?.turns.length).toBe(1));
});

it("complete returning analyzing then result ready advances to done", async () => {
  client.prepareVoice.mockResolvedValue({ sessionId: "s1", scenarioLabel: "L", reused: false, level: null });
  client.completeVoice.mockResolvedValue({ status: "analyzing", sessionId: "s1", pollAfterMs: 1 });
  client.getVoiceResult.mockResolvedValue({ status: "ready", sessionId: "s1", coaching: COACHING });
  client.getVoiceTranscript.mockResolvedValue({ sessionId: "s1", scenarioLabel: "L", turns: [] });
  const { result } = renderHook(() => useVoicePractice("cert-acq"));
  await act(async () => { await result.current.enter(null); });
  await act(async () => { await result.current.complete(); });
  await waitFor(() => expect(result.current.phase).toBe("done"));
  expect(result.current.coaching).toEqual(COACHING);
});

it("an expired-trial prepare surfaces a SPECIFIC message, not the generic one", async () => {
  client.prepareVoice.mockRejectedValue(new client.RingApiError(403, "trial_expired", false));
  const { result } = renderHook(() => useVoicePractice("cert-acq"));
  await act(async () => { await result.current.enter(null); });
  expect(result.current.phase).toBe("error");
  expect(result.current.error).toMatch(/expired/i);
  expect(result.current.error).not.toMatch(/something went wrong/i);
});

it("a dark voice route surfaces 'not available yet'", async () => {
  client.prepareVoice.mockRejectedValue(new client.RingApiError(404, null, true));
  const { result } = renderHook(() => useVoicePractice("cert-acq"));
  await act(async () => { await result.current.enter(null); });
  expect(result.current.phase).toBe("error");
  expect(result.current.error).toMatch(/available yet/i);
});
