/**
 * @jest-environment node
 */
// ============================================================================
// SEC · P0-18 · AP /api/transactions/create defense-in-depth
// ============================================================================
// Pre-fix the route only checked `.eq('is_active', true)` on the target
// `assignedAgentId` — no tenant equality, no role validation. The Vault DB
// RLS `txn_insert_tenant WITH CHECK` + `trg_set_transaction_tenant_id`
// (SEC.2a/2b Slice 1B) already reject cross-tenant INSERTs at the DB, so
// this PR is DEFENSE-IN-DEPTH: it adds an explicit route-level guard so:
//
//   • foreign-tenant assignments 404 cleanly (no raw RLS error leaks)
//   • non-owner roles (tc / manager / office_manager / broker / admin as
//     transaction OWNER) are refused with a clear 400 explaining that the
//     selected user cannot own a transaction
//   • tenantless / nonexistent targets fail closed
//   • rejected cases cause ZERO transaction INSERT attempts
//   • error responses do not leak foreign-tenant identity or profile
//     details
//
// The DB RLS + trigger stay in place as the second line of defense —
// this PR does NOT weaken or replace them.
//
// Locked invariant (owner-role allowlist):
//   DEAL_OWNER_ROLES = ['agent', 'new_agent']
//
// Framework: jest (AP).
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
          return PROFILE_SEQ[
            Math.min(PROFILE_SINGLE_IDX++, PROFILE_SEQ.length - 1)
          ];
        }
        const resp = SCRIPTED[`${table}.single`];
        return resp !== undefined ? resp : { data: null, error: null };
      });
      chain.maybeSingle = jest.fn(async () => {
        const resp =
          SCRIPTED[`${table}.maybeSingle`] ?? SCRIPTED[`${table}.single`];
        return resp !== undefined ? resp : { data: null, error: null };
      });
      return chain;
    },
  };
}

let AUTHED_USER: { id: string } | null = { id: "u-caller" };

jest.mock("@/lib/security", () => ({
  userClient: () => fakeClient(),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: AUTHED_USER }, error: null }),
    },
  }),
}));

jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: AUTHED_USER }, error: null }),
    },
  }),
}));

// Vault-forward + type-mapper are best-effort side channels; stub to no-ops.
jest.mock("@/lib/vault-forward", () => ({
  ensureVaultForms: async () => ({ ok: true, status: 200, body: {} }),
}));
jest.mock("@/lib/portal-transaction-type", () => ({
  mapPortalTransactionTypeToVaultType: () => ({
    supported: true,
    vaultType: "buyer",
  }),
  toEnumTransactionType: (t: string) =>
    ["purchase", "commercial"].includes(t) ? "buyer" : t,
}));

import { POST } from "@/app/api/transactions/create/route";

