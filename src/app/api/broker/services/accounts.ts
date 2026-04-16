// API Route: Service Accounts Management
// GET: List service accounts for broker
// POST: Create new service account

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { CreateServiceAccountRequest, ServiceAccountResponse } from '@/types/integrations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can manage service accounts' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const service_type = searchParams.get('service_type')
    const status = searchParams.get('status')

    // Get broker ID from profiles
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

    // Query service accounts
    let query = supabase
      .from('third_party_service_accounts')
      .select('*')
      .eq('broker_id', profile.broker_id)

    if (service_type) {
      query = query.eq('service_type', service_type)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data: accounts, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch service accounts' },
        { status: 500 }
      )
    }

    // Remove API keys from response for security
    const safeAccounts = accounts?.map(acc => {
      const { api_key, ...safe } = acc
      return safe
    }) || []

    return NextResponse.json({
      data: safeAccounts,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Service accounts fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can create service accounts' },
        { status: 403 }
      )
    }

    const body: CreateServiceAccountRequest = await request.json()

    // Validate required fields
    if (!body.service_type || !body.service_name || !body.account_id) {
      return NextResponse.json(
        { error: 'service_type, service_name, and account_id are required' },
        { status: 400 }
      )
    }

    // Get broker ID from profiles
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

    // Create the account
    const { data: account, error } = await supabase
      .from('third_party_service_accounts')
      .insert({
        broker_id: profile.broker_id,
        service_type: body.service_type,
        service_name: body.service_name,
        account_id: body.account_id,
        api_key: body.api_key,
        endpoint_url: body.endpoint_url,
        auth_method: body.auth_method || 'api_key',
        contact_person: body.contact_person,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        status: 'testing',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create service account', details: error.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      action_type: 'service_account_created',
      action_description: `Created service account: ${body.service_name}`,
      performed_by: userId,
      metadata: {
        service_type: body.service_type,
        service_name: body.service_name,
      },
    })

    // Remove API key from response
    const { api_key, ...safeAccount } = account
    return NextResponse.json({
      data: safeAccount,
      message: 'Service account created successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Create service account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
