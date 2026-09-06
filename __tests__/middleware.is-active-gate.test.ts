/**
 * @jest-environment node
 */
// ============================================================================
// middleware · is_active gate (per Correction 1)
// ============================================================================
// Locks the 5-step order:
//   1. public → allow
//   2. no session → /login
//   3. session + /pending-activation → allow (regardless of is_active; loop-safe)
//   4. session + is_active=false → /pending-activation
//   5. session + is_active=true → next()
// ============================================================================

import { NextResponse } from "next/server";

// Mocked Supabase state — flip per test.
let AUTHED_USER: { id: string } | null = null;
// Three-state model:
//   'active'     → row exists { is_active: true }
//   'inactive'   → row exists { is_active: false }
//   'null-value' → row exists { is_active: null }   (explicit DB null)
//   'no-row'     → no row (data: null, error: PGRST116-shape)
//   'error'      → .single() throws (network / DB down)
type ProfileMode = "active" | "inactive" | "null-value" | "no-row" | "error";
let PROFILE_MODE: ProfileMode = "no-row";

// Capture what .eq() was called with, so we can prove the lookup is bound
// to the authenticated user's id (never selecting another profile).
const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];

jest.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, _cfg: unknown) => ({
    auth: {
      getUser: async () => ({
        data: { user: AUTHED_USER },
        error: null,
      }),
    },
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
  }),
}));

// Import AFTER the mocks are staged.
import { middleware } from "@/middleware";

/** Build a fake NextRequest just enough for the middleware to inspect. */
function req(path: string): any {
  return {
    nextUrl: new URL(`http://apx${path}`),
    url: `http://apx${path}`,
    headers: new Headers(),
    cookies: {
      get: () => undefined,
    },
  };
}

beforeEach(() => {
  AUTHED_USER = null;
  PROFILE_MODE = "no-row";
  eqCalls.length = 0;
});

describe("middleware · public paths (step 1) — never gated", () => {
  it.each([
    ["/login"],
    ["/forgot-password"],
    ["/reset-password"],
    ["/logout"],
    ["/card/some-slug"],
    ["/client/abc"],
    ["/api/client/anything"],
    ["/portal/deal/xyz"],
  ])("public path %s → passes through even without a session", async (path) => {
    AUTHED_USER = null;
    const res = await middleware(req(path));
    // Not a redirect
    expect((res as NextResponse).headers.get("location")).toBeNull();
    expect((res as NextResponse).status).not.toBe(307);
  });
});

describe("middleware · protected route without session (step 2) → /login", () => {
  it.each([
    ["/"],
    ["/training"],
    ["/tasks"],
    ["/workspace"],
    ["/commissions"],
    ["/home"],
    ["/pending-activation"], // still requires auth
  ])("%s with no session → redirects to /login", async (path) => {
    AUTHED_USER = null;
    const res = await middleware(req(path));
    const loc = (res as NextResponse).headers.get("location");
    expect(loc).toMatch(/\/login$/);
  });
});

describe("middleware · authed on /pending-activation (step 3) — allow regardless of is_active", () => {
  it("authed + is_active=false on /pending-activation → allow (does NOT redirect to /pending-activation, no loop)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "inactive";
    const res = await middleware(req("/pending-activation"));
    expect((res as NextResponse).headers.get("location")).toBeNull();
  });
  it("authed + is_active=true on /pending-activation → allow (page decides UX for already-active user)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "active";
    const res = await middleware(req("/pending-activation"));
    expect((res as NextResponse).headers.get("location")).toBeNull();
  });
  it("authed + no profile row on /pending-activation → allow (page renders safely with fallback copy)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "no-row";
    const res = await middleware(req("/pending-activation"));
    expect((res as NextResponse).headers.get("location")).toBeNull();
  });
});

