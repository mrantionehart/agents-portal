import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
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

// GET /api/contacts - List contacts with optional category filter
export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  let query = supabase
    .from('contacts')
    .select('*, contact_categories(id, name, color)')
    .eq('owner_id', user.id)
    .order('full_name')

  if (category) query = query.eq('category_id', category)
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// POST /api/contacts - Create contact(s)
export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Support bulk insert (CSV upload)
  const contacts = Array.isArray(body) ? body : [body]
  const rows = contacts.map(c => ({
    owner_id: user.id,
    full_name: c.full_name,
    email: c.email || null,
    phone: c.phone || null,
    company: c.company || null,
    category_id: c.category_id || null,
    notes: c.notes || null,
  }))

  const { data, error } = await supabase.from('contacts').insert(rows).select('*, contact_categories(id, name, color)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
