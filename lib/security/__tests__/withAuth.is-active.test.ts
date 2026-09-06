/**
 * @jest-environment node
 */
// ============================================================================
// lib/security/withAuth — is_active enforcement (API layer)
// ============================================================================
// Second layer of defense: even if middleware.matcher drifts and stops
// covering `/api/*`, API routes calling `requireAuth` will 403 an inactive
// caller with a structured JSON error. All 48 API-route callers inherit
// the gate transparently.
// ============================================================================

// Force AUTH_MODE for these tests — cookie vs bearer doesn't matter; the
// gate operates AFTER user resolution.
let AUTHED_USER: { id: string } | null = null;
let PROFILE_IS_ACTIVE: boolean | null = null;
let PROFILE_LOOKUP_ERROR: Error | null = null;

// getAuthedUser is called first; we short-circuit its transport-mode logic
// by mocking the Supabase client factories it uses.
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
    from: () => ({
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

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
    from: () => ({
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

import { requireAuth } from "@/lib/security/withAuth";

function req(): any {
  return {
    headers: new Headers(),
    cookies: { get: () => undefined },
  };
}

beforeEach(() => {
  AUTHED_USER = null;
  PROFILE_IS_ACTIVE = null;
  PROFILE_LOOKUP_ERROR = null;
});

describe("requireAuth · is_active gate (403 JSON on inactive)", () => {
  it("no user → 401 (unchanged pre-existing behavior)", async () => {
    AUTHED_USER = null;
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(401);
    const body = await result.response!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("user + is_active=true → passthrough (returns { user })", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_IS_ACTIVE = true;
    const result = await requireAuth(req());
    expect(result.response).toBeUndefined();
    expect(result.user).toEqual({ id: "u-1" });
  });

  it("user + is_active=false → 403 JSON { error, code }", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_IS_ACTIVE = false;
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.error).toBe("Account inactive");
    expect(body.code).toBe("inactive_account");
  });

  it("user + no profile row (defensive) → 403 (fail closed)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_IS_ACTIVE = null;
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.code).toBe("inactive_account");
  });

  it("user + profile lookup throws → 403 (fail closed on transient error)", async () => {
    AUTHED_USER = { id: "u-1" };
    PROFILE_LOOKUP_ERROR = new Error("network");
    const result = await requireAuth(req());
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.code).toBe("inactive_account");
  });
});
