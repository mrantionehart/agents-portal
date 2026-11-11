// ============================================================================
// Broker Preview Agent View — SERVER-SIDE preview context + mutation guard
// ============================================================================
// The client `authFetch` clamp (PR #136) is defense-in-depth and UX, NOT the
// authority. This module is the server-enforced control: a short-lived,
// broker-bound, HMAC-SIGNED preview context that the server validates on every
// mutation entry point (the withAuth API wrapper AND middleware, which covers
// page routes + server actions). There are NO direct browser→Supabase writes in
// the agent surfaces, so these two seams cover every server-mediated AP mutation.
//
// SECURITY PROPERTIES:
//   • Never grants permission. The token can only DOWNGRADE a request to
//     read-only; it carries no capability. A forged/absent token never escalates.
//   • Never trusts a client flag. The context is a server-signed cookie
//     (httpOnly) / header, minted ONLY by the broker-gated preview-session route.
//     The sessionStorage flag from PR #136 governs only the banner, never authz.
//   • Broker-bound. The signed payload carries the broker id; the guard refuses
//     unless it equals the authenticated caller — a token is useless to anyone
//     else and cannot be replayed across identities.
//   • Fail CLOSED. A preview cookie/header that is PRESENT but invalid (bad
//     signature, expired, wrong subject) BLOCKS the mutation — tampering cannot
//     bypass by corrupting the token.
//   • Cannot be escaped by removing ?preview or editing sessionStorage: the
//     httpOnly cookie persists and the server keeps enforcing until it expires.
//   • Dark by default (brokerPreviewEnabled); with no signing secret set,
//     nothing is ever a valid preview (so the feature is inert until activated).
// ============================================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const PREVIEW_COOKIE = "ht_broker_preview";
export const PREVIEW_HEADER = "x-broker-preview";
/** Short-lived — a preview context is good for one testing sitting. */
export const PREVIEW_TTL_MS = 30 * 60 * 1000;

/** Dark-by-default capability gate (server env). Mirrors the public flag. */
export function brokerPreviewEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_BROKER_PREVIEW_ENABLED === "true" ||
    process.env.BROKER_PREVIEW_ENABLED === "true"
  );
}

function secret(): string | null {
  return process.env.BROKER_PREVIEW_SIGNING_SECRET || null;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

interface PreviewPayload {
  b: string; // broker id (subject) — the token is bound to this user
  t: string; // tenant id
  e: number; // expiry (epoch ms)
}

/** Mint a signed, broker-bound, short-lived preview token. Caller MUST have
 *  already verified the subject is a broker-tier user server-side. Returns null
 *  if no signing secret is configured (feature stays inert). */
export function signPreviewToken(brokerId: string, tenantId: string): string | null {
  const key = secret();
  if (!key) return null;
  const payload: PreviewPayload = { b: brokerId, t: tenantId, e: Date.now() + PREVIEW_TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", key).update(body).digest());
  return `${body}.${sig}`;
}

/** Verify a token and that it is bound to `expectedBrokerId`. Returns the
 *  payload when valid, or null (bad shape / signature / expiry / subject). */
export function verifyPreviewToken(token: string, expectedBrokerId: string): PreviewPayload | null {
  const key = secret();
  if (!key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let expected: Buffer;
  try {
    expected = createHmac("sha256", key).update(body).digest();
  } catch {
    return null;
  }
  let got: Buffer;
  try {
    got = fromB64url(sig);
  } catch {
    return null;
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  let payload: PreviewPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as PreviewPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload.b !== "string" || typeof payload.e !== "number") return null;
  if (payload.e < Date.now()) return null; // expired
  if (payload.b !== expectedBrokerId) return null; // not bound to this caller
  return payload;
}

/** The raw preview context on a request — cookie (auto-sent on nav + same-site
 *  fetch) OR the forwarded header (authFetch to AP/Vault). */
function readPreviewContext(request: NextRequest): string | null {
  const cookie = request.cookies.get(PREVIEW_COOKIE)?.value;
  if (cookie) return cookie;
  const header = request.headers.get(PREVIEW_HEADER);
  return header && header.length > 0 ? header : null;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Paths exempt from the clamp: the preview-session mint route itself (it runs
 *  at entry, possibly before a cookie exists) and the sign-out/clear path. */
function isExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/broker/preview-session") ||
    pathname === "/logout" ||
    pathname.startsWith("/api/auth/")
  );
}

/**
 * THE server-enforced decision. Returns true ⇒ refuse this request (read-only
 * preview). Called from withAuth (API routes) and middleware (pages + server
 * actions). A present-but-invalid context FAILS CLOSED (blocks).
 */
export function previewMutationBlockedServer(request: NextRequest, userId: string): boolean {
  if (!brokerPreviewEnabled()) return false;
  const method = (request.method || "GET").toUpperCase();
  if (!MUTATING.has(method)) return false; // reads always allowed
  if (isExemptPath(request.nextUrl.pathname)) return false;

  const token = readPreviewContext(request);
  if (!token) return false; // no preview context → an ordinary request, untouched

  // A preview context IS present on a mutating request. Whether it validates
  // (legitimate preview → read-only) or not (tampered/expired → FAIL CLOSED),
  // the mutation is refused. `verifyPreviewToken` is still called so the subject
  // binding is exercised, but the decision is the same: block.
  verifyPreviewToken(token, userId);
  return true;
}

/** True when a VALID preview context is present (for banner/telemetry). */
export function hasValidPreviewContext(request: NextRequest, userId: string): boolean {
  if (!brokerPreviewEnabled()) return false;
  const token = readPreviewContext(request);
  return !!token && verifyPreviewToken(token, userId) != null;
}
