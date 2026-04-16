import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/broker/leads/analytics/pipeline
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

    const searchParams = request.nextUrl.searchParams;
    const analyticsType = searchParams.get('type') || 'pipeline';
    const agentId = searchParams.get('agent_id');
    const source = searchParams.get('source');

    if (analyticsType === 'pipeline') {
      return getPipelineAnalytics(supabase, user.id, profile, agentId);
    } else if (analyticsType === 'sources') {
      return getSourceAnalytics(supabase, user.id, profile, source);
    } else if (analyticsType === 'conversion') {
      return getConversionAnalytics(supabase, user.id, profile, agentId, source);
    }

    return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

async function getPipelineAnalytics(supabase: any, userId: string, profile: any, agentId?: string | null) {
  let query = supabase
    .from('leads')
    .select('status, lead_score, temperature, created_at');

  if (profile.role !== 'broker' && !agentId) {
    query = query.eq('agent_id', userId);
  } else if (agentId) {
    query = query.eq('agent_id', agentId);
  } else {
    query = query.eq('broker_id', profile.broker_id);
  }

  query = query.is('deleted_at', null);

  const { data: leads, error } = await query;

  if (error) throw error;

  const byStatus = {
    new: 0,
    contacted: 0,
    qualified: 0,
    negotiating: 0,
    closed: 0,
    lost: 0
  };

  const byTemperature = { hot: 0, warm: 0, cold: 0 };
  let totalScore = 0;

  for (const lead of leads) {
    byStatus[lead.status as keyof typeof byStatus]++;
    if (lead.temperature) {
      byTemperature[lead.temperature as keyof typeof byTemperature]++;
    }
    totalScore += lead.lead_score || 0;
  }

  return NextResponse.json({
    total_leads: leads.length,
    by_status: byStatus,
    by_temperature: byTemperature,
    average_lead_score: leads.length > 0 ? (totalScore / leads.length).toFixed(1) : 0,
    hot_leads: byTemperature.hot,
    warm_leads: byTemperature.warm,
    cold_leads: byTemperature.cold
  });
}

async function getSourceAnalytics(supabase: any, userId: string, profile: any, source?: string | null) {
  let query = supabase
    .from('leads')
    .select('source, status, lead_score');

  if (profile.role !== 'broker') {
    query = query.eq('agent_id', userId);
  } else {
    query = query.eq('broker_id', profile.broker_id);
  }

  if (source) {
    query = query.eq('source', source);
  }

  query = query.is('deleted_at', null);

  const { data: leads, error } = await query;

  if (error) throw error;

  const sourceStats: { [key: string]: any } = {};

  for (const lead of leads) {
    if (!sourceStats[lead.source]) {
      sourceStats[lead.source] = {
        total: 0,
        closed: 0,
        avg_score: 0,
        scoreSum: 0
      };
    }

    sourceStats[lead.source].total++;
    sourceStats[lead.source].scoreSum += lead.lead_score || 0;

    if (lead.status === 'closed') {
      sourceStats[lead.source].closed++;
    }
  }

  // Calculate conversion rates and averages
  const sources = Object.entries(sourceStats).map(([name, stats]: [string, any]) => ({
    source: name,
    total_leads: stats.total,
    closed_deals: stats.closed,
    conversion_rate: ((stats.closed / stats.total) * 100).toFixed(2),
    average_lead_score: (stats.scoreSum / stats.total).toFixed(1)
  }));

  return NextResponse.json({ sources });
}

async function getConversionAnalytics(supabase: any, userId: string, profile: any, agentId?: string | null, source?: string | null) {
  let query = supabase
    .from('leads')
    .select('agent_id, source, status, created_at, updated_at');

  if (profile.role !== 'broker' && !agentId) {
    query = query.eq('agent_id', userId);
  } else if (agentId) {
    query = query.eq('agent_id', agentId);
  } else {
    query = query.eq('broker_id', profile.broker_id);
  }

  if (source) {
    query = query.eq('source', source);
  }

  query = query.is('deleted_at', null);

  const { data: leads, error } = await query;

  if (error) throw error;

  const conversionStats: { [key: string]: any } = {};

  for (const lead of leads) {
    const key = `${lead.agent_id}_${lead.source}`;
    if (!conversionStats[key]) {
      conversionStats[key] = {
        agent_id: lead.agent_id,
        source: lead.source,
        total: 0,
        converted: 0
      };
    }

    conversionStats[key].total++;
    if (lead.status === 'closed') {
      conversionStats[key].converted++;
    }
  }

  const conversions = Object.values(conversionStats).map((stat: any) => ({
    agent_id: stat.agent_id,
    source: stat.source,
    total_leads: stat.total,
    converted_leads: stat.converted,
    conversion_rate: ((stat.converted / stat.total) * 100).toFixed(2)
  }));

  return NextResponse.json({ conversions });
}
