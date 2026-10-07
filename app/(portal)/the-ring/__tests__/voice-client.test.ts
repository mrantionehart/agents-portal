// COMM-1D — Vault Ring VOICE client: transport, security (no spoofable fields),
// path-param routing, and DARK 404 semantics. Same discipline as the text
// client: authFetch is the only transport, and the client never sends identity
// or grading fields.

const VAULT_API = "https://vault.test/api";

jest.mock("@/lib/vault-client", () => ({ VAULT_API_URL: "https://vault.test/api" }));

const authFetchMock = jest.fn();
jest.mock("@/lib/supabase", () => ({ authFetch: (...a: unknown[]) => authFetchMock(...a) }));

import {
  prepareVoice,
  joinVoice,
  completeVoice,
  getVoiceResult,
  getVoiceTranscript,
  RingApiError,
} from "@/lib/ring/vault-ring-client";

function ok(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}
function err(status: number, body?: unknown) {
  return { ok: false, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) };
}

const FORBIDDEN = ["tenantId", "learnerId", "mode", "authoritative", "outcome"];

beforeEach(() => authFetchMock.mockReset());

describe("voice transport + URL construction", () => {
  it("prepareVoice POSTs practice/prepare with only {level, certificationId}", async () => {
    authFetchMock.mockResolvedValue(
      ok({ sessionId: "s1", scenarioLabel: "L", attemptNumber: 1, countsTowardProgression: false, reused: false, level: 2 }),
    );
    await prepareVoice("cert-x", 2);
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/simulation/practice/prepare`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ level: 2, certificationId: "cert-x" });
  });

  it("joinVoice POSTs practice/join with only {sessionId, certificationId}", async () => {
    authFetchMock.mockResolvedValue(ok({ sessionId: "s1", accessToken: "tok", scenarioLabel: "L", reused: false }));
    const m = await joinVoice("cert-x", "s1");
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/simulation/practice/join`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ sessionId: "s1", certificationId: "cert-x" });
    expect(m.accessToken).toBe("tok");
  });

  it("completeVoice POSTs the sessionId PATH route with {retry, certificationId} (no sessionId in body)", async () => {
    authFetchMock.mockResolvedValue(ok({ status: "analyzing", sessionId: "s1", pollAfterMs: 1500 }));
    await completeVoice("cert-x", "s1", false);
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/simulation/practice/s1/complete`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ retry: false, certificationId: "cert-x" });
  });

  it("getVoiceResult GETs the sessionId PATH route with certificationId query, no body", async () => {
    authFetchMock.mockResolvedValue(ok({ status: "analyzing", sessionId: "s1", pollAfterMs: 1500 }));
    await getVoiceResult("cert-x", "s1");
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/simulation/practice/s1/result?certificationId=cert-x`);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("getVoiceTranscript GETs the sessionId PATH route with certificationId query", async () => {
    authFetchMock.mockResolvedValue(ok({ sessionId: "s1", scenarioLabel: "L", turns: [] }));
    await getVoiceTranscript("cert-x", "s1");
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/simulation/practice/s1/transcript?certificationId=cert-x`);
    expect(init.method).toBe("GET");
  });

  it("encodes a sessionId with unsafe characters in the path", async () => {
    authFetchMock.mockResolvedValue(ok({ status: "analyzing", sessionId: "a/b", pollAfterMs: 1 }));
    await completeVoice("cert-x", "a/b");
    expect(authFetchMock.mock.calls[0][0]).toBe(`${VAULT_API}/simulation/practice/a%2Fb/complete`);
  });
});

describe("voice security — never sends identity or grading fields", () => {
  it("no voice request body carries a forbidden field", async () => {
    authFetchMock.mockResolvedValue(ok({ sessionId: "s1", accessToken: "t", scenarioLabel: "L", reused: false }));
    await prepareVoice("c", 1);
    await joinVoice("c", "s1");
    await completeVoice("c", "s1");
    for (const [, init] of authFetchMock.mock.calls) {
      if (!init.body) continue;
      const keys = Object.keys(JSON.parse(init.body));
      for (const f of FORBIDDEN) expect(keys).not.toContain(f);
    }
  });
});

describe("voice DARK semantics", () => {
  it("a 404 with EMPTY body is notEnabled (voice route dark)", async () => {
    authFetchMock.mockResolvedValue(err(404));
    await expect(prepareVoice("c", null)).rejects.toMatchObject({ notEnabled: true });
  });

  it("trial_expired (403 with code) is a RingApiError with the code, not notEnabled", async () => {
    authFetchMock.mockResolvedValue(err(403, { error: "trial_expired" }));
    await expect(joinVoice("c", "s1")).rejects.toMatchObject({ notEnabled: false, code: "trial_expired" });
    await expect(joinVoice("c", "s1")).rejects.toBeInstanceOf(RingApiError);
  });
});
