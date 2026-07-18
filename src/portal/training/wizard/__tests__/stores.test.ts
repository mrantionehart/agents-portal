// ============================================================================
// Store implementations behavioral tests
// ============================================================================

import { productionLocalStorageStore } from "../production-store";
import { createTrainingSessionApiStore } from "../training-store";
import {
  WIZARD_SESSION_KEY,
  emptySession,
  type WizardSession,
} from "../../../workspace/new/wizard-session";

const okToken = async () => "test-access-token";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function activeRow(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    session: {
      id: "s-1",
      provenance: {
        user_id: "u",
        tenant_id: "t",
        certification_id: "hartfelt-platform-certified",
        certification_version: "1.0.0",
        lesson_id: "pcert-l04",
        evaluator_key: "test.smoke",
        criterion_version: "1",
        activity_type: "transaction_wizard",
      },
      status: "active",
      state: {},
      completed_steps: [],
      timestamps: {
        started_at: "2026-07-18T00:00:00Z",
        expires_at: "2099-12-31T23:59:59Z",
        completed_at: null,
        revoked_at: null,
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      },
      revocation_reason: null,
      ...overrides,
    },
  };
}

// ─── productionLocalStorageStore ─────────────────────────────────────────

describe("productionLocalStorageStore", () => {
  beforeEach(() => window.localStorage.clear());

  it("load returns the empty session when nothing persisted", async () => {
    const r = await productionLocalStorageStore.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.session).toEqual(emptySession());
    }
  });

  it("save writes to WIZARD_SESSION_KEY", async () => {
    const session: WizardSession = { ...emptySession(), transaction_type: "purchase" };
    await productionLocalStorageStore.save(session);
    const raw = window.localStorage.getItem(WIZARD_SESSION_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).transaction_type).toBe("purchase");
  });

  it("clear removes the key", async () => {
    await productionLocalStorageStore.save(emptySession());
    expect(window.localStorage.getItem(WIZARD_SESSION_KEY)).not.toBeNull();
    await productionLocalStorageStore.clear();
    expect(window.localStorage.getItem(WIZARD_SESSION_KEY)).toBeNull();
  });
});

// ─── TrainingSessionApiStore ─────────────────────────────────────────────

describe("createTrainingSessionApiStore.load", () => {
  it("returns session=null when state.wizard is absent (fresh session)", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(activeRow()));
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.session).toBeNull();
  });

  it("returns the persisted WizardSession from state.wizard", async () => {
    const persisted: WizardSession = { ...emptySession(), transaction_type: "purchase" };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(activeRow({ state: { wizard: persisted } })),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.session?.transaction_type).toBe("purchase");
  });

  it("returns session_expired when the API session is expired-status", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(activeRow({ status: "expired" })));
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const r = await store.load();
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("session_expired");
  });

  it("returns session_not_active for revoked/completed/abandoned", async () => {
    for (const status of ["completed", "revoked", "abandoned"] as const) {
      const fetchImpl = jest.fn(async () => jsonResponse(activeRow({ status })));
      const store = createTrainingSessionApiStore({
        sessionId: "s-1",
        deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
      });
      const r = await store.load();
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("session_not_active");
    }
  });

  it("returns session_expired when expires_at is past", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({
          timestamps: {
            started_at: "2000-01-01T00:00:00Z",
            expires_at: "2000-01-01T00:01:00Z",
            completed_at: null,
            revoked_at: null,
            created_at: "2000-01-01T00:00:00Z",
            updated_at: "2000-01-01T00:00:00Z",
          },
        }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const r = await store.load();
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("session_expired");
  });

  it("returns error with mapped code on API failure", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ error: "gone" }, 404));
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const r = await store.load();
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("session_not_found");
  });
});

describe("createTrainingSessionApiStore.save", () => {
  it("PATCHes state.wizard with the given session", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ ok: true, session: { id: "s-1" } }));
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const session: WizardSession = { ...emptySession(), transaction_type: "purchase" };
    const r = await store.save(session);
    expect(r.kind).toBe("ok");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.state.wizard.transaction_type).toBe("purchase");
    expect((init as RequestInit).method).toBe("PATCH");
  });

  it("surfaces API errors via code", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: "expired", code: "session_expired" }, 409),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const r = await store.save(emptySession());
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("session_expired");
  });
});

describe("createTrainingSessionApiStore.clear", () => {
  it("PATCHes an empty state", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ ok: true, session: { id: "s-1" } }));
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, getAccessTokenImpl: okToken },
    });
    const r = await store.clear();
    expect(r.kind).toBe("ok");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.state).toEqual({});
  });
});
