import { NextRequest, NextResponse } from 'next/server'
import { getQuizForModule, gradeQuiz } from '@/app/data/quizzes'
import { requireAuth, userClient, adminClient } from '@/lib/security'
import { moduleEligibility, parseSubmission, type CurriculumRow } from '@/lib/training/quiz-submission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// HR-CERT-SECURITY D1 (2026-11-04): the quiz RESULT row is now written with
// the service role after server grading and an eligibility check — see
// lib/training/quiz-submission.ts. training_progress stays under user JWT.
//
// Sprint 8B Phase 2B (PARTIAL CONVERSION):
// Own-row writes (training progress) run under user JWT.
// The broker/admin notification fan-out at the end is a cross-user read of
// profiles WHERE role IN ('admin','broker') + SendGrid email loop, which
// is legitimate Category A — that block stays under service role with a
// [service-role: broker-fan-out] marker so it is grep-discoverable.
//
// Policy anchors verified in Sprint 8B-P0.1:
//   training_quiz_results / Users can insert own quiz results / INSERT /
//                           WITH CHECK (auth.uid() = user_id)
//   training_progress     / Users can insert own training progress / INSERT /
//                           WITH CHECK (auth.uid() = user_id)
//   training_progress     / Users can update own training progress / UPDATE /
//                           qual=(auth.uid() = user_id)

// Module counts per volume — used to detect volume completion
const VOLUME_MODULE_COUNTS: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6, 7, 8, 9], // Module 10 (New Agent Playbook) excluded — always unlocked
  2: [8, 9, 10, 11, 12, 13, 14],
  3: [1], // AI training — single module
}

const VOLUME_NAMES: Record<number, string> = {
  1: 'Volume 1 — Foundations',
  2: 'Volume 2 — Elite',
  3: 'Volume 3 — AI Training',
}

