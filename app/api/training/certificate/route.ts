import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ── Auth helper ──────────────────────────────────────────────────────── */
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
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const volume = searchParams.get('volume')

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get agent name
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, name, role')
      .eq('id', user.id)
      .single()
    const agentName = profile?.full_name || profile?.name || user.user_metadata?.name || user.email || 'Agent'

    // If specific volume requested, return that certificate
    if (volume) {
      const { data: progress } = await admin
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
    const { data: allProgress } = await admin
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
