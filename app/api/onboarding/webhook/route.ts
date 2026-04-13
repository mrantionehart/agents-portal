import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// DocuSign Webhook Handler
// This endpoint receives events from DocuSign when documents are signed

const DOCUSIGN_WEBHOOK_SECRET = process.env.DOCUSIGN_WEBHOOK_SECRET
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Verify DocuSign webhook signature
 * Prevents unauthorized/spoofed webhook calls
 */
function verifyDocuSignSignature(body: string, signature: string | null): boolean {
  if (!signature || !DOCUSIGN_WEBHOOK_SECRET) {
    console.error('Webhook verification failed: missing signature or secret');
    return false;
  }

  try {
    // DocuSign uses HMAC-SHA256 for webhook signatures (base64 encoded)
    const expected = crypto
      .createHmac('sha256', DOCUSIGN_WEBHOOK_SECRET)
      .update(body)
      .digest('base64');

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expected, 'utf8')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature from DocuSign
    const signature = request.headers.get('X-Docusign-Signature-1')
    const body = await request.text()

    // Verify webhook signature - CRITICAL for security
    if (!verifyDocuSignSignature(body, signature)) {
      console.error('Unauthorized webhook: invalid signature');
      return NextResponse.json(
        { error: 'Unauthorized: invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body)

    // Handle different DocuSign events
    if (event.eventType === 'envelope-completed') {
      return handleEnvelopeCompleted(event)
    }

    if (event.eventType === 'envelope-signed') {
      return handleEnvelopeSigned(event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}

async function handleEnvelopeSigned(event: any) {
  // When an agent signs the documents, mark status as "signed"
  // and move to "awaiting_approval"

  const { envelopeId, signingTime, recipientEmail } = event

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

    // Update the onboarding record in database
    const { error } = await supabase
      .from('onboarding_invites')
      .update({
        docusign_envelope_id: envelopeId,
        status: 'signed',
        signed_at: signingTime,
        updated_at: new Date().toISOString(),
      })
      .eq('email', recipientEmail)

    if (error) {
      console.error('Database update error:', error)
      return NextResponse.json(
        { error: 'Failed to update onboarding status' },
        { status: 500 }
      )
    }

    // Send alert to brokers/admins
    await notifyAdminsOfSignedDocuments(recipientEmail)

    return NextResponse.json({ success: true, message: 'Document signed' })
  } catch (error) {
    console.error('Error handling envelope signed:', error)
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}

async function handleEnvelopeCompleted(event: any) {
  // When the signing process is complete
  const { envelopeId, completedDateTime } = event

  return NextResponse.json({ success: true })
}

async function notifyAdminsOfSignedDocuments(agentEmail: string) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

  try {
    // Get all admin and broker users
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['admin', 'broker'])

    if (adminError || !admins || admins.length === 0) {
      console.error('Error fetching admin users:', adminError);
      return;
    }

    // Create in-app notifications for all admins/brokers
    const notifications = admins.map((admin: any) => ({
      user_id: admin.id,
      type: 'agent_signed_documents',
      title: `Agent Signed Documents`,
      message: `${agentEmail} has completed and signed their onboarding documents and is awaiting approval.`,
      data: {
        agentEmail,
        action: 'review_agent',
      },
      read: false,
      created_at: new Date().toISOString(),
    }));

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('Error creating notifications:', notificationError);
      return;
    }

    console.log(`✓ Notified ${admins.length} admins/brokers about ${agentEmail}'s signed documents`);

    // Optional: Send email notification to admins
    await notifyAdminsViaEmail(agentEmail, admins);
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}

async function notifyAdminsViaEmail(agentEmail: string, admins: any[]) {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@hartfeltrealestate.com';

  if (!SENDGRID_API_KEY) {
    console.warn('SendGrid not configured - skipping email notifications');
    return;
  }

  try {
    const adminEmails = admins.map((admin: any) => ({ email: admin.email }));

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: adminEmails,
            subject: `Agent Document Review Required: ${agentEmail}`,
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: 'HartFelt Compliance',
        },
        content: [
          {
            type: 'text/html',
            value: `
              <h2>Agent Document Review Required</h2>
              <p>Agent <strong>${agentEmail}</strong> has completed and signed their onboarding documents.</p>

              <h3>Next Steps</h3>
              <ol>
                <li>Review the agent's signed documents in the Agent Portal</li>
                <li>Verify compliance with brokerage requirements</li>
                <li>Approve or request revisions</li>
              </ol>

              <p>
                <a href="https://portal.hartfelt.com/admin/agents"
                   style="background-color: #2EC4D6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  Review Documents
                </a>
              </p>

              <p style="color: #666; font-size: 12px;">
                This is an automated notification. Do not reply to this email.
              </p>
            `,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('SendGrid error:', await response.text());
      return;
    }

    console.log(`✓ Email notification sent to ${admins.length} admins`);
  } catch (error) {
    console.error('Error sending email notifications:', error);
  }
}
