import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sprint 8B Phase 2B: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B Phase 2A:
//   recruit_referrals / recruit_referrals_select / SELECT / {public} /
//     ((referred_by = auth.uid()) OR (profile.role = 'broker'))
//   recruit_referrals / recruit_referrals_insert / INSERT / {public} /
//     WITH CHECK (referred_by = auth.uid())
//   recruit_referrals / recruit_referrals_update / UPDATE / {public} /
//     ((referred_by = auth.uid()) OR (profile.role = 'broker'))
// Net effect: RLS now enforces ownership AND broker cross-user access.
// This SECURITY-TIGHTENS the PATCH path — the pre-conversion code had
// NO ownership check whatsoever (relied on UI gating). RLS now enforces
// that an agent can only PATCH their own referrals.

/* ── GET /api/referrals ──────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const supabase = userClient(request)

    // RLS handles the agent vs broker filter automatically:
    //   * agents see WHERE referred_by = auth.uid()
    //   * brokers see all (per profile.role = 'broker')
    // The route's previous .eq('referred_by', user.id) hint becomes
    // redundant — removing it lets brokers receive the full list under RLS
    // without any code-level role lookup.
    const { data: referrals, error } = await supabase
      .from('recruit_referrals')
      .select('*')
      .order('created_at', { ascending: false })

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
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

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

    const supabase = userClient(request)

    // RLS WITH CHECK (referred_by = auth.uid()) enforces ownership.
    const { data: referral, error } = await supabase
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
// SECURITY-TIGHTENING: this route previously had NO ownership check —
// service-role bypass + UI gating were the only protection. RLS now
// enforces (referred_by = auth.uid() OR broker) on UPDATE qual, so
// agents can only update their own referrals; brokers can update any.
// No code-level role check is needed; RLS provides the boundary.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const { id, status, notes, contacted_date } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = userClient(request)

    const updateData: any = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (contacted_date) updateData.contacted_date = contacted_date

    const { data: referral, error } = await supabase
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