// Volume number -> training_progress.volume string
function volumeString(vol: number): string {
  return `volume-${vol}`
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    let body: unknown
    try { body = await request.json() } catch { body = null }
    const head = parseSubmission(body)
    if ('error' in head) return NextResponse.json({ error: head.error }, { status: 400 })
    const { volume, moduleNum: module_num } = head

    // Look up quiz
    const quiz = getQuizForModule(volume, module_num)
    if (!quiz) {
      return NextResponse.json({ error: 'No quiz found for this module' }, { status: 404 })
    }
    // Keep only answers to this quiz's own questions.
    const parsed = parseSubmission(body, quiz.questions.map((q) => q.id))
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const answers = parsed.answers

    // HR-CERT-SECURITY D1 — the result row is SERVER-written. The Vault
    // migration that follows revokes INSERT on training_quiz_results from
    // `authenticated`, so this is the only path a module result can take.
    // [service-role: training-quiz-result-write]
    const svc = adminClient('training-quiz-result-write', { userId: user.id, context: 'POST /api/training/quiz' })

    // Eligibility: the module must be in the HartFelt Ready curriculum and
    // open to the caller's role (same rule as Vault's roleMayTake).
    const [{ data: callerProfile }, { data: moduleRow }] = await Promise.all([
      svc.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      svc
        .from('training_modules')
        .select('required_role')
        .is('certification_id', null)
        .eq('volume', volume)
        .eq('module_num', module_num)
        .maybeSingle(),
    ])
    const eligibility = moduleEligibility(
      (moduleRow as CurriculumRow | null) ?? null,
      (callerProfile as { role?: string | null } | null)?.role ?? null,
    )
    if ('reason' in eligibility) {
      return NextResponse.json({ error: 'Module not available', reason: eligibility.reason }, { status: eligibility.status })
    }

    // Grade
    const result = gradeQuiz(quiz, answers)

    // User-JWT client for the training_progress own-row writes below (not
    // gate evidence). RLS WITH CHECK (auth.uid() = user_id) bounds them.
    const supabase = userClient(request)

    // Determine attempt number
    const { count } = await svc
      .from('training_quiz_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('volume', volume)
      .eq('module_num', module_num)
      .is('certification_id', null)
      .is('quiz_id', null)

    const attemptNum = (count || 0) + 1

    // Save quiz result — server-graded score and pass flag only.
    const { error: insertError } = await svc.from('training_quiz_results').insert({
      user_id: user.id,
      volume,
      module_num,
      score: result.score,
      passed: result.passed,
      answers,
      attempt_num: attemptNum,
    })
    if (insertError) {
      console.error('[training/quiz] result write failed', { userId: user.id, volume, module_num, code: insertError.code })
      return NextResponse.json({ error: 'Your quiz could not be saved. Please try again.' }, { status: 500 })
    }

    // If passed, update training_progress
    let volumeJustCompleted = false
    if (result.passed) {
      const volStr = volumeString(volume)

      // Upsert training_progress row (own-row under user JWT + RLS).
      const { data: existing } = await supabase
        .from('training_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('volume', volStr)
        .maybeSingle()

      let completedModules: number[] = []
      if (existing) {
        completedModules = existing.completed_modules || []
        if (!completedModules.includes(module_num)) {
          completedModules.push(module_num)
        }

        const testScores: Record<string, number> = existing.test_scores || {}
        testScores[`m${module_num}`] = result.score

        // Check if all modules in this volume are now completed
        const requiredModules = VOLUME_MODULE_COUNTS[volume] || []
        const allComplete = requiredModules.every(m => completedModules.includes(m))
        volumeJustCompleted = allComplete && !existing.volume_completed

        await supabase
          .from('training_progress')
          .update({
            completed_modules: completedModules,
            test_scores: testScores,
            volume_completed: allComplete,
          })
          .eq('user_id', user.id)
          .eq('volume', volStr)
      } else {
        completedModules = [module_num]
        const requiredModules = VOLUME_MODULE_COUNTS[volume] || []
        const allComplete = requiredModules.every(m => completedModules.includes(m))
        volumeJustCompleted = allComplete

        await supabase.from('training_progress').insert({
          user_id: user.id,
          volume: volStr,
          completed_modules: completedModules,
          test_scores: { [`m${module_num}`]: result.score },
          volume_completed: allComplete,
        })
      }

      // ── Notify broker/admin when an agent completes an entire volume ──
      // [service-role: broker-fan-out]
      // This block reads profiles WHERE role IN ('admin','broker') — a
      // legitimate cross-user query for a system notification. The agent
      // does not (and should not) have RLS visibility into other agents'
      // profile rows. This stays under service role by design; the
      // surrounding own-row writes above run under user JWT + RLS.
      if (volumeJustCompleted) {
        try {
          // [service-role: broker-fan-out] — service-role client scoped
          // narrowly to this notification block.
          const admin = adminClient('broker-fan-out', { userId: user.id, context: 'POST /api/training/quiz volume-completion' })

          // Get agent profile info
          const { data: agentProfile } = await admin
            .from('profiles')
            .select('full_name, email, role')
            .eq('id', user.id)
            .single()

          const agentName = agentProfile?.full_name || user.email || 'An agent'
          const agentEmail = agentProfile?.email || user.email || ''
          const volName = VOLUME_NAMES[volume] || `Volume ${volume}`

          // [service-role: broker-fan-out] — cross-user read for
          // admin/broker recipients of the SendGrid notification.
          const { data: admins } = await admin
            .from('profiles')
            .select('email, full_name')
            .in('role', ['admin', 'broker'])

          const recipients = (admins || [])
            .map((a: any) => a.email)
            .filter((e: string) => !!e)

          if (recipients.length > 0) {
            // Send notification via SendGrid
            const sgApiKey = process.env.SENDGRID_API_KEY
            if (sgApiKey) {
              const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agents.hartfeltrealestate.com'

              for (const recipientEmail of recipients) {
                await fetch('https://api.sendgrid.com/v3/mail/send', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${sgApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    personalizations: [{ to: [{ email: recipientEmail }] }],
                    from: { email: 'info@hartfeltrealestate.com', name: 'HartFelt Ready' },
                    subject: `🎓 ${agentName} completed ${volName}!`,
                    content: [
                      {
                        type: 'text/html',
                        value: `
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <h1 style="color:#1F4E78;border-bottom:3px solid #2E75B6;padding-bottom:10px;">
    Training Volume Completed!
  </h1>
  <p style="font-size:16px;margin-top:20px;">
    <strong>${agentName}</strong> (${agentEmail}) has successfully completed
    <strong>${volName}</strong> of HartFelt Ready training.
  </p>
  <div style="background:#f0f9ff;padding:15px;border-left:4px solid #2E75B6;margin:20px 0;border-radius:4px;">
    <p style="margin:0;"><strong>Agent:</strong> ${agentName}</p>
    <p style="margin:8px 0 0;"><strong>Volume:</strong> ${volName}</p>
    <p style="margin:8px 0 0;"><strong>Modules Completed:</strong> ${(VOLUME_MODULE_COUNTS[volume] || []).length} of ${(VOLUME_MODULE_COUNTS[volume] || []).length}</p>
    <p style="margin:8px 0 0;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
  <p>
    <a href="${portalUrl}/admin"
       style="background:#2E75B6;color:white;padding:12px 30px;text-decoration:none;border-radius:4px;display:inline-block;">
      View Agent Progress
    </a>
  </p>
  <p style="margin-top:30px;padding-top:20px;border-top:1px solid #ccc;color:#999;font-size:12px;">
    From The Hart,<br><strong>HartFelt Ready Training System</strong>
  </p>
</div>
</body></html>`,
                      },
                    ],
                  }),
                })
              }
              console.log(`Volume completion notification sent for ${agentName} - ${volName}`)
            }
          }
        } catch (notifErr) {
          // Don't fail the quiz response if notification fails
          console.error('Failed to send volume completion notification:', notifErr)
        }
      }
    }

    return NextResponse.json({
      score: result.score,
      passed: result.passed,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correctAnswers,
      volumeCompleted: volumeJustCompleted,
    })
  } catch (err) {
    console.error('Quiz submission error:', err)
    return NextResponse.json({ error: 'Failed to process quiz' }, { status: 500 })
  }
}
