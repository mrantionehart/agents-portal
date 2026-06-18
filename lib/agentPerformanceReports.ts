// Agent Performance Reports Service
// Calculates agent metrics for monthly, quarterly, and custom date ranges
// Supports PDF/CSV export and historical caching

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  agentEmail: string;

  // Deal metrics
  totalDeals: number;
  dealsCreated: number;
  dealsClosed: number;
  dealsInProgress: number;
  avgDealValue: number;
  totalContractValue: number;

  // Performance metrics
  closeRate: number; // percentage
  daysToClose: number; // average
  documentUploadRate: number; // docs per deal

  // Commission metrics
  totalCommission: number;
  totalCommissionEarned: number; // agent's share
  totalCommissionPaid: number;
  pendingCommission: number;
  avgCommissionPerDeal: number;

  // Activity
  activityCount: number;
  documentsUploaded: number;
  lastActivityDate: Date | null;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ReportPeriod {
  type: 'monthly' | 'quarterly' | 'ytd' | 'custom';
  startDate: Date;
  endDate: Date;
  label: string;
}

/**
 * Get predefined date ranges
 */
export function getReportPeriods(referenceDate: Date = new Date()): ReportPeriod[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  // Current month
  const currentMonthStart = new Date(year, month, 1);
  const currentMonthEnd = new Date(year, month + 1, 0);

  // Last month
  const lastMonthStart = new Date(year, month - 1, 1);
  const lastMonthEnd = new Date(year, month, 0);

  // Current quarter
  const quarter = Math.floor(month / 3);
  const quarterStart = new Date(year, quarter * 3, 1);
  const quarterEnd = new Date(year, quarter * 3 + 3, 0);

  // Year to date
  const ytdStart = new Date(year, 0, 1);
  const ytdEnd = new Date(year, 11, 31);

  return [
    {
      type: 'monthly',
      startDate: currentMonthStart,
      endDate: currentMonthEnd,
      label: currentMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
    },
    {
      type: 'monthly',
      startDate: lastMonthStart,
      endDate: lastMonthEnd,
      label: lastMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
    },
    {
      type: 'quarterly',
      startDate: quarterStart,
      endDate: quarterEnd,
      label: `Q${quarter + 1} ${year}`,
    },
    {
      type: 'ytd',
      startDate: ytdStart,
      endDate: ytdEnd,
      label: `YTD ${year}`,
    },
  ];
}

/**
 * Calculate agent performance metrics for a date range
 */
export async function calculateAgentMetrics(
  agentId: string,
  dateRange: DateRange
): Promise<AgentMetrics | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get agent profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', agentId)
      .single();

    if (profileError || !profile) {
      console.warn('[AgentMetrics] Profile not found:', agentId);
      return null;
    }

    // Get transactions in date range
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString());

    if (txError) {
      console.warn('[AgentMetrics] Transaction fetch failed:', txError);
      return null;
    }

    // Get commissions
    const { data: commissions } = await supabase
      .from('commissions')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString());

    // Get documents
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('uploaded_by', agentId)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString());

    // Get activity
    const { data: activities } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', agentId)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString());

    // Calculate metrics
    const txList = transactions || [];
    const commissionsList = commissions || [];
    const docList = documents || [];
    const activityList = activities || [];

    const totalDeals = txList.length;
    const dealsClosed = txList.filter(t => t.status === 'closed').length;
    const dealsCreated = txList.filter(t => t.created_at >= dateRange.startDate.toISOString()).length;
    const dealsInProgress = txList.filter(
      t => !['closed', 'archived'].includes(t.status)
    ).length;

    const totalContractValue = txList.reduce(
      (sum, t) => sum + (t.contract_price || 0),
      0
    );

    // Close rate calculation
    let closeRate = 0;
    if (totalDeals > 0) {
      closeRate = (dealsClosed / totalDeals) * 100;
    }

    // Days to close
    let daysToClose = 0;
    const closedDeals = txList.filter(t => t.status === 'closed');
    if (closedDeals.length > 0) {
      const totalDays = closedDeals.reduce((sum, tx) => {
        const created = new Date(tx.created_at);
        const closed = new Date(tx.updated_at || tx.created_at);
        const days = Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return sum + (days > 0 ? days : 0);
      }, 0);
      daysToClose = Math.round(totalDays / closedDeals.length);
    }

    // Commission metrics
    const totalCommission = commissionsList.reduce(
      (sum, c) => sum + (c.gross_commission || 0),
      0
    );

    const totalCommissionEarned = commissionsList.reduce(
      (sum, c) => sum + (c.agent_amount || 0),
      0
    );

    const totalCommissionPaid = commissionsList
      .filter(c => c.paid_at)
      .reduce((sum, c) => sum + (c.agent_amount || 0), 0);

    const pendingCommission = commissionsList
      .filter(c => !c.commission_status || c.commission_status === 'pending')
      .reduce((sum, c) => sum + (c.agent_amount || 0), 0);

    const avgCommissionPerDeal = totalDeals > 0 ? totalCommissionEarned / totalDeals : 0;

    // Document upload rate
    const documentUploadRate = totalDeals > 0 ? docList.length / totalDeals : 0;

    // Last activity
    const lastActivity = activityList.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    return {
      agentId,
      agentName: profile.full_name || 'Unknown',
      agentEmail: profile.email || '',
      totalDeals,
      dealsCreated,
      dealsClosed,
      dealsInProgress,
      avgDealValue: totalDeals > 0 ? totalContractValue / totalDeals : 0,
      totalContractValue,
      closeRate: Math.round(closeRate * 100) / 100,
      daysToClose,
      documentUploadRate: Math.round(documentUploadRate * 100) / 100,
      totalCommission,
      totalCommissionEarned,
      totalCommissionPaid,
      pendingCommission,
      avgCommissionPerDeal: Math.round(avgCommissionPerDeal * 100) / 100,
      activityCount: activityList.length,
      documentsUploaded: docList.length,
      lastActivityDate: lastActivity ? new Date(lastActivity.created_at) : null,
    };
  } catch (error) {
    console.error('[AgentMetrics] Calculation error:', error);
    return null;
  }
}

