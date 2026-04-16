/**
 * Referral System Utility Functions
 */

/**
 * Fetch referral sources
 */
export async function fetchReferralSources(filters?: {
  active?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.active !== undefined) params.append('active', String(filters.active));
  if (filters?.type) params.append('type', filters.type);
  params.append('page', String(filters?.page || 1));
  params.append('limit', String(filters?.limit || 20));

  const response = await fetch(`/api/broker/referrals/sources?${params}`);
  if (!response.ok) throw new Error('Failed to fetch referral sources');
  return response.json();
}

/**
 * Create referral source
 */
export async function createReferralSource(data: {
  name: string;
  type: 'agent' | 'broker' | 'past_client' | 'other';
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  commission_rate?: number;
  active?: boolean;
  notes?: string;
}) {
  const response = await fetch('/api/broker/referrals/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to create referral source');
  return response.json();
}

/**
 * Fetch referral leaderboard
 */
export async function fetchReferralLeaderboard(filters?: {
  period?: 'monthly' | 'quarterly' | 'yearly';
  limit?: number;
}) {
  const params = new URLSearchParams();

  params.append('period', filters?.period || 'monthly');
  if (filters?.limit) params.append('limit', String(filters.limit));

  const response = await fetch(`/api/broker/referrals/leaderboard?${params}`);
  if (!response.ok) throw new Error('Failed to fetch leaderboard');
  return response.json();
}

/**
 * Fetch referral payouts
 */
export async function fetchReferralPayouts(filters?: {
  status?: 'pending' | 'approved' | 'paid';
  referral_source_id?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.status) params.append('status', filters.status);
  if (filters?.referral_source_id) {
    params.append('referral_source_id', filters.referral_source_id);
  }
  params.append('page', String(filters?.page || 1));
  params.append('limit', String(filters?.limit || 20));

  const response = await fetch(`/api/broker/referrals/payouts?${params}`);
  if (!response.ok) throw new Error('Failed to fetch payouts');
  return response.json();
}

/**
 * Approve referral payout
 */
export async function approveReferralPayout(payoutId: string) {
  const response = await fetch('/api/broker/referrals/payouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payout_id: payoutId })
  });

  if (!response.ok) throw new Error('Failed to approve payout');
  return response.json();
}

/**
 * Calculate referral commission
 */
export function calculateCommission(
  transactionValue: number,
  commissionRate: number
): number {
  return Math.round((transactionValue * commissionRate) / 100 * 100) / 100;
}

/**
 * Format commission as currency
 */
export function formatCommission(commission: number): string {
  return `$${commission.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Get referral type label
 */
export function getReferralTypeLabel(type: string): string {
  const labels: { [key: string]: string } = {
    agent: 'Agent',
    broker: 'Broker',
    past_client: 'Past Client',
    other: 'Other'
  };

  return labels[type] || type;
}

/**
 * Get referral type color
 */
export function getReferralTypeColor(type: string): string {
  const colors: { [key: string]: string } = {
    agent: 'bg-blue-100 text-blue-800',
    broker: 'bg-purple-100 text-purple-800',
    past_client: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800'
  };

  return colors[type] || 'bg-gray-100 text-gray-800';
}

/**
 * Get payout status color
 */
export function getPayoutStatusColor(status: string): string {
  const colors: { [key: string]: string } = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    disputed: 'bg-red-100 text-red-800'
  };

  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get leaderboard rank medal
 */
export function getLeaderboardMedal(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '';
  }
}

/**
 * Calculate payout period
 */
export function calculatePayoutPeriod(
  period: 'monthly' | 'quarterly' | 'yearly'
): { start: Date; end: Date } {
  const today = new Date();
  let start, end;

  if (period === 'monthly') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (period === 'quarterly') {
    const quarter = Math.floor(today.getMonth() / 3);
    start = new Date(today.getFullYear(), quarter * 3, 1);
    end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
  } else {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear(), 11, 31);
  }

  return { start, end };
}

/**
 * Format payout period as string
 */
export function formatPayoutPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleString('en-US', { month: 'short' });
  const endMonth = end.toLocaleString('en-US', { month: 'short' });

  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${startMonth} ${start.getFullYear()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${startMonth} ${start.getFullYear()} - ${endMonth} ${end.getFullYear()}`;
}

/**
 * Calculate commission percentage from rate
 */
export function calculateCommissionPercentage(
  commission: number,
  transactionValue: number
): number {
  if (transactionValue === 0) return 0;
  return (commission / transactionValue) * 100;
}

/**
 * Validate commission rate
 */
export function isValidCommissionRate(rate: number): boolean {
  return rate >= 0 && rate <= 100;
}

/**
 * Format commission rate for display
 */
export function formatCommissionRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/**
 * Get average commission
 */
export function getAverageCommission(
  totalCommission: number,
  referralCount: number
): number {
  if (referralCount === 0) return 0;
  return Math.round((totalCommission / referralCount) * 100) / 100;
}

/**
 * Export referral data to CSV
 */
export function exportReferralsToCSV(
  referrals: any[],
  filename: string = 'referrals.csv'
): void {
  const headers = [
    'Source Name',
    'Type',
    'Commission Rate',
    'Total Referrals',
    'Total Commission',
    'Active',
    'Contact Email'
  ];

  const rows = referrals.map((ref) => [
    ref.name,
    ref.type,
    `${ref.commission_rate}%`,
    ref.referrals_count || 0,
    `$${(ref.commission_earned || 0).toFixed(2)}`,
    ref.active ? 'Yes' : 'No',
    ref.contact_email || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) =>
          typeof cell === 'string' && cell.includes(',')
            ? `"${cell}"`
            : cell
        )
        .join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}
