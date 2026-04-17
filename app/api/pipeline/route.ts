import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return null
      return data.user
    } catch { return null }
  }
  try {
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { stubResponse.cookies.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { stubResponse.cookies.delete(name) },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch { return null }
}

// Pipeline stages mapped to transaction statuses
const STAGE_MAP: Record<string, { label: string; statuses: string[]; probability: number }> = {
  cultivate:       { label: 'Cultivate',       statuses: ['draft'],                          probability: 0.10 },
  appointment:     { label: 'Appointment',     statuses: ['submitted'],                      probability: 0.25 },
  active:          { label: 'Active',          statuses: ['pending_review', 'revisions_required'], probability: 0.50 },
  under_contract:  { label: 'Under Contract',  statuses: ['approved'],                       probability: 0.80 },
  closed:          { label: 'Closed',          statuses: ['closed'],                         probability: 1.00 },
}

const STAGE_ORDER = ['cultivate', 'appointment', 'active', 'under_contract', 'closed']

// Transaction type groupings (matching KW CommandPro style)
const TYPE_GROUPS: Record<string, { label: string; icon: string; types: string[] }> = {
  listings:  { label: 'Listings',   icon: 'home',      types: ['seller'] },
  buyers:    { label: 'Buyers',     icon: 'key',       types: ['buyer'] },
  leases:    { label: 'Leases',     icon: 'building',  types: ['lease'] },
  referrals: { label: 'Referrals',  icon: 'share',     types: ['referral'] },
  other:     { label: 'Other',      icon: 'layers',    types: ['wholesale', 'double_close'] },
}

const TYPE_GROUP_ORDER = ['listings', 'buyers', 'leases', 'referrals', 'other']

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'agent'

    // Get target agent (broker can view any agent, or "all")
    const { searchParams } = new URL(request.url)
    const targetAgent = searchParams.get('agent_id') || (role === 'agent' ? user.id : null)

    // Get transactions
    let txQuery = admin
      .from('transactions')
      .select('id, agent_id, type, status, property_address, city, contract_price, closing_date, created_at')
      .is('deleted_at', null)
      .not('status', 'eq', 'archived')

    if (targetAgent) {
      txQuery = txQuery.eq('agent_id', targetAgent)
    }

    const { data: transactions, error: txError } = await txQuery
    if (txError) throw txError

    // Get commissions for these transactions
    const txIds = (transactions || []).map(t => t.id)
    let commissionsMap: Record<string, any> = {}

    if (txIds.length > 0) {
      const { data: commissions } = await admin
        .from('commissions')
        .select('transaction_id, gross_commission, commission_rate_pct, agent_amount, agent_split_pct')
        .in('transaction_id', txIds)

      for (const c of commissions || []) {
        commissionsMap[c.transaction_id] = c
      }
    }

    // Build pipeline data grouped by type → stage
    const pipelineGroups: any[] = []

    for (const groupKey of TYPE_GROUP_ORDER) {
      const group = TYPE_GROUPS[groupKey]
      const groupTxs = (transactions || []).filter(t => group.types.includes(t.type))

      if (groupTxs.length === 0 && role === 'agent') {
        // Still show empty groups for agents so they see the full pipeline
      }

      const stages: any[] = []
      let totalVolume = 0
      let potentialGCI = 0
      let probableGCI = 0

      for (const stageKey of STAGE_ORDER) {
        const stage = STAGE_MAP[stageKey]
        const stageTxs = groupTxs.filter(t => stage.statuses.includes(t.status))

        const volume = stageTxs.reduce((sum, t) => sum + (t.contract_price || 0), 0)
        totalVolume += volume

        // Calculate GCI for this stage
        let stageGCI = 0
        for (const tx of stageTxs) {
          const comm = commissionsMap[tx.id]
          if (comm) {
            stageGCI += comm.gross_commission || 0
          } else {
            // Estimate: 3% default commission rate if no commission record
            stageGCI += (tx.contract_price || 0) * 0.03
          }
        }

        potentialGCI += stageGCI
        probableGCI += stageGCI * stage.probability

        // Calculate avg time in stage
        let avgDays = 0
        if (stageTxs.length > 0) {
          const totalDays = stageTxs.reduce((sum, t) => {
            const created = new Date(t.created_at).getTime()
            const now = Date.now()
            return sum + (now - created) / (1000 * 60 * 60 * 24)
          }, 0)
          avgDays = Math.round((totalDays / stageTxs.length) * 10) / 10
        }

        stages.push({
          id: stageKey,
          label: stage.label,
          count: stageTxs.length,
          volume,
          avgDays,
          gci: Math.round(stageGCI * 100) / 100,
          probability: stage.probability,
          transactions: stageTxs.map(t => ({
            id: t.id,
            property_address: t.property_address,
            city: t.city,
            contract_price: t.contract_price,
            closing_date: t.closing_date,
            gci: commissionsMap[t.id]?.gross_commission || (t.contract_price || 0) * 0.03,
            agent_amount: commissionsMap[t.id]?.agent_amount || 0,
          })),
        })
      }

      pipelineGroups.push({
        id: groupKey,
        label: group.label,
        icon: group.icon,
        stages,
        summary: {
          totalDeals: groupTxs.length,
          totalVolume,
          potentialGCI: Math.round(potentialGCI * 100) / 100,
          probableGCI: Math.round(probableGCI * 100) / 100,
        },
      })
    }

    // Overall totals
    const overallTotals = {
      totalDeals: (transactions || []).length,
      totalVolume: (transactions || []).reduce((s, t) => s + (t.contract_price || 0), 0),
      potentialGCI: pipelineGroups.reduce((s, g) => s + g.summary.potentialGCI, 0),
      probableGCI: pipelineGroups.reduce((s, g) => s + g.summary.probableGCI, 0),
      closedDeals: (transactions || []).filter(t => t.status === 'closed').length,
      closedVolume: (transactions || []).filter(t => t.status === 'closed').reduce((s, t) => s + (t.contract_price || 0), 0),
    }

    // Get agent list for broker view
    let agents: any[] = []
    if (['broker', 'admin'].includes(role)) {
      const { data: agentList } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name')

      agents = agentList || []
    }

    return NextResponse.json({
      pipeline: pipelineGroups,
      totals: overallTotals,
      role,
      agents,
    })
  } catch (err) {
    console.error('Pipeline API error:', err)
    return NextResponse.json({ error: 'Failed to load pipeline' }, { status: 500 })
  }
}
