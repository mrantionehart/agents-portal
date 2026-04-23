import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

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

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role || 'agent'

    let targetAgentId = user.id
    if (['broker', 'admin'].includes(role) && agent_id) {
      targetAgentId = agent_id
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
    if (['broker', 'admin', 'office_manager'].includes(role)) {
      try {
        // Get all active agent profiles for notifications
        const { data: agents } = await admin
          .from('profiles')
          .select('id, email, full_name')

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
              title: `New Event: ${title}`,
              message: `${creatorName} scheduled "${title}" on ${eventDateFormatted}${event_time ? ' at ' + event_time : ''}${location ? ' — ' + location : ''}`,
              data: { event_id: event.id, event_date, event_time, location, type: type },
            }))

          if (notifications.length > 0) {
            await admin.from('notifications').insert(notifications)
          }

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
    <a href="https://hartfelt-vault.vercel.app/calendar" style="background:#B89B5E;color:#0A0A0B;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">View Calendar</a>
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

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
