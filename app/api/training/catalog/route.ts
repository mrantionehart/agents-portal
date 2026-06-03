// ---------------------------------------------------------------------------
// GET /api/training/catalog
//
// Returns the full training catalog + the caller's own video progress.
//
// Sprint 8B Phase 1: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B-P0.1:
//   training_modules        / training_modules_select / SELECT / {authenticated} / true
//   training_videos         / training_videos_select  / SELECT / {authenticated} / true
//   training_video_progress / tvp_select_own          / SELECT / {authenticated} /
//                             (auth.uid() = user_id)
// The own-row RLS on training_video_progress replaces the previous
// `.eq('user_id', user.id)` filter as the security boundary — the route's
// explicit filter is kept anyway for query-plan clarity.
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

    const [{ data: modules }, { data: videos }, { data: progress }] = await Promise.all([
      supabase.from('training_modules').select('*').order('sort_order'),
      supabase.from('training_videos').select('*').order('sort_order'),
      supabase
        .from('training_video_progress')
        .select('video_id, watched_seconds, completed')
        .eq('user_id', user.id),
    ])

    return NextResponse.json({
      modules: modules || [],
      videos: videos || [],
      progress: progress || [],
    })
  } catch (err) {
    console.error('Training catalog error:', err)
    return NextResponse.json({ error: 'Failed to load training data' }, { status: 500 })
  }
}
