'use client'

// ============================================================================
// HARTFELT-P8.1A — My Leads
// ============================================================================
// What this replaced: a page calling `vaultAPI.leads.list/create/delete`
// against Vault `/api/leads`, which has never existed and answers 404, with a
// "Convert to Deal" button calling `deals.create`, retired in P7.4C. Every
// control on it failed, and `/leads` is reachable — `NotificationsPanel` links
// to it on `lead_assigned`.
//
// 🔑 WHAT A LEAD IS, IS NOT DECIDED HERE. `/api/vault/leads` forwards to Vault's
// `?assigned=mine`, which runs `classifyLeadQueueRows` — the same predicate as
// the broker's Unassigned queue. 2,704 of this tenant's 2,733 profiles are Deal
// Dispo contacts, bulk-list imports, acquisition datasets or QA records; 8 are
// leads. Restating that rule here would be a second definition that drifts.
//
// 🛑 NO ADD-LEAD FORM. The old page had one, and it posted to the 404. A lead
// arrives through intake, which is what the classifier reads as evidence that a
// person actually arrived; a create button here would be a second intake path
// and a second people store.
//
// 🔑 SEARCH, FILTERS AND PAGING ARE SERVER-SIDE. The old page fetched
// everything and filtered in memory. One agent's set is small today, but
// "small today" is not a pagination strategy.
// ============================================================================

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import { useState, useEffect, useCallback } from 'react'
import {
  Search, Phone, Mail, AlertCircle, Clock, Briefcase, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { authFetch } from '@/lib/supabase'

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? 'https://vault.hartfeltrealestate.com/api'
).replace(/\/$/, '')

const PAGE_SIZE = 25

interface Lead {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  status: string | null
  profile_type: string | null
  temperature: string | null
  source: string | null
  created_at: string | null
  assigned_at: string | null
}

interface FollowUp {
  id: string
  title: string | null
  task_type: string | null
  status: string | null
  due_at: string | null
  completed_at: string | null
}

const ageDays = (iso: string | null) => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

