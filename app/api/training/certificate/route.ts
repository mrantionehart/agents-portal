import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sprint 8B Phase 1: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B-P0.1:
//   profiles          / profiles_select                      / SELECT / {public} / true
//   training_progress / Users can view own training progress / SELECT / {public} /
//                       (auth.uid() = user_id)
// Profile read remains own-row by id = user.id in query body.
// Training progress own-row policy gates RLS; query filter is kept as
// belt-and-braces.

const VOLUME_LABELS: Record<string, string> = {
  'volume-1': 'Volume 1 — Foundations',
  'volume-2': 'Volume 2 — Elite',
  'volume-3': 'Volume 3 — AI Training',
}

/* ── GET /api/training/certificate?volume=volume-1 ────────────────────
   Returns certificate data (completion status + HTML for rendering)
   Used by EASE app to check if agent earned a certificate ──────────── */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const { searchParams } = new URL(request.url)
    const volume = searchParams.get('volume')

    const supabase = userClient(request)

    // Get agent name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, name, role')
      .eq('id', user.id)
      .single()
    const agentName = profile?.full_name || profile?.name || user.user_metadata?.name || user.email || 'Agent'

    // If specific volume requested, return that certificate
    if (volume) {
      const { data: progress } = await supabase
        .from('training_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('volume', volume)
        .single()

      if (!progress?.volume_completed) {
        return NextResponse.json({
          earned: false,
          volume,
          message: 'Volume not yet completed',
        })
      }

      return NextResponse.json({
        earned: true,
        certificate: {
          name: agentName,
          volume: VOLUME_LABELS[volume] || volume,
          volumeKey: volume,
          score: progress.final_exam_score || 0,
          date: progress.certification_date
            ? new Date(progress.certification_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        },
      })
    }

    // No volume specified — return all earned certificates
    const { data: allProgress } = await supabase
      .from('training_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('volume_completed', true)

    const certificates = (allProgress || []).map(p => ({
      name: agentName,
      volume: VOLUME_LABELS[p.volume] || p.volume,
      volumeKey: p.volume,
      score: p.final_exam_score || 0,
      date: p.certification_date
        ? new Date(p.certification_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A',
    }))

    return NextResponse.json({ certificates })
  } catch (err: any) {
    console.error('GET /api/training/certificate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
