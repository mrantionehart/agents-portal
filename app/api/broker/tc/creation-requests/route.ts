import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendTCCreationRequestNotification } from '@/lib/sendgrid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const ADMIN_RECIPIENTS = ['mrhart@hartfeltrealestate.com', 'admin@hartfeltrealestate.com']
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Agents see their own creation requests
    if (userRole === 'agent') {
      const { data: requests, error } = await supabase
        .from('tc_creation_requests')
        .select('*')
        .eq('agent_id', userId)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('Error fetching TC creation requests:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: requests || [],
      })
    }

    // Brokers see all their agents' creation requests
    if (userRole === 'broker') {
      const { data: requests, error } = await supabase
        .from('tc_creation_requests')
        .select('*')
        .eq('broker_id', userId)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('Error fetching TC creation requests:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: requests || [],
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized role' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in TC creation requests GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Only agents can create TC requests
    if (userRole !== 'agent') {
      return NextResponse.json(
        { success: false, error: 'Only agents can request new TCs' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { tc_name, tc_email, commission_split } = body

    if (!tc_name || !tc_email || commission_split === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tc_name, tc_email, commission_split' },
        { status: 400 }
      )
    }

    if (commission_split < 0 || commission_split > 100) {
      return NextResponse.json(
        { success: false, error: 'Commission split must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(tc_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Get agent's broker ID and profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('broker_id, role')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'User profile not found. Please contact your broker to set up your account.' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found. Please contact your broker.' },
        { status: 400 }
      )
    }

    if (!profile.broker_id) {
      return NextResponse.json(
        { success: false, error: `User role is "${profile.role}". Only agents can create TC requests.` },
        { status: 400 }
      )
    }

    // Create the TC creation request
    const { data: request, error } = await supabase
      .from('tc_creation_requests')
      .insert({
        agent_id: userId,
        broker_id: profile.broker_id,
        tc_name,
        tc_email,
        commission_split,
        status: 'pending_approval',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating TC creation request:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    // Send notification email to admins
    try {
      // Get agent profile information
      const { data: agentProfile, error: agentError } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      if (agentError) {
        console.error('Error fetching agent profile:', agentError)
      }

      // Get broker profile information
      const { data: brokerProfile, error: brokerError } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', profile.broker_id)
        .single()

      if (brokerError) {
        console.error('Error fetching broker profile:', brokerError)
      }

      const agentName = agentProfile?.full_name || 'Unknown Agent'
      const agentEmail = agentProfile?.email || 'unknown@example.com'
      const brokerName = brokerProfile?.full_name || 'Unknown Broker'
      const brokerEmail = brokerProfile?.email || 'unknown@example.com'

      const approvalUrl = `${APP_URL}/transaction-coordinator?tab=tc-creation-approvals`

      await sendTCCreationRequestNotification({
        agentName,
        agentEmail,
        tcName: tc_name,
        tcEmail: tc_email,
        commissionSplit: commission_split,
        brokerName,
        brokerEmail,
        approvalUrl,
        recipients: ADMIN_RECIPIENTS,
      })

      console.log('TC creation request notification email sent successfully')
    } catch (emailError) {
      console.error('Failed to send TC creation request notification:', emailError)
      // Don't fail the request if email fails, just log the error
    }

    // Create notification for agent
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'request_submission',
        title: 'TC Creation Request Submitted',
        message: `Your transaction coordinator creation request for ${tc_name} has been submitted. Your broker will review and approve shortly.`,
        data: {
          request_id: request.id,
          tc_name: tc_name,
          status: request.status,
        },
        read: false,
      })
      console.log('Agent notification created successfully')
    } catch (notificationError) {
      console.error('Failed to create agent notification:', notificationError)
      // Don't fail the request if notification fails, just log the error
    }

    return NextResponse.json(
      {
        success: true,
        message: 'TC creation request submitted successfully',
        data: request,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in TC creation requests POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Only brokers can approve/deny TC creation requests
    if (userRole !== 'broker') {
      return NextResponse.json(
        { success: false, error: 'Only brokers can approve TC creation requests' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { request_id, action, denial_reason } = body

    if (!request_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: request_id, action' },
        { status: 400 }
      )
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be either "approve" or "deny"' },
        { status: 400 }
      )
    }

    // Get the TC creation request
    const { data: tcRequest, error: fetchError } = await supabase
      .from('tc_creation_requests')
      .select('*')
      .eq('id', request_id)
      .eq('broker_id', userId)
      .single()

    if (fetchError || !tcRequest) {
      return NextResponse.json(
        { success: false, error: 'TC creation request not found' },
        { status: 404 }
      )
    }

    if (tcRequest.status !== 'pending_approval') {
      return NextResponse.json(
        { success: false, error: 'Request is not in pending approval status' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Create the TC user account in auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: tcRequest.tc_email,
        password: Math.random().toString(36).slice(-12), // Temporary password
        email_confirm: true,
        user_metadata: {
          full_name: tcRequest.tc_name,
        },
      })

      if (authError || !authData.user) {
        console.error('Error creating TC auth user:', authError)
        return NextResponse.json(
          { success: false, error: 'Failed to create TC user account' },
          { status: 400 }
        )
      }

      // Create the TC user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: tcRequest.tc_email,
          full_name: tcRequest.tc_name,
          role: 'tc',
          broker_id: userId,
        })

      if (profileError) {
        console.error('Error creating TC profile:', profileError)
      }

      // Create the transaction coordinator record
      const { data: tc, error: tcError } = await supabase
        .from('transaction_coordinators')
        .insert({
          agent_id: tcRequest.agent_id,
          tc_user_id: authData.user.id,
          broker_id: userId,
          status: 'active',
          hire_date: new Date().toISOString(),
        })
        .select()
        .single()

      if (tcError) {
        console.error('Error creating transaction coordinator:', tcError)
        return NextResponse.json(
          { success: false, error: 'Failed to create transaction coordinator' },
          { status: 400 }
        )
      }

      // Create the TC assignment
      const { error: assignError } = await supabase
        .from('tc_assignments')
        .insert({
          tc_id: tc.id,
          agent_id: tcRequest.agent_id,
          commission_split: tcRequest.commission_split,
          status: 'approved',
          requested_at: new Date().toISOString(),
        })

      if (assignError) {
        console.error('Error creating TC assignment:', assignError)
      }

      // Update the TC creation request
      const { data: updatedRequest, error: updateError } = await supabase
        .from('tc_creation_requests')
        .update({
          status: 'approved',
          created_tc_id: tc.id,
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq('id', request_id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating TC creation request:', updateError)
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'TC creation request approved and TC created successfully',
        data: updatedRequest,
      })
    } else {
      // Deny the request
      const { data: updatedRequest, error: updateError } = await supabase
        .from('tc_creation_requests')
        .update({
          status: 'denied',
          denial_reason: denial_reason || null,
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq('id', request_id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating TC creation request:', updateError)
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'TC creation request denied',
        data: updatedRequest,
      })
    }
  } catch (error) {
    console.error('Error in TC creation requests PATCH:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