export default function LeadsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [leads, setLeads] = useState<Lead[]>([])
  const [leadCount, setLeadCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [selected, setSelected] = useState<Lead | null>(null)
  const [followUps, setFollowUps] = useState<FollowUp[] | null>(null)
  const [followUpsError, setFollowUpsError] = useState<string | null>(null)

  const [showConvert, setShowConvert] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertResult, setConvertResult] = useState<string | null>(null)
  const [convertForm, setConvertForm] = useState({ property_address: '', type: 'buyer' })

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (appliedSearch.trim() !== '') qs.set('search', appliedSearch.trim())
      if (typeFilter !== '') qs.set('type', typeFilter)
      const res = await authFetch(`/api/vault/leads?${qs.toString()}`)
      if (!res.ok) {
        // 🔒 A failure is not an empty list. "No leads assigned to you" is a
        // statement about the brokerage and the agent would act on it.
        setError(
          res.status === 401
            ? "We couldn't load your leads — your session may have expired. Please refresh."
            : `We couldn't load your leads (Vault returned ${res.status}). Please retry.`,
        )
        setLeads([])
        return
      }
      const body = await res.json()
      setLeads(Array.isArray(body?.data) ? body.data : [])
      setLeadCount(typeof body?.lead_count === 'number' ? body.lead_count : 0)
      setHasMore(Boolean(body?.page?.has_more))
    } catch {
      setError("We couldn't load your leads. Please retry.")
      setLeads([])
    } finally {
      setLeadsLoading(false)
    }
  }, [appliedSearch, typeFilter, offset])

  useEffect(() => {
    if (user) loadLeads()
  }, [user, loadLeads])

  async function openLead(lead: Lead) {
    setSelected(lead)
    setFollowUps(null)
    setFollowUpsError(null)
    setConvertResult(null)
    setConvertError(null)
    setConvertForm({ property_address: '', type: 'buyer' })
    try {
      // Vault's own follow-up endpoint, owner-scoped the same way: an agent
      // sees their own tasks. It carries CORS, so this one is a direct call —
      // the same pattern My Follow-Ups already uses.
      const res = await authFetch(
        `${VAULT_API_URL}/crm/followups?client_profile_id=${encodeURIComponent(lead.id)}&limit=50`,
      )
      if (!res.ok) {
        setFollowUpsError('Follow-up history could not be loaded.')
        return
      }
      const body = await res.json()
      const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
      setFollowUps(rows)
    } catch {
      setFollowUpsError('Follow-up history could not be loaded.')
    }
  }

  async function submitConvert() {
    if (!selected || converting) return // 🔒 one submission per click
    setConverting(true)
    setConvertError(null)
    setConvertResult(null)
    try {
      const res = await authFetch('/api/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: convertForm.type,
          business_line: 'brokerage',
          property_address: convertForm.property_address,
          client_name: selected.full_name ?? '',
          client_email: selected.email ?? '',
          client_phone: selected.phone ?? '',
          client_profile_id: selected.id,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        // 🔑 The ACTUAL response, not a generic failure. A 403
        // CLIENT_PROFILE_NOT_ASSIGNED and a 400 missing-address are different
        // problems and the agent can only act on one of them.
        setConvertError(body?.error || `Could not create the transaction (${res.status}).`)
        return
      }
      setConvertResult(
        'Draft transaction created. It is a draft — the broker reviews it before anything is sent.',
      )
      setShowConvert(false)
    } catch {
      setConvertError('Could not create the transaction. Please retry.')
    } finally {
      setConverting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-text-secondary">Loading…</div>
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">My Leads</h1>
        <p className="text-sm text-text-secondary mt-1">
          Brokerage leads assigned to you. Vault is the source of truth; the broker assigns.
        </p>
      </header>

      {/* Search + filter. Both are applied by the server. */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form
          className="flex-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setOffset(0)
            setAppliedSearch(searchTerm)
          }}
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              aria-label="Search leads"
              placeholder="Search name, email or phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-sm font-medium">
            Search
          </button>
        </form>
        <select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => { setOffset(0); setTypeFilter(e.target.value) }}
          className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary"
        >
          <option value="">All types</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
          <option value="tenant">Tenant</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="mb-5 p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex gap-2 text-sm text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {convertResult && (
        <div role="status" className="mb-5 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
          {convertResult}
        </div>
      )}

      {leadsLoading ? (
        <div className="p-8 text-center text-text-secondary text-sm">Loading your leads…</div>
      ) : leads.length === 0 && !error ? (
        <div className="p-8 text-center border border-border rounded-lg">
          <p className="text-text-primary font-medium">No leads assigned to you</p>
          <p className="text-sm text-text-secondary mt-1">
            {appliedSearch || typeFilter
              ? 'No assigned lead matches this search.'
              : 'When the broker assigns you a lead it appears here.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-secondary mb-2">
            {leadCount} {leadCount === 1 ? 'lead' : 'leads'} assigned to you
          </p>
          <ul className="space-y-2">
            {leads.map((lead) => {
              const age = ageDays(lead.created_at)
              return (
                <li key={lead.id}>
                  <button
                    onClick={() => openLead(lead)}
                    className="w-full text-left p-4 rounded-lg border border-border hover:border-accent transition flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                  >
                    <span className="flex-1 font-medium text-text-primary">
                      {lead.full_name || 'Unnamed lead'}
                    </span>
                    {lead.profile_type && (
                      <span className="text-xs px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
                        {lead.profile_type}
                      </span>
                    )}
                    {lead.status && (
                      <span className="text-xs text-text-secondary">{lead.status}</span>
                    )}
                    {age !== null && (
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <Clock size={12} /> {age}d
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          <nav className="flex items-center justify-between mt-5" aria-label="Pagination">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="px-3 py-2 text-sm rounded-lg border border-border disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs text-text-secondary">
              {offset + 1}–{offset + leads.length} of {leadCount}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasMore}
              className="px-3 py-2 text-sm rounded-lg border border-border disabled:opacity-40 flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </nav>
        </>
      )}

      {/* ── Lead detail ─────────────────────────────────────────────── */}
      {selected && (
        <div className="mt-6 p-4 sm:p-6 rounded-lg border border-border bg-surface">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {selected.full_name || 'Unnamed lead'}
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                {selected.profile_type ?? 'lead'} · {selected.status ?? 'no status'}
                {selected.source ? ` · ${selected.source}` : ''}
              </p>
            </div>
            <button aria-label="Close lead details" onClick={() => setSelected(null)}>
              <X size={18} className="text-text-secondary" />
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-text-secondary" />
              <dt className="sr-only">Phone</dt>
              <dd className="text-text-primary">{selected.phone || 'No phone on file'}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-text-secondary" />
              <dt className="sr-only">Email</dt>
              <dd className="text-text-primary">{selected.email || 'No email on file'}</dd>
            </div>
          </dl>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Follow-up history</h3>
            {followUpsError ? (
              <p className="text-sm text-red-300">{followUpsError}</p>
            ) : followUps === null ? (
              <p className="text-sm text-text-secondary">Loading follow-up history…</p>
            ) : followUps.length === 0 ? (
              <p className="text-sm text-text-secondary">No follow-ups recorded for this lead.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {followUps.map((f) => (
                  <li key={f.id} className="flex flex-wrap gap-2 text-text-secondary">
                    <span className="text-text-primary">{f.title || f.task_type || 'Follow-up'}</span>
                    <span>{f.status ?? ''}</span>
                    {f.due_at && <span>due {new Date(f.due_at).toLocaleDateString()}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => { setShowConvert(true); setConvertError(null) }}
              className="px-4 py-2 rounded-lg bg-accent text-sm font-medium flex items-center gap-2"
            >
              <Briefcase size={14} /> Convert to Transaction
            </button>
          </div>
        </div>
      )}

      {/* ── Convert ─────────────────────────────────────────────────── */}
      {showConvert && selected && (
        <div className="mt-4 p-4 sm:p-6 rounded-lg border border-accent/40 bg-surface">
          <h3 className="text-sm font-semibold text-text-primary">
            Convert {selected.full_name || 'this lead'} to a transaction
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            This creates a <strong>draft</strong>. The broker reviews it; nothing is sent and no
            envelope is generated.
          </p>

          {convertError && (
            <div role="alert" className="mt-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
              {convertError}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-xs text-text-secondary mb-1">Property address</span>
              <input
                aria-label="Property address"
                value={convertForm.property_address}
                onChange={(e) => setConvertForm({ ...convertForm, property_address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-text-secondary mb-1">Transaction type</span>
              <select
                aria-label="Transaction type"
                value={convertForm.type}
                onChange={(e) => setConvertForm({ ...convertForm, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="listing">Listing</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={submitConvert}
              disabled={converting}
              className="px-4 py-2 rounded-lg bg-accent text-sm font-medium disabled:opacity-50"
            >
              {converting ? 'Creating draft…' : 'Create draft transaction'}
            </button>
            <button
              onClick={() => setShowConvert(false)}
              disabled={converting}
              className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
