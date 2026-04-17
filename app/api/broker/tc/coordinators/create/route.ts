import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // Only brokers can create TCs directly
    if (userRole !== 'broker') {
      return NextResponse.json(
        { success: false, error: 'Only brokers can create Transaction Coordinators' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { agent_id, tc_name, tc_email, commission_split } = body

    // Validate required fields
    if (!agent_id) {
      return NextResponse.json(
        { success: false, error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    if (!tc_name || !tc_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'TC name is required' },
        { status: 400 }
      )
    }

    if (!tc_email) {
      return NextResponse.json(
        { success: false, error: 'TC email is required' },
        { status: 400 }
      )
    }

    if (commission_split === undefined || commission_split === null) {
      return NextResponse.json(
        { success: false, error: 'Commission split is required' },
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

    if (commission_split < 0 || commission_split > 100) {
      return NextResponse.json(
        { success: false, error: 'Commission split must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Verify agent exists and belongs to this broker
    const { data: agent, error: agentError } = await supabase
      .from('profiles')
      .select('id, broker_id, role')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    if (agent.broker_id !== userId || agent.role !== 'agent') {
      return NextResponse.json(
        { success: false, error: 'Agent does not belong to your brokerage' },
        { status: 403 }
      )
    }

    // Check if email already exists in auth
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      if (existingUsers?.users.some((u: any) => u.email === tc_email)) {
        return NextResponse.json(
          { success: false, error: 'Email already in use' },
          { status: 400 }
        )
      }
    } catch (err) {
      console.error('Error checking email:', err)
      // Continue with user creation, let it fail if email exists
    }

    // Create the TC user account in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: tc_email,
      password: Math.random().toString(36).slice(-12), // Temporary password
      email_confirm: true,
      user_metadata: {
        full_name: tc_name,
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
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      email: tc_email,
      full_name: tc_name,
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
        tc_user_id: authData.user.id,
        agent_id,
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
    const { error: assignError } = await supabase.from('tc_assignments').insert({
      tc_id: tc.id,
      agent_id,
      commission_split,
      status: 'approved',
      requested_at: new Date().toISOString(),
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })

    if (assignError) {
      console.error('Error creating TC assignment:', assignError)
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Transaction Coordinator created and assigned successfully',
        data: {
          tc_id: tc.id,
          tc_user_id: authData.user.id,
          tc_name,
          tc_email,
          commission_split,
          status: 'active',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in TC creation endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
