'use client'

import React from 'react'
import { AlertCircle, ChevronRight } from 'lucide-react'
import Section from './_shared/Section'
import EmptyState from './_shared/EmptyState'
import StatusBadge from './_shared/StatusBadge'
import type { MissingFieldsReport, MissingFieldsItem, TransactionRow } from '@/lib/paperworkTypes'

interface Props {
  report: MissingFieldsReport | null
  transactionType: TransactionRow['type']
}

const SEVERITY_RANK: Record<string, number> = {
  statutory: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

function sectionForPath(path: string): string {
  if (path.startsWith('terms.')) return 'terms'
  if (path.startsWith('facts.') || path.startsWith('facts_hearsay.')) return 'facts'
  if (path.startsWith('parties.') || path.startsWith('party.')) return 'parties'
  return 'overview'
}

export default function MissingFieldsSection({ report, transactionType }: Props) {
  if (!report || report.items.length === 0) {
    if (transactionType !== 'lease') {
      return (
        <Section title="Missing Fields">
          <EmptyState
            message={`Missing-field analysis for ${transactionType ?? 'this'} transactions is coming in a later phase.`}
            hint="The current rule engine emits required fields for lease transactions only."
          />
        </Section>
      )
    }
    return (
      <Section title="Missing Fields">
        <EmptyState message="No missing fields. ✓" />
      </Section>
    )
  }

  const sorted = [...report.items].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
  )

  return (
    <Section
      title="Missing Fields"
      subtitle={`${report.items.length} item${report.items.length === 1 ? '' : 's'} pending.`}
    >
      <ul className="space-y-2">
        {sorted.map((m, idx) => (
          <MissingFieldRow key={`${m.transaction_path}-${idx}`} item={m} />
        ))}
      </ul>
      <p className="text-zinc-500 text-xs mt-3">
        Sorted: statutory &gt; high &gt; medium &gt; low &gt; info.
      </p>
    </Section>
  )
}

function MissingFieldRow({ item }: { item: MissingFieldsItem }) {
  const isPartySide = item.completer_role !== 'agent' && item.completer_role !== 'broker'
  const isStatutory = item.severity === 'statutory'
  const target = sectionForPath(item.transaction_path)

  return (
    <li className="bg-[#0f0f17] rounded-lg border border-[#1a1a2e] p-3 flex items-start gap-3">
      <AlertCircle
        size={16}
        className={`flex-shrink-0 mt-0.5 ${isStatutory ? 'text-amber-400' : 'text-zinc-500'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-100 text-sm font-medium">{item.label}</span>
          <StatusBadge
            variant={isStatutory ? 'blocked' : 'info'}
            label={isStatutory ? 'statutory' : item.severity}
          />
          {item.completer_role !== 'agent' && (
            <StatusBadge variant="neutral" label={`${item.completer_role} attests`} />
          )}
        </div>
        {item.reason && <div className="text-zinc-400 text-xs mt-1">{item.reason}</div>}
        {item.blocks_forms.length > 0 && (
          <div className="text-zinc-500 text-xs mt-1">
            Blocks: {item.blocks_forms.join(', ')}
          </div>
        )}
      </div>
      {!isStatutory && !isPartySide && (
        <button
          onClick={() => {
            const el = document.getElementById(`section-${target}`)
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className="text-xs text-[#C9A84C] hover:text-amber-300 inline-flex items-center gap-1 self-center"
        >
          Resolve <ChevronRight size={12} />
        </button>
      )}
      {(isStatutory || isPartySide) && (
        <span className="text-xs text-zinc-500 italic self-center">Awaiting party portal</span>
      )}
    </li>
  )
}
