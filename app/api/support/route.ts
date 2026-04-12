import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

const sgApiKey = process.env.SENDGRID_API_KEY
if (sgApiKey) {
  sgMail.setApiKey(sgApiKey)
}

export async function POST(request: NextRequest) {
  try {
    const { email, name, subject, message } = await request.json()

    // Validate required fields
    if (!email || !name || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Send email to admin
    await sgMail.send({
      to: 'admin@hartfeltrealestate.com',
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@hartfeltmg.com',
      replyTo: email,
      subject: `Support Request from ${name}: ${subject}`,
      html: `
        <h2>Support Request</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    })

    return NextResponse.json(
      { success: true, message: 'Support request sent successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Support email error:', error)
    return NextResponse.json(
      { error: 'Failed to send support request' },
      { status: 500 }
    )
  }
}
