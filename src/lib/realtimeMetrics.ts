// Real-time Metrics - Supabase Realtime subscriptions for dashboard
// Enables live updates when agents create deals, upload documents, etc.

import { RealtimeChannel } from '@supabase/realtime-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface ActivityMetrics {
  dealsCreatedToday: number;
  documentsUploadedToday: number;
  commissionsPendingApproval: number;
  dealsClosedToday: number;
  activeAgents: Set<string>;
  lastUpdated: Date;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  userEmail: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface RealtimeSubscription {
  metrics: ActivityMetrics;
  activities: ActivityEvent[];
  isConnected: boolean;
  subscribe: (callback: (data: { metrics: ActivityMetrics; activities: ActivityEvent[] }) => void) => void;
  unsubscribe: () => void;
}

/**
 * Create a real-time subscription to activity_log table
 * Tracks metrics and recent activities in real-time
 */
export function createRealtimeMetricsSubscription(): RealtimeSubscription {
  const supabase = createClient(supabaseUrl, supabaseKey);
  let channel: RealtimeChannel | null = null;
  let callbacks: Array<(data: { metrics: ActivityMetrics; activities: ActivityEvent[] }) => void> = [];
  let isConnected = false;

  const metrics: ActivityMetrics = {
    dealsCreatedToday: 0,
    documentsUploadedToday: 0,
    commissionsPendingApproval: 0,
    dealsClosedToday: 0,
    activeAgents: new Set(),
    lastUpdated: new Date(),
  };

  const activities: ActivityEvent[] = [];

  const updateMetrics = () => {
    // Calculate metrics from recent activities
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dealsCreated = 0;
    let docsUploaded = 0;
    let dealsClosed = 0;
    const activeAgentIds = new Set<string>();

    for (const activity of activities) {
      // Count today's activities
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);

      if (activityDate.getTime() === today.getTime()) {
        if (activity.actionType === 'deal_created') dealsCreated++;
        if (activity.actionType === 'document_uploaded') docsUploaded++;
        if (activity.actionType === 'deal_closed') dealsClosed++;
      }

      // Track active agents from last 6 hours
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      if (activity.createdAt > sixHoursAgo) {
        activeAgentIds.add(activity.userId);
      }
    }

    metrics.dealsCreatedToday = dealsCreated;
    metrics.documentsUploadedToday = docsUploaded;
    metrics.dealsClosedToday = dealsClosed;
    metrics.activeAgents = activeAgentIds;
    metrics.lastUpdated = new Date();
  };

  const notifySubscribers = () => {
    callbacks.forEach(callback => {
      callback({ metrics, activities: [...activities] });
    });
  };

  return {
    metrics,
    activities,
    isConnected,

    subscribe(callback) {
      // Add callback
      callbacks.push(callback);

      // Set up realtime subscription if not already connected
      if (!channel) {
        channel = supabase
          .channel('public:activity_log')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'activity_log',
            },
            (payload: any) => {
              const newActivity: ActivityEvent = {
                id: payload.new.id,
                userId: payload.new.user_id,
                userEmail: '', // Will be enriched later
                actionType: payload.new.action_type,
                resourceType: payload.new.resource_type,
                resourceId: payload.new.resource_id,
                description: payload.new.description,
                metadata: payload.new.metadata || {},
                createdAt: new Date(payload.new.created_at),
              };

              // Add to activities (keep most recent 50)
              activities.unshift(newActivity);
              if (activities.length > 50) {
                activities.pop();
              }

              // Update metrics
              updateMetrics();

              // Notify subscribers
              notifySubscribers();
            }
          )
          .subscribe((status) => {
            isConnected = status === 'SUBSCRIBED';
            if (isConnected) {
              console.log('[Realtime Metrics] Connected to activity_log');
            }
          });
      }
    },

    unsubscribe() {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      callbacks = [];
      isConnected = false;
    },
  };
}

/**
 * Fetch initial activities for bootstrap (before realtime kicks in)
 */
export async function fetchInitialActivities(userId: string, limit: number = 50): Promise<ActivityEvent[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // For brokers/admins, fetch all activities
    // For agents, fetch only their activities
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[Realtime Metrics] Initial fetch failed:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      userEmail: '',
      actionType: row.action_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      description: row.description,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('[Realtime Metrics] Fetch error:', error);
    return [];
  }
}

