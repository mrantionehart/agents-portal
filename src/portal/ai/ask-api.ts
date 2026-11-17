import { VAULT_API_URL } from '@/lib/vault-client';
import { getAccessToken } from '@/lib/supabase';

export interface AskResponse {
  answer: string | null;
  citations: Array<{ section_key: string; title: string; version: string | number | null; status: string }>;
  party_display?: Array<{ ref: string; role: string; name: string | null }>;
  conversation_id?: string;
  escalation_id?: string;
  disclaimer: string;
  unavailable?: boolean;
}

async function request(path: string, body?: object) {
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in to use Ask HartFelt AI.');
  return fetch(`${VAULT_API_URL.replace(/\/$/, '')}/ai/ask${path}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(35_000),
  });
}

export async function askStatus(): Promise<boolean> {
  const response = await request('/status');
  return response.ok && (await response.json()).enabled === true;
}

export async function askQuestion(question: string, conversation_id?: string): Promise<AskResponse> {
  const response = await request('', { question, ...(conversation_id ? { conversation_id } : {}), surface: 'ap' });
  if (response.status === 503) return { answer: null, citations: [], disclaimer: '', ...await response.json().catch(() => ({})), unavailable: true };
  if (!response.ok) throw new Error('Ask HartFelt AI is unavailable. Please try again or contact the Broker of Record.');
  return response.json();
}

export async function escalateQuestion(question: string, conversation_id?: string): Promise<{ escalation_id: string; disclaimer: string }> {
  const response = await request('/escalate', conversation_id ? { conversation_id } : { question });
  if (!response.ok) throw new Error('Unable to send to the Broker of Record. Please try again.');
  return response.json();
}
