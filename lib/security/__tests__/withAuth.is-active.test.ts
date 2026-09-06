/**
 * @jest-environment node
 */
// ============================================================================
// lib/security/withAuth — is_active enforcement (API layer, fail-closed)
// ============================================================================
// Second layer of defense: even if middleware.matcher drifts and stops
// covering /api/*, API routes calling requireAuth will 403 an inactive
// caller with a structured JSON error. All 48 API-route callers inherit
// the gate transparently.
//
// Fail-closed matrix (identical semantics to the middleware page gate):
//   is_active=true                → passthrough
//   is_active=false               → 403 { error, code: 'inactive_account' }
//   is_active=null (row present)  → 403 (deny)
//   profile row missing           → 403 (deny)
//   profile lookup DB error       → 403 (deny safely)
// Only explicit === true grants access.
// ============================================================================

let AUTHED_USER: { id: string } | null = null;
type ProfileMode = "active" | "inactive" | "null-value" | "no-row" | "error";
let PROFILE_MODE: ProfileMode = "no-row";

// Capture .eq calls to prove tenant-bound lookup.
const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];

function fakeSb() {
  return {
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          eqCalls.push({ table, column, value });
          return {
            single: async () => {
              switch (PROFILE_MODE) {
                case "error":
                  throw new Error("network");
                case "active":
                  return { data: { is_active: true }, error: null };
                case "inactive":
                  return { data: { is_active: false }, error: null };
                case "null-value":
                  return { data: { is_active: null }, error: null };
                case "no-row":
                default:
                  return {
                    data: null,
                    error: { code: "PGRST116", message: "no rows" },
                  };
              }
            },
          };
        },
      }),
    }),
  };
}

jest.mock("@supabase/ssr", () => ({ createServerClient: () => fakeSb() }));
jest.mock("@supabase/supabase-js", () => ({ createClient: () => fakeSb() }));

import { requireAuth } from "@/lib/security/withAuth";

function req(): any {
  return {
    headers: new Headers(),
    cookies: { get: () => undefined },
  };
}

beforeEach(() => {
  AUTHED_USER = null;
  PROFILE_MODE = "no-row";
  eqCalls.length = 0;
});

describe("requireAuth · unauthenticated (unchanged)", () => {
  it("no user → 401 { error: 'Unauthorized' }", async () => {
    AUTHED_USER = null;
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(401);
    const body = await result.response!.json();
    expect(body.error).toBe("Unauthorized");
  });
});

describe("requireAuth · fail-closed matrix (API layer)", () => {
  it("is_active=true → passthrough (returns { user })", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "active";
    const result = await requireAuth(req());
    expect(result.response).toBeUndefined();
    expect(result.user).toEqual({ id: "u-1" });
  });

  it("is_active=false → 403 JSON { error: 'Account inactive', code: 'inactive_account' }", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "inactive";
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.error).toBe("Account inactive");
    expect(body.code).toBe("inactive_account");
  });

  it("is_active=null (row present, explicit NULL) → 403 (deny)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "null-value";
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.code).toBe("inactive_account");
  });

  it("profile row missing → 403 (deny)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "no-row";
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.code).toBe("inactive_account");
  });

  it("profile lookup DB error → 403 (deny safely; never grants access on transient error)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "error";
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.code).toBe("inactive_account");
  });
});

describe("requireAuth · lookup is tenant-bound to the AUTHENTICATED user.id", () => {
  it("profile SELECT is filtered by the caller's own id — never another id", async () => {
    AUTHED_USER = { id: "caller-42" };
    PROFILE_MODE = "active";
    await requireAuth(req());

    const profileEqs = eqCalls.filter((c) => c.table === "profiles");
    expect(profileEqs.length).toBeGreaterThan(0);
    for (const c of profileEqs) {
      expect(c.column).toBe("id");
      expect(c.value).toBe("caller-42");
    }
  });

  it("a different caller sees only their own row queried", async () => {
    AUTHED_USER = { id: "someone-else-99" };
    PROFILE_MODE = "active";
    await requireAuth(req());

    const profileEqs = eqCalls.filter((c) => c.table === "profiles");
    for (const c of profileEqs) {
      expect(c.value).toBe("someone-else-99");
    }
  });
});
