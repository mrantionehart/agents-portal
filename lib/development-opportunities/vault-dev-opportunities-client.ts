// ============================================================================
// DEVINTEL-P3I — Developer Opportunities client (Agent Portal side)
// ============================================================================
// The Agent Portal has NO developer-opportunity engine, database or table of
// its own. Every call here reaches the EXISTING, already agent-capable Vault
// APIs cross-origin, using the logged-in agent's Supabase Bearer token (via
// `authFetch`). Vault derives tenant, role, licence standing and assignment
// from that token.
//
// 🔒 SO THIS CLIENT NEVER SENDS tenantId, agentId, stage, assignment or any
// approval decision. Those are Vault's to decide; sending them would be a
// spoof surface. Do not add them.
//
// Same bridge the Ring client uses, which is proven in production — and the
// CORS allow-list already covers this origin for `/api/development-intel/*`
// (measured: preflight 204 with `Authorization` allowed, and the GET echoes
// `access-control-allow-origin: https://agents.hartfeltrealestate.com`).
//
// What the Portal shows is therefore always what Vault says. There is no
// second copy of the rule here to drift from it.
// ============================================================================

import { authFetch } from '@/lib/supabase'

// Same derivation AP-FOLLOWUPS-1 uses — the custom domain, which is the host
// whose CORS allow-list was measured for this origin.
const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  'https://vault.hartfeltrealestate.com/api'
).replace(/\/$/, '')

const BASE = `${VAULT_API_URL}/development-intel/opportunities`

/** A Vault API error. `forbidden` means the agent is authenticated but not
 *  entitled — suspended, unaffiliated, licence unverified or not assigned. */
export class DevOpportunityApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly forbidden: boolean
  readonly notFound: boolean
  constructor(status: number, code: string | null, message?: string) {
    super(message ?? code ?? `dev_opportunity_api_${status}`)
    this.name = 'DevOpportunityApiError'
    this.status = status
    this.code = code
    this.forbidden = status === 403
    this.notFound = status === 404
  }
}

async function parseBody(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

async function request(path: string, init?: RequestInit): Promise<any> {
  const res = await authFetch(`${BASE}${path}`, init)
  const body = await parseBody(res)
  if (!res.ok) {
    throw new DevOpportunityApiError(res.status, body?.code ?? null, body?.error ?? undefined)
  }
  return body
}

// ---------------------------------------------------------------------------
// Shapes — mirrors of what Vault returns. Read-only on this side.
// ---------------------------------------------------------------------------

export type Gate = 'RESEARCH' | 'OUTREACH' | 'PROPOSAL' | 'AGREEMENT'

export interface ApprovalRow {
  id: string; approval_type: Gate; decision: 'approved' | 'rejected'
  decided_by: string; decided_at: string; note: string | null
}
export interface ProjectRow {
  id: string; parcel_id: string | null; project_name: string | null
  addresses: string[] | null; category: string | null; category_basis: string | null
  tenure: string | null; max_total_sqft: number | null; zones: string[] | null
  units: number | null; asset_class: string | null; acreage: number | null
  link: { is_primary: boolean; link_basis: string } | null
}
export interface FilingRow {
  project_id: string; permit_stage: string | null; permit_or_case_id: string | null
  address: string | null; contractor_text: string | null; filing_type: string | null
  application_date: string | null; stage_verified_at: string | null
  applicant_text: string | null; stage_evidence_url: string | null; authority: string | null
}
export interface OwnerRow {
  project_id: string; role: string; identity_verified: boolean
  source_name: string | null; retrieved_at: string | null
  dev_developers: { entity_name: string } | { entity_name: string }[] | null
}
export interface FollowupRow {
  id: string; title: string | null; status: string | null; due_at: string | null; agent_id: string | null
}
export interface OpportunitySummary {
  id: string; opportunity_type: string; stage: string; score: number | null
  assigned_agent_id: string | null; assigned_at: string | null
  research_notes: string | null; created_at?: string | null
}
/** A fact Vault has already classified. The Portal renders the confidence it
 *  is given and never computes one. */
export interface Claim {
  confidence: 'VERIFIED' | 'POSSIBLE' | 'UNKNOWN'
  value: string | null
  note: string | null
  url: string | null
  checked: string[]
}
export interface ChecklistTask {
  id: string; label: string; why: string
  settled: boolean | null
  /** Whether the agent has ticked it. Vault's stored progress, not ours. */
  done: boolean
}
export interface NextAction {
  label: string; because: string
  gate: Gate | null
  brokerOnly: boolean
}
/**
 * Everything Vault has already decided, so the Portal does not decide it again.
 * The five tasks, the progress, the next permitted step and every confidence
 * label are computed by the SAME functions Vault's own screen uses — which is
 * why the two surfaces cannot disagree about what is outstanding or allowed.
 */
export interface DerivedBlock {
  checklist: ChecklistTask[]
  progress: { done: number; total: number }
  nextAction: NextAction
  representation: Claim
  developer: { name: string | null; status: Claim; url: string | null }
  contact: Claim
  inventory: Claim
  sources: Array<{ label: string; url: string }>
  pursuitStrategy: Claim
}

export interface OpportunityDetail {
  derived: DerivedBlock
  opportunity: OpportunitySummary & { evidence_refs: unknown }
  projects: ProjectRow[]
  filings: FilingRow[]
  owners: OwnerRow[]
  approvals: ApprovalRow[]
  followups: FollowupRow[]
  viewer: { isBrokerTier: boolean; userId: string }
}
export interface OpportunityPage {
  opportunities: OpportunitySummary[]
  page: { size: number; count: number; nextCursor: string | null }
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

/**
 * The agent's own assigned relationships, one bounded page at a time.
 *
 * Which rows come back is Vault's decision from the token — this never asks
 * for "the agent's" anything, because asking would imply it could ask for
 * someone else's.
 */
export async function listMyOpportunities(
  opts: { limit?: number; cursor?: string | null } = {},
): Promise<OpportunityPage> {
  const q = new URLSearchParams()
  if (opts.limit) q.set('limit', String(opts.limit))
  if (opts.cursor) q.set('cursor', opts.cursor)
  const qs = q.toString()
  const body = await request(qs ? `?${qs}` : '')
  return {
    opportunities: body?.opportunities ?? [],
    page: body?.page ?? { size: 0, count: 0, nextCursor: null },
  }
}

/** One relationship in full. Vault answers 404 — not a partial view — for
 *  anything this agent does not hold. */
export async function getOpportunity(id: string): Promise<OpportunityDetail> {
  return request(`/${encodeURIComponent(id)}`)
}

/**
 * Save research notes. The only free-text field an agent may write.
 */
export async function saveResearchNotes(id: string, notes: string): Promise<void> {
  await request(`/${encodeURIComponent(id)}/research`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ research_notes: notes }),
  })
}

