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
  // LEAD-POOL (2026-11-13) · the claim is made by the database, as the
  // caller, through claim_pooled_lead() (Vault mig 20271470000000). Agents no
  // longer hold direct UPDATE on client_profiles: that function is the only
  // write path, it enforces licence + brokerage + audience + first-claim-wins,
  // and it can set only the ownership columns.
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: outcome, error } = await supabase.rpc('claim_pooled_lead', { p_client_profile_id: id });
    if (error) {
      console.error('[AgentPortal] claim_pooled_lead failed:', error.message);
      return NextResponse.json({ error: 'Could not claim the lead' }, { status: 503 });
    }
    if (outcome === 'not_eligible') {
      return NextResponse.json({ error: 'Only active agents with a verified licence can claim leads' }, { status: 403 });
    }
    if (outcome === 'not_found') return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    if (outcome === 'taken') return NextResponse.json({ error: 'Profile was claimed by another agent' }, { status: 409 });
    if (outcome !== 'claimed') return NextResponse.json({ error: 'Could not claim the lead' }, { status: 503 });

    const { data } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[AgentPortal] Claim error:', err);
    return NextResponse.json({ error: 'Could not claim the lead' }, { status: 500 });
  }
}
