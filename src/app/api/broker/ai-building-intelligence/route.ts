// ============================================================================
// Agent Portal — AI Building Intelligence Proxy
// POST /api/broker/ai-building-intelligence
// Proxies to Vault's /api/ai-building-intelligence
// ============================================================================

import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const VAULT_API =
  process.env.NEXT_PUBLIC_VAULT_API_URL ||
  "https://hartfelt-vault.vercel.app/api";

function getSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookies().set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookies().delete(name);
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    const res = await fetch(`${VAULT_API}/ai-building-intelligence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
