/**
 * @jest-environment node
 */
// ============================================================================
// HARTFELT-P8.1A · linking the lead a transaction came from
// ============================================================================
// Vault's own POST /api/transactions decides this with
// `evaluateLinkAuthorization`: a manager role may link any lead in the tenant,
// and anyone else only a lead assigned to them. This route writes the row
// itself, so the same rule has to hold here — and these tests are what keep the
// two from drifting.
//
// 🔒 THE TENANT HALF IS NOT RE-IMPLEMENTED AND IS NOT TESTED HERE. `admin` is
// the caller's JWT under RLS, so `cp_agent_select_tenant` refuses a foreign
// tenant's profile before this code runs, and
// `trg_transactions_client_profile_tenant` refuses the INSERT besides. What is
// tested is OWNERSHIP, because RLS does NOT settle that on its own: the same
// policy grants every agent the tenant's `visibility='dispo_feed'` rows, so
// "readable" is wider than "mine".
// ============================================================================

type Call = { table: string; op: string; args: unknown[] };
let calls: Call[] = [];
let LEAD_ROW: unknown = null;
let PROFILE_ROW: unknown = { role: "agent", tenant_id: "t-1" };

function fakeClient() {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const rec = (op: string) => (...args: unknown[]) => {
        calls.push({ table, op, args });
        return chain;
      };
      chain.select = rec("select");
      chain.eq = rec("eq");
      chain.insert = (payload: unknown) => {
        calls.push({ table, op: "insert", args: [payload] });
        return chain;
      };
      chain.single = jest.fn(async () => {
        if (table === "profiles") return { data: PROFILE_ROW, error: null };
        if (table === "transactions") {
          return { data: { id: "tx-1", agent_id: "u-caller" }, error: null };
        }
        return { data: null, error: null };
      });
      chain.maybeSingle = jest.fn(async () => {
        if (table === "client_profiles") return { data: LEAD_ROW, error: null };
        return { data: null, error: null };
      });
      return chain;
    },
  };
}

const AUTHED_USER = { id: "u-caller" };

jest.mock("@/lib/security", () => ({ userClient: () => fakeClient() }));
jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
  }),
}));
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
  }),
}));
jest.mock("@/lib/vault-forward", () => ({
  ensureVaultForms: async () => ({ ok: true, status: 200, body: {} }),
}));
jest.mock("@/lib/portal-transaction-type", () => ({
  mapPortalTransactionTypeToVaultType: () => ({ supported: true, vaultType: "buyer" }),
  toEnumTransactionType: (t: string) => t,
}));

jest.mock("@/lib/vault-client", () => ({ VAULT_API_URL: "https://vault.test/api" }));

import { POST } from "@/app/api/transactions/create/route";

/** P8.1A-S — Vault's verdict on whether the lead may be linked at all. */
let VAULT: { status: number; body: unknown } | "throw" = {
  status: 200,
  body: { linkable: true },
};
const vaultCalls: string[] = [];

const LEAD = "11111111-1111-4111-8111-111111111111";

const post = (extra: Record<string, unknown> = {}) =>
  POST(
    new Request("http://localhost/api/transactions/create", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
      body: JSON.stringify({
        type: "buyer",
        business_line: "brokerage",
        property_address: "12 Elm St",
        ...extra,
      }),
    }) as never,
  );

const insert = () => calls.find((c) => c.table === "transactions" && c.op === "insert");
const leadRead = () => calls.find((c) => c.table === "client_profiles");

beforeEach(() => {
  calls = [];
  vaultCalls.length = 0;
  VAULT = { status: 200, body: { linkable: true } };
  global.fetch = jest.fn(async (url: string) => {
    vaultCalls.push(String(url));
    if (VAULT === "throw") throw new Error("ECONNREFUSED");
    return {
      ok: VAULT.status >= 200 && VAULT.status < 300,
      status: VAULT.status,
      json: async () => VAULT === "throw" ? null : (VAULT as { body: unknown }).body,
    };
  }) as unknown as typeof fetch;
  LEAD_ROW = null;
  PROFILE_ROW = { role: "agent", tenant_id: "t-1" };
});

