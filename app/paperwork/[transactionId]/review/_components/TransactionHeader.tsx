'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import StatusBadge from './_shared/StatusBadge'
import type { TransactionRow, MissingFieldsReport } from '@/lib/paperworkTypes'

interface Props {
  transaction: TransactionRow
  missingFields: MissingFieldsReport | null
  requiredFormCount: number
}

export default function TransactionHeader({ transaction, missingFields, requiredFormCount }: Props) {
  const router = useRouter()
  const reviewStatus = transaction.broker_review_status ?? 'draft'
  const statutoryCount = missingFields?.statutory_count ?? 0
  const totalMissing = missingFields?.items.length ?? 0

  return (
    <header className="mb-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4 text-sm"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-semibold text-zinc-100">
        {transaction.property_address || '(no address)'}
      </h1>
      <div className="text-zinc-400 text-sm mt-1">
        {transaction.type ?? 'transaction'}
        {transaction.client_name ? ` · ${transaction.client_name}` : ''}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <StatusBadge variant={reviewStatus} />
        {statutoryCount > 0 && (
          <StatusBadge
            variant="blocked"
            label={`${statutoryCount} statutory pending`}
          />
        )}
        {totalMissing > 0 && (
          <StatusBadge
            variant="info"
            label={`${totalMissing} missing field${totalMissing === 1 ? '' : 's'}`}
          />
        )}
        {requiredFormCount > 0 && (
          <StatusBadge
            variant="info"
            label={`${requiredFormCount} form${requiredFormCount === 1 ? '' : 's'} required`}
          />
        )}
      </div>
    </header>
  )
}
