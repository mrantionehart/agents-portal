import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/broker/referrals/leaderboard
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
      return NextResponse.json({ error: 'Only brokers can access leaderboard' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'monthly';
    const limit = parseInt(searchParams.get('limit') || '25');

    // Check if snapshot exists
    const today = new Date().toISOString().split('T')[0];
    const { data: snapshot, error: snapshotError } = await supabase
      .from('referral_leaderboard_snapshot')
      .select('*')
      .eq('broker_id', profile.broker_id)
      .eq('period', period)
      .eq('snapshot_date', today)
      .order('rank', { ascending: true })
      .limit(limit);

    if (snapshotError) throw snapshotError;

    // If no snapshot exists, generate one
    if (!snapshot || snapshot.length === 0) {
      await generateLeaderboardSnapshot(supabase, profile.broker_id, period);

      // Fetch the newly generated snapshot
      const { data: newSnapshot, error: newError } = await supabase
        .from('referral_leaderboard_snapshot')
        .select('*')
        .eq('broker_id', profile.broker_id)
        .eq('period', period)
        .eq('snapshot_date', today)
        .order('rank', { ascending: true })
        .limit(limit);

      if (newError) throw newError;
      return NextResponse.json({
        period,
        snapshot_date: today,
        leaderboard: newSnapshot || []
      });
    }

    return NextResponse.json({
      period,
      snapshot_date: today,
      leaderboard: snapshot
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

async function generateLeaderboardSnapshot(supabase: any, brokerId: string, period: string) {
  // Call the database function to generate snapshot
  const { error } = await supabase.rpc(
    'generate_referral_leaderboard_snapshot',
    {
      broker_id_param: brokerId,
      period_param: period
    }
  );

  if (error) {
    console.error('Error generating snapshot:', error);
    throw error;
  }
}
