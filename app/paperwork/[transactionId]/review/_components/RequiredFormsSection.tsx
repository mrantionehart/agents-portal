'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import Section from './_shared/Section'
import EmptyState from './_shared/EmptyState'
import StatusBadge from './_shared/StatusBadge'
import {
  LEASE_PACKAGE_PLACEHOLDERS,
  type FormRequirement,
  type FormInstanceRow,
  type TransactionRow,
} from '@/lib/paperworkTypes'

interface Props {
  requirements: FormRequirement[]
  instances: FormInstanceRow[]
  transactionType: TransactionRow['type']
  missingFieldsByForm?: Record<string, Array<{ label: string; severity: string }>>
}

export default function RequiredFormsSection({
  requirements,
  instances,
  transactionType,
  missingFieldsByForm,
}: Props) {
  const isLease = transactionType === 'lease'

  if (requirements.length === 0 && !isLease) {
    return (
      <Section title="Required Forms">
        <EmptyState
          message={`Form rules for ${transactionType ?? 'this'} transactions are coming in a later phase.`}
          hint="The current rule engine emits required forms for lease transactions only."
        />
      </Section>
    )
  }

  if (requirements.length === 0 && isLease) {
    return (
      <Section title="Required Forms">
        <EmptyState
          message="No required forms computed yet for this lease."
          hint="Forms materialize after the first PATCH to terms/facts or a broker recompute."
        />
        <LeasePackagePlaceholders />
      </Section>
    )
  }

  return (
    <Section
      title="Required Forms"
      subtitle={`${requirements.length} form${requirements.length === 1 ? '' : 's'} derived from this transaction.`}
    >
      <div className="space-y-3">
        {requirements.map((req) => {
          const instance = instances.find((i) => i.form_id === req.form_id) ?? null
          const status = instance?.status ?? 'recommended'
          const formMissing = missingFieldsByForm?.[req.form_id] ?? []
          return (
            <FormInstanceCard
              key={req.form_id}
              formId={req.form_id}
              status={status}
              reason={req.reason}
              missingForThisForm={formMissing}
            />
          )
        })}
      </div>
      {isLease && <LeasePackagePlaceholders />}
    </Section>
  )
}

function FormInstanceCard({
  formId,
  status,
  reason,
  missingForThisForm,
}: {
  formId: string
  status: string
  reason: string
  missingForThisForm: Array<{ label: string; severity: string }>
}) {
  const [openReason, setOpenReason] = useState(false)
  const [openMissing, setOpenMissing] = useState(false)
  return (
    <div className="bg-[#0f0f17] rounded-lg border border-[#1a1a2e] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={16} className="text-zinc-500 flex-shrink-0" />
          <div className="text-zinc-100 font-medium truncate">{formId}</div>
        </div>
        <StatusBadge variant={status as never} />
      </div>
      <div className="mt-2 text-zinc-400 text-sm">{reason}</div>
      <div className="mt-2 flex flex-col gap-1 text-xs">
        <button
          onClick={() => setOpenReason((o) => !o)}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300"
        >
          {openReason ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Why required?
        </button>
        {openReason && (
          <div className="text-zinc-400 pl-4 py-1 text-xs">{reason}</div>
        )}
        {missingForThisForm.length > 0 && (
          <>
            <button
              onClick={() => setOpenMissing((o) => !o)}
              className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300"
            >
              {openMissing ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              What's missing? ({missingForThisForm.length})
            </button>
            {openMissing && (
              <ul className="text-zinc-400 pl-5 py-1 list-disc">
                {missingForThisForm.map((m, idx) => (
                  <li key={idx}>
                    {m.label} <span className="text-zinc-500">({m.severity})</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LeasePackagePlaceholders() {
  return (
    <div className="mt-6 border-t border-[#1a1a2e] pt-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-1">
        Lease package (informational)
      </div>
      <div className="text-zinc-500 text-xs mb-3">
        Forms confirmed in HartFelt production lease documents but not yet in
        Vault's rule engine. Surfaced here so the agent knows what's coming.
      </div>
      <div className="space-y-2">
        {LEASE_PACKAGE_PLACEHOLDERS.map((p) => (
          <div
            key={p.form_id}
            className="bg-[#0f0f17] rounded-lg border border-dashed border-[#2a2a3e] p-3 opacity-80"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-zinc-500 flex-shrink-0" />
                <div className="text-zinc-300 font-medium truncate">{p.form_id}</div>
              </div>
              <StatusBadge variant="info" label="Not yet automated" />
            </div>
            <div className="mt-2 text-zinc-400 text-sm">{p.reason}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
