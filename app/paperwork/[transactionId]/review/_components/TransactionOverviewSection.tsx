'use client'

import React from 'react'
import Section from './_shared/Section'
import type { TransactionRow } from '@/lib/paperworkTypes'

interface Props {
  transaction: TransactionRow
}

function formatLocation(t: TransactionRow): string {
  const parts = [t.city, t.state, t.zip].filter((p) => p && p.trim().length > 0) as string[]
  return parts.length === 0 ? '(not set)' : parts.join(', ')
}

function formatMoney(n: number | null): string {
  return n == null ? '—' : `$${n.toLocaleString()}`
}

function formatDate(d: string | null): string {
  return d ? d.slice(0, 10) : '—'
}

export default function TransactionOverviewSection({ transaction }: Props) {
  const t = transaction
  return (
    <Section title="Overview" subtitle="Read-only summary of the transaction.">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-6 text-sm">
        <Row label="Property" value={t.property_address ?? '—'} />
        <Row label="Location" value={formatLocation(t)} />
        <Row label="Type" value={t.type ?? '—'} />
        <Row label="Client" value={t.client_name ?? '—'} />
        <Row label="Email" value={t.client_email ?? '—'} />
        <Row label="Phone" value={t.client_phone ?? '—'} />
        <Row label="Contract $" value={formatMoney(t.contract_price)} />
        <Row label="Earnest $" value={formatMoney(t.earnest_money)} />
        <Row label="Closing" value={formatDate(t.closing_date)} />
        <Row label="Contract date" value={formatDate(t.contract_date)} />
        <Row label="Year built" value={t.year_built != null ? String(t.year_built) : '—'} />
        {t.type === 'lease' && (
          <Row label="Lease term (months)" value={t.lease_term_months != null ? String(t.lease_term_months) : '—'} />
        )}
        <Row label="HOA" value={t.has_hoa == null ? '—' : t.has_hoa ? 'Yes' : 'No'} />
        <Row label="Financing" value={t.financing_type ?? '—'} />
        {t.notes && <Row label="Notes" value={t.notes} fullWidth />}
        {t.deal_intake_session_id && (
          <Row
            label="Source"
            value={
              <span className="text-zinc-400">
                Created via intake (session {t.deal_intake_session_id.slice(0, 8)}…)
              </span>
            }
          />
        )}
      </dl>
    </Section>
  )
}

function Row({ label, value, fullWidth }: { label: string; value: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <dt className="text-zinc-400">{label}</dt>
      <dd className="text-zinc-100">{value}</dd>
    </div>
  )
}