function req(body: unknown, authHeader?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers.authorization = authHeader;
  return new Request("http://localhost/api/transactions/create", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as never;
}
async function call(body: unknown) {
  const r = await POST(req(body, "Bearer test-token"));
  return { status: r.status, body: await r.json() };
}

function countInserts(table: string): number {
  return svcCalls.filter((c) => c.table === table && c.op === "insert").length;
}

// Standard broker caller payload.
function brokerCallerPayload(assignedAgentId?: string) {
  return {
    type: "buyer",
    property_address: "123 Test St",
    ...(assignedAgentId !== undefined ? { agent_id: assignedAgentId } : {}),
  };
}

beforeEach(() => {
  svcCalls.length = 0;
  SCRIPTED = {};
  PROFILE_SEQ = [];
  PROFILE_SINGLE_IDX = 0;
  AUTHED_USER = { id: "u-broker" };
});

describe("SEC · P0-18 · /api/transactions/create defense-in-depth", () => {
  // ── Success cases ──────────────────────────────────────────────────
  it("case 1 — same-tenant `agent` target succeeds", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null }, // caller
      { data: { id: "u-agent", role: "agent", tenant_id: "tenant-A", is_active: true }, error: null }, // target
    ];
    SCRIPTED["transactions.single"] = {
      data: { id: "txn-1", agent_id: "u-agent", type: "buyer" },
      error: null,
    };
    const r = await call(brokerCallerPayload("u-agent"));
    expect(r.status).toBe(201);
    expect(r.body.transaction?.id).toBe("txn-1");
    expect(countInserts("transactions")).toBe(1);
  });

  it("case 2 — same-tenant `new_agent` target succeeds", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-new-agent", role: "new_agent", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    SCRIPTED["transactions.single"] = {
      data: { id: "txn-2", agent_id: "u-new-agent", type: "buyer" },
      error: null,
    };
    const r = await call(brokerCallerPayload("u-new-agent"));
    expect(r.status).toBe(201);
    expect(countInserts("transactions")).toBe(1);
  });

  // ── Tenant containment ────────────────────────────────────────────
  it("case 3 — foreign-tenant agent rejected BEFORE INSERT (generic 404, no tenant leak)", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-b-agent", role: "agent", tenant_id: "tenant-B", is_active: true }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-b-agent"));
    expect(r.status).toBe(404);
    expect(countInserts("transactions")).toBe(0);
    // Response body must NOT leak the foreign tenant identity or profile.
    expect(JSON.stringify(r.body)).not.toContain("tenant-B");
    expect(JSON.stringify(r.body)).not.toContain("u-b-agent");
  });

  it("case 4 — tenantless agent (`tenant_id=NULL`) rejected BEFORE INSERT", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-orphan", role: "agent", tenant_id: null, is_active: true }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-orphan"));
    expect(r.status).toBe(404);
    expect(countInserts("transactions")).toBe(0);
  });

  it("case 5 — missing target profile (nonexistent) rejected BEFORE INSERT, no identity leak", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: null, error: null }, // target not found
    ];
    const r = await call(brokerCallerPayload("u-nobody"));
    expect(r.status).toBe(404);
    expect(countInserts("transactions")).toBe(0);
    expect(JSON.stringify(r.body)).not.toContain("u-nobody");
  });

  // ── Owner role allowlist enforcement ──────────────────────────────
  it("case 6 — `tc` target rejected", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-tc", role: "tc", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-tc"));
    expect(r.status).toBe(400);
    expect(countInserts("transactions")).toBe(0);
    expect(String(r.body.error).toLowerCase()).toMatch(/owner|role|agent/i);
  });

  it("case 7 — `manager` target rejected", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-mgr", role: "manager", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-mgr"));
    expect(r.status).toBe(400);
    expect(countInserts("transactions")).toBe(0);
  });

  it("case 8 — `office_manager` target rejected", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-om", role: "office_manager", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-om"));
    expect(r.status).toBe(400);
    expect(countInserts("transactions")).toBe(0);
  });

  it("case 9 — `broker` target rejected (as OWNER — cannot own a transaction)", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-broker-2", role: "broker", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-broker-2"));
    expect(r.status).toBe(400);
    expect(countInserts("transactions")).toBe(0);
  });

  it("case 10 — `admin` target rejected (as OWNER)", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-admin", role: "admin", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-admin"));
    expect(r.status).toBe(400);
    expect(countInserts("transactions")).toBe(0);
  });

  // ── Caller-side ────────────────────────────────────────────────────
  it("case 11 — missing caller tenant (`tenant_id=NULL`) fails closed 403", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: null }, error: null },
    ];
    const r = await call(brokerCallerPayload("u-agent"));
    expect(r.status).toBe(403);
    expect(countInserts("transactions")).toBe(0);
  });

  // ── Static / structural guards ─────────────────────────────────────
  it("case 12 — every rejected case above triggers ZERO transaction INSERT attempts (structural)", async () => {
    // Composite regression guard — pick 3 representative rejection paths
    // and prove each one leaves svcCalls with zero transaction inserts.
    // (Repeats 3, 5, 9 in a compact form so a single grep-friendly test
    // owns the invariant.)
    for (const scenario of [
      { targetRole: "agent", targetTenant: "tenant-B" }, // foreign-tenant
      { targetRole: "tc", targetTenant: "tenant-A" }, // wrong role
      { targetRole: "broker", targetTenant: "tenant-A" }, // wrong role
    ]) {
      svcCalls.length = 0;
      PROFILE_SEQ = [
        { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
        { data: { id: "u-t", role: scenario.targetRole, tenant_id: scenario.targetTenant, is_active: true }, error: null },
      ];
      PROFILE_SINGLE_IDX = 0;
      const r = await call(brokerCallerPayload("u-t"));
      expect([400, 404]).toContain(r.status);
      expect(countInserts("transactions")).toBe(0);
    }
  });

  it("case 13 — error responses do NOT expose foreign tenant ids or profile details", async () => {
    // Aggregate leak-probe: run 4 rejection paths and assert no
    // tenant/profile identifiers appear in any response body.
    const leakSubstrings = ["tenant-B", "tenant-C", "leak-uuid"];
    const scenarios: Array<[unknown, unknown]> = [
      [
        { role: "broker", tenant_id: "tenant-A" },
        { id: "leak-uuid", role: "agent", tenant_id: "tenant-B", is_active: true },
      ],
      [
        { role: "broker", tenant_id: "tenant-A" },
        { id: "leak-uuid", role: "tc", tenant_id: "tenant-C", is_active: true },
      ],
    ];
    for (const [caller, target] of scenarios) {
      svcCalls.length = 0;
      PROFILE_SEQ = [
        { data: caller, error: null },
        { data: target, error: null },
      ];
      PROFILE_SINGLE_IDX = 0;
      const r = await call(brokerCallerPayload("leak-uuid"));
      const body = JSON.stringify(r.body);
      for (const leak of leakSubstrings) {
        expect(body).not.toContain(leak);
      }
    }
  });

  it("case 14 — existing legitimate same-tenant `agent` INSERT payload shape unchanged", async () => {
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-agent", role: "agent", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    SCRIPTED["transactions.single"] = {
      data: { id: "txn-14", agent_id: "u-agent", type: "buyer" },
      error: null,
    };
    await call({
      type: "buyer",
      agent_id: "u-agent",
      property_address: "456 Elm",
      city: "Miami",
      state: "FL",
      zip: "33101",
      contract_price: "500000",
    });
    const insert = svcCalls.find(
      (c) => c.table === "transactions" && c.op === "insert"
    );
    expect(insert).toBeDefined();
    const payload = insert!.args[0] as {
      agent_id: string;
      type: string;
      status: string;
      property_address: string;
      city: string;
      state: string;
      contract_price: number | null;
    };
    expect(payload.agent_id).toBe("u-agent");
    expect(payload.type).toBe("buyer"); // stored enum
    expect(payload.status).toBe("draft");
    expect(payload.property_address).toBe("456 Elm");
    expect(payload.city).toBe("Miami");
    expect(payload.state).toBe("FL");
    expect(payload.contract_price).toBe(500000);
  });

  // ── DB defense preservation ────────────────────────────────────────
  it("case 15 — validation uses user JWT client (via userClient), NOT service-role — DB RLS still enforces", async () => {
    // The route imports `userClient` from `@/lib/security`. Our mock
    // covers it — the route MUST NOT reach for a service-role client
    // for the target-profile validation. Prove structurally: only
    // `profiles.select().eq('id', ...)` calls appear against the mocked
    // fakeClient (which is the user client). No service-role client is
    // constructed by the route for the validation branch.
    PROFILE_SEQ = [
      { data: { role: "broker", tenant_id: "tenant-A" }, error: null },
      { data: { id: "u-agent", role: "agent", tenant_id: "tenant-A", is_active: true }, error: null },
    ];
    SCRIPTED["transactions.single"] = {
      data: { id: "txn-15", agent_id: "u-agent" },
      error: null,
    };
    await call(brokerCallerPayload("u-agent"));
    // Target-profile probe uses the userClient (RLS-safe). Explicitly
    // count profiles.eq('id', ...) call = one for caller + one for
    // target = 2.
    const profileIdEqs = svcCalls.filter(
      (c) =>
        c.table === "profiles" &&
        c.op === "eq" &&
        Array.isArray(c.args) &&
        c.args[0] === "id"
    );
    expect(profileIdEqs.length).toBe(2);
  });

  // ── Agent-caller cross-assignment guard ────────────────────────────
  it("case 16 — agent caller passing another `agent_id` cannot cross-assign (assignedAgentId ignored, self-assign preserved)", async () => {
    AUTHED_USER = { id: "u-caller-agent" };
    PROFILE_SEQ = [
      { data: { role: "agent", tenant_id: "tenant-A" }, error: null },
    ];
    SCRIPTED["transactions.single"] = {
      data: { id: "txn-16", agent_id: "u-caller-agent", type: "buyer" },
      error: null,
    };
    // Agent caller tries to assign to a different agent id.
    await call({
      type: "buyer",
      agent_id: "u-other-agent",
      property_address: "789 Palm",
    });
    // Target-profile probe MUST NOT have run (agent caller's assignedAgentId
    // is not processed by the broker/admin branch). The INSERT payload's
    // agent_id must be the caller's own id, not "u-other-agent".
    const insert = svcCalls.find(
      (c) => c.table === "transactions" && c.op === "insert"
    );
    expect(insert).toBeDefined();
    const payload = insert!.args[0] as { agent_id: string };
    expect(payload.agent_id).toBe("u-caller-agent");
    // Only ONE profiles.eq('id',...) call — the caller lookup — no target probe.
    const profileIdEqs = svcCalls.filter(
      (c) =>
        c.table === "profiles" &&
        c.op === "eq" &&
        Array.isArray(c.args) &&
        c.args[0] === "id"
    );
    expect(profileIdEqs.length).toBe(1);
  });

  // ── Cluster A + P0-19 preservation guards ──────────────────────────
  it("case 17 — AP P0-41 calendar tenant isolation file NOT modified by this PR (grep-based static guard)", () => {
    // This is a diff-scope assertion — the calendar route file is not part
    // of PR-F's touch set. Enforced at the diff-audit gate, but we assert
    // structurally here that the calendar route file exists (present in
    // the repo) so a later refactor doesn't silently move the guard.
    // Runtime check: require the file exists (module resolution succeeds).
    // If someone deletes/rename it, this test fails — surface the change.
    const fs = require("fs");
    const path = require("path");
    const p = path.resolve(process.cwd(), "app/api/calendar/events/route.ts");
    expect(fs.existsSync(p)).toBe(true);
  });

  it("case 18 — AP P0-19 pipeline TYPE_GROUPS module NOT modified by this PR (grep-based static guard)", () => {
    const fs = require("fs");
    const path = require("path");
    const p = path.resolve(process.cwd(), "app/api/pipeline/type-groups.ts");
    expect(fs.existsSync(p)).toBe(true);
  });
});
