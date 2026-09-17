// COMM-1C — Vault Ring client: transport, security (no spoofable fields), and
// DARK 404 semantics. authFetch (which attaches the Bearer token) is the only
// transport — the client never calls fetch directly and never sends identity
// or grading fields.

const VAULT_API = "https://vault.test/api";

jest.mock("@/lib/vault-client", () => ({ VAULT_API_URL: "https://vault.test/api" }));

const authFetchMock = jest.fn();
jest.mock("@/lib/supabase", () => ({ authFetch: (...a: unknown[]) => authFetchMock(...a) }));

import {
  prepareText,
  beginText,
  sendTurn,
  getTextState,
  completeText,
  getTextResult,
  getPracticeHistory,
  getCertificationProgress,
  startAssessment,
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

describe("transport + URL construction", () => {
  it("prepareText POSTs to the Vault origin with only {level, certificationId}", async () => {
    authFetchMock.mockResolvedValue(ok({ sessionId: "s1", scenarioLabel: "L", attemptNumber: 1, countsTowardProgression: false, reused: false, level: 1 }));
    await prepareText("cert-x", 2);
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/simulation/text/prepare`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ level: 2, certificationId: "cert-x" });
  });

  it("getTextState builds a query string and sends no body (GET)", async () => {
    authFetchMock.mockResolvedValue(ok({ sessionId: "s1", status: "active", sealed: false, scenarioLabel: "L", level: 1, ended: false, messages: [] }));
    await getTextState("cert-x", "s1");
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/simulation/text/state?sessionId=s1&certificationId=cert-x`);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("progress + history hit the certification/practice read endpoints", async () => {
    authFetchMock.mockResolvedValue(ok({ certificationId: "c", certificationVersion: "1.0.0", status: "not_started", completed: 0, total: 4, requirements: [], missing: [] }));
    await getCertificationProgress();
    expect(authFetchMock.mock.calls[0][0]).toBe(`${VAULT_API}/ring/seller-certification/progress`);

    authFetchMock.mockResolvedValue(ok({ rows: [], completed: 0, trend: null }));
    await getPracticeHistory("cert-x");
    expect(authFetchMock.mock.calls[1][0]).toBe(`${VAULT_API}/simulation/practice/history?certificationId=cert-x`);
  });
});

describe("start-assessment body", () => {
  it("omitted requirement → {}", async () => {
    authFetchMock.mockResolvedValue(ok({ ok: true, sessionId: "s", requirementId: "r1", scenarioLabel: "L", attemptNumber: 1, level: 1 }));
    await startAssessment();
    expect(JSON.parse(authFetchMock.mock.calls[0][1].body)).toEqual({});
  });
  it("given requirement → {requirementId}", async () => {
    authFetchMock.mockResolvedValue(ok({ ok: true, sessionId: "s", requirementId: "r2", scenarioLabel: "L", attemptNumber: 1, level: 1 }));
    await startAssessment("r2");
    expect(JSON.parse(authFetchMock.mock.calls[0][1].body)).toEqual({ requirementId: "r2" });
  });
});

describe("security — no spoofable identity/grading fields on any write", () => {
  it("prepare/begin/turn/complete/start bodies contain none of the forbidden fields", async () => {
    authFetchMock.mockResolvedValue(ok({ sessionId: "s1", openingMessage: "hi", resumed: false }));
    await beginText("cert-x", "s1");
    await sendTurn("cert-x", "s1", "hello").catch(() => {});
    await completeText("cert-x", "s1").catch(() => {});
    await prepareText("cert-x", null).catch(() => {});
    await startAssessment("r1").catch(() => {});
    for (const call of authFetchMock.mock.calls) {
      const body = call[1]?.body ? JSON.parse(call[1].body) : {};
      for (const f of FORBIDDEN) expect(body).not.toHaveProperty(f);
    }
  });
});

describe("DARK 404 semantics", () => {
  it("404 with empty body → RingApiError.notEnabled=true", async () => {
    authFetchMock.mockResolvedValue(err(404));
    await expect(startAssessment()).rejects.toMatchObject({ notEnabled: true, status: 404 });
  });
  it("404 with {error:'not_found'} → notEnabled=false, code preserved", async () => {
    authFetchMock.mockResolvedValue(err(404, { error: "not_found" }));
    await expect(getTextState("c", "s")).rejects.toMatchObject({ notEnabled: false, code: "not_found" });
  });
  it("throws RingApiError instances", async () => {
    authFetchMock.mockResolvedValue(err(409, { error: "already_certified" }));
    await expect(startAssessment()).rejects.toBeInstanceOf(RingApiError);
  });
});
