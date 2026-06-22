'use client'

import React from 'react'
import Section from './_shared/Section'
import EmptyState from './_shared/EmptyState'
import InlineEditableField from './_shared/InlineEditableField'
import { Lock } from 'lucide-react'
import {
  STATUTORY_FACT_KEYS,
  isStatutoryFact,
  type TransactionFacts,
  type TransactionFact,
  type TransactionFactState,
  type BrokerReviewStatus,
} from '@/lib/paperworkTypes'

interface Props {
  facts: TransactionFacts
  reviewStatus: BrokerReviewStatus | null
  onPatchFact: (key: string, value: unknown, new_state: TransactionFactState, note?: string) => Promise<void>
}

const NON_EDITABLE_STATES: TransactionFactState[] = ['reviewed', 'attested', 'rejected', 'superseded']
const LOCKED_REVIEW_STATUSES: BrokerReviewStatus[] = ['submitted', 'approved']

function labelize(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function stateBadgeText(state: TransactionFactState) {
  if (state === 'heard') return 'Heard at intake'
  if (state === 'entered') return 'Entered by agent'
  if (state === 'reviewed') return 'Reviewed by broker'
  if (state === 'attested') return 'Attested by party'
  if (state === 'rejected') return 'Rejected'
  if (state === 'superseded') return 'Superseded'
  return state
}

export default function TransactionFactsSection({ facts, reviewStatus, onPatchFact }: Props) {
  const factsLocked = LOCKED_REVIEW_STATUSES.includes(reviewStatus ?? 'draft')
  const entries = Object.entries(facts ?? {})

  // Partition: confirmed (reviewed/attested) | pending (heard/entered) | statutory (always read-only) | other
  const confirmed: Array<[string, TransactionFact]> = []
  const pending: Array<[string, TransactionFact]> = []
  const statutoryEntries: Array<[string, TransactionFact | null]> = []
  const other: Array<[string, TransactionFact]> = []

  for (const k of STATUTORY_FACT_KEYS) {
    statutoryEntries.push([k, (facts ?? {})[k] ?? null])
  }
  for (const [k, f] of entries) {
    if (isStatutoryFact(k)) continue
    if (f.state === 'reviewed' || f.state === 'attested') confirmed.push([k, f])
    else if (f.state === 'heard' || f.state === 'entered') pending.push([k, f])
    else other.push([k, f])
  }

  const totalNonStatutory = confirmed.length + pending.length + other.length

  return (
    <Section title="Facts" subtitle="Captured facts about this transaction.">
      {totalNonStatutory === 0 && (
        <EmptyState
          message="No facts captured yet."
          hint="Facts populate as you fill in terms or as a broker promotes an intake session."
        />
      )}

      {confirmed.length > 0 && (
        <FactGroup
          title="Confirmed"
          subtitle="Reviewed or attested — not editable here."
        >
          {confirmed.map(([k, f]) => (
            <InlineEditableField
              key={k}
              label={`${labelize(k)} (${stateBadgeText(f.state)})`}
              value={f.value}
              editable={false}
              readOnlyHint={`State is '${f.state}' — managed by broker / party.`}
            />
          ))}
        </FactGroup>
      )}

      {pending.length > 0 && (
        <FactGroup title="Pending" subtitle="Agent can confirm or correct these.">
          {pending.map(([k, f]) => (
            <InlineEditableField
              key={k}
              label={`${labelize(k)} (${stateBadgeText(f.state)})`}
              value={f.value}
              editable={!factsLocked}
              readOnlyHint={factsLocked ? 'Review submitted; awaiting broker.' : undefined}
              onSave={(v) => onPatchFact(k, v, 'entered')}
            />
          ))}
        </FactGroup>
      )}

      {other.length > 0 && (
        <FactGroup title="Other states" subtitle="Rejected or superseded facts (historical).">
          {other.map(([k, f]) => (
            <InlineEditableField
              key={k}
              label={`${labelize(k)} (${stateBadgeText(f.state)})`}
              value={f.value}
              editable={false}
              readOnlyHint={`State is '${f.state}' — historical record.`}
            />
          ))}
        </FactGroup>
      )}

      <FactGroup
        title="Statutory disclosures"
        subtitle="Landlord must attest via party portal (PAPERWORK.4)."
      >
        {statutoryEntries.map(([k, f]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2 border-b border-[#1a1a2e] last:border-b-0">
            <div className="text-zinc-400 text-sm w-1/2 break-words flex items-center gap-1.5">
              <Lock size={12} className="text-zinc-600 inline-block" />
              {labelize(k)}
            </div>
            <div className="text-sm text-right">
              {f ? (
                <>
                  <div className="text-zinc-100">{String(f.value)}</div>
                  <div className="text-zinc-500 text-xs italic">{stateBadgeText(f.state)}</div>
                </>
              ) : (
                <div className="text-zinc-500 text-xs italic">Pending landlord attestation</div>
              )}
            </div>
          </div>
        ))}
      </FactGroup>
    </Section>
  )
}

function FactGroup({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="text-xs uppercase tracking-wide text-[#C9A84C] font-semibold mb-1">{title}</div>
      <div className="text-zinc-500 text-xs mb-2">{subtitle}</div>
      <div>{children}</div>
    </div>
  )
}
