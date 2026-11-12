/**
 * @jest-environment node
 */
// ============================================================================
// lib/security/withAuth — Broker Preview read-only clamp (integration)
// ============================================================================
// Proves the SERVER clamp actually fires inside the central API auth wrapper
// (not just in the decision unit): a mutating request carrying a valid preview
// context gets 403 preview_read_only; reads and non-preview requests pass.
// ============================================================================

let AUTHED_USER: { id: string } | null = null;

function fakeSb() {
  return {
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { is_active: true }, error: null }) }) }),
    }),
  };
}
jest.mock("@supabase/ssr", () => ({ createServerClient: () => fakeSb() }));
jest.mock("@supabase/supabase-js", () => ({ createClient: () => fakeSb() }));

import { requireAuth, withAuth } from "@/lib/security/withAuth";
import { signPreviewToken, PREVIEW_COOKIE } from "@/lib/security/broker-preview";

const SECRET = "BROKER_PREVIEW_SIGNING_SECRET";
const FLAG = "NEXT_PUBLIC_BROKER_PREVIEW_ENABLED";

beforeEach(() => {
  AUTHED_USER = { id: "broker-1" };
  process.env[SECRET] = "integration-secret-bbbbbbbbbbbbbbbb";
  process.env[FLAG] = "true";
});
afterEach(() => {
  delete process.env[SECRET];
  delete process.env[FLAG];
});

function req(opts: { method?: string; path?: string; cookie?: string } = {}): any {
  const { method = "GET", path = "/api/transactions/create", cookie } = opts;
  return {
    method,
    nextUrl: { pathname: path },
    headers: new Headers(),
    cookies: { get: (n: string) => (cookie && n === PREVIEW_COOKIE ? { value: cookie } : undefined) },
  };
}

describe("requireAuth · preview read-only clamp", () => {
  it("POST under a valid preview cookie → 403 preview_read_only", async () => {
    const cookie = signPreviewToken("broker-1", "t1")!;
    const result = await requireAuth(req({ method: "POST", cookie }));
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.code).toBe("preview_read_only");
  });

  it("GET under the same preview cookie → passes (reads allowed)", async () => {
    const cookie = signPreviewToken("broker-1", "t1")!;
    const result = await requireAuth(req({ method: "GET", cookie }));
    expect(result.response).toBeUndefined();
    expect(result.user).toEqual({ id: "broker-1" });
  });

  it("POST with NO preview context → passes (ordinary mutation unaffected)", async () => {
    const result = await requireAuth(req({ method: "POST" }));
    expect(result.response).toBeUndefined();
    expect(result.user).toEqual({ id: "broker-1" });
  });

  it("tampered cookie on a POST → 403 (fail closed)", async () => {
    const result = await requireAuth(req({ method: "POST", cookie: "garbage.sig" }));
    expect(result.response!.status).toBe(403);
    expect((await result.response!.json()).code).toBe("preview_read_only");
  });
});

describe("withAuth HOF · preview read-only clamp", () => {
  it("blocks the wrapped handler from running on a preview mutation", async () => {
    const cookie = signPreviewToken("broker-1", "t1")!;
    const handler = jest.fn(async () => new Response("ok") as any);
    const wrapped = withAuth(handler as any);
    const res = await wrapped(req({ method: "POST", cookie }) as any);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled(); // the handler never ran
  });
});
