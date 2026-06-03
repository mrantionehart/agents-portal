import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Sprint 8B Phase 2B: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B Phase 2A:
//   compliance_notifications / Users can read own compliance notifications /
//     SELECT / {authenticated} / (auth.uid() = recipient_id)
//   compliance_notifications / Users can update own compliance notifications /
//     UPDATE / {authenticated} / (auth.uid() = recipient_id)
// INSERT path is intentionally absent for non-service-role; the four
// compliance writer routes (upload, review, scan, closeiq) keep their
// service-role inserts unchanged — that is Category A by design.

// GET — fetch compliance notifications for current user
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('compliance_notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.is('read_at', null)
    }

    const { data: notifications, error } = await query
    if (error) throw error

    // Get unread count
    const { count } = await supabase
      .from('compliance_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: count || 0,
    })
  } catch (err) {
    console.error('Notifications fetch error:', err)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

// PATCH — mark notification(s) as read
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)

    const body = await request.json()
    const { notification_id, mark_all } = body as {
      notification_id?: string
      mark_all?: boolean
    }

    // RLS UPDATE qual=(auth.uid() = recipient_id) is the actual security
    // boundary; the .eq('recipient_id', user.id) filter remains as a
    // query-plan hint and belt-and-braces guard.
    if (mark_all) {
      await supabase
        .from('compliance_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .is('read_at', null)
    } else if (notification_id) {
      await supabase
        .from('compliance_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification_id)
        .eq('recipient_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Notification update error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
