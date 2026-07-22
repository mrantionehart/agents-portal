import { NextRequest, NextResponse } from 'next/server'
import { sendExpoPushToUsers } from '@/lib/push-notifications'
import { adminClient, withWebhookSignature } from '@/lib/security'

// Onboarding Webhook Handler (DocuSign)
// This endpoint receives events from DocuSign when onboarding documents
// are signed. Distinct from /api/docusign/webhook which handles transaction
// envelopes — both use the same DOCUSIGN_WEBHOOK_SECRET.
//
// Sprint 8B Phase 3: module-level SUPABASE_URL/SUPABASE_SERVICE_KEY pair
// removed. Each privileged DB client is now built per-call through
// adminClient('webhook-onboarding-idempotency'), which emits a
// [security:service-role] log line.

// Sprint 5D: per-route verifyDocuSignSignature() removed; this route
// previously omitted the explicit length check before timingSafeEqual
// (which throws on length mismatch). withWebhookSignature() provides
// the explicit short-circuit centrally — both onboarding and docusign
// webhooks now go through identical verification logic.

export const POST = withWebhookSignature(
  {
    header: 'X-Docusign-Signature-1',
    secret: process.env.DOCUSIGN_WEBHOOK_SECRET,
    encoding: 'base64',
    logPrefix: '[security:onboarding-webhook]',
  },
  async (_request: NextRequest, { rawBody }) => {
  try {
    let event: any
    try {
      event = JSON.parse(rawBody)
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
      const idem = adminClient('webhook-onboarding-idempotency', { context: 'POST /api/onboarding/webhook' })
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
)

async function handleEnvelopeSigned(event: any) {
  // When an agent signs the documents, mark status as "signed"
  // and move to "awaiting_approval"

  const { envelopeId, signingTime, recipientEmail } = event

  try {
    const supabase = adminClient('webhook-onboarding-idempotency', { context: 'POST /api/onboarding/webhook' })

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
  const supabase = adminClient('webhook-onboarding-idempotency', { context: 'POST /api/onboarding/webhook' })

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
      // Sprint D-3 Option C, Step 2: production notification_type enum
      // does not contain 'agent_signed_documents' (PF-NOTIF-ENUM).
      // 'admin_alert' is the existing semantic match — the same value
      // compliance/scan + licenses/check use for broker-level alerts about
      // an agent. Adding the original value to the enum would have
      // required a schema change with no page-side icon affordance to
      // preserve, so the writer substitution is the lighter fix.
      type: 'admin_alert',
      // Sprint D-3 Track F.0.2 — schema-drift fix: production has a NOT NULL
      // 'status' column. 'unread' matches compliance/scan + licenses/check.
      status: 'unread',
      title: `Agent Signed Documents`,
      // Sprint D-3 Track F.0 — schema-drift fix: production column is 'body'
      // (PF-NOTIF discovery), not 'message'.
      body: `${agentEmail} has completed and signed their onboarding documents and is awaiting approval.`,
      // Sprint D-3 Track F.0.2 — schema-drift fixes:
      //   * 'data' column does not exist; structured reference dropped.
      //     A future product decision can map agentEmail/action to
      //     related_type='onboarding' + action_url='/agents' if wanted.
      //   * 'read: false' was writing to a non-existent column; production
      //     uses 'read_at' (NULL = unread) + the 'status' enum above.
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
  // Migrated from SendGrid to Resend (2026-07-22). Non-onboarding SendGrid
  // callers in this repo remain on SendGrid until a follow-up pass.
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM_EMAIL || 'HartFelt Compliance <noreply@hartfeltrealestate.com>';

  if (!RESEND_API_KEY) {
    console.warn('Resend not configured - skipping email notifications');
    return;
  }

  try {
    const adminEmails = admins
      .map((a: any) => a.email)
      .filter((e: string) => !!e);

    if (adminEmails.length === 0) return;

    const html = `
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
            `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: adminEmails,
        subject: `Agent Document Review Required: ${agentEmail}`,
        html,
      }),
    });

    if (!response.ok) {
      console.error('Resend error:', await response.text());
      return;
    }

    console.log(`✓ Email notification sent to ${admins.length} admins`);
  } catch (error) {
    console.error('Error sending email notifications:', error);
  }
}
