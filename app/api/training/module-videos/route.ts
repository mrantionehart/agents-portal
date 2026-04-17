// ---------------------------------------------------------------------------
// GET /api/training/module-videos?module_id=m_v1_1
//
// Returns the list of videos for a given training module.
// Uses service-role key to bypass RLS (training_videos / training_modules are
// catalog data that all authenticated users should access).
//
// Auth: Supabase session cookie (portal) OR Bearer token (EASE).
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Service-role client — bypasses RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthedUser(
  request: NextRequest
): Promise<{ userId: string } | null> {
  // 1. Bearer token (mobile / curl)
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data.user) return null;
      return { userId: data.user.id };
    } catch {
      return null;
    }
  }

  // 2. SSR cookie (portal)
  try {
    const stubResponse = NextResponse.json({});
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            stubResponse.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            stubResponse.cookies.delete(name);
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { userId: user.id };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('module_id');

    if (!moduleId) {
      return NextResponse.json(
        { error: 'missing module_id parameter' },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Fetch module info
    const { data: moduleData, error: moduleError } = await admin
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
    const { data: videos, error: videoError } = await admin
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
