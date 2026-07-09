// ============================================================================
// DEPRECATED — legacy PAPERWORK.3B agent "paperwork review" surface.
// ============================================================================
// This route is orphaned: nothing links to it, and it relied on the legacy
// `@/lib/auth-context` `ProtectedRoute`, whose `AuthProvider` is no longer
// mounted anywhere (Portal 2.0 uses `app/providers.tsx` instead). Rendering it
// therefore threw "useAuth must be used within an AuthProvider" and
// white-screened.
//
// Its replacement is the Portal 2.0 workspace document surface. We permanently
// redirect there. `router.replace` (not push) means the deprecated URL leaves
// no history entry, so browser Back returns to the prior page rather than
// bouncing back into this redirect. The old page + its `_components` /
// `useTransactionReview` hook are no longer imported and drop out of the
// bundle.
// ============================================================================

'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function DeprecatedPaperworkReviewPage() {
  const params = useParams()
  const router = useRouter()
  const transactionId = (params?.transactionId as string) ?? null

  useEffect(() => {
    router.replace(
      transactionId ? `/workspace/${transactionId}?tab=documents` : '/workspace'
    )
  }, [transactionId, router])

  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#71717A]">
      <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
    </div>
  )
}
