// API Route: External Service Requests
// POST: Submit request to external service
// GET: List service requests for transaction

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SubmitServiceRequestPayload } from '@/types/integrations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      )
    }

    const transaction_id = params.id

    // Verify access
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, agent_id, broker_id')
      .eq('id', transaction_id)
      .single()

    if (!transaction || (transaction.agent_id !== userId && transaction.broker_id !== userId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const service_type = searchParams.get('service_type')

    // Query service requests
    let query = supabase
      .from('external_service_requests')
      .select(`
        *,
        service_account:service_account_id(
          id,
          service_type,
          service_name,
          contact_person,
          contact_email
        )
      `)
      .eq('transaction_id', transaction_id)

    if (status) {
      query = query.eq('status', status)
    }
    if (service_type) {
      query = query.eq('service_type', service_type)
    }

    const { data: requests, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch service requests' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: requests || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Service requests fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      )
    }

    const transaction_id = params.id
    const body: SubmitServiceRequestPayload = await request.json()

    // Validate required fields
    if (!body.service_type || !body.request_type) {
      return NextResponse.json(
        { error: 'service_type and request_type are required' },
        { status: 400 }
      )
    }

    // Verify access
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, agent_id, broker_id')
      .eq('id', transaction_id)
      .single()

    if (!transaction || (transaction.agent_id !== userId && transaction.broker_id !== userId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get broker's service account for this service type
    const { data: profile } = await supabase
      .from('profiles')
      .select('broker_id')
      .eq('id', userId)
      .single()

    if (!profile?.broker_id) {
      return NextResponse.json(
        { error: 'Broker not found' },
        { status: 404 }
      )
    }

    const { data: serviceAccount } = await supabase
      .from('third_party_service_accounts')
      .select('id, service_type')
      .eq('broker_id', profile.broker_id)
      .eq('service_type', body.service_type)
      .eq('status', 'active')
      .single()

    if (!serviceAccount) {
      return NextResponse.json(
        { error: `No active service account for ${body.service_type}` },
        { status: 400 }
      )
    }

    // Create the service request
    const { data: serviceRequest, error } = await supabase
      .from('external_service_requests')
      .insert({
        transaction_id,
        service_account_id: serviceAccount.id,
        service_type: body.service_type,
        request_type: body.request_type,
        status: 'pending',
        request_data: body.details || {},
        due_date: body.due_date,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create service request', details: error.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      transaction_id,
      action_type: 'service_request_submitted',
      action_description: `Submitted ${body.service_type} request (${body.request_type})`,
      performed_by: userId,
      metadata: {
        service_type: body.service_type,
        request_type: body.request_type,
      },
    })

    return NextResponse.json({
      data: serviceRequest,
      message: 'Service request submitted successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Submit service request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
