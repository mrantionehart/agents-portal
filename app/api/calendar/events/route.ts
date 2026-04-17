import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ── Auth helper (Bearer token for EASE, cookies for portal) ──────── */
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

/* ── GET /api/calendar/events?month=2026-04&agent_id=xxx ──────────── */
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

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // e.g. "2026-04"
    const targetAgent = searchParams.get('agent_id') || (role === 'agent' ? user.id : null)

    let query = admin
      .from('calendar_events')
      .select('*')
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true })

    // Filter by agent (agents see own; broker/admin can see all or specific)
    if (targetAgent) {
      query = query.eq('agent_id', targetAgent)
    }

    // Filter by month if provided
    if (month) {
      const [year, mo] = month.split('-').map(Number)
      const startDate = `${year}-${String(mo).padStart(2, '0')}-01`
      const endDate = new Date(year, mo, 0).toISOString().split('T')[0] // last day of month
      query = query.gte('event_date', startDate).lte('event_date', endDate)
    }

    const { data: events, error } = await query
    if (error) throw error

    return NextResponse.json({ events: events || [], role })
  } catch (err) {
    console.error('Calendar events GET error:', err)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }
}

/* ── POST /api/calendar/events — create a new event ───────────────── */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()
    const {
      title, type = 'other', event_date, event_time = '10:00',
      duration_min = 60, location, notes, property_address,
      client_name, transaction_id, agent_id,
    } = body

    if (!title || !event_date) {
      return NextResponse.json({ error: 'title and event_date are required' }, { status: 400 })
    }

    // Determine target agent (broker can assign events to agents)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role || 'agent'

    let targetAgentId = user.id
    if (['broker', 'admin'].includes(role) && agent_id) {
      targetAgentId = agent_id
    }

    const { data: event, error } = await admin
      .from('calendar_events')
      .insert({
        agent_id: targetAgentId,
        title,
        type,
        event_date,
        event_time,
        duration_min,
        location: location || null,
        notes: notes || null,
        property_address: property_address || null,
        client_name: client_name || null,
        transaction_id: transaction_id || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    console.error('Calendar events POST error:', err)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

/* ── DELETE /api/calendar/events?id=xxx ────────────────────────────── */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')
    if (!eventId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Verify ownership (or broker/admin)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role || 'agent'

    const { data: event } = await admin
      .from('calendar_events')
      .select('agent_id')
      .eq('id', eventId)
      .single()

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    if (event.agent_id !== user.id && !['broker', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin
      .from('calendar_events')
      .delete()
      .eq('id', eventId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Calendar events DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
