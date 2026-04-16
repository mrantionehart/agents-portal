import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/broker/referrals/sources
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
      return NextResponse.json({ error: 'Only brokers can access referral sources' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active') === 'true';
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('referral_sources')
      .select('*', { count: 'exact' })
      .eq('broker_id', profile.broker_id);

    if (active !== undefined) {
      query = query.eq('active', active);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
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
    console.error('Error fetching referral sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral sources' },
      { status: 500 }
    );
  }
}

// POST /api/broker/referrals/sources
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
      return NextResponse.json({ error: 'Only brokers can create referral sources' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      type,
      contact_person,
      contact_email,
      contact_phone,
      commission_rate = 0,
      active = true,
      notes
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('referral_sources')
      .insert([
        {
          broker_id: profile.broker_id,
          name,
          type,
          contact_person,
          contact_email,
          contact_phone,
          commission_rate,
          active,
          notes,
          contact_info: {
            email: contact_email,
            phone: contact_phone,
            person: contact_person
          }
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating referral source:', error);
    return NextResponse.json(
      { error: 'Failed to create referral source' },
      { status: 500 }
    );
  }
}
