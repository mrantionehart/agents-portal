// ============================================================================
// session-api — HTTP client behavioral tests
// ============================================================================

import {
  SessionApiError,
  classifyApiFailure,
  completeSession,
  getSession,
  patchSession,
  startSession,
  type StartSessionInput,
} from "../session-api";

const okToken = async () => "test-access-token";
const nullToken = async () => null;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("classifyApiFailure", () => {
  it("maps 401 → unauthorized", () => {
    expect(classifyApiFailure(401, null)).toBe("unauthorized");
  });
  it("maps 403 → forbidden", () => {
    expect(classifyApiFailure(403, null)).toBe("forbidden");
  });
  it("maps 404 → session_not_found", () => {
    expect(classifyApiFailure(404, null)).toBe("session_not_found");
  });
  it("maps 409 session_expired → session_expired", () => {
    expect(classifyApiFailure(409, "session_expired")).toBe("session_expired");
  });
  it("maps 409 session_not_active / revoked / active_session_exists → session_not_active", () => {
    expect(classifyApiFailure(409, "session_not_active")).toBe("session_not_active");
    expect(classifyApiFailure(409, "session_revoked")).toBe("session_not_active");
    expect(classifyApiFailure(409, "active_session_exists")).toBe("session_not_active");
  });
  it("maps 5xx → network_error", () => {
    expect(classifyApiFailure(500, null)).toBe("network_error");
    expect(classifyApiFailure(503, null)).toBe("network_error");
  });
  it("falls through to unknown", () => {
    expect(classifyApiFailure(418, null)).toBe("unknown");
  });
});

describe("startSession", () => {
  const input: StartSessionInput = {
    certification_id: "hartfelt-platform-certified",
    certification_version: "1.0.0",
    lesson_id: "pcert-l04",
    activity_type: "transaction_wizard",
    evaluator_key: "test.smoke",
    criterion_version: "1",
  };

  it("POSTs to /activity-sessions/start with Bearer token", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ ok: true, session: { id: "s-1", activity_type: "transaction_wizard", status: "active", started_at: "x", expires_at: "y", state: {}, completed_steps: [] } }, 201),
    );
    const started = await startSession(input, { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken });
    expect(started.id).toBe("s-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/activity-sessions\/start$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
  });

  it("throws SessionApiError with unauthorized when no token", async () => {
    const fetchImpl = jest.fn();
    await expect(
      startSession(input, { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: nullToken }),
    ).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws SessionApiError classified by HTTP status + apiCode", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: "already exists", code: "active_session_exists" }, 409),
    );
    await expect(
      startSession(input, { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken }),
    ).rejects.toMatchObject({ code: "session_not_active", apiCode: "active_session_exists" });
  });

  it("throws network_error on fetch throw", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("dns failed");
    });
    await expect(
      startSession(input, { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken }),
    ).rejects.toMatchObject({ code: "network_error" });
  });
});

describe("getSession + patchSession + completeSession", () => {
  it("getSession round-trips a projection", async () => {
    const projection = { id: "s-1", provenance: {}, status: "active", state: { wizard: { hello: 1 } }, completed_steps: [], timestamps: { started_at: "x", expires_at: "y", completed_at: null, revoked_at: null, created_at: "x", updated_at: "x" }, revocation_reason: null };
    const fetchImpl = jest.fn(async () => jsonResponse({ ok: true, session: projection }));
    const row = await getSession("s-1", { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken });
    expect(row.id).toBe("s-1");
    expect(row.state).toEqual({ wizard: { hello: 1 } });
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[0]).toMatch(/\/activity-sessions\/s-1$/);
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe("GET");
  });

  it("patchSession sends state + completed_steps in body", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ ok: true, session: { id: "s-1" } }));
    await patchSession("s-1", { state: { wizard: { a: 1 } }, completed_steps: ["one"] }, { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/activity-sessions\/s-1$/);
    expect((init as RequestInit).method).toBe("PATCH");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ state: { wizard: { a: 1 } }, completed_steps: ["one"] });
  });

  it("completeSession POSTs to /complete", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ ok: true, session: { id: "s-1", status: "completed", completed_at: "x" } }));
    const res = await completeSession("s-1", { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken });
    expect(res.status).toBe("completed");
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[0]).toMatch(/\/activity-sessions\/s-1\/complete$/);
  });

  it("SessionApiError carries httpStatus + apiCode + code", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ error: "expired", code: "session_expired" }, 409));
    try {
      await getSession("s-1", { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken });
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SessionApiError);
      expect((err as SessionApiError).code).toBe("session_expired");
      expect((err as SessionApiError).httpStatus).toBe(409);
      expect((err as SessionApiError).apiCode).toBe("session_expired");
    }
  });
});
