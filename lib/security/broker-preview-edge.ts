// ============================================================================
// Broker Preview Mode — the EDGE-SAFE half of the read-only clamp
// ============================================================================
// `middleware.ts` runs on the Edge runtime, which cannot bundle `node:crypto`.
// Importing broker-preview.ts (HMAC sign/verify) from middleware broke every
// Agent Portal production build after #137 ("UnhandledSchemeError: node:crypto").
//
// The clamp's DECISION never needed the signature: any preview context on a
// mutating request is refused — a valid one because preview is read-only, an
// invalid one because the clamp fails CLOSED. So the decision lives here with
// no crypto, and broker-preview.ts re-uses it for the Node path (withAuth),
// which additionally exercises verification. One rule, two runtimes.
// ============================================================================

import type { NextRequest } from "next/server";

export const PREVIEW_COOKIE = "ht_broker_preview";
export const PREVIEW_HEADER = "x-broker-preview";

/** Dark-by-default capability gate (server env). Mirrors the public flag. */
export function brokerPreviewEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_BROKER_PREVIEW_ENABLED === "true" ||
    process.env.BROKER_PREVIEW_ENABLED === "true"
  );
}

/** The raw preview context on a request — cookie (auto-sent on nav + same-site
 *  fetch) OR the forwarded header (authFetch to AP/Vault). */
export function readPreviewContext(request: NextRequest): string | null {
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

/** The preview context that would clamp this request, or null when the request
 *  is untouched (feature off, a read, an exempt path, or no context). */
export function clampingPreviewContext(request: NextRequest): string | null {
  if (!brokerPreviewEnabled()) return null;
  const method = (request.method || "GET").toUpperCase();
  if (!MUTATING.has(method)) return null; // reads always allowed
  if (isExemptPath(request.nextUrl.pathname)) return null;
  return readPreviewContext(request);
}

/** Edge-runtime decision (middleware). Identical outcome to the Node path's
 *  previewMutationBlockedServer: a present context on a mutation ⇒ refuse. */
export function previewMutationBlockedEdge(request: NextRequest): boolean {
  return clampingPreviewContext(request) !== null;
}
