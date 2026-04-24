// ============================================================================
// GET/POST /api/leaderboard — CRUD for manual wins (Agents Portal)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
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

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = adminClient()
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
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = adminClient()
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
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = adminClient()
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
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = adminClient()
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
