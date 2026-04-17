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

/* ── GET /api/referrals ──────────────────────────────────────────────── */
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

    let query = admin
      .from('recruit_referrals')
      .select('*')
      .order('created_at', { ascending: false })

    // Agents see only their own; brokers see all
    if (role !== 'broker') {
      query = query.eq('referred_by', user.id)
    }

    const { data: referrals, error } = await query

    if (error) {
      console.error('Referrals fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ referrals: referrals || [] })
  } catch (err: any) {
    console.error('GET /api/referrals error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ── POST /api/referrals ─────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      candidate_name,
      candidate_email,
      candidate_phone,
      candidate_instagram,
      candidate_twitter,
      candidate_tiktok,
      shared_content,
      notes,
    } = body

    if (!candidate_name?.trim()) {
      return NextResponse.json({ error: 'candidate_name is required' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: referral, error } = await admin
      .from('recruit_referrals')
      .insert({
        referred_by: user.id,
        candidate_name: candidate_name.trim(),
        candidate_email: candidate_email?.trim() || null,
        candidate_phone: candidate_phone?.trim() || null,
        candidate_instagram: candidate_instagram?.trim() || null,
        candidate_twitter: candidate_twitter?.trim() || null,
        candidate_tiktok: candidate_tiktok?.trim() || null,
        shared_content: shared_content || [],
        notes: notes?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Referral insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ referral }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/referrals error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ── PATCH /api/referrals ────────────────────────────────────────────── */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, status, notes, contacted_date } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updateData: any = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (contacted_date) updateData.contacted_date = contacted_date

    const { data: referral, error } = await admin
      .from('recruit_referrals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Referral update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ referral })
  } catch (err: any) {
    console.error('PATCH /api/referrals error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
