/**
 * @jest-environment node
 */
// ============================================================================
// P4H-15 — /api/pipeline tenant scope on the broker-view agent roster
// ============================================================================
// Before: the broker/admin branch read `profiles` with only `.eq('is_active',
// true)` — no tenant filter. The route uses `userClient(request)` so RLS
// normally caps the SELECT to the caller's own tenant, but a route that
// counts on RLS as its ONLY defence has to deserve it. In production, an RLS
// mis-step on `profiles` would have shown every brokerage's active agents
// to any broker-tier caller — which is the shape of the defect P4H was
// opened against. These tests pin the tenant predicate into the SELECT so
// an RLS regression cannot alone widen the scope again.
// ============================================================================

// FINSEC P0-4: the route now authenticates through the shared requireAuth
// gate (session + is_active). This suite is about the roster predicate, so the
// gate is reduced to authenticated / not; the gate itself is exercised for real
// in __tests__/api/finsec-p0-4-commission-endpoints.test.ts.
let AUTHED = true;
jest.mock("@/lib/security", () => {
  const { NextResponse } = jest.requireActual("next/server");
  return {
    userClient: jest.fn(),
    requireAuth: jest.fn(async () =>
      AUTHED
        ? { user: { id: "broker-1" } }
        : { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    ),
  };
});

import { NextRequest } from "next/server";
import { GET } from "@/app/api/pipeline/route";
import { userClient } from "@/lib/security";

const uc = userClient as jest.Mock;

type EqCall = { field: string; value: string };

interface TableCalls {
  table: string;
  eqs: EqCall[];
  // profiles.select('role, tenant_id').eq('id', uid).single()
  // or    .select('id, full_name, email').eq('tenant_id', T).eq('is_active', true).order('full_name')
}

/**
 * A tiny fake supabase-js chain that records every table, every eq() filter,
 * every select() column list, and resolves to the fixture rows the test seeded.
 * It is intentionally dumb — the tests assert that the correct predicates
 * were ADDED, not that the DB answered.
 */
function makeClient(opts: {
  profileRow: { role: string; tenant_id: string | null } | null;
}) {
  const log: TableCalls[] = [];
  let current: TableCalls | null = null;

  const chain: any = {
    select(_cols: string) {
      return chain;
    },
    eq(field: string, value: string) {
      if (current) current.eqs.push({ field, value });
      return chain;
    },
    is() {
      return chain;
    },
    not() {
      return chain;
    },
    in() {
      return chain;
    },
    order() {
      return chain;
    },
    single() {
      if (current?.table === "profiles") {
        return Promise.resolve({ data: opts.profileRow, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve: any) {
      // Terminal — treat as "list" call. Returns empty transactions / agents.
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };

  return {
    log,
    client: {
      from(table: string) {
        current = { table, eqs: [] };
        log.push(current);
        return chain;
      },
    },
  };
}

function req(): NextRequest {
  return {
    url: "https://ap.example.com/api/pipeline",
    headers: { get: () => "Bearer stub-token" },
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

beforeEach(() => {
  uc.mockReset();
});

describe("P4H-15 — broker-view agent roster is tenant-scoped", () => {
  it("[P4H-15.1] a broker gets `profiles` filtered by HER OWN tenant", async () => {
    const fx = makeClient({
      profileRow: { role: "broker", tenant_id: "tenant-HF" },
    });
    uc.mockReturnValue(fx.client);

    const res = await GET(req());
    expect(res.status).toBe(200);

    const profilesCalls = fx.log.filter((c) => c.table === "profiles");
    // At least two: (1) read own role+tenant, (2) list active agents in-tenant
    expect(profilesCalls.length).toBeGreaterThanOrEqual(2);
    const rosterCall = profilesCalls.at(-1)!;
    const fieldSet = new Set(rosterCall.eqs.map((e) => e.field));
    expect(fieldSet.has("tenant_id")).toBe(true);
    expect(fieldSet.has("is_active")).toBe(true);

    const tenantEq = rosterCall.eqs.find((e) => e.field === "tenant_id")!;
    expect(tenantEq.value).toBe("tenant-HF");
  });

  it("[P4H-15.2] an admin gets the same tenant predicate", async () => {
    const fx = makeClient({
      profileRow: { role: "admin", tenant_id: "tenant-HF" },
    });
    uc.mockReturnValue(fx.client);

    await GET(req());
    const rosterCall = fx.log.filter((c) => c.table === "profiles").at(-1)!;
    expect(rosterCall.eqs.some((e) => e.field === "tenant_id" && e.value === "tenant-HF")).toBe(true);
  });

  it("[P4H-15.3] an agent-tier caller NEVER issues the roster SELECT", async () => {
    const fx = makeClient({
      profileRow: { role: "agent", tenant_id: "tenant-HF" },
    });
    uc.mockReturnValue(fx.client);

    await GET(req());
    // Exactly one profiles call (role/tenant lookup); no roster SELECT.
    const profilesCalls = fx.log.filter((c) => c.table === "profiles");
    expect(profilesCalls).toHaveLength(1);
  });

  it("[P4H-15.4] a tenant-less broker FAILS CLOSED — 403, no roster or transaction SELECT", async () => {
    const fx = makeClient({
      profileRow: { role: "broker", tenant_id: null },
    });
    uc.mockReturnValue(fx.client);

    // FINSEC P0-4 tightened this from "200 with an empty roster" to a 403: a
    // broker-tier caller with no tenant cannot be tenant-scoped, so the
    // all-agents transaction read is refused too, not just the roster.
    const res = await GET(req());
    expect(res.status).toBe(403);
    const profilesCalls = fx.log.filter((c) => c.table === "profiles");
    // Only the self-read for role; no second profiles SELECT when tenant is NULL.
    expect(profilesCalls).toHaveLength(1);
    expect(fx.log.some((c) => c.table === "transactions")).toBe(false);
  });

  it("[P4H-15.5] an office_manager is NOT elevated to broker on this route", async () => {
    const fx = makeClient({
      profileRow: { role: "office_manager", tenant_id: "tenant-HF" },
    });
    uc.mockReturnValue(fx.client);

    await GET(req());
    // Only the role lookup — office_manager is intentionally outside the
    // ['broker','admin'] gate here, so no roster SELECT runs.
    const profilesCalls = fx.log.filter((c) => c.table === "profiles");
    expect(profilesCalls).toHaveLength(1);
  });
});

describe("P4H-15 — unauthenticated", () => {
  it("[P4H-15.6] no user → 401 and no DB access", async () => {
    AUTHED = false;
    uc.mockReturnValue({
      from: () => {
        throw new Error("userClient should not be invoked when unauthenticated");
      },
    });

    const res = await GET(req());
    expect(res.status).toBe(401);
    AUTHED = true;
  });
});
