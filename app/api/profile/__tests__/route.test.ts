/**
 * @jest-environment node
 */
// ============================================================================
// AP-PROFILE-SAVE — /api/profile PATCH
// ============================================================================
// The defect being locked down: the browser used to send the whole form object
// to `profiles`, including `location` — a column that does not exist — so the
// statement was rejected and NOTHING persisted. Separately, a filtered UPDATE
// that matches no rows is NOT an error in PostgREST, so "no error" was never
// proof of persistence.
//
// These tests assert BOTH halves: only allowlisted columns reach the database,
// and success is reported only when a row actually came back.
// ============================================================================
import { NextResponse } from "next/server";

jest.mock("@/lib/security", () => ({
  requireAuth: jest.fn(async () => ({ user: { id: "agent-1" } })),
  userClient: jest.fn(),
}));

import { PATCH } from "@/app/api/profile/route";
import { requireAuth, userClient } from "@/lib/security";

const ra = requireAuth as jest.Mock;
const uc = userClient as jest.Mock;

/** Records what was sent to `.update()` and what filter was applied. */
function makeClient(result: { data?: any[]; error?: any }) {
  const calls: { table?: string; updates?: any; eqField?: string; eqValue?: string } = {};
  const chain: any = {
    update(updates: any) {
      calls.updates = updates;
      return chain;
    },
    eq(field: string, value: string) {
      calls.eqField = field;
      calls.eqValue = value;
      return chain;
    },
    select() {
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };
  return {
    calls,
    client: {
      from(table: string) {
        calls.table = table;
        return chain;
      },
    },
  };
}

const OK_ROW = {
  id: "agent-1",
  full_name: "QA Tester",
  phone: "(201) 555-0100",
  bio: null,
  license_number: null,
  updated_at: "2026-08-18T03:00:00.000Z",
};

function req(body: unknown): any {
  return { json: async () => body, headers: { get: () => null } };
}

beforeEach(() => {
  ra.mockReset();
  ra.mockResolvedValue({ user: { id: "agent-1" } });
  uc.mockReset();
});

describe("authorization", () => {
  it("4 · rejects an unauthenticated caller and never touches the database", async () => {
    ra.mockResolvedValue({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await PATCH(req({ phone: "(201) 555-0100" }));
    expect(res.status).toBe(401);
    expect(uc).not.toHaveBeenCalled();
  });

  it("4 · scopes the write to the CALLER's own id, never a client-supplied id", async () => {
    const { calls, client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    await PATCH(req({ phone: "(201) 555-0100", id: "someone-else" }));
    expect(calls.eqField).toBe("id");
    expect(calls.eqValue).toBe("agent-1");
    expect(calls.updates).not.toHaveProperty("id");
  });
});

describe("field allowlist", () => {
  it("1 · persists an allowed field", async () => {
    const { calls, client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    const res = await PATCH(req({ phone: "(201) 555-0100" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(calls.table).toBe("profiles");
    expect(calls.updates.phone).toBe("(201) 555-0100");
  });

  it("5 · role cannot be changed through this endpoint", async () => {
    const { calls, client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    await PATCH(req({ phone: "(201) 555-0100", role: "admin" }));
    expect(calls.updates).not.toHaveProperty("role");
  });

  it("6 · tenant cannot be changed through this endpoint", async () => {
    const { calls, client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    await PATCH(req({ phone: "(201) 555-0100", tenant_id: "other-tenant" }));
    expect(calls.updates).not.toHaveProperty("tenant_id");
  });

  it("5/6 · no security or lifecycle column can be smuggled in", async () => {
    const { calls, client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    await PATCH(
      req({
        phone: "(201) 555-0100",
        role: "admin",
        tenant_id: "t",
        is_active: false,
        suspended_at: "now",
        deleted_at: "now",
        permissions: ["*"],
        annual_cap: 999999,
        stripe_account_id: "acct_x",
        card_slug: "hijack",
      }),
    );
    expect(Object.keys(calls.updates).sort()).toEqual(["phone", "updated_at"]);
  });

  it("· `location` is never sent — the column does not exist and broke every save", async () => {
    const { calls, client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    await PATCH(req({ phone: "(201) 555-0100", location: "Newark, NJ" }));
    expect(calls.updates).not.toHaveProperty("location");
  });

  it("· rejects a request with no editable field, without writing", async () => {
    const { client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    const res = await PATCH(req({ role: "admin", location: "Newark" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("no_editable_fields");
  });
});

describe("truthful persistence result", () => {
  it("8 · a ZERO-ROW update is a failure, not a success", async () => {
    // The exact shape that made the old code lie: no error, no rows.
    const { client } = makeClient({ data: [], error: null });
    uc.mockReturnValue(client);
    const res = await PATCH(req({ phone: "(201) 555-0100" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBeUndefined();
    expect(json.code).toBe("not_persisted");
  });

  it("8 · a row for a DIFFERENT user is not accepted as success", async () => {
    const { client } = makeClient({ data: [{ ...OK_ROW, id: "someone-else" }] });
    uc.mockReturnValue(client);
    const res = await PATCH(req({ phone: "(201) 555-0100" }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("unexpected_scope");
  });

  it("· a database error is reported as failure", async () => {
    const { client } = makeClient({ error: { code: "42501", message: "permission denied" } });
    uc.mockReturnValue(client);
    const res = await PATCH(req({ phone: "(201) 555-0100" }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("database_error");
  });

  it("2/3 · returns the PERSISTED representation so a reload shows the saved value", async () => {
    const { client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    const res = await PATCH(req({ phone: "(201) 555-0100" }));
    expect((await res.json()).profile).toMatchObject({
      id: "agent-1",
      phone: "(201) 555-0100",
    });
  });

  it("· validation failure is distinct from persistence failure", async () => {
    const { client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    const res = await PATCH(req({ phone: 12345 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("validation_failed");
  });

  it("· a blank value clears the field rather than writing an empty string", async () => {
    const { calls, client } = makeClient({ data: [OK_ROW] });
    uc.mockReturnValue(client);
    await PATCH(req({ bio: "   " }));
    expect(calls.updates.bio).toBeNull();
  });
});
