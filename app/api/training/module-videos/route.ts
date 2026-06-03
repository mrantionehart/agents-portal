// ---------------------------------------------------------------------------
// GET /api/training/module-videos?module_id=m_v1_1
//
// Returns the list of videos for a given training module.
//
// Sprint 8B Phase 1: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B-P0.1:
//   training_modules / training_modules_select / SELECT / {authenticated} / true
//   training_videos  / training_videos_select  / SELECT / {authenticated} / true
//
// Auth: Supabase session cookie (portal) OR Bearer token (EASE) — both
// handled by requireAuth + userClient from @/lib/security.
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, userClient } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('module_id');

    if (!moduleId) {
      return NextResponse.json(
        { error: 'missing module_id parameter' },
        { status: 400 }
      );
    }

    const supabase = userClient(request);

    // Fetch module info
    const { data: moduleData, error: moduleError } = await supabase
      .from('training_modules')
      .select('*')
      .eq('id', moduleId)
      .single();

    if (moduleError) {
      console.error('module fetch error:', moduleError);
      // Try without single() to see if it's a not-found vs RLS issue
      return NextResponse.json(
        { error: 'module not found', detail: moduleError.message },
        { status: 404 }
      );
    }

    // Fetch videos for the module, ordered by sort_order
    const { data: videos, error: videoError } = await supabase
      .from('training_videos')
      .select('*')
      .eq('module_id', moduleId)
      .order('sort_order', { ascending: true });

    if (videoError) {
      console.error('video fetch error:', videoError);
      return NextResponse.json(
        { error: 'failed to fetch videos', detail: videoError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      module: moduleData,
      videos: videos || [],
    });
  } catch (err) {
    console.error('module-videos error:', err);
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 }
    );
  }
}
