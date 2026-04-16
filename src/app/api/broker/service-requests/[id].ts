// API Route: Service Request Detail
// GET: Get detailed status of external service request
// PATCH: Update service request status (webhook handler)

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ServiceRequestStatusUpdate } from '@/types/integrations'

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

    // Get the service request with related data
    const { data: serviceRequest, error } = await supabase
      .from('external_service_requests')
      .select(`
        *,
        transaction:transaction_id(
          id,
          title,
          agent_id,
          broker_id
        ),
        service_account:service_account_id(
          id,
          service_type,
          service_name,
          contact_person,
          contact_email
        )
      `)
      .eq('id', params.id)
      .single()

    if (error || !serviceRequest) {
      return NextResponse.json(
        { error: 'Service request not found' },
        { status: 404 }
      )
    }

    // Verify access
    if (serviceRequest.transaction?.agent_id !== userId && serviceRequest.transaction?.broker_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      data: serviceRequest,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get service request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // For webhooks, verify origin (in production, validate webhook signature)
    const body = await request.json()

    // Get the service request
    const { data: serviceRequest } = await supabase
      .from('external_service_requests')
      .select('id, transaction_id, service_type, status')
      .eq('id', params.id)
      .single()

    if (!serviceRequest) {
      return NextResponse.json(
        { error: 'Service request not found' },
        { status: 404 }
      )
    }

    // Update the request status
    const updateData: Record<string, any> = {
      status: body.status || 'in_progress',
      updated_at: new Date().toISOString(),
    }

    if (body.response_data) {
      updateData.response_data = body.response_data
    }
    if (body.completed_date) {
      updateData.completed_date = body.completed_date
    }
    if (body.external_id) {
      updateData.external_id = body.external_id
    }

    const { data: updated, error } = await supabase
      .from('external_service_requests')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update service request' },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      transaction_id: serviceRequest.transaction_id,
      action_type: 'service_request_status_updated',
      action_description: `Service request status updated to ${body.status}`,
      metadata: {
        service_type: serviceRequest.service_type,
        status: body.status,
      },
    })

    return NextResponse.json({
      data: updated,
      message: 'Service request updated successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Update service request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
