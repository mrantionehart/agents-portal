// ---------------------------------------------------------------------------
// GET /api/scripts
//
// Returns published scripts + categories for the Script Library.
// Supports filtering by category, difficulty, search, tag.
// Also returns the caller's completion records for progress tracking.
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
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')

    // Fetch categories, scripts, and user completions in parallel
    const [categoriesResult, scriptsResult, completionsResult] = await Promise.all([
      supabase
        .from('script_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),

      buildScriptsQuery(supabase, { category, difficulty, search }),

      supabase
        .from('script_completions')
        .select('script_id, status, video_watched, quiz_score, quiz_passed, practice_count, favorited, notes, last_accessed_at')
        .eq('user_id', user.id),
    ])

    return NextResponse.json({
      categories: categoriesResult.data || [],
      scripts: scriptsResult.data || [],
      completions: completionsResult.data || [],
    })
  } catch (err) {
    console.error('Scripts route error:', err)
    return NextResponse.json({ error: 'Failed to load scripts' }, { status: 500 })
  }
}

async function buildScriptsQuery(
  supabase: any,
  filters: { category: string | null; difficulty: string | null; search: string | null }
) {
  let query = supabase
    .from('script_library')
    .select('*, script_categories!category_id(id, name, slug, icon)')
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (filters.category) {
    // Look up category by slug
    const { data: cat } = await supabase
      .from('script_categories')
      .select('id')
      .eq('slug', filters.category)
      .single()

    if (cat) {
      query = query.eq('category_id', cat.id)
    } else {
      return { data: [] }
    }
  }

  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty)
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`
    query = query.or(
      `title.ilike.${pattern},subtitle.ilike.${pattern},summary.ilike.${pattern}`
    )
  }

  return query
}
