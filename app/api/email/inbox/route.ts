import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

function getSupabaseServer(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

// GET /api/email/inbox?folder=inbox|sent|drafts|trash&search=...
export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const folder = searchParams.get('folder') || 'inbox'
  const search = searchParams.get('search')
  const threadId = searchParams.get('thread_id')

  let query = supabase
    .from('emails')
    .select('*, contacts(id, full_name, email, company)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (threadId) {
    query = query.eq('thread_id', threadId)
  } else if (folder === 'all') {
    // Show all emails
  } else {
    query = query.eq('folder', folder)
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,from_email.ilike.%${search}%,to_email.ilike.%${search}%,body_text.ilike.%${search}%`)
  }

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// PATCH /api/email/inbox - Bulk update (mark read, star, move to trash)
export async function PATCH(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, updates } = await request.json()
  // updates can be: { is_read: true }, { is_starred: true }, { folder: 'trash' }

  const { error } = await supabase
    .from('emails')
    .update(updates)
    .in('id', ids)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
