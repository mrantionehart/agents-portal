/**
 * @jest-environment node
 */
// ============================================================================
// /api/login · inactive users receive redirectPath = '/pending-activation'
// ============================================================================
// The session IS still created (so the pending-activation page can render
// for the authenticated user). Only the post-login navigation target
// changes.
// ============================================================================

let AUTH_USER: { id: string; email: string } | null = null;
let AUTH_ERROR: { message: string } | null = null;
type ProfileRow = { role: string; is_active: boolean } | null;
let PROFILE_ROW: ProfileRow = null;
type ProgressRow = { volume_completed: boolean } | null;
let PROGRESS_ROW: ProgressRow = null;

jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: AUTH_USER },
        error: AUTH_ERROR,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === "training_progress" ? PROGRESS_ROW : null,
              error: null,
            }),
          }),
          single: async () => ({
            data: table === "profiles" ? PROFILE_ROW : null,
            error: null,
          }),
          maybeSingle: async () => ({
            data: table === "training_progress" ? PROGRESS_ROW : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

// Rate-limit + normalization: pass through with no throttling
jest.mock("@/lib/ratelimit", () => ({
  normalizeEmail: (e: string) => (typeof e === "string" ? e.toLowerCase() : ""),
}));
jest.mock("@/lib/security", () => ({
  clientIp: () => "127.0.0.1",
  requireRateLimit: async () => ({}),
}));

import { POST } from "@/app/api/login/route";

function req(body: unknown): any {
  return {
    json: async () => body,
    headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    cookies: { get: () => undefined },
  };
}

beforeEach(() => {
  AUTH_USER = null;
  AUTH_ERROR = null;
  PROFILE_ROW = null;
  PROGRESS_ROW = null;
});

describe("/api/login · redirectPath contract", () => {
  it("bad credentials → 401 unchanged (pre-existing behavior)", async () => {
    AUTH_ERROR = { message: "Invalid" };
    const res = await POST(req({ email: "x@y.com", password: "z" }));
    expect(res.status).toBe(401);
  });

  it("active agent + onboarded → /home (unchanged)", async () => {
    AUTH_USER = { id: "u-1", email: "a@y.com" };
    PROFILE_ROW = { role: "agent", is_active: true };
    PROGRESS_ROW = { volume_completed: true };
    const res = await POST(req({ email: "a@y.com", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectPath).toBe("/home");
  });

  it("active agent + NOT onboarded → /training (unchanged)", async () => {
    AUTH_USER = { id: "u-1", email: "a@y.com" };
    PROFILE_ROW = { role: "agent", is_active: true };
    PROGRESS_ROW = null;
    const res = await POST(req({ email: "a@y.com", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectPath).toBe("/training");
  });

  it("INACTIVE agent → /pending-activation (session still created)", async () => {
    AUTH_USER = { id: "u-1", email: "a@y.com" };
    PROFILE_ROW = { role: "agent", is_active: false };
    // training_progress irrelevant when inactive — pending-activation wins first
    PROGRESS_ROW = { volume_completed: true };
    const res = await POST(req({ email: "a@y.com", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectPath).toBe("/pending-activation");
  });

  it("INACTIVE broker → /pending-activation (safety: staff who are inactive don't jump to Vault)", async () => {
    AUTH_USER = { id: "u-1", email: "b@y.com" };
    PROFILE_ROW = { role: "broker", is_active: false };
    const res = await POST(req({ email: "b@y.com", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectPath).toBe("/pending-activation");
  });

  it("active broker/admin → Vault dashboard (unchanged)", async () => {
    AUTH_USER = { id: "u-1", email: "b@y.com" };
    PROFILE_ROW = { role: "broker", is_active: true };
    const res = await POST(req({ email: "b@y.com", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectPath).toMatch(/vault\.hartfeltrealestate\.com/);
  });

  it("no profile row (defensive) → /pending-activation (fail closed)", async () => {
    AUTH_USER = { id: "u-1", email: "a@y.com" };
    PROFILE_ROW = null;
    const res = await POST(req({ email: "a@y.com", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectPath).toBe("/pending-activation");
  });
});
