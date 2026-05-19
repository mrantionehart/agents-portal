// ============================================================================
// Agent Portal — Client Action Center Proxy
// GET  /api/broker/client-intelligence/[id]/actions → action log + templates
// POST /api/broker/client-intelligence/[id]/actions → send action via Vault
//
// This route proxies to Vault's action API — no duplicated backend logic.
// Auth: Extracts user's Supabase access token, forwards as Bearer to Vault.
// ============================================================================

import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const VAULT_API = process.env.NEXT_PUBLIC_VAULT_API_URL || "https://hartfelt-vault.vercel.app/api";

function getSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookies().get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookies().set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookies().delete(name); },
      },
    }
  );
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// ── GET: Action log + templates ─────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getAccessToken();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const res = await fetch(`${VAULT_API}/client-intelligence/${id}/actions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: Send action via Vault ─────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getAccessToken();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    const res = await fetch(`${VAULT_API}/client-intelligence/${id}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
