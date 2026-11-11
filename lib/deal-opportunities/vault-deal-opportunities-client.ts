// ============================================================================
// DEAL-DISPO-AGENTS — Deal Opportunities client (Agent Portal side)
// ============================================================================
// The Portal has NO dispo table or engine. Every call reaches Vault's
// agent-capable `/api/dispo/agent-opportunities` routes cross-origin with the
// logged-in agent's Supabase Bearer token (via `authFetch`) — the same bridge
// Developer Opportunities and The Ring use. Vault derives tenant, standing and
// assignment from that token.
//
// 🔒 THIS CLIENT NEVER SENDS a tenant, agent id, deal id, stage or price that
// Vault would trust. The assignment id in the path is looked up by Vault
// THROUGH the caller's own assignments; anything else is a 404.
// ============================================================================
import { authFetch } from '@/lib/supabase'

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  'https://vault.hartfeltrealestate.com/api'
).replace(/\/$/, '')

const BASE = `${VAULT_API_URL}/dispo/agent-opportunities`

export class DealOpportunityApiError extends Error {
  readonly status: number
  readonly code: string | null
  constructor(status: number, code: string | null) {
    super(code ?? `deal_opportunity_api_${status}`)
    this.name = 'DealOpportunityApiError'
    this.status = status
    this.code = code
  }
}

async function request(path: string, init?: RequestInit): Promise<any> {
  const res = await authFetch(`${BASE}${path}`, init)
  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (!res.ok) throw new DealOpportunityApiError(res.status, body?.code ?? body?.error ?? null)
  return body
}

export type DealStage =
  | 'published' | 'viewed' | 'interested' | 'offer_submitted' | 'under_review'
  | 'negotiating' | 'accepted' | 'declined' | 'passed'

export interface DealView {
  dealId: string
  status: string
  askingPriceCents: number | null
  propertyType: string | null
  opportunityTags: string[]
  headline: string | null
  buyerDescription: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  lotSizeSqft: number | null
  units: number | null
  yearBuilt: number | null
  dealTerms: string | null
}

export interface DealOpportunitySummary {
  assignmentId: string
  stage: DealStage
  publishedAt: string
  deal: DealView
  location: { city: string | null; region: string | null; street: string | null }
}

export interface DealEvent {
  id: string
  party: 'agent' | 'broker'
  kind: string
  amountCents: number | null
  message: string | null
  createdAt: string
}

export type DealOpportunityDetail = DealOpportunitySummary & { events: DealEvent[] }
export type DealAction = 'interest' | 'inquiry' | 'offer' | 'pass'

export async function listDealOpportunities(): Promise<DealOpportunitySummary[]> {
  const b = await request('')
  return Array.isArray(b?.opportunities) ? b.opportunities : []
}

export async function getDealOpportunity(assignmentId: string): Promise<DealOpportunityDetail> {
  const b = await request(`/${encodeURIComponent(assignmentId)}`)
  return b.opportunity
}

/** `clientRef` makes a retry or double tap ONE response on Vault's side. */
export async function respondToDeal(
  assignmentId: string,
  input: { action: DealAction; amountCents?: number | null; message?: string | null; clientRef: string },
): Promise<{ kind: 'ok' | 'duplicate'; stage: DealStage }> {
  return request(`/${encodeURIComponent(assignmentId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