/**
 * Tick or untick ONE checklist task.
 *
 * Sends only that task. Vault merges it against the row it has just read under
 * a compare-and-swap, so two people working the same relationship cannot
 * overwrite each other — and this client never holds the authoritative copy of
 * the evidence it would need to clobber.
 */
export async function setChecklistTask(id: string, taskId: string, done: boolean): Promise<void> {
  await request(`/${encodeURIComponent(id)}/research`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist: { [taskId]: done } }),
  })
}

// ---------------------------------------------------------------------------
// DEVINTEL-P12A — submitting research, and what the broker said back
// ---------------------------------------------------------------------------
// 🔒 The submission and review logs are APPEND-ONLY TABLES in Vault, with
// UPDATE, DELETE and TRUNCATE revoked and a trigger behind that. There is no
// edit call and no withdraw call here because there is none to make — a change
// of mind is a new revision, which is why `submitResearchForReview` is the
// only write on this side.
//
// 🔒 And no review call. Accepting research or asking for changes is broker
// work, refused for an agent token by `research/reviews` POST. It is absent
// here rather than hidden, the same way the four gates are.

export type ResearchSubmissionState =
  | 'not_submitted' | 'awaiting_review' | 'changes_requested' | 'accepted'

export interface ResearchSubmissionRow {
  id: string
  submitted_at: string
  submitted_by: string
  tasks_done: number
  research_notes: string | null
  evidence_snapshot: unknown
  supersedes_submission_id: string | null
}
export interface ResearchReviewRow {
  id: string
  submission_id: string
  decision: 'accepted' | 'changes_requested'
  note: string | null
  reviewed_by: string
  reviewed_at: string
}
export interface ResearchLog {
  submissions: ResearchSubmissionRow[]
  reviews: ResearchReviewRow[]
  state: ResearchSubmissionState
  latestSubmissionId: string | null
}

/**
 * The submission history and the broker's verdicts.
 *
 * The same endpoint the broker's workspace reads. Vault decides what an agent
 * may see from the token: `not_assignee` for a relationship they do not hold.
 */
export async function getResearchLog(id: string): Promise<ResearchLog> {
  const body = await request(`/${encodeURIComponent(id)}/research/reviews`)
  return {
    submissions: body?.submissions ?? [],
    reviews: body?.reviews ?? [],
    state: body?.state ?? 'not_submitted',
    latestSubmissionId: body?.latestSubmissionId ?? null,
  }
}

/**
 * Submit the research as it currently stands, for a broker to review.
 *
 * 🔑 Sends NO content. Vault snapshots the row's own `research_notes` and
 * `evidence_refs` and counts the ticked tasks itself. If this posted what the
 * screen was holding, an agent could submit findings and evidence that were
 * never saved, and the broker's verdict would point at something no longer in
 * the record — so the body is empty on purpose. Do not add one.
 */
export async function submitResearchForReview(
  id: string,
): Promise<{ submissionId: string; supersedes: string | null }> {
  const body = await request(`/${encodeURIComponent(id)}/research/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return {
    submissionId: body?.submission?.id ?? '',
    supersedes: body?.supersedes ?? null,
  }
}

/**
 * Add ONE source document.
 *
 * 🔒 `addSource`, never `evidence_refs`. Vault merges this record into the
 * array it has just read, under a compare-and-set, and validates the URL —
 * http(s) only, bounded, deduplicated. Sending `evidence_refs` would hand the
 * whole array to a client that does not hold the authoritative copy, and would
 * put the developer attribution and the representation finding within reach of
 * a typed link. Do not change this to `evidence_refs`.
 */
export async function addResearchSource(
  id: string, source: { url: string; label?: string },
): Promise<{ label: string; url: string } | null> {
  const body = await request(`/${encodeURIComponent(id)}/research`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addSource: { url: source.url, label: source.label ?? '' } }),
  })
  return body?.source ?? null
}
