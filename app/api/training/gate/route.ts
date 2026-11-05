// ---------------------------------------------------------------------------
// GET /api/training/gate
//
// Returns the training‐gate status for the authenticated user.
// Agents must complete ALL Volume 1 modules (1‑9) before the full app unlocks.
// Brokers / admins always pass the gate.
//
// Response shape:
// {
//   gateOpen: boolean,        // true = full app unlocked
//   role: string,             // user's role
//   vol1: { completed: number[], total: number, done: boolean },
//   vol2: { completed: number[], total: number, done: boolean },
// }
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'
import { passedModulesForVolume, type QuizEvidenceRow } from '@/lib/training/evidence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Sprint 8B Phase 1: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B-P0.1:
//   profiles          / profiles_select                       / SELECT / {public}        / true
//   training_quiz_results / Users can view own quiz results    / SELECT / {public}        /
//                       (auth.uid() = user_id)   [HR-PROGRESS-SECURITY: was training_progress]
// The profiles read is still own-row by id = user.id in the query body.
// The training_progress own-row policy replaces the previous service-role
// bypass; the query's `.eq('user_id', user.id)` filter remains as a
// belt-and-braces guard alongside RLS.

// Same module lists used by /api/training/quiz
// Vol 1 base modules (1-9) are required to unlock the app.
// EASE role-specific modules (11=broker, 12=admin, 13=agent) are optional —
// they don't have quizzes yet, so they can't block the gate.
const VOL1_BASE = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const VOL2_REQUIRED = [8, 9, 10, 11, 12, 13, 14]

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)

    // Fetch role + QA status + training progress in parallel
    const [{ data: profile }, { data: quizRows }] = await Promise.all([
      supabase.from('profiles').select('role, is_qa_user').eq('id', user.id).single(),
      // HR-PROGRESS-SECURITY — the gate reads graded quiz evidence, NOT the
      // client-written training_progress row (own-row SELECT policy).
      supabase
        .from('training_quiz_results')
        .select('volume, module_num, passed, certification_id, quiz_id')
        .eq('user_id', user.id)
        .eq('passed', true)
        .is('certification_id', null)
        .is('quiz_id', null),
    ])

    const role = profile?.role || 'agent'
    const isQaUser = profile?.is_qa_user === true

    // Vol 1 required list: base modules 1-9 only
    const vol1Required = [...VOL1_BASE]

    // Brokers, admins, office managers, and QA users always pass the gate
    if (role === 'broker' || role === 'admin' || role === 'office_manager' || isQaUser) {
      return NextResponse.json({
        gateOpen: true,
        role,
        vol1: { completed: vol1Required, total: vol1Required.length, done: true },
        vol2: { completed: [], total: VOL2_REQUIRED.length, done: false },
      })
    }

    // HR-PROGRESS-SECURITY — completion is what the learner PASSED, as graded
    // by the server (or, for an old EASE build, by the database). A
    // client-written completed_modules / volume_completed no longer opens it.
    const rows = (quizRows || []) as QuizEvidenceRow[]
    const vol1Completed: number[] = passedModulesForVolume(rows, 1)
    // Gate opens when agent has passed all base modules (1-9)
    const vol1Done = vol1Required.every(m => vol1Completed.includes(m))
    const vol2Completed: number[] = passedModulesForVolume(rows, 2)
    const vol2Done = VOL2_REQUIRED.every(m => vol2Completed.includes(m))

    return NextResponse.json({
      gateOpen: vol1Done,
      role,
      vol1: {
        completed: vol1Completed,
        total: vol1Required.length,
        done: vol1Done,
      },
      vol2: {
        completed: vol2Completed,
        total: VOL2_REQUIRED.length,
        done: vol2Done,
      },
    })
  } catch (err) {
    console.error('Training gate error:', err)
    return NextResponse.json(
      { error: 'Failed to check training gate' },
      { status: 500 }
    )
  }
}
