// ============================================================================
// Broker Preview Agent View — SERVER guard (adversarial)
// ============================================================================
// Proves the server-enforced read-only clamp: signed, broker-bound, short-lived
// context; fail-closed on tampering; cannot be escaped by dropping ?preview or
// editing storage (the guard reads the server cookie/header, not a client flag);
// reads + ordinary non-preview requests untouched.
// ============================================================================

import type { NextRequest } from "next/server";
import {
  signPreviewToken,
  verifyPreviewToken,
  previewMutationBlockedServer,
  hasValidPreviewContext,
  PREVIEW_COOKIE,
  PREVIEW_HEADER,
} from "../broker-preview";

const SECRET = "BROKER_PREVIEW_SIGNING_SECRET";
const FLAG = "NEXT_PUBLIC_BROKER_PREVIEW_ENABLED";
const prevSecret = process.env[SECRET];
const prevFlag = process.env[FLAG];

beforeEach(() => {
  process.env[SECRET] = "unit-test-secret-aaaaaaaaaaaaaaaaaaaa";
  process.env[FLAG] = "true";
});
afterEach(() => {
  if (prevSecret === undefined) delete process.env[SECRET]; else process.env[SECRET] = prevSecret;
  if (prevFlag === undefined) delete process.env[FLAG]; else process.env[FLAG] = prevFlag;
});

const BROKER = "broker-111";
const OTHER = "someone-else-222";

function req(opts: { method?: string; path?: string; cookie?: string; header?: string } = {}): NextRequest {
  const { method = "GET", path = "/api/transactions/create", cookie, header } = opts;
  return {
    method,
    nextUrl: { pathname: path },
    cookies: { get: (n: string) => (cookie && n === PREVIEW_COOKIE ? { value: cookie } : undefined) },
    headers: { get: (n: string) => (n === PREVIEW_HEADER ? header ?? null : null) },
  } as unknown as NextRequest;
}

describe("token sign/verify — broker-bound, tamper-evident, short-lived", () => {
  it("round-trips for the bound broker and rejects a different subject", () => {
    const t = signPreviewToken(BROKER, "tenant-1")!;
    expect(verifyPreviewToken(t, BROKER)).toMatchObject({ b: BROKER });
    expect(verifyPreviewToken(t, OTHER)).toBeNull(); // not bound to this caller
  });
  it("rejects a tampered signature", () => {
    const t = signPreviewToken(BROKER, "tenant-1")!;
    const [body] = t.split(".");
    expect(verifyPreviewToken(`${body}.deadbeef`, BROKER)).toBeNull();
    expect(verifyPreviewToken(`${body}X.${t.split(".")[1]}`, BROKER)).toBeNull();
  });
  it("rejects an expired token", () => {
    const realNow = Date.now;
    const t = signPreviewToken(BROKER, "tenant-1")!;
    try {
      Date.now = () => realNow() + 60 * 60 * 1000; // +1h, past the 30m TTL
      expect(verifyPreviewToken(t, BROKER)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
  it("mints nothing without a signing secret (feature inert)", () => {
    delete process.env[SECRET];
    expect(signPreviewToken(BROKER, "tenant-1")).toBeNull();
    expect(verifyPreviewToken("a.b", BROKER)).toBeNull();
  });
});

describe("previewMutationBlockedServer — server-enforced read-only", () => {
  const validCookie = () => signPreviewToken(BROKER, "tenant-1")!;

  it("(P3.3) blocks a direct API mutation carrying a valid preview cookie", () => {
    expect(previewMutationBlockedServer(req({ method: "POST", cookie: validCookie() }), BROKER)).toBe(true);
    expect(previewMutationBlockedServer(req({ method: "PATCH", cookie: validCookie() }), BROKER)).toBe(true);
    expect(previewMutationBlockedServer(req({ method: "DELETE", cookie: validCookie() }), BROKER)).toBe(true);
  });

  it("(P3.4) blocks a server-action/form POST (same guard, page path)", () => {
    expect(previewMutationBlockedServer(req({ method: "POST", path: "/workspace/new", cookie: validCookie() }), BROKER)).toBe(true);
  });

  it("blocks via the forwarded header too (Vault-direct path)", () => {
    expect(previewMutationBlockedServer(req({ method: "POST", header: validCookie() }), BROKER)).toBe(true);
  });

  it("(P3.8) FAILS CLOSED on a tampered context — cannot bypass by corrupting the token", () => {
    expect(previewMutationBlockedServer(req({ method: "POST", cookie: "garbage.token" }), BROKER)).toBe(true);
    // Wrong-subject token (stolen) also blocks the mutation.
    expect(previewMutationBlockedServer(req({ method: "POST", cookie: signPreviewToken(OTHER, "t")! }), BROKER)).toBe(true);
  });

  it("(P3.7) leaves ordinary (non-preview) requests untouched — agent workflows unaffected", () => {
    expect(previewMutationBlockedServer(req({ method: "POST" }), BROKER)).toBe(false); // no context
    expect(previewMutationBlockedServer(req({ method: "GET", cookie: validCookie() }), BROKER)).toBe(false); // read
  });

  it("exempts the mint/auth routes so entering preview is possible", () => {
    expect(previewMutationBlockedServer(req({ method: "POST", path: "/api/broker/preview-session", cookie: validCookie() }), BROKER)).toBe(false);
    expect(previewMutationBlockedServer(req({ method: "POST", path: "/api/auth/signout", cookie: validCookie() }), BROKER)).toBe(false);
  });

  it("is dark when the flag is off", () => {
    delete process.env[FLAG];
    expect(previewMutationBlockedServer(req({ method: "POST", cookie: validCookie() }), BROKER)).toBe(false);
  });

  it("hasValidPreviewContext reflects a valid, bound token", () => {
    expect(hasValidPreviewContext(req({ cookie: validCookie() }), BROKER)).toBe(true);
    expect(hasValidPreviewContext(req({ cookie: validCookie() }), OTHER)).toBe(false);
    expect(hasValidPreviewContext(req({}), BROKER)).toBe(false);
  });
});
