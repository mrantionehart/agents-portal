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
import { roleMayAccessModule } from '@/lib/training/video-authorization'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)

    const [{ data: modules }, { data: videos }, { data: progress }, { data: profile }] =
      await Promise.all([
        supabase.from('training_modules').select('*').order('sort_order'),
        supabase.from('training_videos').select('*').order('sort_order'),
        supabase
          .from('training_video_progress')
          .select('video_id, watched_seconds, completed')
          .eq('user_id', user.id),
        // Own row only — `profiles` RLS restricts the read to auth.uid(), and
        // `authenticated` holds no UPDATE grant on profiles at all, so a
        // caller cannot alter the role they are judged by. Reading it with
        // userClient keeps the Sprint 8B anon-key + user-JWT design intact
        // rather than reintroducing a service client here.
        supabase.from('profiles').select('role').eq('id', user.id).single(),
      ])

    // AP-TRAINING-SIGN-1 — required_role is enforced HERE as well as in
    // sign-video. sign-video is the security boundary (it is what turns a key
    // into playable media); this filter keeps the portal from listing modules
    // the caller cannot play and from handing out their r2_keys.
    const role = (profile?.role as string) ?? null
    const visibleModules = (modules || []).filter((m) =>
      roleMayAccessModule((m as { required_role?: string[] | null }).required_role, role)
    )
    const visibleModuleIds = new Set(visibleModules.map((m) => (m as { id: string }).id))
    const visibleVideos = (videos || []).filter((v) =>
      visibleModuleIds.has((v as { module_id: string | null }).module_id ?? '')
    )

    return NextResponse.json({
      modules: visibleModules,
      videos: visibleVideos,
      progress: progress || [],
    })
  } catch (err) {
    console.error('Training catalog error:', err)
    return NextResponse.json({ error: 'Failed to load training data' }, { status: 500 })
  }
}
