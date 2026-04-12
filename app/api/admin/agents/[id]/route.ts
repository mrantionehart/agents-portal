import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendApprovalEmail, sendRejectionEmail } from '@/lib/sendgrid';
import { suspendGoogleWorkspaceUser } from '@/lib/google-workspace';
import { Agent, AgentResponse } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/admin/agents/[id]
 * Get agent by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<AgentResponse>> {
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: agent as Agent,
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/agents/[id]
 * Update agent status (approve, reject, deactivate) or edit agent details
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<AgentResponse>> {
  try {
    const body = await req.json();
    const { action, reason, first_name, last_name, email, phone } = body;

    // Handle edit/update operations
    if (!action && (first_name || last_name || email || phone)) {
      const { data: agent, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', params.id)
        .single();

      if (fetchError || !agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (first_name) updateData.first_name = first_name;
      if (last_name) updateData.last_name = last_name;
      if (email) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;

      const { error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', params.id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { ...agent, ...updateData },
      });
    }

    // Validate action
    if (!action || !['approve', 'reject', 'deactivate'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be approve, reject, or deactivate' },
        { status: 400 }
      );
    }

    // Get agent details
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    let updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Handle approval
    if (action === 'approve') {
      updateData.status = 'approved';
      updateData.approved_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', params.id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 400 }
        );
      }

      // Send approval email
      try {
        const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await sendApprovalEmail(
          `${agent.first_name} ${agent.last_name}`,
          agent.email,
          portalUrl
        );
      } catch (emailError) {
        console.error('Warning: Failed to send approval email:', emailError);
        // Don't fail the request if email fails
      }

      return NextResponse.json(
        {
          success: true,
          data: { ...agent, ...updateData },
        },
        { status: 200 }
      );
    }

    // Handle rejection
    if (action === 'reject') {
      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Reason required for rejection' },
          { status: 400 }
        );
      }

      updateData.status = 'rejected';

      const { error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', params.id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 400 }
        );
      }

      // Send rejection email
      try {
        await sendRejectionEmail(
          `${agent.first_name} ${agent.last_name}`,
          agent.email,
          reason
        );
      } catch (emailError) {
        console.error('Warning: Failed to send rejection email:', emailError);
        // Don't fail the request if email fails
      }

      return NextResponse.json(
        {
          success: true,
          data: { ...agent, ...updateData },
        },
        { status: 200 }
      );
    }

    // Handle deactivation
    if (action === 'deactivate') {
      updateData.status = 'inactive';

      const { error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', params.id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 400 }
        );
      }

      // Deactivate Google Workspace user if workspace_email exists
      if (agent.workspace_email) {
        try {
          await suspendGoogleWorkspaceUser(agent.workspace_email);
          console.log(`Google Workspace user ${agent.workspace_email} suspended`);
        } catch (gError) {
          console.error('Warning: Failed to suspend Google Workspace user:', gError);
          // Don't fail the request if Google Workspace deactivation fails
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: { ...agent, ...updateData },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/agents/[id]
 * Delete an agent
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<AgentResponse>> {
  try {
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
