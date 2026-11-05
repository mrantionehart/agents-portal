/**
 * @jest-environment node
 */
// ============================================================================
// /api/login · MATRIX-BROKER-ACCESS-1 — a broker/admin may be routed to a
// same-origin Agent Portal path via `next`. Default (no/unsafe next) is the
// unchanged Vault landing. Open-redirect safe. Agents/inactive unchanged.
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
      signInWithPassword: async () => ({ data: { user: AUTH_USER }, error: AUTH_ERROR }),
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
          single: async () => ({ data: table === "profiles" ? PROFILE_ROW : null, error: null }),
          maybeSingle: async () => ({
            data: table === "training_progress" ? PROGRESS_ROW : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
jest.mock("@/lib/ratelimit", () => ({
  normalizeEmail: (e: string) => (typeof e === "string" ? e.toLowerCase() : ""),
}));
// ONBOARD-002 — onboarding evidence is read with the service role:
// training_lesson_attestations (pcert-l01) and graded Volume 1 passes.
let ATTESTED = false;
const evidenceChain = (table: string): any => {
  const c: any = {};
  for (const m of ["select", "eq", "is"]) c[m] = () => c;
  c.limit = async () => ({ data: table === "training_lesson_attestations" && ATTESTED ? [{ lesson_id: "pcert-l01" }] : [], error: null });
  c.then = (res: any) => Promise.resolve({ data: [], error: null }).then(res);
  return c;
};
jest.mock("@/lib/security", () => ({
  adminClient: () => ({ from: (t: string) => evidenceChain(t) }),
  clientIp: () => "127.0.0.1",
  requireRateLimit: async () => ({}),
}));

import { POST, safeNextPath } from "@/app/api/login/route";

function req(body: unknown): any {
  return {
    json: async () => body,
    headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    cookies: { get: () => undefined },
  };
}

async function redirectFor(body: Record<string, unknown>): Promise<string> {
  const res = await POST(req(body));
  const j = await res.json();
  return j.redirectPath as string;
}

beforeEach(() => {
  AUTH_USER = { id: "u-1", email: "b@y.com" };
  AUTH_ERROR = null;
  PROFILE_ROW = null;
  PROGRESS_ROW = null;
  ATTESTED = false;
});

const VAULT = "https://vault.hartfeltrealestate.com/dashboard";

describe("safeNextPath (open-redirect guard)", () => {
  it("accepts a clean same-origin absolute path", () => {
    expect(safeNextPath("/the-matrix/review")).toBe("/the-matrix/review");
    expect(safeNextPath("/the-matrix/review?x=1")).toBe("/the-matrix/review?x=1");
  });
  it("rejects protocol-relative, schemes, backslashes, whitespace, relative, and non-strings", () => {
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "http://evil.com/x",
      "/\\evil.com",
      "/the matrix",
      "the-matrix/review",
      "",
      null,
      undefined,
      42,
      "\\\\evil",
    ]) {
      expect(safeNextPath(bad as unknown)).toBeNull();
    }
  });
});

describe("/api/login · broker next-redirect", () => {
  it("broker + valid next=/the-matrix/review → lands on that AP path", async () => {
    PROFILE_ROW = { role: "broker", is_active: true };
    expect(await redirectFor({ email: "b@y.com", password: "ok", next: "/the-matrix/review" })).toBe(
      "/the-matrix/review",
    );
  });

  it("broker + NO next → Vault (unchanged default)", async () => {
    PROFILE_ROW = { role: "broker", is_active: true };
    expect(await redirectFor({ email: "b@y.com", password: "ok" })).toBe(VAULT);
  });

  it("broker + open-redirect next → Vault (ignored)", async () => {
    PROFILE_ROW = { role: "broker", is_active: true };
    expect(await redirectFor({ email: "b@y.com", password: "ok", next: "//evil.com" })).toBe(VAULT);
    expect(await redirectFor({ email: "b@y.com", password: "ok", next: "https://evil.com" })).toBe(
      VAULT,
    );
  });

  it("admin + valid next → that AP path", async () => {
    PROFILE_ROW = { role: "admin", is_active: true };
    expect(await redirectFor({ email: "b@y.com", password: "ok", next: "/the-matrix/review" })).toBe(
      "/the-matrix/review",
    );
  });

  it("agent + next is IGNORED (default landing unchanged)", async () => {
    PROFILE_ROW = { role: "agent", is_active: true };
    ATTESTED = true;
    // Agents keep their onboarding-based landing; next does not apply.
    expect(await redirectFor({ email: "b@y.com", password: "ok", next: "/the-matrix/review" })).toBe(
      "/home",
    );
  });

  it("inactive broker + next → /pending-activation (unchanged, next not honored)", async () => {
    PROFILE_ROW = { role: "broker", is_active: false };
    expect(await redirectFor({ email: "b@y.com", password: "ok", next: "/the-matrix/review" })).toBe(
      "/pending-activation",
    );
  });
});