describe("[P81A-L] who may attach a lead", () => {
  it("[P81A-L1] no lead id → the row is created UNLINKED, not refused", async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect((insert()!.args[0] as Record<string, unknown>).client_profile_id).toBeNull();
    // It did not go looking for a lead it was never given.
    expect(leadRead()).toBeUndefined();
  });

  it("[P81A-L2] 🔒 a MALFORMED id is refused, not silently dropped", async () => {
    const res = await post({ client_profile_id: "not-a-uuid" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CLIENT_PROFILE_ID");
    // 🔑 The row must NOT exist. Creating it unlinked would leave the agent
    // looking at a dialog that said the client was attached.
    expect(insert()).toBeUndefined();
  });

  it("[P81A-L3] 🔒 a lead the caller cannot read is a 404, and nothing is written", async () => {
    LEAD_ROW = null; // RLS refused it, or it does not exist — reported alike
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("CLIENT_PROFILE_NOT_FOUND");
    expect(insert()).toBeUndefined();
  });

  it("[P81A-L4] 🛑 another agent's lead is a 403, and nothing is written", async () => {
    LEAD_ROW = { assigned_agent_id: "someone-else", claimed_by: null };
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CLIENT_PROFILE_NOT_ASSIGNED");
    expect(insert()).toBeUndefined();
  });

  it("[P81A-L5] 🔑 a lead ASSIGNED to the caller is linked (the positive control)", async () => {
    LEAD_ROW = { assigned_agent_id: "u-caller", claimed_by: null };
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(201);
    expect((insert()!.args[0] as Record<string, unknown>).client_profile_id).toBe(LEAD);
  });

  it("[P81A-L6] a lead CLAIMED by the caller is linked", async () => {
    LEAD_ROW = { assigned_agent_id: null, claimed_by: "u-caller" };
    expect((await post({ client_profile_id: LEAD })).status).toBe(201);
    expect((insert()!.args[0] as Record<string, unknown>).client_profile_id).toBe(LEAD);
  });

  it("[P81A-L7] a manager role may link a lead assigned to someone else", async () => {
    PROFILE_ROW = { role: "office_manager", tenant_id: "t-1" };
    LEAD_ROW = { assigned_agent_id: "someone-else", claimed_by: null };
    expect((await post({ client_profile_id: LEAD })).status).toBe(201);
    expect((insert()!.args[0] as Record<string, unknown>).client_profile_id).toBe(LEAD);
  });

  it("[P81A-L8] 🔒 the created row is always a DRAFT", async () => {
    LEAD_ROW = { assigned_agent_id: "u-caller", claimed_by: null };
    await post({ client_profile_id: LEAD, status: "approved" });
    // A client-supplied status must not reach the insert — that is the
    // create-as-approved hole, and this route has never taken one.
    expect((insert()!.args[0] as Record<string, unknown>).status).toBe("draft");
  });
});

// ============================================================================
// HARTFELT-P8.1A-S · the linked client must be a BROKERAGE LEAD
// ============================================================================
// Ownership was the whole check and it was not enough. Measured on production:
// of 24 profiles linkable by ownership in the live tenant, 22 were NOT eligible
// leads — 16 review-band and 6 excluded, the DO-NOT-CONTACT canaries among
// them.
//
// 🔑 THE PORTAL MUST NOT ANSWER THIS ITSELF. Classification needs
// `dispo_buyer_profiles` (RLS on, ZERO policies) and `seller_property_bundles`
// (broker/admin), neither readable by an agent JWT. These tests pin that it
// ASKS, what it asks, and that anything short of an explicit `linkable: true`
// refuses.
// ============================================================================

describe("[P81AS-AP] the Portal asks Vault whether the lead is a lead", () => {
  beforeEach(() => {
    LEAD_ROW = { assigned_agent_id: "u-caller", claimed_by: null };
  });

  it("[P81AS-AP1] 🔑 it asks, with the lead id and the caller's bearer", async () => {
    await post({ client_profile_id: LEAD });
    expect(vaultCalls).toHaveLength(1);
    const url = new URL(vaultCalls[0]);
    expect(url.pathname).toBe("/api/client-intelligence");
    expect(url.searchParams.get("lead_linkable")).toBe(LEAD);
    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer t");
  });

  it("[P81AS-AP2] 🔑 an eligible lead is linked (the positive control)", async () => {
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(201);
    expect((insert()!.args[0] as Record<string, unknown>).client_profile_id).toBe(LEAD);
  });

  it("[P81AS-AP3] 🛑 a NOT-A-LEAD verdict refuses, and NOTHING is written", async () => {
    VAULT = {
      status: 422,
      body: {
        linkable: false,
        error: "That contact is not a brokerage lead and cannot be linked to a transaction.",
        code: "CLIENT_PROFILE_NOT_A_LEAD",
      },
    };
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("CLIENT_PROFILE_NOT_A_LEAD");
    expect(insert()).toBeUndefined();
  });

  it("[P81AS-AP4] 🔒 an UNREACHABLE Vault refuses — a network problem is not permission", async () => {
    VAULT = "throw";
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("CLIENT_PROFILE_CHECK_UNAVAILABLE");
    expect(insert()).toBeUndefined();
  });

  it("[P81AS-AP5] 🔒 an UNREADABLE answer refuses", async () => {
    VAULT = { status: 200, body: null };
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("CLIENT_PROFILE_CHECK_UNAVAILABLE");
    expect(insert()).toBeUndefined();
  });

  it("[P81AS-AP6] 🔒 a 200 that does not say linkable:true refuses", async () => {
    // The dangerous shape: a success status with a body that never granted
    // anything. Only an explicit `true` is permission.
    VAULT = { status: 200, body: { eligible: true } };
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(502);
    expect(insert()).toBeUndefined();
  });

  it("[P81AS-AP7] 🔒 Vault's 404 passes through — the error channel stays identical", async () => {
    VAULT = {
      status: 404,
      body: { linkable: false, error: "Client profile not found", code: "CLIENT_PROFILE_NOT_FOUND" },
    };
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("CLIENT_PROFILE_NOT_FOUND");
    expect(insert()).toBeUndefined();
  });

  it("[P81AS-AP8] 🔑 no lead id → Vault is NEVER asked, and the row is created unlinked", async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect(vaultCalls).toHaveLength(0);
    expect((insert()!.args[0] as Record<string, unknown>).client_profile_id).toBeNull();
  });

  it("[P81AS-AP9] 🔒 the local ownership check still runs FIRST — Vault is not asked at all", async () => {
    LEAD_ROW = { assigned_agent_id: "someone-else", claimed_by: null };
    const res = await post({ client_profile_id: LEAD });
    expect(res.status).toBe(403);
    // An obviously-wrong request never leaves this origin.
    expect(vaultCalls).toHaveLength(0);
    expect(insert()).toBeUndefined();
  });
});
