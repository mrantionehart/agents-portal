// Matrix Vault client: transport, no-spoof body, path routing, 422 fieldErrors,
// dark-404 semantics. authFetch is the only transport.

const VAULT_API = "https://vault.test/api";
jest.mock("@/lib/vault-client", () => ({ VAULT_API_URL: "https://vault.test/api" }));
const authFetchMock = jest.fn();
jest.mock("@/lib/supabase", () => ({ authFetch: (...a: unknown[]) => authFetchMock(...a) }));

import {
  prepareExercise,
  saveDraft,
  submitAttempt,
  getReviewQueue,
  certifySubmission,
  getLatestResult,
  MatrixApiError,
} from "@/lib/matrix/vault-matrix-client";

function ok(body: unknown) { return { ok: true, status: 200, text: async () => JSON.stringify(body) }; }
function err(status: number, body?: unknown) { return { ok: false, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) }; }

const FORBIDDEN = ["tenantId", "learnerId", "mode", "authoritative", "outcome", "passed", "score_pct"];

beforeEach(() => authFetchMock.mockReset());

describe("transport + routing", () => {
  it("prepareExercise POSTs /matrix-sim/prepare with an empty body", async () => {
    authFetchMock.mockResolvedValue(ok({ attemptId: "a1", scenarioId: "s", scenarioLabel: "L", briefing: "", fields: [], values: {}, hints: [] }));
    await prepareExercise();
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/matrix-sim/prepare`);
    expect(init.method).toBe("POST");
  });

  it("saveDraft PUTs the attempt path with {values} only", async () => {
    authFetchMock.mockResolvedValue(ok({ ok: true }));
    await saveDraft("a1", { streetAddress: "1 Main" });
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/matrix-sim/attempts/a1/draft`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ values: { streetAddress: "1 Main" } });
  });

  it("submitAttempt POSTs the submit path", async () => {
    authFetchMock.mockResolvedValue(ok({ submissionId: "x", scorePct: 100, passed: true, criticalErrorCount: 0, coaching: [], reviewStatus: "submitted" }));
    await submitAttempt("a1");
    expect(authFetchMock.mock.calls[0][0]).toBe(`${VAULT_API}/matrix-sim/attempts/a1/submit`);
  });

  it("certifySubmission POSTs decision+note to the submission path", async () => {
    authFetchMock.mockResolvedValue(ok({ certified: true, issued: false, reviewStatus: "approved" }));
    await certifySubmission("sub-9", "approve", "ok");
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe(`${VAULT_API}/matrix-sim/submissions/sub-9/certify`);
    expect(JSON.parse(init.body)).toEqual({ decision: "approve", note: "ok" });
  });

  it("getReviewQueue + getLatestResult are GETs with no body", async () => {
    authFetchMock.mockResolvedValue(ok({ queue: [] }));
    await getReviewQueue();
    expect(authFetchMock.mock.calls[0][0]).toBe(`${VAULT_API}/matrix-sim/review`);
    expect(authFetchMock.mock.calls[0][1].method).toBe("GET");
    authFetchMock.mockResolvedValue(ok({ result: null }));
    await getLatestResult();
    expect(authFetchMock.mock.calls[1][0]).toBe(`${VAULT_API}/matrix-sim/result`);
  });
});

describe("security + error semantics", () => {
  it("never sends an identity or score/approval field", async () => {
    authFetchMock.mockResolvedValue(ok({ ok: true }));
    await saveDraft("a1", { streetAddress: "x" });
    await certifySubmission("s", "approve");
    for (const [, init] of authFetchMock.mock.calls) {
      if (!init.body) continue;
      const keys = Object.keys(JSON.parse(init.body));
      for (const f of FORBIDDEN) expect(keys).not.toContain(f);
    }
  });

  it("surfaces a 422 submit as a MatrixApiError carrying fieldErrors", async () => {
    authFetchMock.mockResolvedValue(err(422, { error: "invalid", fieldErrors: { bedrooms: "required" } }));
    await expect(submitAttempt("a1")).rejects.toMatchObject({ code: "invalid", fieldErrors: { bedrooms: "required" } });
  });

  it("an empty-body 404 is notEnabled (dark)", async () => {
    authFetchMock.mockResolvedValue(err(404));
    await expect(prepareExercise()).rejects.toMatchObject({ notEnabled: true });
    await expect(prepareExercise()).rejects.toBeInstanceOf(MatrixApiError);
  });
});
