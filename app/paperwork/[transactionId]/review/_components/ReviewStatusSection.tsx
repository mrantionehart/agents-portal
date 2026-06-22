'use client'

import React from 'react'
import { Send } from 'lucide-react'
import Section from './_shared/Section'
import StatusBadge from './_shared/StatusBadge'
import type { TransactionRow } from '@/lib/paperworkTypes'

interface Props {
  transaction: TransactionRow
  isSubmitting: boolean
  patchError: string | null
  onSubmit: () => Promise<void>
}

export default function ReviewStatusSection({ transaction, isSubmitting, patchError, onSubmit }: Props) {
  const status = transaction.broker_review_status ?? 'draft'
  const canSubmit = status === 'draft' || status === 'revisions_required'

  const handleSubmit = async () => {
    const confirmed = window.confirm(
      "Submit for broker review? You won't be able to edit until the broker responds."
    )
    if (!confirmed) return
    try {
      await onSubmit()
    } catch {
      // Error rendered via patchError prop.
    }
  }

  return (
    <Section title="Review Status">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-6 text-sm">
        <div>
          <div className="text-zinc-400">Current</div>
          <div><StatusBadge variant={status} /></div>
        </div>
        <div>
          <div className="text-zinc-400">Submitted at</div>
          <div className="text-zinc-100">
            {transaction.submitted_for_review_at?.slice(0, 19).replace('T', ' ') ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-zinc-400">Reviewed at</div>
          <div className="text-zinc-100">
            {transaction.reviewed_at?.slice(0, 19).replace('T', ' ') ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-zinc-400">Reviewed by</div>
          <div className="text-zinc-100">{transaction.reviewed_by_id ? transaction.reviewed_by_id.slice(0, 8) + '…' : '—'}</div>
        </div>
      </div>

      {status === 'revisions_required' && transaction.revision_notes && (
        <div className="mt-3 bg-amber-500/10 border border-amber-500/40 text-amber-200 rounded-md p-3 text-sm">
          <div className="font-semibold mb-1">Revisions required</div>
          <div className="whitespace-pre-line">{transaction.revision_notes}</div>
        </div>
      )}

      {patchError && (
        <div className="mt-3 bg-red-500/10 border border-red-500/40 text-red-200 rounded-md p-2 text-sm">
          {patchError}
        </div>
      )}

      {canSubmit ? (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="mt-4 inline-flex items-center gap-2 bg-[#C9A84C] hover:bg-amber-500 disabled:opacity-50 text-zinc-900 font-medium px-4 py-2 rounded-md text-sm"
        >
          <Send size={14} />
          {isSubmitting
            ? 'Submitting…'
            : status === 'revisions_required'
            ? 'Re-submit for broker review'
            : 'Submit for broker review'}
        </button>
      ) : (
        <div className="mt-4 text-zinc-500 text-xs italic">
          {status === 'submitted'
            ? 'Awaiting broker review.'
            : status === 'approved'
            ? 'This transaction has been approved.'
            : 'Submit unavailable.'}
        </div>
      )}
    </Section>
  )
}
