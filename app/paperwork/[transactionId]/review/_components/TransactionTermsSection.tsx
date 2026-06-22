'use client'

import React from 'react'
import Section from './_shared/Section'
import EmptyState from './_shared/EmptyState'
import InlineEditableField from './_shared/InlineEditableField'
import type { TransactionTerms, BrokerReviewStatus, TransactionRow } from '@/lib/paperworkTypes'

interface Props {
  terms: TransactionTerms
  reviewStatus: BrokerReviewStatus | null
  transactionType: TransactionRow['type']
  onPatchTerm: (path: string, value: unknown) => Promise<void>
}

const LOCKED_REVIEW_STATUSES: BrokerReviewStatus[] = ['submitted', 'approved']

// Mirrors a representative subset of Vault's TERMS_PATH_ALLOWLIST. The full
// allowlist lives server-side in src/lib/paperwork/route-helpers.ts and
// changes are enforced there. This client-side mirror only controls which
// rows get a pencil icon — server still rejects disallowed paths with 400.
interface TermPathSpec {
  path: string
  label: string
  inputType: 'text' | 'number' | 'boolean' | 'date'
}

const LEASE_PATHS: TermPathSpec[] = [
  { path: 'lease.term.start_date', label: 'Lease start date', inputType: 'date' },
  { path: 'lease.term.end_date', label: 'Lease end date', inputType: 'date' },
  { path: 'lease.term.term_months', label: 'Term (months)', inputType: 'number' },
  { path: 'lease.rent.monthly_amount', label: 'Monthly rent ($)', inputType: 'number' },
  { path: 'lease.rent.due_day_of_month', label: 'Rent due day', inputType: 'number' },
  { path: 'lease.rent.late_fee_amount', label: 'Late fee ($)', inputType: 'number' },
  { path: 'lease.deposits.security_amount', label: 'Security deposit ($)', inputType: 'number' },
  { path: 'lease.deposits.pet_deposit', label: 'Pet deposit ($)', inputType: 'number' },
  { path: 'lease.pets.allowed', label: 'Pets allowed', inputType: 'boolean' },
]

function getAtPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else return undefined
  }
  return cur
}

export default function TransactionTermsSection({ terms, reviewStatus, transactionType, onPatchTerm }: Props) {
  const termsLocked = LOCKED_REVIEW_STATUSES.includes(reviewStatus ?? 'draft')
  const hasAnyTerms = terms && Object.keys(terms).length > 0

  if (transactionType !== 'lease') {
    return (
      <Section title="Terms">
        <EmptyState
          message={`Terms editing for ${transactionType ?? 'this'} transactions is coming in a later phase.`}
          hint="The current rule engine emits lease-only term paths. PAPERWORK.5+ will add purchase/listing/buyer_rep."
        />
      </Section>
    )
  }

  return (
    <Section title="Terms" subtitle="Editable lease terms. Server enforces allowlist.">
      {!hasAnyTerms && (
        <div className="mb-3 text-zinc-500 text-xs">
          No terms set yet. Fill in below to populate.
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wide text-[#C9A84C] font-semibold mb-2">Lease</div>
        {LEASE_PATHS.map((p) => (
          <InlineEditableField
            key={p.path}
            label={p.label}
            value={getAtPath(terms, p.path)}
            editable={!termsLocked}
            readOnlyHint={termsLocked ? 'Review submitted; awaiting broker.' : undefined}
            inputType={p.inputType}
            onSave={(v) => onPatchTerm(p.path, v)}
          />
        ))}
      </div>
    </Section>
  )
}
