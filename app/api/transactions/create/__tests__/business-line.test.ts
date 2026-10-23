/**
 * @jest-environment node
 */
// ============================================================================
// P4H-14 — /api/transactions/create business-line classification + isolation
// ============================================================================
// Proves (framework: jest, AP):
//   • business_line is REQUIRED (missing / invalid → 400, zero inserts)
//   • acquisition → transaction stored agentless (agent_id null) with
//     prepared_by = creator and business_line 'acquisition', and NO commission
//     row is ever inserted (no split / cap / payout can follow)
//   • brokerage (priced) → exactly one commission row, agent credited
//   • office_manager may create an acquisition as preparer (agentless)
// ============================================================================

type Call = { table: string; op: string; args: unknown[] };
const svcCalls: Call[] = [];
let SCRIPTED: Record<string, unknown> = {};
let PROFILE_SEQ: Array<{ data: unknown; error: unknown }> = [];
let PROFILE_SINGLE_IDX = 0;

function fakeClient() {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const rec = (op: string) => (...args: unknown[]) => {
        svcCalls.push({ table, op, args });
        return chain;
      };
      chain.select = rec("select");
      chain.eq = rec("eq");
      chain.insert = (payload: unknown) => {
        svcCalls.push({ table, op: "insert", args: [payload] });
        return chain;
      };
      chain.single = jest.fn(async () => {
        if (table === "profiles" && PROFILE_SEQ.length > 0) {
          return PROFILE_SEQ[Math.min(PROFILE_SINGLE_IDX++, PROFILE_SEQ.length - 1)];
        }
        const resp = SCRIPTED[`${table}.single`];
        return resp !== undefined ? resp : { data: null, error: null };
      });
      chain.maybeSingle = chain.single;
      return chain;
    },
  };
}

let AUTHED_USER: { id: string } | null = { id: "u-caller" };

jest.mock("@/lib/security", () => ({ userClient: () => fakeClient() }));
jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) } }),
}));
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) } }),
}));
jest.mock("@/lib/vault-forward", () => ({ ensureVaultForms: async () => ({ ok: true, status: 200, body: {} }) }));
jest.mock("@/lib/portal-transaction-type", () => ({
  mapPortalTransactionTypeToVaultType: () => ({ supported: true, vaultType: "buyer" }),
  toEnumTransactionType: (t: string) => (["purchase", "commercial"].includes(t) ? "buyer" : t),
}));

import { POST } from "@/app/api/transactions/create/route";

function call(body: unknown) {
  const r = new Request("http://localhost/api/transactions/create", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: JSON.stringify(body),
  }) as never;
  return POST(r).then(async (res) => ({ status: res.status, body: await res.json() }));
}
const inserts = (table: string) => svcCalls.filter((c) => c.table === table && c.op === "insert");
const txnInsert = () => inserts("transactions")[0]?.args[0] as Record<string, unknown> | undefined;

beforeEach(() => {
  svcCalls.length = 0;
  SCRIPTED = {};
  PROFILE_SEQ = [];
  PROFILE_SINGLE_IDX = 0;
  AUTHED_USER = { id: "u-agent" };
});

describe("P4H-14 — business-line classification on create", () => {
  it("missing business_line → 400, no inserts", async () => {
    PROFILE_SEQ = [{ data: { role: "agent", tenant_id: "tenant-A" }, error: null }];
    const r = await call({ type: "buyer", property_address: "1 A St", contract_price: "500000" });
    expect(r.status).toBe(400);
    expect(String(r.body.error).toLowerCase()).toContain("business_line");
    expect(inserts("transactions")).toHaveLength(0);
    expect(inserts("commissions")).toHaveLength(0);
  });

  it("invalid business_line → 400", async () => {
    PROFILE_SEQ = [{ data: { role: "agent", tenant_id: "tenant-A" }, error: null }];
    const r = await call({ type: "buyer", business_line: "holdings", property_address: "1 A St" });
    expect(r.status).toBe(400);
    expect(inserts("transactions")).toHaveLength(0);
  });

  it("acquisition (priced) → agentless + preparer, NO commission row", async () => {
    PROFILE_SEQ = [{ data: { role: "agent", tenant_id: "tenant-A" }, error: null }];
    SCRIPTED["transactions.single"] = { data: { id: "txn-acq", business_line: "acquisition" }, error: null };
    const r = await call({
      type: "wholesale",
      business_line: "acquisition",
      property_address: "2 Holdings Way",
      contract_price: "300000",
    });
    expect(r.status).toBe(201);
    const t = txnInsert();
    expect(t?.business_line).toBe("acquisition");
    expect(t?.agent_id).toBeNull();
    expect(t?.prepared_by).toBe("u-agent");
    // The whole point: acquisitions spawn NO commission (no split/cap/payout).
    expect(inserts("commissions")).toHaveLength(0);
  });

  it("brokerage (priced) → one commission row, agent credited", async () => {
    PROFILE_SEQ = [{ data: { role: "agent", tenant_id: "tenant-A" }, error: null }];
    SCRIPTED["transactions.single"] = { data: { id: "txn-brk", business_line: "brokerage" }, error: null };
    const r = await call({
      type: "buyer",
      business_line: "brokerage",
      property_address: "3 Market St",
      contract_price: "500000",
    });
    expect(r.status).toBe(201);
    const t = txnInsert();
    expect(t?.business_line).toBe("brokerage");
    expect(t?.agent_id).toBe("u-agent");
    expect(t?.prepared_by).toBeNull();
    expect(inserts("commissions")).toHaveLength(1);
  });

  it("office_manager may create an acquisition as preparer (agentless, no commission)", async () => {
    AUTHED_USER = { id: "u-om" };
    PROFILE_SEQ = [{ data: { role: "office_manager", tenant_id: "tenant-A" }, error: null }];
    SCRIPTED["transactions.single"] = { data: { id: "txn-om-acq", business_line: "acquisition" }, error: null };
    const r = await call({
      type: "double_close",
      business_line: "acquisition",
      property_address: "4 Principal Ave",
      contract_price: "250000",
    });
    expect(r.status).toBe(201);
    const t = txnInsert();
    expect(t?.agent_id).toBeNull();
    expect(t?.prepared_by).toBe("u-om");
    expect(inserts("commissions")).toHaveLength(0);
  });
});