/**
 * Enrich activities with user information
 */
export async function enrichActivitiesWithUsers(
  activities: ActivityEvent[]
): Promise<ActivityEvent[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get unique user IDs
    const userIds = [...new Set(activities.map(a => a.userId))];

    // Fetch user profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (error) {
      console.warn('[Realtime Metrics] Profile enrichment failed:', error);
      return activities;
    }

    // Create email map
    const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);
    const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

    // Enrich activities
    return activities.map(activity => ({
      ...activity,
      userEmail: emailMap.get(activity.userId) || '',
      description: activity.description.includes(activity.userId)
        ? activity.description.replace(activity.userId, nameMap.get(activity.userId) || activity.userId)
        : activity.description,
    }));
  } catch (error) {
    console.error('[Realtime Metrics] Enrichment error:', error);
    return activities;
  }
}

/**
 * Get transaction counts by status (for dashboard cards)
 */
export async function getTransactionMetrics(brokerId?: string): Promise<{
  draftCount: number;
  pendingCount: number;
  reviewCount: number;
  approvedCount: number;
  closedCount: number;
  total: number;
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('transactions')
      .select('status', { count: 'exact', head: true });

    // For now, fetch all (RLS will filter by tenant)
    // In production, add broker_id filter if applicable

    const { count, error } = await query;

    if (error) {
      console.warn('[Realtime Metrics] Transaction count failed:', error);
      return {
        draftCount: 0,
        pendingCount: 0,
        reviewCount: 0,
        approvedCount: 0,
        closedCount: 0,
        total: 0,
      };
    }

    // Fetch actual data for status breakdown
    const { data: transactions } = await supabase
      .from('transactions')
      .select('status')
      .limit(1000);

    const statusCounts = {
      draft: 0,
      submitted: 0,
      pending_review: 0,
      revisions_required: 0,
      approved: 0,
      closed: 0,
      archived: 0,
    };

    transactions?.forEach(t => {
      if (t.status in statusCounts) {
        statusCounts[t.status as keyof typeof statusCounts]++;
      }
    });

    return {
      draftCount: statusCounts.draft,
      pendingCount: statusCounts.submitted + statusCounts.pending_review,
      reviewCount: statusCounts.revisions_required,
      approvedCount: statusCounts.approved,
      closedCount: statusCounts.closed,
      total: count || 0,
    };
  } catch (error) {
    console.error('[Realtime Metrics] Transaction metrics error:', error);
    return {
      draftCount: 0,
      pendingCount: 0,
      reviewCount: 0,
      approvedCount: 0,
      closedCount: 0,
      total: 0,
    };
  }
}

/**
 * Get commission metrics
 */
export async function getCommissionMetrics(): Promise<{
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  totalAmount: number;
  totalPaidAmount: number;
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: commissions, error } = await supabase
      .from('commissions')
      .select('commission_status, gross_commission, agent_amount, paid_at');

    if (error) {
      console.warn('[Realtime Metrics] Commission fetch failed:', error);
      return {
        pendingCount: 0,
        approvedCount: 0,
        paidCount: 0,
        totalAmount: 0,
        totalPaidAmount: 0,
      };
    }

    let pending = 0;
    let approved = 0;
    let paid = 0;
    let totalAmount = 0;
    let totalPaidAmount = 0;

    commissions?.forEach(c => {
      totalAmount += c.gross_commission || 0;

      if (!c.commission_status || c.commission_status === 'pending') {
        pending++;
      } else if (c.commission_status === 'approved' && !c.paid_at) {
        approved++;
      } else if (c.paid_at) {
        paid++;
        totalPaidAmount += c.agent_amount || 0;
      }
    });

    return {
      pendingCount: pending,
      approvedCount: approved,
      paidCount: paid,
      totalAmount,
      totalPaidAmount,
    };
  } catch (error) {
    console.error('[Realtime Metrics] Commission metrics error:', error);
    return {
      pendingCount: 0,
      approvedCount: 0,
      paidCount: 0,
      totalAmount: 0,
      totalPaidAmount: 0,
    };
  }
}
