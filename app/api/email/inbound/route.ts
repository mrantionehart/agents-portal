import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Use service role for inbound webhook — no user session available
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/email/inbound - SendGrid Inbound Parse webhook
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const from = formData.get('from') as string // "Name <email@example.com>"
    const to = formData.get('to') as string
    const subject = formData.get('subject') as string
    const text = formData.get('text') as string
    const html = formData.get('html') as string
    const envelope = formData.get('envelope') as string

    // Parse sender email from "Name <email>" format
    const emailMatch = from?.match(/<(.+?)>/) || from?.match(/([^\s]+@[^\s]+)/)
    const fromEmail = emailMatch ? emailMatch[1] : from
    const fromName = from?.replace(/<.+?>/, '').trim() || fromEmail

    // Parse recipient email
    const toMatch = to?.match(/<(.+?)>/) || to?.match(/([^\s]+@[^\s]+)/)
    const toEmail = toMatch ? toMatch[1] : to

    if (!fromEmail || !toEmail) {
      console.error('Missing from/to in inbound email:', { from, to })
      return NextResponse.json({ error: 'Invalid email data' }, { status: 400 })
    }

    // Find the user who owns this email address by checking profiles
    // Look for any user whose profile or auth email matches the to address
    const { data: users } = await supabase.auth.admin.listUsers()
    const recipientUser = users?.users?.find(u => u.email === toEmail)

    if (!recipientUser) {
      // Try to find by matching the inbound domain — deliver to all broker/admin accounts
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'broker'])

      if (admins && admins.length > 0) {
        // Deliver to all admins
        for (const admin of admins) {
          await storeEmail(admin.id, fromEmail, fromName, toEmail, subject, text, html)
        }
        return NextResponse.json({ success: true, delivered_to: admins.length })
      }

      console.log('No recipient found for inbound email to:', toEmail)
      return NextResponse.json({ success: true, note: 'No matching user found' })
    }

    // Find matching contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('owner_id', recipientUser.id)
      .eq('email', fromEmail)
      .single()

    // Find existing thread with this sender
    const { data: existingThread } = await supabase
      .from('emails')
      .select('thread_id')
      .eq('owner_id', recipientUser.id)
      .or(`from_email.eq.${fromEmail},to_email.eq.${fromEmail}`)
      .not('thread_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const threadId = existingThread?.thread_id || crypto.randomUUID()

    await storeEmail(
      recipientUser.id,
      fromEmail,
      fromName,
      toEmail,
      subject,
      text,
      html,
      contact?.id,
      threadId
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Inbound email error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function storeEmail(
  ownerId: string,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  text: string,
  html: string,
  contactId?: string,
  threadId?: string
) {
  const { error } = await supabase.from('emails').insert({
    owner_id: ownerId,
    thread_id: threadId || crypto.randomUUID(),
    direction: 'received',
    from_email: fromEmail,
    from_name: fromName,
    to_email: toEmail,
    subject: subject || '(no subject)',
    body_text: text || '',
    body_html: html || '',
    contact_id: contactId || null,
    is_read: false,
    folder: 'inbox',
  })

  if (error) console.error('Failed to store inbound email:', error)
}
