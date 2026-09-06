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
let PROFILE_IS_ACTIVE: boolean | null = null;
let PROFILE_LOOKUP_ERROR: Error | null = null;

jest.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, _cfg: unknown) => ({
    auth: {
      getUser: async () => ({
        data: { user: AUTHED_USER },
        error: null,
      }),
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            if (PROFILE_LOOKUP_ERROR) throw PROFILE_LOOKUP_ERROR;
            return {
              data:
                PROFILE_IS_ACTIVE === null
                  ? null
                  : { is_active: PROFILE_IS_ACTIVE },
              error: null,
            };
          },
        }),
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
  PROFILE_IS_ACTIVE = null;
  PROFILE_LOOKUP_ERROR = null;
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
    PROFILE_IS_ACTIVE = false;
    const res = await middleware(req("/pending-activation"));
    expect((res as NextResponse).headers.get("location")).toBeNull();
  });
  it("authed + is_active=true on /pending-activation → allow (page decides UX for already-active user)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_IS_ACTIVE = true;
    const res = await middleware(req("/pending-activation"));
    expect((res as NextResponse).headers.get("location")).toBeNull();
  });
  it("authed + no profile row on /pending-activation → allow (page renders safely)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_IS_ACTIVE = null;
    const res = await middleware(req("/pending-activation"));
    expect((res as NextResponse).headers.get("location")).toBeNull();
  });
});

describe("middleware · authed + is_active=false on protected route (step 4) → /pending-activation", () => {
  it.each([["/"], ["/training"], ["/tasks"], ["/workspace"], ["/commissions"], ["/home"]])(
    "%s → 307 → /pending-activation",
    async (path) => {
      AUTHED_USER = { id: "u-1" };
      PROFILE_IS_ACTIVE = false;
      const res = await middleware(req(path));
      const loc = (res as NextResponse).headers.get("location");
      expect(loc).toMatch(/\/pending-activation$/);
    }
  );

  it("no profile row (defensive) → treated as inactive → /pending-activation", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_IS_ACTIVE = null;
    const res = await middleware(req("/training"));
    const loc = (res as NextResponse).headers.get("location");
    expect(loc).toMatch(/\/pending-activation$/);
  });
});

describe("middleware · authed + is_active=true (step 5) → next()", () => {
  it.each([["/"], ["/training"], ["/tasks"], ["/workspace"], ["/commissions"], ["/home"]])(
    "%s → no redirect",
    async (path) => {
      AUTHED_USER = { id: "u-1" };
      PROFILE_IS_ACTIVE = true;
      const res = await middleware(req(path));
      expect((res as NextResponse).headers.get("location")).toBeNull();
    }
  );
});

describe("middleware · loop prevention (no redirect loop)", () => {
  it("inactive user redirected to /pending-activation → next request to /pending-activation is NOT re-redirected", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_IS_ACTIVE = false;

    // First hop: /training → /pending-activation
    const first = await middleware(req("/training"));
    expect(first.headers.get("location")).toMatch(/\/pending-activation$/);

    // Follow-up: /pending-activation → allow
    const second = await middleware(req("/pending-activation"));
    expect(second.headers.get("location")).toBeNull();
  });
});

describe("middleware · profile lookup failure — fail closed on protected pages", () => {
  it("authed + profile lookup throws → treated as inactive → /pending-activation (never grants access on error)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_LOOKUP_ERROR = new Error("network");
    const res = await middleware(req("/training"));
    const loc = (res as NextResponse).headers.get("location");
    expect(loc).toMatch(/\/pending-activation$/);
  });
  it("authed + profile lookup throws on /pending-activation itself → still allowed (no loop even under errors)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_LOOKUP_ERROR = new Error("network");
    const res = await middleware(req("/pending-activation"));
    expect(res.headers.get("location")).toBeNull();
  });
});
