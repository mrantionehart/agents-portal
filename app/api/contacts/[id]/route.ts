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

// PUT /api/contacts/[id] - Update contact
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('contacts')
    .update({
      full_name: body.full_name,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      category_id: body.category_id || null,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('owner_id', user.id)
    .select('*, contact_categories(id, name, color)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/contacts/[id] - Delete contact
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', params.id)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
