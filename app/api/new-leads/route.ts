import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

/**
 * GET /api/new-leads?filter=available|mine|all
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filter = request.nextUrl.searchParams.get('filter') || 'available'

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = admin
      .from('new_leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter === 'available') {
      query = query.is('claimed_by', null)
    } else if (filter === 'mine') {
      query = query.eq('claimed_by', user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('New leads fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }

    return NextResponse.json({ leads: data || [] })
  } catch (error) {
    console.error('New leads GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/new-leads  { action: 'claim', leadId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, leadId } = body

    if (action !== 'claim' || !leadId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if still available
    const { data: check } = await admin
      .from('new_leads')
      .select('claimed_by')
      .eq('id', leadId)
      .single()

    if (check?.claimed_by) {
      return NextResponse.json({ error: 'Lead already claimed' }, { status: 409 })
    }

    // Get agent name
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Claim it
    const { error } = await admin
      .from('new_leads')
      .update({
        claimed_by: user.id,
        claimed_by_name: profile?.full_name || user.email,
        claimed_at: new Date().toISOString(),
        status: 'claimed',
      })
      .eq('id', leadId)
      .is('claimed_by', null) // Double-check atomicity

    if (error) {
      console.error('Claim error:', error)
      return NextResponse.json({ error: 'Failed to claim lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('New leads POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
