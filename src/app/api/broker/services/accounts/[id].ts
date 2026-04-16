// API Route: Service Account Detail
// GET: Get service account details
// PATCH: Update service account
// DELETE: Delete service account

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { UpdateServiceAccountRequest } from '@/types/integrations'

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
    const userRole = request.headers.get('X-User-Role')

    if (!userId || userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can view service accounts' },
        { status: 403 }
      )
    }

    // Get broker ID
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

    // Get service account
    const { data: account, error } = await supabase
      .from('third_party_service_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('broker_id', profile.broker_id)
      .single()

    if (error || !account) {
      return NextResponse.json(
        { error: 'Service account not found' },
        { status: 404 }
      )
    }

    // Remove API key
    const { api_key, ...safeAccount } = account

    return NextResponse.json({
      data: safeAccount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get service account error:', error)
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
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can update service accounts' },
        { status: 403 }
      )
    }

    const body: UpdateServiceAccountRequest = await request.json()

    // Get broker ID
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

    // Verify account belongs to broker
    const { data: existing } = await supabase
      .from('third_party_service_accounts')
      .select('id')
      .eq('id', params.id)
      .eq('broker_id', profile.broker_id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Service account not found' },
        { status: 404 }
      )
    }

    // Update the account
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (body.service_name) updateData.service_name = body.service_name
    if (body.api_key) updateData.api_key = body.api_key
    if (body.endpoint_url) updateData.endpoint_url = body.endpoint_url
    if (body.contact_person) updateData.contact_person = body.contact_person
    if (body.contact_email) updateData.contact_email = body.contact_email
    if (body.contact_phone) updateData.contact_phone = body.contact_phone
    if (body.status) updateData.status = body.status

    const { data: updated, error } = await supabase
      .from('third_party_service_accounts')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update service account' },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      action_type: 'service_account_updated',
      action_description: `Updated service account: ${params.id}`,
      performed_by: userId,
    })

    // Remove API key
    const { api_key, ...safeAccount } = updated

    return NextResponse.json({
      data: safeAccount,
      message: 'Service account updated successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Update service account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can delete service accounts' },
        { status: 403 }
      )
    }

    // Get broker ID
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

    // Verify account belongs to broker
    const { data: account } = await supabase
      .from('third_party_service_accounts')
      .select('service_name')
      .eq('id', params.id)
      .eq('broker_id', profile.broker_id)
      .single()

    if (!account) {
      return NextResponse.json(
        { error: 'Service account not found' },
        { status: 404 }
      )
    }

    // Delete the account
    const { error } = await supabase
      .from('third_party_service_accounts')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete service account' },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      action_type: 'service_account_deleted',
      action_description: `Deleted service account: ${account.service_name}`,
      performed_by: userId,
    })

    return NextResponse.json({
      message: 'Service account deleted successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Delete service account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
