import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendExpoPushToUsers } from '@/lib/push-notifications'

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
    console.error('[hardening:phase-a] webhook verification failed: missing signature or secret', {
      hasSignature: !!signature,
      hasSecret: !!DOCUSIGN_WEBHOOK_SECRET,
    });
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
      console.error('[security:onboarding-webhook] invalid signature');
      return NextResponse.json(
        { error: 'Unauthorized: invalid signature' },
        { status: 401 }
      );
    }

    let event: any
    try {
      event = JSON.parse(body)
    } catch (parseErr) {
      console.error('[security:onboarding-webhook] malformed payload', parseErr)
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 400 }
      )
    }

    // ---- Replay protection (Sprint 4: C3) ----
    // Insert one row per (envelope_id, event_type, event_time) into the
    // onboarding_webhook_events idempotency table. The unique constraint
    // catches replays; on conflict we return 200 and skip every mutation.
    // Service-role client bypasses RLS — table is service-role-only.
    const envelopeId: string | undefined = event?.envelopeId
    const eventType: string | undefined = event?.eventType
    const eventTime: string | null =
      event?.signingTime || event?.completedDateTime || null

    if (envelopeId && eventType) {
      const idem = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
      const { data: inserted, error: idemErr } = await idem
        .from('onboarding_webhook_events')
        .insert({
          envelope_id: envelopeId,
          event_type: eventType,
          event_time: eventTime,
          payload: event,
        })
        .select('id')
        .single()

      if (idemErr) {
        const code = (idemErr as any).code
        // 23505 = unique_violation → this is a replay; short-circuit safely.
        if (code === '23505') {
          console.log(
            '[security:onboarding-webhook] duplicate event ignored',
            { envelopeId, eventType, eventTime }
          )
          return NextResponse.json(
            { success: true, idempotent: true, message: 'Duplicate event ignored' },
            { status: 200 }
          )
        }
        // 42P01 = undefined_table. This is the bootstrap window between
        // code deploy and the 20260603_onboarding_webhook_events.sql
        // migration landing in the database. Fail OPEN here so legitimate
        // onboarding webhooks still process; we lose replay protection
        // until the migration is applied. The loud log surfaces the gap.
        if (code === '42P01') {
          console.error(
            '[security:onboarding-webhook] idempotency table missing; replay protection disabled until migration runs',
            { hint: 'apply supabase/migrations/20260603_onboarding_webhook_events.sql' }
          )
          // Fall through to legacy processing — do NOT return here.
        } else {
          // Any other DB error: fail closed so DocuSign retries later.
          console.error(
            '[security:onboarding-webhook] idempotency insert failed',
            { code, message: idemErr.message }
          )
          return NextResponse.json(
            { error: 'Idempotency check failed' },
            { status: 500 }
          )
        }
      } else {
        console.log(
          '[security:onboarding-webhook] accepted event',
          { envelopeId, eventType, eventTime, eventId: inserted?.id }
        )
      }
    } else {
      // Missing envelope_id or event_type → cannot dedupe. Log and continue;
      // downstream handlers will likely no-op on missing fields anyway.
      console.warn(
        '[security:onboarding-webhook] no envelope_id/event_type; replay protection skipped',
        { hasEnvelopeId: !!envelopeId, hasEventType: !!eventType }
      )
    }

    // Handle different DocuSign events
    if (event.eventType === 'envelope-completed') {
      return handleEnvelopeCompleted(event)
    }

    if (event.eventType === 'envelope-signed') {
      return handleEnvelopeSigned(event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[security:onboarding-webhook] handler error', error)
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

    // Send push notifications to admins/brokers
    const adminIds = admins.map((a: any) => a.id);
    sendExpoPushToUsers(
      adminIds,
      'Agent Signed Documents',
      `${agentEmail} has completed and signed their onboarding documents.`,
      { type: 'agent_signed_documents' }
    ).catch(() => {});

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
                <a href="https://vault.hartfeltrealestate.com/agents"
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
