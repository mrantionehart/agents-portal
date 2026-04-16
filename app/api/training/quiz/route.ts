import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getQuizForModule, gradeQuiz } from '@/app/data/quizzes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Module counts per volume — used to detect volume completion
const VOLUME_MODULE_COUNTS: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6, 7, 8],
  2: [8, 9, 10, 11, 12, 13, 14],
  3: [1], // AI training — single module
}

const VOLUME_NAMES: Record<number, string> = {
  1: 'Volume 1 — Foundations',
  2: 'Volume 2 — Elite',
  3: 'Volume 3 — AI Training',
}

// Shared auth helper — same pattern as /api/training/catalog/route.ts
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
    } catch {
      return null
    }
  }

  try {
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            stubResponse.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            stubResponse.cookies.delete(name)
          },
        },
      }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

// Volume number -> training_progress.volume string
function volumeString(vol: number): string {
  return `volume-${vol}`
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { volume, module_num, answers } = body as {
      volume: number
      module_num: number
      answers: Record<string, string>
    }

    if (!volume || !module_num || !answers) {
      return NextResponse.json(
        { error: 'Missing required fields: volume, module_num, answers' },
        { status: 400 }
      )
    }

    // Look up quiz
    const quiz = getQuizForModule(volume, module_num)
    if (!quiz) {
      return NextResponse.json({ error: 'No quiz found for this module' }, { status: 404 })
    }

    // Grade
    const result = gradeQuiz(quiz, answers)

    // Service role client for DB writes (bypasses RLS)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Determine attempt number
    const { count } = await admin
      .from('training_quiz_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('volume', volume)
      .eq('module_num', module_num)

    const attemptNum = (count || 0) + 1

    // Save quiz result
    await admin.from('training_quiz_results').insert({
      user_id: user.id,
      volume,
      module_num,
      score: result.score,
      passed: result.passed,
      answers,
      attempt_num: attemptNum,
    })

    // If passed, update training_progress
    let volumeJustCompleted = false
    if (result.passed) {
      const volStr = volumeString(volume)

      // Upsert training_progress row
      const { data: existing } = await admin
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

        await admin
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

        await admin.from('training_progress').insert({
          user_id: user.id,
          volume: volStr,
          completed_modules: completedModules,
          test_scores: { [`m${module_num}`]: result.score },
          volume_completed: allComplete,
        })
      }

      // ── Notify broker/admin when an agent completes an entire volume ──
      if (volumeJustCompleted) {
        try {
          // Get agent profile info
          const { data: agentProfile } = await admin
            .from('profiles')
            .select('full_name, email, role')
            .eq('id', user.id)
            .single()

          const agentName = agentProfile?.full_name || user.email || 'An agent'
          const agentEmail = agentProfile?.email || user.email || ''
          const volName = VOLUME_NAMES[volume] || `Volume ${volume}`

          // Get all admins and brokers to notify
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
    <p style="margin:8px 0 0;"><strong>Modules Completed:</strong> ${completedModules.length} of ${(VOLUME_MODULE_COUNTS[volume] || []).length}</p>
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
