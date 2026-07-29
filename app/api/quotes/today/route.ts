// ============================================================================
// From The Hart — GET /api/quotes/today
// ============================================================================
// Read-only. Returns the same quote for everyone for the current day. Requires
// an authenticated session (no extra permissions). Cache-friendly: a short
// shared cache is fine since the value only changes at day boundaries.
// ============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getTodaysQuote } from "@/src/portal/home/quotes/quote-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(_n: string, _v: string, _o: CookieOptions) { /* read-only */ },
        remove(_n: string, _o: CookieOptions) { /* read-only */ },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quote = await getTodaysQuote(supabase);
  return NextResponse.json(quote, {
    headers: {
      // Same for everyone all day; safe to cache briefly and revalidate.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
