// ============================================================================
// Agent Portal — Claim a client profile from dispo feed
// POST /api/broker/client-intelligence/[id]/claim
// ============================================================================

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Check the profile is still claimable
    const { data: existing } = await supabase
      .from('client_profiles')
      .select('status, claimed_by')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (existing.status !== 'dispo') {
      return NextResponse.json(
        { error: 'This profile is no longer available for claiming' },
        { status: 409 }
      );
    }

    if (existing.claimed_by) {
      return NextResponse.json(
        { error: 'This profile has already been claimed' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('client_profiles')
      .update({
        claimed_by: user.id,
        claimed_by_name: profile.full_name,
        claimed_at: new Date().toISOString(),
        assigned_agent_id: user.id,
        assigned_agent_name: profile.full_name,
        assigned_at: new Date().toISOString(),
        visibility: 'assigned_agent',
        status: 'claimed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'dispo') // Optimistic lock
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: 'Profile was claimed by another agent' },
        { status: 409 }
      );
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[AgentPortal] Claim error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
