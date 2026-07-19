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

  it("PILOT-D-008: load reconciles server-side completed_steps with client persisted", async () => {
    const persisted: WizardSession = {
      ...emptySession(),
      transaction_type: "purchase",
      completed_steps: ["type"],
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({
          state: { wizard: persisted },
          completed_steps: ["property"],
        }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.session) {
      // Union: type (client) + property (server) + derived-from-state
      // (type — evidence-based since transaction_type is set).
      // Preserves canonical journey order.
      expect(r.session.completed_steps).toEqual(["type", "property"]);
    }
  });

  it("PILOT-D-008 recovery: derives all five steps from state.wizard evidence when server completed_steps is empty (learner #1 stuck-session shape)", async () => {
    // Mirrors production session `704fb65b-...`: server has state.wizard
    // fully populated but completed_steps=[]. The reconciled load result
    // MUST expose all five steps so the useEffect-driven save flushes
    // them to the server on next PATCH.
    const stuck: WizardSession = {
      ...emptySession(),
      transaction_type: "purchase",
      property: { address: "123 test" },
      parties: [
        { role: "buyer", name: "test" },
        { role: "seller", name: "sell test" },
      ],
      dates: {
        contract_date: "2026-07-19",
        closing_date: "2026-07-30",
      },
      current_step: "create",
      completed_steps: [], // Client-persisted empty — matches the stuck-session bug.
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({
          state: { wizard: stuck },
          completed_steps: [], // Server-persisted empty too.
        }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.session) {
      expect(r.session.completed_steps).toEqual([
        "type",
        "property",
        "parties",
        "dates",
        "review",
      ]);
    }
  });

  it("PILOT-D-008 recovery: does NOT synthesize steps that state.wizard cannot prove", async () => {
    // Learner is only on the `parties` step, having filled in type
    // and property. dates and review MUST NOT be marked completed.
    const partial: WizardSession = {
      ...emptySession(),
      transaction_type: "purchase",
      property: { address: "123 Main" },
      current_step: "parties",
      completed_steps: [],
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({
          state: { wizard: partial },
          completed_steps: [],
        }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const r = await store.load();
    if (r.kind === "ok" && r.session) {
      expect(r.session.completed_steps).toEqual(["type", "property"]);
      expect(r.session.completed_steps).not.toContain("parties");
      expect(r.session.completed_steps).not.toContain("dates");
      expect(r.session.completed_steps).not.toContain("review");
    }
  });

  it("PILOT-D-008 recovery: uses ONLY the normal authenticated PATCH — no synthesized side channel", async () => {
    // This is a defensive assertion: the reconciliation must happen
    // during load() by MASSAGING THE RETURN VALUE — no fire-and-forget
    // secondary fetch call is made. The subsequent PATCH is driven
    // entirely by useWizardSession's hydration effect through the
    // public session-api, which the outer test surface owns.
    const stuck: WizardSession = {
      ...emptySession(),
      transaction_type: "purchase",
      property: { address: "1 Elm" },
      parties: [{ role: "buyer", name: "Alice" }],
      dates: { contract_date: "2026-07-19" },
      current_step: "create",
      completed_steps: [],
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(activeRow({ state: { wizard: stuck }, completed_steps: [] })),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    await store.load();
    // Exactly one fetch: the GET. Recovery reshapes the response — it
    // does not fire a separate PATCH during load.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init as RequestInit).method ?? "GET").toBe("GET");
  });

  // ── PILOT-D-008 hotfix: runtime compatibility with pre-fix persisted state ──
  //
  // Sessions persisted BEFORE the PILOT-D-008 fix landed had NO
  // `completed_steps` field on their state.wizard blob (the WizardSession
  // interface did not yet declare it). When the fix's reconciler tried to
  // `for … of wizard.completed_steps`, JS threw `Symbol.iterator is
  // undefined` and every stuck session crashed into an error boundary
  // before recovery could run. The hotfix normalizes `completed_steps`
  // at the deserialization boundary (extractWizardSession) and
  // defensively coalesces in reconcileCompletedSteps.

  it("HOTFIX: legacy state.wizard with NO completed_steps field loads without throwing", async () => {
    // Learner #1's exact stuck-session shape as it round-trips off the
    // server: state.wizard is fully populated but has no completed_steps
    // key at all (because it was written by a pre-fix client).
    const legacyWizardMissingField = {
      version: 1,
      transaction_type: "purchase",
      property: { address: "123 test" },
      parties: [
        { role: "buyer", name: "test", signature_required: true },
        { role: "seller", name: "sell test", signature_required: true },
      ],
      dates: { contract_date: "2026-07-19", closing_date: "2026-07-30" },
      current_step: "create",
      draft_transaction_id: null,
      created_party_ids: [],
      // NB: `completed_steps` field intentionally absent.
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({
          state: { wizard: legacyWizardMissingField },
          completed_steps: [],
        }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    // Must not throw. Must return the reconciled session, deriving all
    // five canonical steps from state.wizard evidence.
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.session) {
      expect(Array.isArray(r.session.completed_steps)).toBe(true);
      expect(r.session.completed_steps).toEqual([
        "type",
        "property",
        "parties",
        "dates",
        "review",
      ]);
    }
  });

  it("HOTFIX: legacy state.wizard with completed_steps=null loads without throwing", async () => {
    const legacyWizardNull = {
      version: 1,
      transaction_type: "purchase",
      property: { address: "123 test" },
      parties: [{ role: "buyer", name: "Alice" }],
      dates: { contract_date: "2026-07-19" },
      current_step: "review",
      draft_transaction_id: null,
      created_party_ids: [],
      completed_steps: null as unknown as string[],
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({
          state: { wizard: legacyWizardNull },
          completed_steps: [],
        }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.session) {
      expect(Array.isArray(r.session.completed_steps)).toBe(true);
      // On review step, the derivation does NOT include "review"
      // (review is only completed once the wizard has advanced past it).
      expect(r.session.completed_steps).toEqual(["type", "property", "parties", "dates"]);
    }
  });

  it("HOTFIX: malformed non-array completed_steps (string / object / number) coerces to []", async () => {
    for (const bad of ["typeXproperty", { 0: "type" }, 42, true] as unknown[]) {
      const wizard = {
        version: 1,
        transaction_type: "purchase",
        property: {},
        parties: [],
        dates: {},
        current_step: "type",
        draft_transaction_id: null,
        created_party_ids: [],
        completed_steps: bad as unknown as string[],
      };
      const fetchImpl = jest.fn(async () =>
        jsonResponse(
          activeRow({ state: { wizard }, completed_steps: [] }),
        ),
      );
      const store = createTrainingSessionApiStore({
        sessionId: "s-1",
        deps: {
          fetchImpl: fetchImpl as unknown as typeof fetch,
          getAccessTokenImpl: okToken,
        },
      });
      const r = await store.load();
      expect(r.kind).toBe("ok");
      if (r.kind === "ok" && r.session) {
        expect(Array.isArray(r.session.completed_steps)).toBe(true);
        // Only "type" is derivable from transaction_type; the malformed
        // client-side value must NEVER leak in.
        expect(r.session.completed_steps).toEqual(["type"]);
      }
    }
  });

  it("HOTFIX: array containing unknown / non-string / non-canonical step ids is filtered by the StepId allowlist", async () => {
    // Deliberately use a wizard where transaction_type + address are set
    // (so 'type' + 'property' are evidence-derivable) but parties/dates
    // are EMPTY so they cannot be evidence-derived. The persisted list
    // then contains a mix of valid canonical StepIds, unknown strings,
    // non-string junk, and duplicates. The reconciler should return
    // only ['type', 'property'] — both derivable AND explicitly listed.
    const wizard = {
      version: 1,
      transaction_type: "purchase",
      property: { address: "123 test" },
      // Deliberately empty so no evidence derivation for these.
      parties: [],
      dates: {},
      current_step: "property",
      draft_transaction_id: null,
      created_party_ids: [],
      completed_steps: [
        "type",
        // Unknown ids — must be filtered out.
        "made_up_step",
        "review; DROP TABLE",
        "",
        // Non-string entries — must be filtered out.
        42,
        null,
        undefined,
        { obj: 1 },
        ["nested"],
        // Duplicate valid entry — dedupe is applied by the reconciler.
        "type",
        // Valid canonical id — must survive.
        "property",
        // Junk canonical-looking uppercase — must be filtered out.
        "TYPE",
      ] as unknown as string[],
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({ state: { wizard }, completed_steps: [] }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.session) {
      // Only canonical navigable StepIds allowed through. Deduped +
      // canonical journey order.
      expect(r.session.completed_steps).toEqual(["type", "property"]);
    }
  });

  it("HOTFIX: valid persisted completed_steps load intact and union with server + evidence", async () => {
    const wizard = {
      version: 1,
      transaction_type: "purchase",
      property: { address: "123 Main" },
      parties: [{ role: "buyer", name: "Alice" }],
      dates: { contract_date: "2026-07-19" },
      current_step: "review",
      draft_transaction_id: null,
      created_party_ids: [],
      completed_steps: ["type", "property"], // valid, canonical
    };
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        activeRow({
          state: { wizard },
          completed_steps: ["parties"], // server has an additional one
        }),
      ),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const r = await store.load();
    if (r.kind === "ok" && r.session) {
      // Union: client (type,property) + server (parties) +
      // evidence (type,property,parties,dates). "review" NOT included —
      // current_step is `review`, so review is not yet advanced past.
      // Canonical journey order.
      expect(r.session.completed_steps).toEqual([
        "type",
        "property",
        "parties",
        "dates",
      ]);
    }
  });

  it("HOTFIX: reconciliation does not throw when server-side completed_steps is missing / null in the row", async () => {
    // Guard against server-side JSON returning `completed_steps: undefined`
    // or missing the key entirely (should not happen with the current
    // Vault projection but defense-in-depth).
    const wizard = {
      version: 1,
      transaction_type: "purchase",
      property: { address: "1 A" },
      parties: [{ role: "buyer", name: "B" }],
      dates: { contract_date: "2026-07-19" },
      current_step: "create",
      draft_transaction_id: null,
      created_party_ids: [],
    };
    // Simulate a row missing `completed_steps` entirely.
    const rowMissing = activeRow({ state: { wizard } });
    delete (rowMissing.session as unknown as { completed_steps?: unknown })
      .completed_steps;
    const fetchImpl = jest.fn(async () => jsonResponse(rowMissing));
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.session) {
      // Derivation still runs; produces all 5 from the fully-populated
      // state.wizard.
      expect(r.session.completed_steps).toEqual([
        "type",
        "property",
        "parties",
        "dates",
        "review",
      ]);
    }
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

  it("PILOT-D-008: PATCH payload includes top-level completed_steps in ONE request", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ ok: true, session: { id: "s-1" } }),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const session: WizardSession = {
      ...emptySession(),
      transaction_type: "purchase",
      completed_steps: ["type", "property"],
    };
    const r = await store.save(session);
    expect(r.kind).toBe("ok");
    // ONE PATCH — never two — carries both fields atomically.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.completed_steps).toEqual(["type", "property"]);
    expect(body.state.wizard.transaction_type).toBe("purchase");
    // Client MUST NEVER supply completion assertions, user/tenant ids,
    // or evaluator results from the client. The PATCH body may only
    // carry `state` and `completed_steps` (validated by Vault's route
    // MUTABLE_PATCH_KEYS allow-list).
    expect(Object.keys(body).sort()).toEqual(["completed_steps", "state"]);
    expect(body.user_id).toBeUndefined();
    expect(body.tenant_id).toBeUndefined();
    expect(body.evaluator_result).toBeUndefined();
  });

  it("PILOT-D-008: is idempotent — a repeated save with the same session sends the same payload", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ ok: true, session: { id: "s-1" } }),
    );
    const store = createTrainingSessionApiStore({
      sessionId: "s-1",
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessTokenImpl: okToken,
      },
    });
    const session: WizardSession = {
      ...emptySession(),
      transaction_type: "purchase",
      completed_steps: ["type"],
    };
    await store.save(session);
    await store.save(session);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [, initA] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const [, initB] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse((initA as RequestInit).body as string)).toEqual(
      JSON.parse((initB as RequestInit).body as string),
    );
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
