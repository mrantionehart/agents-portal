/**
 * Referral System Type Definitions
 */

export interface ReferralSource {
  id: string;
  broker_id: string;
  name: string;
  type: 'agent' | 'broker' | 'past_client' | 'other';
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_info?: Record<string, any>;
  commission_rate: number;
  active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReferralRelationship {
  id: string;
  broker_id: string;
  transaction_id: string;
  referral_source_id: string;
  agent_id?: string;
  referral_commission: number;
  commission_percentage: number;
  status: 'pending' | 'approved' | 'paid' | 'disputed';
  paid_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ReferralPayout {
  id: string;
  broker_id: string;
  referral_source_id: string;
  period_start: string;
  period_end: string;
  total_referrals: number;
  total_commission: number;
  status: 'pending' | 'approved' | 'paid';
  paid_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReferralLeaderboardEntry {
  id: string;
  broker_id: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  snapshot_date: string;
  rank: number;
  referral_source_id: string;
  name: string;
  commission_earned: number;
  referrals_count: number;
  created_at: string;
}

export interface ReferralLeaderboardSnapshot {
  period: string;
  snapshot_date: string;
  leaderboard: ReferralLeaderboardEntry[];
}

export interface ReferralAnalytics {
  total_referrals: number;
  total_commission: number;
  average_commission_per_referral: number;
  top_sources: ReferralLeaderboardEntry[];
  commission_by_period: Array<{
    period: string;
    commission: number;
    referral_count: number;
  }>;
}

export interface CreateReferralSourceRequest {
  name: string;
  type: 'agent' | 'broker' | 'past_client' | 'other';
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  commission_rate?: number;
  active?: boolean;
  notes?: string;
}

export interface UpdateReferralSourceRequest {
  name?: string;
  type?: 'agent' | 'broker' | 'past_client' | 'other';
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  commission_rate?: number;
  active?: boolean;
  notes?: string;
}

export interface LinkReferralSourceRequest {
  transaction_id: string;
  referral_source_id: string;
  commission_percentage?: number;
}

export interface ApprovePayoutRequest {
  payout_id: string;
}

export interface ReferralSourceResponse {
  data: ReferralSource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ReferralPayoutResponse {
  data: ReferralPayout[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
