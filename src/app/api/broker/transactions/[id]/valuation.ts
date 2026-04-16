// API Route: Property Valuation Logging
// POST: Log a property valuation for a transaction
// GET: Get valuations for a transaction

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { LogPropertyValuationRequest } from '@/types/integrations'

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

    // Get valuations
    const { data: valuations, error } = await supabase
      .from('property_valuations')
      .select('*')
      .eq('transaction_id', transaction_id)
      .order('valuation_date', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch valuations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: valuations || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get valuations error:', error)
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
    const body: LogPropertyValuationRequest = await request.json()

    // Validate required fields
    if (!body.valuation_type || !body.value_amount) {
      return NextResponse.json(
        { error: 'valuation_type and value_amount are required' },
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

    // Create valuation record
    const { data: valuation, error } = await supabase
      .from('property_valuations')
      .insert({
        transaction_id,
        valuation_type: body.valuation_type,
        valuation_date: new Date().toISOString(),
        value_amount: body.value_amount,
        source: body.source || 'Manual Entry',
        confidence_score: body.confidence_score || 0.75,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create valuation', details: error.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      transaction_id,
      action_type: 'valuation_logged',
      action_description: `Logged ${body.valuation_type} valuation: $${body.value_amount}`,
      performed_by: userId,
      metadata: {
        valuation_type: body.valuation_type,
        value_amount: body.value_amount,
      },
    })

    return NextResponse.json({
      data: valuation,
      message: 'Valuation logged successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Log valuation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
