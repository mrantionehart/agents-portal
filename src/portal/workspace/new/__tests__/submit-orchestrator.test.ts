/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.3B.3D — submit orchestrator tests
// ============================================================================
// Exercises the create → parties → redirect flow with an injected fetch. No
// real network, no Vault. Focus: happy path, failures, idempotency/resume,
// duplicate prevention, body mapping.
// ============================================================================

import {
  submitWizard,
  toCreateBody,
  toPartyBody,
  type SubmitCallbacks,
} from "../submit-orchestrator";
import {
  emptySession,
  type WizardSession,
  type WizardPartyDraft,
} from "../wizard-session";

function session(over: Partial<WizardSession> = {}): WizardSession {
  return {
    ...emptySession(),
    transaction_type: "purchase",
    property: { address: "123 Main St" },
    ...over,
  };
}

interface Resp {
  ok: boolean;
  status: number;
  data: any;
}
function res(data: any, status = 200): Resp {
  return { ok: status >= 200 && status < 300, status, data };
}

/** Build a fake fetch driven by per-endpoint handlers; records calls. */
function makeFetch(handlers: {
  create?: (body: any) => Resp;
  party?: (id: string, body: any, partyCallIdx: number) => Resp;
}) {
  const calls: Array<{ url: string; body: any }> = [];
  let partyCalls = 0;
  const fetchImpl = (async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push({ url, body });
    let r: Resp;
    if (url === "/api/transactions/create") {
      r = (handlers.create ?? (() => res({ transaction: { id: "txn-1" } }, 201)))(body);
    } else {
      const m = url.match(/\/api\/transactions\/([^/]+)\/parties$/);
      const id = m ? m[1] : "";
      const idx = partyCalls++;
      r = (handlers.party ?? (() => res({ party: { id: `p${idx}` } }, 201)))(id, body, idx);
    }
    return { ok: r.ok, status: r.status, json: async () => r.data } as any;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function recorder(): SubmitCallbacks & { txn: string[]; parties: string[] } {
  const txn: string[] = [];
  const parties: string[] = [];
  return {
    txn,
    parties,
    onTransactionCreated: (id) => txn.push(id),
    onPartyCreated: (id) => parties.push(id),
  };
}

describe("submitWizard — happy path", () => {
  it("creates the transaction, then each party, then returns the redirect", async () => {
    const { fetchImpl, calls } = makeFetch({
      create: () => res({ transaction: { id: "txn-1" } }, 201),
      party: (_id, _b, i) => res({ party: { id: `p${i}` } }, 201),
    });
    const cb = recorder();
    const r = await submitWizard(
      session({ parties: [{ role: "buyer", name: "Jane" }, { role: "seller", name: "Sam" }] }),
      cb,
      { fetchImpl }
    );
    expect(r.ok).toBe(true);
    expect(r.transactionId).toBe("txn-1");
    expect(r.redirectTo).toBe("/workspace/txn-1?tab=package");
    expect(r.createdParties).toBe(2);
    expect(cb.txn).toEqual(["txn-1"]);
    expect(cb.parties).toEqual(["p0", "p1"]);
    // 1 create + 2 party calls, in order
    expect(calls.map((c) => c.url)).toEqual([
      "/api/transactions/create",
      "/api/transactions/txn-1/parties",
      "/api/transactions/txn-1/parties",
    ]);
  });

  it("works with zero parties", async () => {
    const { fetchImpl, calls } = makeFetch({});
    const r = await submitWizard(session({ parties: [] }), recorder(), { fetchImpl });
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1); // create only
  });
});

describe("submitWizard — failures", () => {
  it("create failure → no party calls, anchor not set", async () => {
    const { fetchImpl, calls } = makeFetch({
      create: () => res({ error: "bad type" }, 400),
    });
    const cb = recorder();
    const r = await submitWizard(session({ parties: [{ role: "buyer", name: "J" }] }), cb, { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.stage).toBe("create");
    expect(r.error).toBe("bad type");
    expect(cb.txn).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("party failure (partial) → records the created prefix, stops", async () => {
    const { fetchImpl } = makeFetch({
      create: () => res({ transaction: { id: "txn-1" } }, 201),
      party: (_id, _b, i) => (i === 0 ? res({ party: { id: "p0" } }, 201) : res({ error: "invalid role" }, 400)),
    });
    const cb = recorder();
    const r = await submitWizard(
      session({ parties: [{ role: "buyer", name: "A" }, { role: "bogus", name: "B" }] }),
      cb,
      { fetchImpl }
    );
    expect(r.ok).toBe(false);
    expect(r.stage).toBe("parties");
    expect(r.transactionId).toBe("txn-1");
    expect(r.createdParties).toBe(1);
    expect(cb.parties).toEqual(["p0"]); // only the successful one
  });

  it("network error surfaces a retry-friendly message", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const r = await submitWizard(session({ parties: [] }), recorder(), { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.stage).toBe("create");
    expect(r.error).toMatch(/network/i);
  });
});

describe("submitWizard — idempotency / resume", () => {
  it("skips create when draft_transaction_id is already set", async () => {
    const { fetchImpl, calls } = makeFetch({});
    const cb = recorder();
    const r = await submitWizard(
      session({ draft_transaction_id: "txn-9", parties: [] }),
      cb,
      { fetchImpl }
    );
    expect(r.ok).toBe(true);
    expect(r.redirectTo).toBe("/workspace/txn-9?tab=package");
    expect(cb.txn).toEqual([]); // not re-created
    expect(calls.some((c) => c.url === "/api/transactions/create")).toBe(false);
  });

  it("resumes parties from created_party_ids.length (no duplicates)", async () => {
    const { fetchImpl, calls } = makeFetch({
      party: (_id, _b, i) => res({ party: { id: `new${i}` } }, 201),
    });
    const cb = recorder();
    const parties: WizardPartyDraft[] = [
      { role: "buyer", name: "A" },
      { role: "co_buyer", name: "B" },
      { role: "seller", name: "C" },
    ];
    const r = await submitWizard(
      session({ draft_transaction_id: "txn-9", parties, created_party_ids: ["a", "b"] }),
      cb,
      { fetchImpl }
    );
    expect(r.ok).toBe(true);
    // only the 3rd party (index 2) is created
    const partyCalls = calls.filter((c) => c.url.endsWith("/parties"));
    expect(partyCalls).toHaveLength(1);
    expect(partyCalls[0].body.name).toBe("C");
    expect(cb.parties).toEqual(["new0"]);
  });

  it("retry after a partial failure never re-creates or duplicates", async () => {
    // First attempt: create ok, party[1] fails.
    let mode: "fail" | "pass" = "fail";
    const { fetchImpl, calls } = makeFetch({
      create: () => res({ transaction: { id: "txn-1" } }, 201),
      party: (_id, _b, i) => {
        if (mode === "fail" && i >= 1) return res({ error: "temporary" }, 500);
        return res({ party: { id: `p${i}` } }, 201);
      },
    });
    // A mutable session that the callbacks update, mirroring the hook.
    const s = session({ parties: [{ role: "buyer", name: "A" }, { role: "seller", name: "B" }] });
    const cb: SubmitCallbacks = {
      onTransactionCreated: (id) => (s.draft_transaction_id = id),
      onPartyCreated: (id) => s.created_party_ids.push(id),
    };

    const r1 = await submitWizard(s, cb, { fetchImpl });
    expect(r1.ok).toBe(false);
    expect(s.draft_transaction_id).toBe("txn-1");
    expect(s.created_party_ids).toEqual(["p0"]);

    // Second attempt succeeds; must skip create + skip party 0.
    mode = "pass";
    const r2 = await submitWizard(s, cb, { fetchImpl });
    expect(r2.ok).toBe(true);
    const createCalls = calls.filter((c) => c.url === "/api/transactions/create");
    expect(createCalls).toHaveLength(1); // never re-created
    // party 0 kept, party 1 created on retry — 2 total, no duplication
    expect(s.created_party_ids).toHaveLength(2);
    expect(s.created_party_ids[0]).toBe("p0");
    // only party "B" (index 1) was (re)attempted in the second run
    const secondRunPartyCalls = calls
      .filter((c) => c.url.endsWith("/parties"))
      .map((c) => c.body.name);
    expect(secondRunPartyCalls).toEqual(["A", "B", "B"]); // A ok, B failed, B retried
  });
});

describe("body mapping", () => {
  it("toCreateBody sends the canonical type + non-lease dates + primary client", () => {
    const b = toCreateBody(
      session({
        transaction_type: "purchase",
        dates: { contract_date: "2026-07-10", closing_date: "2026-08-10" },
        parties: [{ role: "buyer", name: "Jane Buyer", email: "j@x.com" }],
      })
    );
    expect(b.type).toBe("purchase");
    expect(b.contract_date).toBe("2026-07-10");
    expect(b.closing_date).toBe("2026-08-10");
    expect(b.client_name).toBe("Jane Buyer");
    expect(b.client_email).toBe("j@x.com");
  });

  it("toCreateBody maps lease start/end into contract/closing columns", () => {
    const b = toCreateBody(
      session({
        transaction_type: "lease",
        dates: { lease_start: "2026-09-01", lease_end: "2027-09-01" },
      })
    );
    expect(b.contract_date).toBe("2026-09-01");
    expect(b.closing_date).toBe("2027-09-01");
  });

  it("toPartyBody omits empties and defaults signature_required true", () => {
    expect(toPartyBody({ role: "buyer", name: "Jane" })).toEqual({
      role: "buyer",
      name: "Jane",
      signature_required: true,
    });
    expect(toPartyBody({ role: "escrow", company: "First American", signature_required: false })).toEqual({
      role: "escrow",
      company: "First American",
      signature_required: false,
    });
  });
});
