import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendDocuSignEnvelope } from '@/lib/docusign';
import { sendWelcomeEmail } from '@/lib/sendgrid';
import { sendAgentOnboardingSMS } from '@/lib/twilio';
import { generateTemporaryPassword } from '@/lib/google-workspace';
import { CreateAgentRequest, Agent, AgentResponse } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/admin/agents
 * List all agents with their status
 */
export async function GET(req: NextRequest): Promise<NextResponse<any>> {
  try {
    // Verify admin access (you would add proper auth check here)
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: agents as Agent[],
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/agents
 * Create new agent and trigger provisioning
 */
export async function POST(req: NextRequest): Promise<NextResponse<AgentResponse>> {
  try {
    const body: CreateAgentRequest = await req.json();
    const { first_name, last_name, email, phone } = body;

    // Validate input
    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate workspace email
    const workspace_email = `${first_name.toLowerCase()}.${last_name.toLowerCase()}@hartfeltrealestate.com`;

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // 1. Create agent record in Supabase
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert([
        {
          first_name,
          last_name,
          email,
          phone,
          workspace_email,
          status: 'awaiting_signature',
        },
      ])
      .select()
      .single();

    if (agentError) {
      return NextResponse.json(
        { success: false, error: agentError.message },
        { status: 400 }
      );
    }

    try {
      // 2. Create Supabase authentication user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: workspace_email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
        },
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
      } else if (authData.user) {
        // Update agent with supabase_user_id
        await supabase
          .from('agents')
          .update({ supabase_user_id: authData.user.id })
          .eq('id', agent.id);
      }

      // 3. Send welcome email
      const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await sendWelcomeEmail({
        agentName: `${first_name} ${last_name}`,
        personalEmail: email,
        workspaceEmail: workspace_email,
        temporaryPassword,
        portalUrl,
      });

      // 3b. Send Twilio SMS notification
      if (phone) {
        try {
          await sendAgentOnboardingSMS(phone, email);
        } catch (smsError) {
          console.warn('Warning: Failed to send SMS notification:', smsError);
          // Don't fail the agent creation if SMS fails
        }
      }

      // 4. Send DocuSign envelope
      try {
        // Read the combined HartFelt onboarding packet PDF
        const pdfPath = path.join(process.cwd(), 'public', 'HartFelt_Agent_Onboarding_Packet.pdf');
        let pdfBase64 = '';

        try {
          const pdfBuffer = await fs.readFile(pdfPath);
          pdfBase64 = pdfBuffer.toString('base64');
          console.log('✓ Loaded onboarding PDF for DocuSign');
        } catch {
          console.warn('⚠ Onboarding PDF not found at', pdfPath);
          console.warn('⚠ Using placeholder PDF for DocuSign - agent will need to retry');
          // Create minimal PDF for demo (production should use real PDF)
          pdfBase64 = Buffer.from('%PDF-1.4\n%demo').toString('base64');
        }

        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/docusign/webhook`;
        const envelope = await sendDocuSignEnvelope(
          email,
          `${first_name} ${last_name}`,
          pdfBase64,
          webhookUrl
        );

        // Update agent with docusign_envelope_id
        await supabase
          .from('agents')
          .update({ docusign_envelope_id: envelope.envelopeId })
          .eq('id', agent.id);
      } catch (docuSignError) {
        console.error('Warning: DocuSign envelope send failed:', docuSignError);
        // Don't fail the entire request if DocuSign fails
        // Admin can retry manually
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            ...agent,
            docusign_envelope_id: agent.docusign_envelope_id,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error in provisioning steps:', error);
      // Return success for agent creation, but provisioning had issues
      return NextResponse.json(
        {
          success: true,
          data: agent,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
