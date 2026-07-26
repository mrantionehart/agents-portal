// ============================================================================
// AGENT PORTAL — Meetings — server-side session helper (SSR)
// ============================================================================
// Mirrors the inline @supabase/ssr pattern used by the Home/Calendar pages.
// Returns the caller's Supabase session (with access_token) for forwarding to
// the Vault agent-safe endpoints. Read-only cookie access.
// ============================================================================
import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

export async function getPortalSession(): Promise<{ supabase: SupabaseClient; session: Session | null }> {
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
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, session };
}
