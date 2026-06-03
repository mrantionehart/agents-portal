// ---------------------------------------------------------------------------
// GET /api/training/progress
//
// Returns the caller's own training_progress rows and quiz history.
//
// Sprint 8B Phase 1: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B-P0.1:
//   training_progress     / Users can view own training progress / SELECT / {public} /
//                          (auth.uid() = user_id)
//   training_quiz_results / Users can view own quiz results      / SELECT / {public} /
//                          (auth.uid() = user_id)
// The own-row RLS replaces the previous service-role bypass; `.eq('user_id',
// user.id)` filters remain as belt-and-braces alongside RLS.
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)

    const [{ data: trainingProgress }, { data: quizResults }] = await Promise.all([
      supabase
        .from('training_progress')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('training_quiz_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      trainingProgress: trainingProgress || [],
      quizResults: quizResults || [],
    })
  } catch (err) {
    console.error('Training progress error:', err)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}
