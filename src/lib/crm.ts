/**
 * CRM Utility Functions
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Fetch leads with filtering
 */
export async function fetchLeads(filters?: {
  status?: string;
  source?: string;
  temperature?: string;
  agent_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.status) params.append('status', filters.status);
  if (filters?.source) params.append('source', filters.source);
  if (filters?.temperature) params.append('temperature', filters.temperature);
  if (filters?.agent_id) params.append('agent_id', filters.agent_id);
  if (filters?.search) params.append('search', filters.search);
  params.append('page', String(filters?.page || 1));
  params.append('limit', String(filters?.limit || 20));

  const response = await fetch(`/api/broker/leads?${params}`);
  if (!response.ok) throw new Error('Failed to fetch leads');
  return response.json();
}

/**
 * Create a new lead
 */
export async function createLead(data: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  property_type: 'buy' | 'sell' | 'both';
  source: string;
  status?: string;
  notes?: string;
  tags?: string[];
}) {
  const response = await fetch('/api/broker/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to create lead');
  return response.json();
}

/**
 * Update a lead
 */
export async function updateLead(
  leadId: string,
  data: {
    status?: string;
    notes?: string;
    temperature?: string;
    tags?: string[];
  }
) {
  const response = await fetch(`/api/broker/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to update lead');
  return response.json();
}

/**
 * Log an interaction
 */
export async function logInteraction(
  leadId: string,
  data: {
    interaction_type: 'call' | 'email' | 'meeting' | 'text' | 'other';
    duration_minutes?: number;
    notes?: string;
    outcome?: 'positive' | 'neutral' | 'negative';
    next_followup_date?: string;
  }
) {
  const response = await fetch(`/api/broker/leads/${leadId}/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      interaction_date: new Date().toISOString()
    })
  });

  if (!response.ok) throw new Error('Failed to log interaction');
  return response.json();
}

/**
 * Fetch contacts
 */
export async function fetchContacts(filters?: {
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.type) params.append('type', filters.type);
  if (filters?.search) params.append('search', filters.search);
  params.append('page', String(filters?.page || 1));
  params.append('limit', String(filters?.limit || 20));

  const response = await fetch(`/api/broker/contacts?${params}`);
  if (!response.ok) throw new Error('Failed to fetch contacts');
  return response.json();
}

/**
 * Create a contact
 */
export async function createContact(data: {
  type?: 'buyer' | 'seller' | 'other';
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  tags?: string[];
}) {
  const response = await fetch('/api/broker/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to create contact');
  return response.json();
}

/**
 * Fetch pipeline analytics
 */
export async function fetchPipelineAnalytics(agentId?: string) {
  const params = new URLSearchParams({ type: 'pipeline' });
  if (agentId) params.append('agent_id', agentId);

  const response = await fetch(`/api/broker/leads/analytics?${params}`);
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
}

/**
 * Fetch source analytics
 */
export async function fetchSourceAnalytics(source?: string) {
  const params = new URLSearchParams({ type: 'sources' });
  if (source) params.append('source', source);

  const response = await fetch(`/api/broker/leads/analytics?${params}`);
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
}

/**
 * Fetch conversion analytics
 */
export async function fetchConversionAnalytics(
  agentId?: string,
  source?: string
) {
  const params = new URLSearchParams({ type: 'conversion' });
  if (agentId) params.append('agent_id', agentId);
  if (source) params.append('source', source);

  const response = await fetch(`/api/broker/leads/analytics?${params}`);
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
}

/**
 * Format lead score as percentage
 */
export function formatLeadScore(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Get temperature color
 */
export function getTemperatureColor(
  temperature: 'hot' | 'warm' | 'cold'
): string {
  const colors = {
    hot: 'bg-red-100 text-red-800',
    warm: 'bg-yellow-100 text-yellow-800',
    cold: 'bg-blue-100 text-blue-800'
  };
  return colors[temperature];
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  const colors: { [key: string]: string } = {
    closed: 'bg-green-100 text-green-800',
    negotiating: 'bg-purple-100 text-purple-800',
    qualified: 'bg-blue-100 text-blue-800',
    contacted: 'bg-gray-100 text-gray-800',
    new: 'bg-gray-100 text-gray-800',
    lost: 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
}

/**
 * Calculate days since date
 */
export function daysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format phone number
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Export leads to CSV
 */
export function exportLeadsToCSV(
  leads: any[],
  filename: string = 'leads.csv'
): void {
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Status',
    'Temperature',
    'Score',
    'Source'
  ];

  const rows = leads.map((lead) => [
    lead.first_name,
    lead.last_name,
    lead.email || '',
    lead.phone || '',
    lead.status,
    lead.temperature,
    lead.lead_score,
    lead.source
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
