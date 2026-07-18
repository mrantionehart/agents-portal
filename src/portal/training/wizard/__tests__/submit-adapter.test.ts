// ============================================================================
// submit-adapter behavioral tests
// ============================================================================

import { createTrainingSubmitAdapter } from "../submit-adapter";
import { emptySession, type WizardSession } from "../../../workspace/new/wizard-session";

const okToken = async () => "test-access-token";
const noopCallbacks = {
  onTransactionCreated: jest.fn(),
  onPartyCreated: jest.fn(),
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("createTrainingSubmitAdapter", () => {
  const session: WizardSession = emptySession();

  it("POSTs to /complete and returns ok=true with the configured successHref", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ ok: true, session: { id: "s-1", status: "completed", completed_at: "x" } }),
    );
    const adapter = createTrainingSubmitAdapter({
      sessionId: "s-1",
      successHref: "/training?completed=1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const result = await adapter(session, noopCallbacks);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.redirectTo).toBe("/training?completed=1");
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[0]).toMatch(/\/activity-sessions\/s-1\/complete$/);
  });

  it("NEVER calls the production create/parties endpoints", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ ok: true, session: { id: "s-1", status: "completed", completed_at: "x" } }),
    );
    const adapter = createTrainingSubmitAdapter({
      sessionId: "s-1",
      successHref: "/training",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    await adapter(session, noopCallbacks);
    for (const call of fetchImpl.mock.calls) {
      const [url] = call as unknown as [string, RequestInit];
      expect(url).not.toMatch(/\/api\/transactions\/create/);
      expect(url).not.toMatch(/\/parties$/);
    }
    ;
  });

  it("returns ok=false with a specific message on session_expired", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: "expired", code: "session_expired" }, 409),
    );
    const adapter = createTrainingSubmitAdapter({
      sessionId: "s-1",
      successHref: "/training",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const result = await adapter(session, noopCallbacks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expired/i);
  });

  it("returns ok=false when the validator is unavailable (501 fail-closed)", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: "unavailable", code: "session_validator_unavailable" }, 501),
    );
    const adapter = createTrainingSubmitAdapter({
      sessionId: "s-1",
      successHref: "/training",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const result = await adapter(session, noopCallbacks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not yet available/i);
  });

  it("returns ok=false when criterion is not configured (501)", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: "no criterion", code: "session_criterion_unsupported" }, 501),
    );
    const adapter = createTrainingSubmitAdapter({
      sessionId: "s-1",
      successHref: "/training",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const result = await adapter(session, noopCallbacks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not yet have a training criterion/i);
  });

  it("does not throw on network errors — returns ok=false", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("dns");
    });
    const adapter = createTrainingSubmitAdapter({
      sessionId: "s-1",
      successHref: "/training",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const result = await adapter(session, noopCallbacks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});
