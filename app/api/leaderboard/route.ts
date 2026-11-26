// ============================================================================
// GET/POST /api/leaderboard — CRUD for manual wins (Agents Portal)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


export async function GET(req: NextRequest) {
  try {
    // FINSEC closeout — shared gate: 401 no session, 403 inactive/suspended/deleted.
    const auth = await requireAuth(req)
    if (auth.response) return auth.response
    const user = auth.user

    // Sprint 8B Phase 4B: was service-role; now user JWT + RLS.
    // Coverage: manual_wins "Authenticated users can view all manual wins"
    // (SELECT TO authenticated USING true) — any authed agent reads.
    const db = userClient(req)
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    let dateFilter: string | null = null
    if (period === 'month') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    } else if (period === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3
      dateFilter = new Date(now.getFullYear(), qMonth, 1).toISOString()
    }

    let query = db.from('manual_wins').select('*').order('win_date', { ascending: false })
    if (dateFilter) query = query.gte('win_date', dateFilter)

    const { data, error } = await query
    if (error) return NextResponse.json({ manualWins: [] })

    return NextResponse.json({ manualWins: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // FINSEC closeout — shared gate: 401 no session, 403 inactive/suspended/deleted.
    const auth = await requireAuth(req)
    if (auth.response) return auth.response
    const user = auth.user

    // Sprint 8B Phase 4B: was service-role; now user JWT + RLS.
    // Coverage: "Managers can insert manual wins" — WITH CHECK on
    // broker/admin/office_manager role. The explicit code-side role check
    // below remains as defense-in-depth + a clean 403 path; without it the
    // INSERT would still fail at RLS but with a less friendly Postgres error.
    const db = userClient(req)
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['broker', 'admin', 'office_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only brokers/admins can add wins' }, { status: 403 })
    }

    const body = await req.json()
    const { agent_name, property_address, sale_price, win_date, win_type, notes } = body

    if (!agent_name || !property_address) {
      return NextResponse.json({ error: 'Agent name and property address required' }, { status: 400 })
    }

    const { data, error } = await db.from('manual_wins').insert({
      agent_name,
      property_address,
      sale_price: sale_price || 0,
      win_date: win_date || new Date().toISOString().split('T')[0],
      win_type: win_type || 'closed_deal',
      notes: notes || '',
      created_by: user.id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ win: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // FINSEC closeout — shared gate: 401 no session, 403 inactive/suspended/deleted.
    const auth = await requireAuth(req)
    if (auth.response) return auth.response
    const user = auth.user

    // Sprint 8B Phase 4B: user JWT + RLS (see GET handler header).
    // Coverage: "Managers can update manual wins" — broker/admin/office_manager.
    const db = userClient(req)
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['broker', 'admin', 'office_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Win ID required' }, { status: 400 })

    const { data, error } = await db.from('manual_wins').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ win: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // FINSEC closeout — shared gate: 401 no session, 403 inactive/suspended/deleted.
    const auth = await requireAuth(req)
    if (auth.response) return auth.response
    const user = auth.user

    // Sprint 8B Phase 4B: user JWT + RLS (see GET handler header).
    // Coverage: "Managers can delete manual wins" — broker/admin/office_manager.
    const db = userClient(req)
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['broker', 'admin', 'office_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Win ID required' }, { status: 400 })

    const { error } = await db.from('manual_wins').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
