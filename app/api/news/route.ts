// Portal proxy → Vault /api/news
import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";

// Build a fresh NextResponse on every call — module-scope instances
// have their body stream consumed on first return (Sprint 5A lesson).
const tooManyRequests = () =>
  NextResponse.json({ error: "Too many requests" }, { status: 429 });

export async function GET(req: NextRequest) {
  // ---- Rate limit: per-IP soft cap (Sprint 5C: optional) ----
  // 15-min edge cache absorbs the bulk of normal load, so this
  // primarily catches misbehaving scripts and cache-busting probes.
  // Fails open with [security:ratelimit] telemetry on KV outage.
  const ipCheck = await checkRateLimit(
    "news-ip",
    clientIp(req.headers),
    120,
    "1 m"
  );
  if (!ipCheck.ok) return tooManyRequests();
  // ------------------------------------------------------------

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