// ============================================================================
// FAIL-CLOSED MATRIX (step 4)
// ============================================================================
// Only explicit is_active === true grants access. Every other profile
// result must deny. Applies to both protected pages (middleware) and APIs
// (see withAuth.is-active.test.ts for the API layer).
// ============================================================================
describe("middleware · fail-closed matrix (step 4) — protected page navigation", () => {
  const PROTECTED_PATHS = ["/", "/training", "/tasks", "/workspace", "/commissions", "/home"];

  it.each(PROTECTED_PATHS)(
    "is_active=true · %s → allow",
    async (path) => {
      AUTHED_USER = { id: "u-1" };
      PROFILE_MODE = "active";
      const res = await middleware(req(path));
      expect((res as NextResponse).headers.get("location")).toBeNull();
    }
  );

  it.each(PROTECTED_PATHS)(
    "is_active=false · %s → /pending-activation",
    async (path) => {
      AUTHED_USER = { id: "u-1" };
      PROFILE_MODE = "inactive";
      const res = await middleware(req(path));
      expect((res as NextResponse).headers.get("location")).toMatch(/\/pending-activation$/);
    }
  );

  it.each(PROTECTED_PATHS)(
    "is_active=null (row present, explicit NULL) · %s → deny → /pending-activation",
    async (path) => {
      AUTHED_USER = { id: "u-1" };
      PROFILE_MODE = "null-value";
      const res = await middleware(req(path));
      expect((res as NextResponse).headers.get("location")).toMatch(/\/pending-activation$/);
    }
  );

  it.each(PROTECTED_PATHS)(
    "profile row missing · %s → deny → /pending-activation",
    async (path) => {
      AUTHED_USER = { id: "u-1" };
      PROFILE_MODE = "no-row";
      const res = await middleware(req(path));
      expect((res as NextResponse).headers.get("location")).toMatch(/\/pending-activation$/);
    }
  );

  it.each(PROTECTED_PATHS)(
    "profile lookup DB error · %s → deny safely → /pending-activation (never grants access)",
    async (path) => {
      AUTHED_USER = { id: "u-1" };
      PROFILE_MODE = "error";
      const res = await middleware(req(path));
      expect((res as NextResponse).headers.get("location")).toMatch(/\/pending-activation$/);
    }
  );
});

describe("middleware · loop prevention (no redirect loop)", () => {
  it("inactive user redirected to /pending-activation → next request to /pending-activation is NOT re-redirected", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "inactive";

    const first = await middleware(req("/training"));
    expect(first.headers.get("location")).toMatch(/\/pending-activation$/);

    const second = await middleware(req("/pending-activation"));
    expect(second.headers.get("location")).toBeNull();
  });

  it("under lookup ERROR: /training → /pending-activation, then /pending-activation itself → allowed (no loop even under errors)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_MODE = "error";

    const first = await middleware(req("/training"));
    expect(first.headers.get("location")).toMatch(/\/pending-activation$/);

    const second = await middleware(req("/pending-activation"));
    expect(second.headers.get("location")).toBeNull();
  });
});

describe("middleware · lookup is tenant-bound to the AUTHENTICATED user.id", () => {
  it("profile SELECT is filtered by the authenticated caller's own id — never another id", async () => {
    AUTHED_USER = { id: "caller-42" };
    PROFILE_MODE = "active";
    await middleware(req("/training"));

    const profileEqs = eqCalls.filter((c) => c.table === "profiles");
    expect(profileEqs.length).toBeGreaterThan(0);
    for (const c of profileEqs) {
      expect(c.column).toBe("id");
      expect(c.value).toBe("caller-42");
    }
  });

  it("a different caller sees only their own row queried (no cross-user probe)", async () => {
    AUTHED_USER = { id: "someone-else-99" };
    PROFILE_MODE = "active";
    await middleware(req("/tasks"));

    const profileEqs = eqCalls.filter((c) => c.table === "profiles");
    for (const c of profileEqs) {
      expect(c.value).toBe("someone-else-99");
    }
  });
});
