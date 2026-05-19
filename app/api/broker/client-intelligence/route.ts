// ============================================================================
// Agent Portal — Client Intelligence API
// GET /api/broker/client-intelligence → list profiles (role-filtered)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get('tab'); // "dispo" | "mine" | "all"
    const search = searchParams.get('search');

    const isBroker = ['broker', 'admin', 'office_manager'].includes(profile.role);

    let query = supabase
      .from('client_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (tab === 'dispo') {
      // Dispo feed — available for claiming
      query = query.eq('status', 'dispo').eq('visibility', 'dispo_feed');
    } else if (tab === 'mine') {
      // My profiles — assigned or claimed by this agent
      query = query.or(`assigned_agent_id.eq.${user.id},claimed_by.eq.${user.id}`);
    } else if (isBroker) {
      // Brokers see all
      query = query.not('status', 'eq', 'lost');
    } else {
      // Agents: assigned, claimed, or dispo
      query = query.or(
        `assigned_agent_id.eq.${user.id},claimed_by.eq.${user.id},and(visibility.eq.dispo_feed,status.eq.dispo)`
      );
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Strip broker_notes for non-broker roles
    const cleaned = isBroker
      ? data
      : (data || []).map((p: any) => ({ ...p, broker_notes: null }));

    return NextResponse.json({ data: cleaned || [] });
  } catch (err: any) {
    console.error('[AgentPortal] Client Intelligence GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
