'use client'

import React from 'react'
import { UserCircle } from 'lucide-react'
import Section from './_shared/Section'
import EmptyState from './_shared/EmptyState'
import type { TransactionPartyRow } from '@/lib/paperworkTypes'

interface Props {
  parties: TransactionPartyRow[]
}

export default function TransactionPartiesSection({ parties }: Props) {
  if (parties.length === 0) {
    return (
      <Section title="Parties">
        <EmptyState
          message="No parties on this transaction yet."
          hint="Parties are added when a broker promotes an intake session."
          icon={<UserCircle size={28} className="opacity-50" />}
        />
      </Section>
    )
  }

  return (
    <Section title="Parties" subtitle={`${parties.length} part${parties.length === 1 ? 'y' : 'ies'} on file.`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {parties.map((p) => (
          <div
            key={p.id}
            className="bg-[#0f0f17] rounded-lg border border-[#1a1a2e] p-3"
          >
            <div className="text-xs uppercase tracking-wide text-[#C9A84C] font-semibold mb-1">
              {p.role}
            </div>
            <div className="text-zinc-100 font-medium">{p.name || '(no name)'}</div>
            <div className="text-zinc-400 text-sm mt-1">
              {p.email ? `✉ ${p.email}` : '✉ —'}
              {'  '}·{'  '}
              {p.phone ? `☎ ${p.phone}` : '☎ —'}
            </div>
            <div className="text-zinc-500 text-xs mt-2">
              Signature: {p.signature_required ? 'required' : 'not required'}
              {p.signed_at ? ` · signed ${p.signed_at.slice(0, 10)}` : ''}
            </div>
          </div>
        ))}
      </div>
      <p className="text-zinc-500 text-xs mt-3">
        Editing parties is coming in a later phase.
      </p>
    </Section>
  )
}
