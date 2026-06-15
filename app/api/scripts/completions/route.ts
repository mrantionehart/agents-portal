// ---------------------------------------------------------------------------
// /api/scripts/completions
//
// GET  — returns the caller's script completion records
// POST — upsert a completion (mark practiced, mastered, favorited, etc.)
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET — user's own completions
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)

    const { data, error } = await supabase
      .from('script_completions')
      .select('*, script_library!script_id(id, title, subtitle, difficulty, category_id)')
      .eq('user_id', user.id)
      .order('last_accessed_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ completions: data || [] })
  } catch (err) {
    console.error('Completions GET error:', err)
    return NextResponse.json({ error: 'Failed to load completions' }, { status: 500 })
  }
}

// POST — upsert completion record
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)
    const body = await request.json()

    const {
      script_id,
      status,
      video_watched,
      quiz_score,
      quiz_passed,
      practice_count,
      notes,
      favorited,
    } = body

    if (!script_id) {
      return NextResponse.json({ error: 'script_id is required' }, { status: 400 })
    }

    // Build the upsert payload
    const record: Record<string, any> = {
      user_id: user.id,
      script_id,
      last_accessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) record.status = status
    if (video_watched !== undefined) record.video_watched = video_watched
    if (quiz_score !== undefined) record.quiz_score = quiz_score
    if (quiz_passed !== undefined) record.quiz_passed = quiz_passed
    if (practice_count !== undefined) record.practice_count = practice_count
    if (notes !== undefined) record.notes = notes
    if (favorited !== undefined) record.favorited = favorited

    const { data, error } = await supabase
      .from('script_completions')
      .upsert(record, { onConflict: 'user_id,script_id' })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ completion: data })
  } catch (err) {
    console.error('Completions POST error:', err)
    return NextResponse.json({ error: 'Failed to save completion' }, { status: 500 })
  }
}
