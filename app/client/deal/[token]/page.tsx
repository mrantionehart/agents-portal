// ============================================================================
// /client/deal/[token] — Client-facing Deal Summary (Portal)
// ============================================================================
// Phase 1: token-gated, no login required. The Portal reads the session row
// directly via service role and writes back through Vault's shared endpoint.

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { verifyClientToken, type StructuredDealLite } from '@/lib/dealCopilotToken'
import ConfirmForm from './ConfirmForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ClientDealPage({ params }: PageProps) {
  const { token } = await params
  const verified = verifyClientToken(token)
  if (!verified) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">
              This confirmation link is no longer valid. Please contact your agent
              for an updated link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: session, error } = await admin
    .from('deal_intake_sessions')
    .select('id, status, structured_fields, client_token')
    .eq('id', verified.sessionId)
    .maybeSingle()

  if (error || !session) notFound()
  if (session.client_token !== token) notFound()

  const fields = (session.structured_fields || {}) as StructuredDealLite
  const alreadyConfirmed = session.status === 'client_confirmed'
  const changesRequested = session.status === 'changes_requested'

  const money = (v: number | null | undefined) =>
    v == null ? '—' : `$${Number(v).toLocaleString()}`
  const days = (v: number | null | undefined) =>
    v == null ? '—' : `${v} day${v === 1 ? '' : 's'}`

  const rows: { label: string; value: string }[] = [
    { label: 'Property', value: fields.property_address || '—' },
    { label: 'Offer', value: money(fields.offer_amount) },
    { label: 'Inspection', value: days(fields.inspection_days) },
    {
      label: 'Close',
      value:
        fields.closing_date ||
        (fields.closing_days != null ? days(fields.closing_days) : '—'),
    },
  ]

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-[#D4AF37] mb-1">
            HartFelt
          </div>
          <h1 className="text-2xl font-semibold">Deal Summary</h1>
          <p className="text-sm text-gray-400 mt-1">
            Review the details below and confirm — or request changes.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-3">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex justify-between items-baseline border-b border-[#1a1a2e] last:border-b-0 pb-3 last:pb-0"
              >
                <span className="text-xs uppercase tracking-wide text-gray-400">
                  {r.label}
                </span>
                <span className="text-base text-white text-right ml-3 break-words max-w-[65%]">
                  {r.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-6">
          {alreadyConfirmed ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-300">
              Thanks — you confirmed this deal. Your agent has been notified.
            </div>
          ) : changesRequested ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-300">
              Your change request has been sent to your agent. They will reach out
              with an updated summary.
            </div>
          ) : (
            <ConfirmForm token={token} />
          )}
        </div>
      </div>
    </div>
  )
}