/**
 * Calculate metrics for all agents in a date range
 */
export async function calculateAllAgentMetrics(
  dateRange: DateRange,
  limit: number = 100
): Promise<AgentMetrics[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all agent profiles
    const { data: agents, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'agent')
      .limit(limit);

    if (error) {
      console.warn('[AgentMetrics] Agent fetch failed:', error);
      return [];
    }

    if (!agents || agents.length === 0) {
      return [];
    }

    // Calculate metrics for each agent
    const metrics: AgentMetrics[] = [];

    for (const agent of agents) {
      const agentMetrics = await calculateAgentMetrics(agent.id, dateRange);
      if (agentMetrics) {
        metrics.push(agentMetrics);
      }
    }

    // Sort by totalContractValue descending
    return metrics.sort((a, b) => b.totalContractValue - a.totalContractValue);
  } catch (error) {
    console.error('[AgentMetrics] Batch calculation error:', error);
    return [];
  }
}

/**
 * Compare agent metrics against team averages
 */
export function compareToTeamAverage(
  agentMetrics: AgentMetrics,
  teamMetrics: AgentMetrics[]
): {
  dealsVsTeam: number; // percentage difference
  commissionVsTeam: number;
  closeRateVsTeam: number;
  ranking: number; // 1 = top performer
  totalAgents: number;
} {
  if (teamMetrics.length === 0) {
    return {
      dealsVsTeam: 0,
      commissionVsTeam: 0,
      closeRateVsTeam: 0,
      ranking: 1,
      totalAgents: 1,
    };
  }

  const avgDeals = teamMetrics.reduce((sum, m) => sum + m.totalDeals, 0) / teamMetrics.length;
  const avgCommission =
    teamMetrics.reduce((sum, m) => sum + m.totalCommissionEarned, 0) / teamMetrics.length;
  const avgCloseRate =
    teamMetrics.reduce((sum, m) => sum + m.closeRate, 0) / teamMetrics.length;

  // Calculate differences
  const dealsVsTeam = avgDeals > 0 ? ((agentMetrics.totalDeals - avgDeals) / avgDeals) * 100 : 0;
  const commissionVsTeam =
    avgCommission > 0 ? ((agentMetrics.totalCommissionEarned - avgCommission) / avgCommission) * 100 : 0;
  const closeRateVsTeam = avgCloseRate > 0 ? agentMetrics.closeRate - avgCloseRate : 0;

  // Calculate ranking
  const sorted = teamMetrics.sort((a, b) => b.totalCommissionEarned - a.totalCommissionEarned);
  const ranking = sorted.findIndex(m => m.agentId === agentMetrics.agentId) + 1;

  return {
    dealsVsTeam: Math.round(dealsVsTeam * 100) / 100,
    commissionVsTeam: Math.round(commissionVsTeam * 100) / 100,
    closeRateVsTeam: Math.round(closeRateVsTeam * 100) / 100,
    ranking,
    totalAgents: teamMetrics.length,
  };
}

/**
 * Format metrics for CSV export
 */
export function formatMetricsForCSV(metrics: AgentMetrics[]): string {
  const headers = [
    'Agent Name',
    'Email',
    'Total Deals',
    'Deals Closed',
    'Close Rate %',
    'Avg Days to Close',
    'Total Contract Value',
    'Avg Deal Value',
    'Total Commission',
    'Commission Earned',
    'Commission Paid',
    'Pending Commission',
    'Documents Uploaded',
    'Last Activity',
  ];

  const rows = metrics.map(m => [
    m.agentName,
    m.agentEmail,
    m.totalDeals,
    m.dealsClosed,
    m.closeRate.toFixed(2),
    m.daysToClose,
    m.totalContractValue.toFixed(2),
    m.avgDealValue.toFixed(2),
    m.totalCommission.toFixed(2),
    m.totalCommissionEarned.toFixed(2),
    m.totalCommissionPaid.toFixed(2),
    m.pendingCommission.toFixed(2),
    m.documentsUploaded,
    m.lastActivityDate?.toLocaleDateString() || 'Never',
  ]);

  // Format CSV
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Format metrics for PDF export (returns object for PDF library)
 */
export function formatMetricsForPDF(
  metrics: AgentMetrics[],
  period: ReportPeriod
): {
  title: string;
  period: string;
  generatedAt: string;
  metrics: AgentMetrics[];
  summary: {
    totalAgents: number;
    totalDeals: number;
    totalCommission: number;
    avgCloseRate: number;
  };
} {
  const totalDeals = metrics.reduce((sum, m) => sum + m.totalDeals, 0);
  const totalCommission = metrics.reduce((sum, m) => sum + m.totalCommissionEarned, 0);
  const avgCloseRate = metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.closeRate, 0) / metrics.length : 0;

  return {
    title: 'Agent Performance Report',
    period: period.label,
    generatedAt: new Date().toLocaleString(),
    metrics,
    summary: {
      totalAgents: metrics.length,
      totalDeals,
      totalCommission,
      avgCloseRate: Math.round(avgCloseRate * 100) / 100,
    },
  };
}
