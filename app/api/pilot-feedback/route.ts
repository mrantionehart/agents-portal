import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// ── PILOT-FEEDBACK-001 — POST /api/pilot-feedback ──────────────────────
//
// Accepts a single row of qualitative feedback from a pilot learner.
// All fields are optional except that at least ONE narrative answer
// or the rating must be present (prevents empty-form submissions).
// The client's own Supabase session mediates the write via the RLS
// policy `pilot_feedback_insert_own` — server-side role escalation is
// not needed.
export const runtime = 'nodejs'

interface FeedbackBody {
  q1_first_action?: string
  q2_confusing?: string
  q3_stuck?: string
  q4_improve?: string
  q5_experience_rating?: number
  q6_anything_else?: string
}

function trim(s: unknown, max: number): string | null {
  if (typeof s !== 'string') return null
  const t = s.trim()
  if (t.length === 0) return null
  return t.slice(0, max)
}

export async function POST(request: NextRequest) {
  let body: FeedbackBody
  try {
    body = (await request.json()) as FeedbackBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const q1 = trim(body.q1_first_action, 4000)
  const q2 = trim(body.q2_confusing, 4000)
  const q3 = trim(body.q3_stuck, 4000)
  const q4 = trim(body.q4_improve, 4000)
  const q6 = trim(body.q6_anything_else, 4000)
  const rating =
    typeof body.q5_experience_rating === 'number' &&
    Number.isInteger(body.q5_experience_rating) &&
    body.q5_experience_rating >= 1 &&
    body.q5_experience_rating <= 10
      ? body.q5_experience_rating
      : null

  if (!q1 && !q2 && !q3 && !q4 && !q6 && rating == null) {
    return NextResponse.json(
      { error: 'Please answer at least one question before submitting.' },
      { status: 400 },
    )
  }

  const cookieStore = await cookies()
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookiesToSet.push({ name, value, options })
        },
        remove(name: string, options: CookieOptions) {
          cookiesToSet.push({ name, value: '', options: { ...options, maxAge: 0 } })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { error } = await supabase.from('pilot_feedback').insert({
    user_id: user.id,
    q1_first_action: q1,
    q2_confusing: q2,
    q3_stuck: q3,
    q4_improve: q4,
    q5_experience_rating: rating,
    q6_anything_else: q6,
  })

  if (error) {
    console.warn('[pilot-feedback] insert failed:', error.message)
    return NextResponse.json(
      { error: 'Could not save your feedback right now. Please try again.' },
      { status: 500 },
    )
  }

  const response = NextResponse.json({ ok: true }, { status: 200 })
  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set({ name, value, ...options })
  }
  return response
}
