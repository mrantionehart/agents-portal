// ============================================================================
// Broker Preview — the edge (middleware) clamp decides EXACTLY like the Node one
// ============================================================================
// middleware.ts cannot bundle node:crypto (it broke every AP production build
// after #137), so it uses previewMutationBlockedEdge. These prove the two make
// the same decision on every request shape, and that the edge module (and the
// middleware) never pull crypto in.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { previewMutationBlockedEdge } from "../broker-preview-edge";
import { previewMutationBlockedServer, signPreviewToken, PREVIEW_COOKIE, PREVIEW_HEADER } from "../broker-preview";

const SECRET = "BROKER_PREVIEW_SIGNING_SECRET";
const FLAG = "NEXT_PUBLIC_BROKER_PREVIEW_ENABLED";
const prev = { s: process.env[SECRET], f: process.env[FLAG] };
afterEach(() => {
  if (prev.s === undefined) delete process.env[SECRET]; else process.env[SECRET] = prev.s;
  if (prev.f === undefined) delete process.env[FLAG]; else process.env[FLAG] = prev.f;
});

const BROKER = "broker-111";
function req(method: string, path: string, cookie?: string, header?: string): NextRequest {
  return {
    method,
    nextUrl: { pathname: path },
    cookies: { get: (n: string) => (cookie && n === PREVIEW_COOKIE ? { value: cookie } : undefined) },
    headers: { get: (n: string) => (n === PREVIEW_HEADER ? header ?? null : null) },
  } as unknown as NextRequest;
}

describe("edge clamp ≡ node clamp", () => {
  it.each([true, false])("same decision on every shape (flag on=%s)", (on) => {
    process.env[SECRET] = "unit-test-secret-aaaaaaaaaaaaaaaaaaaa";
    if (on) process.env[FLAG] = "true"; else delete process.env[FLAG];
    const valid = signPreviewToken(BROKER, "t1") ?? "x.y";
    const contexts = [undefined, valid, "tampered.sig"];
    let blocked = 0;
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]) {
      for (const path of ["/transactions", "/api/broker/preview-session", "/logout", "/api/auth/x"]) {
        for (const cookie of contexts) {
          for (const header of [undefined, valid]) {
            const r = req(method, path, cookie, header);
            const edge = previewMutationBlockedEdge(r);
            expect(edge).toBe(previewMutationBlockedServer(r, BROKER));
            if (edge) blocked++;
          }
        }
      }
    }
    // Not vacuous: with the flag on, mutations under a context ARE refused.
    if (on) expect(blocked).toBeGreaterThan(0); else expect(blocked).toBe(0);
  });
});

describe("no crypto on the edge path", () => {
  const code = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").replace(/^\s*\/\/.*$/gm, "");
  it("broker-preview-edge.ts imports no crypto and nothing from broker-preview.ts", () => {
    const src = code("lib/security/broker-preview-edge.ts");
    expect(src).not.toMatch(/crypto/);
    expect(src).not.toMatch(/from ["']\.\/broker-preview["']/);
  });
  it("middleware.ts imports only the edge clamp", () => {
    const mw = code("middleware.ts");
    expect(mw).toMatch(/from '@\/lib\/security\/broker-preview-edge'/);
    expect(mw).not.toMatch(/from ['"]@\/lib\/security\/broker-preview['"]/);
    expect(mw).not.toMatch(/node:crypto/);
  });
});
