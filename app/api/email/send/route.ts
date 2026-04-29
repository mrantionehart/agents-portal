import sgMail from '@sendgrid/mail'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'info@hartfeltrealestate.com'

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
}

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

// POST /api/email/send
export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!SENDGRID_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const { to, subject, body, bodyHtml, contactId, replyToThreadId } = await request.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
  }

  // Get sender profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const senderName = profile?.full_name || 'HartFelt Real Estate'

  try {
    // Send via SendGrid
    const msg = {
      to,
      from: { email: FROM_EMAIL, name: senderName },
      replyTo: FROM_EMAIL,
      subject,
      text: body,
      html: bodyHtml || body.replace(/\n/g, '<br>'),
    }

    const [response] = await sgMail.send(msg)
    const messageId = response?.headers?.['x-message-id'] || null

    // Determine thread ID
    const threadId = replyToThreadId || crypto.randomUUID()

    // Store in emails table
    const { data: email, error } = await supabase
      .from('emails')
      .insert({
        owner_id: user.id,
        thread_id: threadId,
        direction: 'sent',
        from_email: FROM_EMAIL,
        from_name: senderName,
        to_email: to,
        to_name: null,
        subject,
        body_text: body,
        body_html: bodyHtml || body.replace(/\n/g, '<br>'),
        contact_id: contactId || null,
        is_read: true,
        folder: 'sent',
        sendgrid_message_id: messageId,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to store sent email:', error)
      // Email was still sent even if storage fails
    }

    return NextResponse.json({ success: true, email, messageId })
  } catch (err: any) {
    console.error('SendGrid error:', err?.response?.body || err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
