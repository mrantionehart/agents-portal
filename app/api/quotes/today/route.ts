// ============================================================================
// From The Hart — GET /api/quotes/today
// ============================================================================
// Read-only. Returns the same quote for everyone for the current day. Requires
// an authenticated session (no extra permissions) via the platform's requireAuth
// wrapper. Cache-friendly: the value only changes at day boundaries.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, userClient } from "@/lib/security";
import { getTodaysQuote } from "@/src/portal/home/quotes/quote-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const supabase = userClient(request);
  const quote = await getTodaysQuote(supabase);

  return NextResponse.json(quote, {
    headers: {
      // Same for everyone all day; safe to cache briefly and revalidate.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
