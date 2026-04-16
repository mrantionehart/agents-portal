import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/broker/email/accounts
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

    if (profile.role !== 'broker' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Only brokers can manage email accounts' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('email_accounts')
      .select('id, email_address, provider, sync_status, last_sync_date, auto_sync_enabled, created_at')
      .eq('broker_id', profile.broker_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ accounts: data });
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email accounts' },
      { status: 500 }
    );
  }
}

// POST /api/broker/email/accounts
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

    if (profile.role !== 'broker' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Only brokers can add email accounts' }, { status: 403 });
    }

    const body = await request.json();
    const {
      email_address,
      provider,
      auth_token,
      refresh_token,
      auto_sync_enabled = true,
      sync_interval_minutes = 15
    } = body;

    if (!email_address || !provider || !auth_token) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('email_accounts')
      .insert([
        {
          broker_id: profile.broker_id,
          email_address,
          provider,
          auth_token,
          refresh_token,
          auto_sync_enabled,
          sync_interval_minutes,
          sync_status: 'idle',
          last_sync_date: null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Trigger initial sync
    await triggerEmailSync(supabase, data.id);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating email account:', error);
    return NextResponse.json(
      { error: 'Failed to create email account' },
      { status: 500 }
    );
  }
}

async function triggerEmailSync(supabase: any, accountId: string) {
  try {
    await supabase
      .from('email_accounts')
      .update({ sync_status: 'syncing' })
      .eq('id', accountId);

    // In production, this would call an external service to sync emails
    // For now, we'll just update the status after a delay
    setTimeout(async () => {
      await supabase
        .from('email_accounts')
        .update({
          sync_status: 'idle',
          last_sync_date: new Date().toISOString()
        })
        .eq('id', accountId);
    }, 1000);
  } catch (error) {
    console.error('Error triggering sync:', error);
  }
}
