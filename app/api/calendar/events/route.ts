import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { VAULT_BASE_URL } from '@/lib/vault-client'
import { sendExpoPushToUsers } from '@/lib/push-notifications'
import { adminClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ── Auth helper (Bearer token for EASE, cookies for portal) ──────── */
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

/* ── GET /api/calendar/events?month=2026-04&agent_id=xxx ──────────── */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = adminClient('calendar-broker-mgmt', { userId: user.id, context: '/api/calendar/events' })

    // Get user role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role || 'agent'

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // e.g. "2026-04"
    const targetAgent = searchParams.get('agent_id') || (role === 'agent' ? user.id : null)

    let query = admin
      .from('calendar_events')
      .select('*')
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true })

    // Filter by agent (agents see own; broker/admin can see all or specific)
    if (targetAgent) {
      query = query.eq('agent_id', targetAgent)
    }

    // Filter by month if provided
    if (month) {
      const [year, mo] = month.split('-').map(Number)
      const startDate = `${year}-${String(mo).padStart(2, '0')}-01`
      const endDate = new Date(year, mo, 0).toISOString().split('T')[0] // last day of month
      query = query.gte('event_date', startDate).lte('event_date', endDate)
    }

    const { data: events, error } = await query
    if (error) throw error

    return NextResponse.json({ events: events || [], role })
  } catch (err) {
    console.error('Calendar events GET error:', err)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }
}

