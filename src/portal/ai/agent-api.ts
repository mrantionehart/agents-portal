import { VAULT_API_URL } from '@/lib/vault-client';
import { getAccessToken } from '@/lib/supabase';
import type { AskResponse } from './ask-api';

export interface Procedure { id: string; section_key: string; heading: string; version: string; body: string }
export interface Evidence { ref: string; note: string }
export interface TransactionReport {
  transaction_id: string; summary: string; report_only: true;
  attention_items: Array<{ type: string; severity: string; due_at: string | null; source_record_ref: string; evidence: Evidence[] }>;
  readiness: Array<{ key: string; label: string; status: '✔' | '✖' | 'NOT ASSESSED'; evidence: Evidence[] }>;
}
export interface SupportItem { id: string; question: string; status: string; created_at: string; transaction_id: string | null; resolution: string | null }
export interface SupportDetail { item: SupportItem; messages: Array<{ id: string; body: string; created_at: string }> }

// Same Bearer transport as Ask: identity and tenant are exclusively server-derived.
export async function agentRequest<T>(path: string, body?: object): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not available');
  const response = await fetch(`${VAULT_API_URL.replace(/\/$/, '')}${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error('Not available');
  const data = await response.json();
  if (data.unavailable || data.enabled === false) throw new Error('Not available');
  return data;
}
export const searchProcedures = (q: string) => agentRequest<{ results: Procedure[] | null }>(`/ai/kb/search?q=${encodeURIComponent(q)}`);
export const transactionReport = (id: string) => agentRequest<TransactionReport>(`/ai/tc/transactions/${encodeURIComponent(id)}`);
export const transactionAsk = (id: string, question: string, conversation_id?: string) => agentRequest<AskResponse>(`/ai/tc/transactions/${encodeURIComponent(id)}/ask`, { question, surface: 'ap', ...(conversation_id ? { conversation_id } : {}) });
export async function myRequests() {
  const data = await agentRequest<{ items: SupportItem[] }>('/support/requests');
  if (!Array.isArray(data.items) || data.items.some(item => typeof item.question !== 'string')) throw new Error('Not available');
  return data;
}
export const createRequest = (question: string, transaction_id?: string) => agentRequest<{ id: string }>('/support/requests', { question, ...(transaction_id ? { transaction_id } : {}) });
export const requestDetail = (id: string) => agentRequest<SupportDetail>(`/support/requests/${encodeURIComponent(id)}`);
export const replyToRequest = (id: string, body: string) => agentRequest<{ saved: boolean }>(`/support/requests/${encodeURIComponent(id)}/messages`, { body });
