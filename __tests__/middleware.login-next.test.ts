/**
 * @jest-environment node
 */
// ============================================================================
// middleware · MATRIX-BROKER-ACCESS-1 — the unauth → /login redirect must carry
// the intended destination as ?next= so a broker deep-linked to an Agent Portal
// surface (e.g. the Matrix broker preview) returns there after signing in.
// /login itself must NOT get a self-referential next (loop-safe). Agents are
// unaffected — /api/login only honours next for broker/admin.
// ============================================================================
import { NextResponse } from "next/server";

let AUTHED_USER: { id: string } | null = null;
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_active: true }, error: null }) }) }) }),
  }),
}));

import { middleware } from "@/middleware";

function req(path: string): any {
  return { nextUrl: new URL(`http://apx${path}`), url: `http://apx${path}`, headers: new Headers(), cookies: { get: () => undefined } };
}

beforeEach(() => { AUTHED_USER = null; });

describe("middleware · unauth deep-link preserves ?next", () => {
  it("the Matrix broker-preview path → /login?next=<that path incl. query>", async () => {
    const res = (await middleware(req("/the-matrix/practice?preview=1"))) as NextResponse;
    const loc = res.headers.get("location")!;
    const u = new URL(loc);
    expect(u.pathname).toBe("/login");
    expect(u.searchParams.get("next")).toBe("/the-matrix/practice?preview=1");
  });

  it("the quiz preview path is preserved too", async () => {
    const res = (await middleware(req("/the-matrix/quiz?preview=1"))) as NextResponse;
    const u = new URL(res.headers.get("location")!);
    expect(u.searchParams.get("next")).toBe("/the-matrix/quiz?preview=1");
  });

  it("/login itself gets NO next (loop-safe)", async () => {
    // /login is a public path → passes through without a redirect at all.
    const res = (await middleware(req("/login"))) as NextResponse;
    expect(res.headers.get("location")).toBeNull();
  });

  it("an authenticated active user is NOT redirected (next logic only applies when logged out)", async () => {
    AUTHED_USER = { id: "u1" };
    const res = (await middleware(req("/the-matrix/practice?preview=1"))) as NextResponse;
    expect(res.headers.get("location")).toBeNull();
  });
});
