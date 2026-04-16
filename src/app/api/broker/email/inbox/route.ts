import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/broker/email/inbox
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get(name: string) { return cookies().get(name)?.value; }, set(name: string, value: string, options: CookieOptions) { cookies().set({ name, value, ...options }); }, remove(name: string, options: CookieOptions) { cookies().delete(name); } } });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('broker_id')
      .eq('id', user.id)
      .single();

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('account_id');
    const unreadOnly = searchParams.get('unread') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    let query = supabase
      .from('email_messages')
      .select(
        'id, message_id, from_email, to_email, subject, received_date, read, archived, thread_id, transaction_id, lead_id, email_accounts(email_address)',
        { count: 'exact' }
      )
      .eq('direction', 'inbound')
      .eq('email_accounts.broker_id', profile.broker_id);

    if (accountId) {
      query = query.eq('email_account_id', accountId);
    }

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    query = query.eq('archived', false);

    const offset = (page - 1) * limit;
    query = query
      .order('received_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // Group by thread
    const threads: { [key: string]: any[] } = {};

    for (const message of data) {
      const threadId = message.thread_id || message.id;
      if (!threads[threadId]) {
        threads[threadId] = [];
      }
      threads[threadId].push(message);
    }

    return NextResponse.json({
      threads: Object.values(threads),
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching inbox:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox' },
      { status: 500 }
    );
  }
}
