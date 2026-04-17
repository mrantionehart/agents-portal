import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

// POST — approve or reject a document (broker/admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check role
    const { data: profile } = await admin
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['broker', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only broker/admin can review documents' }, { status: 403 })
    }

    const body = await request.json()
    const { document_id, action, notes } = body as {
      document_id: string
      action: 'approve' | 'reject'
      notes?: string
    }

    if (!document_id || !action) {
      return NextResponse.json({ error: 'Missing document_id or action' }, { status: 400 })
    }

    // Get document
    const { data: doc } = await admin
      .from('documents')
      .select('*, transactions!inner(agent_id)')
      .eq('id', document_id)
      .is('deleted_at', null)
      .single()

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Update status
    const newStatus = action === 'approve' ? 'verified' : 'rejected'
    const { error: updateError } = await admin
      .from('documents')
      .update({
        status: newStatus,
        verified_date: action === 'approve' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', document_id)

    if (updateError) throw updateError

    // Log to verification table
    try {
      await admin.from('document_verification_log').insert({
        document_id,
        verified_by: user.id,
        verification_type: 'manual',
        verification_status: action === 'approve' ? 'passed' : 'failed',
        notes: notes || `${action === 'approve' ? 'Approved' : 'Rejected'} by ${profile.full_name}`,
      })
    } catch {
      // Verification log table might not exist yet — non-critical
    }

    return NextResponse.json({
      document_id,
      status: newStatus,
      reviewed_by: profile.full_name,
      message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    })
  } catch (err) {
    console.error('Compliance review error:', err)
    return NextResponse.json({ error: 'Failed to review document' }, { status: 500 })
  }
}
