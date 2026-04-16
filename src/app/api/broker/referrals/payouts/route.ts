import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/broker/referrals/payouts
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get(name: string) { return cookies().get(name)?.value; }, set(name: string, value: string, options: CookieOptions) { cookies().set({ name, value, ...options }); }, remove(name: string, options: CookieOptions) { cookies().delete(name); } } });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('broker_id, role')
      .eq('id', user.id)
      .single();

    if (profile.role !== 'broker') {
      return NextResponse.json({ error: 'Only brokers can access payouts' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const referralSourceId = searchParams.get('referral_source_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('referral_payouts')
      .select('*, referral_sources(name, type)', { count: 'exact' })
      .eq('broker_id', profile.broker_id);

    if (status) {
      query = query.eq('status', status);
    }

    if (referralSourceId) {
      query = query.eq('referral_source_id', referralSourceId);
    }

    const offset = (page - 1) * limit;
    query = query
      .order('period_end', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}

// POST /api/broker/referrals/payouts/approve/:id
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get(name: string) { return cookies().get(name)?.value; }, set(name: string, value: string, options: CookieOptions) { cookies().set({ name, value, ...options }); }, remove(name: string, options: CookieOptions) { cookies().delete(name); } } });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('broker_id, role')
      .eq('id', user.id)
      .single();

    if (profile.role !== 'broker') {
      return NextResponse.json({ error: 'Only brokers can manage payouts' }, { status: 403 });
    }

    const body = await request.json();
    const { payout_id } = body;

    if (!payout_id) {
      return NextResponse.json(
        { error: 'Missing payout_id' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('referral_payouts')
      .update({ status: 'approved' })
      .eq('id', payout_id)
      .eq('broker_id', profile.broker_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error approving payout:', error);
    return NextResponse.json(
      { error: 'Failed to approve payout' },
      { status: 500 }
    );
  }
}
