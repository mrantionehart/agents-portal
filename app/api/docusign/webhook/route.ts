import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { DocuSignWebhookPayload } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/docusign/webhook
 * Handle DocuSign envelope status change webhooks
 *
 * This endpoint receives webhook notifications from DocuSign when:
 * - Envelope is sent to signer
 * - Envelope is opened by signer
 * - Envelope is signed by signer
 * - Envelope is completed
 * - Envelope is declined
 * - Envelope is voided
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: DocuSignWebhookPayload = await req.json();

    // Log webhook for debugging
    console.log('DocuSign webhook received:', JSON.stringify(body, null, 2));

    // Extract envelope information from webhook payload
    const envelopeStatus = body.eventNotification?.envelopeStatus;

    if (!envelopeStatus) {
      console.warn('No envelope status in webhook payload');
      return NextResponse.json(
        { success: true, message: 'Webhook received but no envelope status' },
        { status: 200 }
      );
    }

    const { envelopeId, status } = envelopeStatus;

    if (!envelopeId) {
      console.warn('No envelope ID in webhook payload');
      return NextResponse.json(
        { success: true, message: 'Webhook received but no envelope ID' },
        { status: 200 }
      );
    }

    // Find agent by docusign_envelope_id
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('docusign_envelope_id', envelopeId)
      .single();

    if (fetchError) {
      console.warn(`Agent not found for envelope ${envelopeId}`);
      // Don't fail - DocuSign needs a 2xx response or it will retry
      return NextResponse.json(
        { success: true, message: 'Agent not found for envelope' },
        { status: 200 }
      );
    }

    // Update agent record based on envelope status
    let updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status === 'sent') {
      console.log(`Envelope ${envelopeId} sent to ${agent.email}`);
      // Already in 'awaiting_signature' status, no update needed
      return NextResponse.json(
        { success: true, message: 'Envelope sent' },
        { status: 200 }
      );
    }

    if (status === 'delivered') {
      console.log(`Envelope ${envelopeId} delivered to ${agent.email}`);
      // Envelope was delivered to signer
      return NextResponse.json(
        { success: true, message: 'Envelope delivered' },
        { status: 200 }
      );
    }

    if (status === 'signed') {
      console.log(`Envelope ${envelopeId} signed by ${agent.email}`);
      updateData.status = 'signed';
      updateData.signed_at = new Date().toISOString();
    }

    if (status === 'completed') {
      console.log(`Envelope ${envelopeId} completed for ${agent.email}`);
      updateData.status = 'signed';
      updateData.signed_at = new Date().toISOString();
    }

    if (status === 'declined') {
      console.log(`Envelope ${envelopeId} declined by ${agent.email}`);
      updateData.status = 'declined';
      // Admin can have agent re-sign or reject application
    }

    if (status === 'voided') {
      console.log(`Envelope ${envelopeId} voided for ${agent.email}`);
      updateData.status = 'voided';
    }

    // Only update if there's something to update
    if (Object.keys(updateData).length > 1) {
      const { error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', agent.id);

      if (updateError) {
        console.error(`Error updating agent status for envelope ${envelopeId}:`, updateError);
        // Still return 200 so DocuSign doesn't retry
      }
    }

    // Always return 200 to acknowledge receipt (DocuSign requirement)
    return NextResponse.json(
      { success: true, message: `Webhook processed for envelope ${envelopeId}` },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing DocuSign webhook:', error);
    // Return 200 to prevent DocuSign from retrying
    // (we've logged the error for investigation)
    return NextResponse.json(
      { success: false, error: 'Error processing webhook', details: String(error) },
      { status: 200 }
    );
  }
}
