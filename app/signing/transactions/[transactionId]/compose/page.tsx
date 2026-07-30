// ============================================================================
// Slice 2 Phase 3B-4 · Composer route (server-gated by AP_SIGNING_COMPOSER_ENABLED)
// ============================================================================
// Server-side render. When the flag is OFF, this route renders the exact
// same "Unavailable" UX as any other unavailable AP page — do NOT reveal
// the composer surface exists, do NOT return a technical explanation.
// Vault-side auth / cross-tenant / ownership gates remain the ultimate
// enforcement layer for the compose-preview + V2 submit endpoints. This
// server gate exists to prevent a signed-in user from reaching the client
// UI (and any incidental fetches) while the flag is OFF.
// ============================================================================

import Link from 'next/link'
import { use } from 'react'

import { isSigningComposerEnabled } from '@/lib/signing/composer-flag'
import { ComposerShell } from './ComposerShell'

interface PageProps {
  readonly params: Promise<{ transactionId: string }>
  readonly searchParams: Promise<{ readonly previous_package_id?: string }>
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export default function ComposerPage({ params, searchParams }: PageProps) {
  const { transactionId } = use(params)
  const search = use(searchParams)

  // Server-side flag gate. When OFF, render the standard unavailable UX.
  if (!isSigningComposerEnabled()) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0 }}>Page unavailable</h1>
        <p style={{ marginTop: 12 }}>
          This page is not available right now.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/transactions">Back to transactions</Link>
        </p>
      </main>
    )
  }

  // Invalid transactionId path segment → same unavailable UX.
  if (!UUID_RE.test(transactionId)) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0 }}>Page unavailable</h1>
        <p style={{ marginTop: 12 }}>
          This page is not available right now.
        </p>
      </main>
    )
  }

  // Validate previous_package_id if provided (revision entry).
  const previousPackageId =
    typeof search.previous_package_id === 'string' && UUID_RE.test(search.previous_package_id)
      ? search.previous_package_id
      : undefined

  return (
    <ComposerShell
      transactionId={transactionId}
      previousPackageId={previousPackageId}
    />
  )
}