/* ── POST /api/calendar/events — create a new event ───────────────── */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = adminClient('calendar-broker-mgmt', { userId: user.id, context: '/api/calendar/events' })

    const body = await request.json()
    const {
      title, type = 'other', event_date, event_time = '10:00',
      duration_min = 60, location, notes, property_address,
      client_name, transaction_id, agent_id,
    } = body

    if (!title || !event_date) {
      return NextResponse.json({ error: 'title and event_date are required' }, { status: 400 })
    }

    // Determine target agent (broker can assign events to agents)
    // P0-41 (Cluster A) — also pull tenant_id so the fan-out below is
    // bounded to the caller's own tenant. The recipient set MUST NOT cross
    // tenants under any role, including the platform super-admin.
    const { data: profile } = await admin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()
    const role = profile?.role || 'agent'
    const callerTenantId = ((profile as any)?.tenant_id ?? null) as
      | string
      | null

    let targetAgentId = user.id
    if (['broker', 'admin'].includes(role) && agent_id) {
      targetAgentId = agent_id
    }

    // P0-41 (Cluster A) — Correction 3: fail closed on missing tenant when
    // the caller would trigger a fan-out. Deny the whole request before
    // persisting an orphan event; the caller has no scope to broadcast
    // into, so proceeding would either leak (old behavior) or silently
    // drop notifications (which is worse than a clear 403).
    const willFanOut = ['broker', 'admin', 'office_manager'].includes(role)
    if (willFanOut && !callerTenantId) {
      return NextResponse.json(
        {
          error: 'tenant_required',
          message:
            'Caller profile is missing tenant_id; cannot fan out event notifications',
        },
        { status: 403 },
      )
    }

    const { data: event, error } = await admin
      .from('calendar_events')
      .insert({
        agent_id: targetAgentId,
        title,
        type,
        event_date,
        event_time,
        duration_min,
        location: location || null,
        notes: notes || null,
        property_address: property_address || null,
        client_name: client_name || null,
        transaction_id: transaction_id || null,
      })
      .select()
      .single()

    if (error) throw error

    // ── Notify all agents (in-app + email) when broker/admin/office_manager creates an event ──
    if (willFanOut) {
      try {
        // P0-41 (Cluster A) — tenant-scoped recipient query. The prior
        // implementation selected every profile in the database with no
        // filter, causing cross-tenant fan-out of in-app notifications,
        // emails, and push notifications. Recipients are now scoped to
        // the caller's own tenant. Precedent for hand-rolled inline
        // tenant derivation via `adminClient` is documented in
        // lib/security/withServiceRole.ts (`sec3a-new-leads-tenant-scope`,
        // `r3b-intakes-tenant-scope`). `callerTenantId` is guaranteed
        // non-null by the fail-closed gate above. Profiles with
        // tenant_id IS NULL are naturally excluded because PostgREST
        // `.eq('tenant_id', X)` compares by equality (NULL never equals X).
        const { data: agents } = await admin
          .from('profiles')
          .select('id, email, full_name')
          .eq('tenant_id', callerTenantId as string)

        if (agents && agents.length > 0) {
          const eventDateFormatted = new Date(event_date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          })

          // Get creator name
          const { data: creatorProfile } = await admin
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
          const creatorName = creatorProfile?.full_name || 'Management'

          // Insert in-app notifications for all users (except creator)
          const notifications = agents
            .filter((a: any) => a.id !== user.id)
            .map((a: any) => ({
              user_id: a.id,
              type: 'event',
              // Sprint D-3 Track F.0.2 — schema-drift fix: production has a
              // NOT NULL 'status' column (USER-DEFINED enum). 'unread' is
              // the canonical initial value (compliance/scan + licenses/check
              // both write 'unread').
              status: 'unread',
              title: `New Event: ${title}`,
              // Sprint D-3 Track F.0 — schema-drift fix: production column is
              // 'body' (PF-NOTIF discovery), not 'message'.
              body: `${creatorName} scheduled "${title}" on ${eventDateFormatted}${event_time ? ' at ' + event_time : ''}${location ? ' — ' + location : ''}`,
              // Sprint D-3 Track F.0.2 — schema-drift fix: production has no
              // 'data' column. The structured event reference is dropped
              // here to make INSERT succeed; push notifications still carry
              // the full payload. A future product decision can map
              // event_id -> related_id, type -> related_type,
              // '/calendar' -> action_url if a click-through path is wanted.
            }))

          if (notifications.length > 0) {
            await admin.from('notifications').insert(notifications)
          }

          // Send push notifications to agents' phones (non-blocking)
          // P0-41 (Cluster A) — switched from `sendExpoPushBroadcast` (which
          // fans out to EVERY active Expo token in the system regardless of
          // tenant) to `sendExpoPushToUsers` scoped to the tenant-filtered
          // recipient IDs. The excludeUserId parameter is preserved to
          // maintain the actor-exclusion invariant across all three
          // channels (in-app, email, push).
          const pushTitle = `New Event: ${title}`
          const pushBody = `${creatorName} scheduled "${title}" on ${eventDateFormatted}${event_time ? ' at ' + event_time : ''}${location ? ' — ' + location : ''}`
          const tenantRecipientIds = agents
            .filter((a: any) => a.id !== user.id)
            .map((a: any) => a.id)
          sendExpoPushToUsers(
            tenantRecipientIds,
            pushTitle,
            pushBody,
            { type: 'event', event_id: event.id },
            user.id,
          ).catch(() => {})

          // Send email notifications via SendGrid
          const sgKey = process.env.SENDGRID_API_KEY
          if (sgKey) {
            const sgMail = (await import('@sendgrid/mail')).default
            sgMail.setApiKey(sgKey)

            const recipientEmails = agents
              .filter((a: any) => a.id !== user.id && a.email)
              .map((a: any) => a.email)

            if (recipientEmails.length > 0) {
              const emailHtml = `
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#0A0A0B;padding:24px;border-radius:12px;text-align:center;">
    <h1 style="color:#B89B5E;font-size:20px;margin:0 0 4px;">HartFelt Real Estate</h1>
    <p style="color:#8D8D94;font-size:12px;margin:0;letter-spacing:2px;">NEW EVENT</p>
  </div>
  <div style="padding:24px 0;">
    <h2 style="color:#1F4E78;margin:0 0 16px;">${title}</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#666;width:100px;">Date</td><td style="padding:8px 0;font-weight:600;">${eventDateFormatted}</td></tr>
      ${event_time ? `<tr><td style="padding:8px 0;color:#666;">Time</td><td style="padding:8px 0;font-weight:600;">${event_time}</td></tr>` : ''}
      ${location ? `<tr><td style="padding:8px 0;color:#666;">Location</td><td style="padding:8px 0;font-weight:600;">${location}</td></tr>` : ''}
      ${notes ? `<tr><td style="padding:8px 0;color:#666;">Details</td><td style="padding:8px 0;">${notes}</td></tr>` : ''}
    </table>
    <p style="color:#666;margin-top:16px;font-size:13px;">Created by ${creatorName}</p>
  </div>
  <div style="border-top:1px solid #eee;padding-top:16px;text-align:center;">
    <a href="${VAULT_BASE_URL}/calendar" style="background:#B89B5E;color:#0A0A0B;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">View Calendar</a>
  </div>
  <p style="color:#999;font-size:11px;text-align:center;margin-top:24px;">HartFelt Real Estate — Because Choices Matter.</p>
</div>
</body></html>`

              await sgMail.sendMultiple({
                to: recipientEmails,
                from: { email: 'info@hartfeltrealestate.com', name: 'HartFelt Real Estate' },
                subject: `New Event: ${title} — ${eventDateFormatted}`,
                html: emailHtml,
              }).catch((emailErr: any) => console.error('Event email error:', emailErr))
            }
          }
        }
      } catch (notifErr) {
        // Don't fail the event creation if notifications fail
        console.error('Event notification error:', notifErr)
      }
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    console.error('Calendar events POST error:', err)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

/* ── DELETE /api/calendar/events?id=xxx ────────────────────────────── */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = adminClient('calendar-broker-mgmt', { userId: user.id, context: '/api/calendar/events' })

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')
    if (!eventId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Verify ownership (or broker/admin)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role || 'agent'

    const { data: event } = await admin
      .from('calendar_events')
      .select('agent_id')
      .eq('id', eventId)
      .single()

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    if (event.agent_id !== user.id && !['broker', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin
      .from('calendar_events')
      .delete()
      .eq('id', eventId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Calendar events DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
