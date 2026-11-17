import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/security'
import { forwardToVault } from '@/lib/association/forward'

// Association assessment case action — forwarder to Vault. The portal only
// ever sends an agent's objection; Vault enforces who may take which action.
export const dynamic = 'force-dynamic'
export const POST = withAuth<Promise<{ id: string }>>(async (request: NextRequest, ctx) => {
  const id = ctx.params ? (await ctx.params).id : ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
  return forwardToVault(request, `/association/assessments/${id}`, 'POST')
})
