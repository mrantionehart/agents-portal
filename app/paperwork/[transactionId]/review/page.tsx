'use client'

export const dynamic = 'force-dynamic'

import React, { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useTransactionReview } from '@/lib/hooks/useTransactionReview'
import TransactionHeader from './_components/TransactionHeader'
import TransactionOverviewSection from './_components/TransactionOverviewSection'
import TransactionPartiesSection from './_components/TransactionPartiesSection'
import TransactionFactsSection from './_components/TransactionFactsSection'
import TransactionTermsSection from './_components/TransactionTermsSection'
import RequiredFormsSection from './_components/RequiredFormsSection'
import MissingFieldsSection from './_components/MissingFieldsSection'
import ReviewStatusSection from './_components/ReviewStatusSection'
import ErrorBanner from './_components/_shared/ErrorBanner'
import EmptyState from './_components/_shared/EmptyState'

export default function PaperworkReviewPage() {
  const params = useParams()
  const router = useRouter()
  const transactionId = (params?.transactionId as string) ?? null

  const {
    transaction,
    parties,
    requirements,
    instances,
    missingFields,
    isLoading,
    status,
    errors,
    notFound,
    unauthorized,
    patchError,
    isSubmitting,
    refetchSection,
    patchFact,
    patchTerm,
    submitForReview,
  } = useTransactionReview(transactionId)

  // Auth redirect — out of effect to avoid render loop.
  React.useEffect(() => {
    if (unauthorized) router.push('/login')
  }, [unauthorized, router])

  // Build missing-fields-by-form map for the RequiredFormsSection per-card "what's missing".
  const missingByForm = useMemo(() => {
    const m: Record<string, Array<{ label: string; severity: string }>> = {}
    for (const item of missingFields?.items ?? []) {
      for (const formId of item.blocks_forms ?? []) {
        if (!m[formId]) m[formId] = []
        m[formId].push({ label: item.label, severity: item.severity })
      }
    }
    return m
  }, [missingFields])

  if (notFound) {
    return (
      <ProtectedRoute>
        <div className="container max-w-4xl py-8">
          <EmptyState
            message="Transaction not found."
            hint="The transaction may have been deleted or you may not have access."
          />
          <div className="text-center mt-4">
            <button
              onClick={() => router.push('/transactions')}
              className="text-sm text-[#C9A84C] hover:text-amber-300"
            >
              ← Back to transactions
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (isLoading && !transaction) {
    return (
      <ProtectedRoute>
        <div className="container max-w-4xl py-8 flex flex-col items-center text-zinc-400">
          <Loader2 className="animate-spin mb-3" size={28} />
          <div>Loading paperwork review…</div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!transaction) {
    // After load, transaction still null + not isLoading → all 3 fetches failed.
    return (
      <ProtectedRoute>
        <div className="container max-w-4xl py-8">
          <ErrorBanner
            message={errors.transaction ?? 'Failed to load transaction.'}
            onRetry={() => refetchSection('transaction')}
          />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container max-w-4xl py-8">
        <TransactionHeader
          transaction={transaction}
          missingFields={missingFields}
          requiredFormCount={requirements.length}
        />

        {/* Per-section errors render inline so a single failure doesn't blank everything. */}
        {errors.transaction && (
          <div className="mb-3">
            <ErrorBanner
              message={`Transaction: ${errors.transaction}`}
              onRetry={() => refetchSection('transaction')}
            />
          </div>
        )}

        <div id="section-overview">
          <TransactionOverviewSection transaction={transaction} />
        </div>

        <div id="section-parties">
          <TransactionPartiesSection parties={parties} />
        </div>

        <div id="section-facts">
          <TransactionFactsSection
            facts={transaction.facts ?? {}}
            reviewStatus={transaction.broker_review_status}
            onPatchFact={patchFact}
          />
        </div>

        <div id="section-terms">
          <TransactionTermsSection
            terms={transaction.terms ?? {}}
            reviewStatus={transaction.broker_review_status}
            transactionType={transaction.type}
            onPatchTerm={patchTerm}
          />
        </div>

        {errors.forms && (
          <div className="mb-3">
            <ErrorBanner
              message={`Forms: ${errors.forms}`}
              onRetry={() => refetchSection('forms')}
            />
          </div>
        )}
        <RequiredFormsSection
          requirements={requirements}
          instances={instances}
          transactionType={transaction.type}
          missingFieldsByForm={missingByForm}
        />

        {errors.missingFields && (
          <div className="mb-3">
            <ErrorBanner
              message={`Missing fields: ${errors.missingFields}`}
              onRetry={() => refetchSection('missingFields')}
            />
          </div>
        )}
        <MissingFieldsSection report={missingFields} transactionType={transaction.type} />

        <ReviewStatusSection
          transaction={transaction}
          isSubmitting={isSubmitting}
          patchError={patchError}
          onSubmit={submitForReview}
        />
      </div>
    </ProtectedRoute>
  )
}
