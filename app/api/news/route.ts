// Portal proxy → Vault /api/news
import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";
import { clientIp, withRateLimit } from "@/lib/security";

// Intentionally-public endpoint — surfaces curated news to all signed-in
// and signed-out portal viewers via a Vault proxy. Soft rate-limit below
// is a backstop for misbehaving scripts; the 15-min edge cache absorbs
// the bulk of normal load. Sprint 5D marker: declares CI-enforced public.
export const PUBLIC_ROUTE = true;

// Sprint 5D: rate limit moved from inline checkRateLimit() to the
// withRateLimit() HOF. Same 120 req/min/IP semantics; fail-open on KV
// outage with [security:ratelimit] log; standardized 429 body.
export const GET = withRateLimit(
  {
    name: "news-ip",
    identifier: (req) => clientIp(req.headers),
    limit: 120,
    window: "1 m",
  },
  async (req: NextRequest) => {
    const limit = req.nextUrl.searchParams.get("limit") || "20";
    try {
      const res = await fetch(`${VAULT_API_URL}/news?limit=${limit}`, {
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 900 }, // cache 15 min at edge
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ articles: [], count: 0 }, { status: 502 });
    }
  }
);
