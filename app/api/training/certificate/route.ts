import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'
import { verifiedCertificationDate } from '@/lib/training/evidence'

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

    // HR-PROGRESS-SECURITY — a certificate is EARNED only by a HartFelt Ready
    // certification that the designated Broker of Record granted through the
    // evidence gate (onboarding_pipeline.hartfelt_ready_verified_at, written
    // only by Vault complete_training). training_progress.volume_completed /
    // certification_date are client-written and no longer earn anything.
    // QA profiles never hold an official certificate. Own-row reads only.
    const [{ data: pipeline }, { data: qaRow }, { data: finals }] = await Promise.all([
      supabase
        .from('onboarding_pipeline')
        .select('hartfelt_ready_verified_at')
        .eq('profile_id', user.id)
        .not('hartfelt_ready_verified_at', 'is', null)
        .limit(1)
        .maybeSingle(),
      supabase.from('profiles').select('is_qa_user').eq('id', user.id).maybeSingle(),
      supabase
        .from('training_quiz_results')
        .select('score')
        .eq('user_id', user.id)
        .eq('quiz_id', 'hartfelt-ready.comprehensive-final')
        .eq('passed', true)
        .order('score', { ascending: false })
        .limit(1),
    ])
    const certifiedAt = verifiedCertificationDate(
      pipeline as { hartfelt_ready_verified_at: string | null } | null,
      (qaRow as { is_qa_user?: boolean | null } | null)?.is_qa_user ?? null,
    )
    const finalScore = ((finals as { score: number }[] | null) ?? [])[0]?.score ?? 0
    const dateLabel = certifiedAt
      ? new Date(certifiedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : null
    const certFor = (volumeKey: string) => ({
      name: agentName,
      volume: VOLUME_LABELS[volumeKey] || volumeKey,
      volumeKey,
      score: finalScore,
      date: dateLabel,
    })

    // If specific volume requested, return that certificate
    if (volume) {
      if (!certifiedAt) {
        return NextResponse.json({
          earned: false,
          volume,
          message: 'HartFelt Ready certification has not been granted by the Broker of Record',
        })
      }
      return NextResponse.json({ earned: true, certificate: certFor(volume) })
    }

    // No volume specified — the certification covers Volumes 1-3 together.
    const certificates = certifiedAt ? Object.keys(VOLUME_LABELS).map(certFor) : []
    return NextResponse.json({ certificates })
  } catch (err: any) {
    console.error('GET /api/training/certificate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
