// API Route: Property Valuation from Multiple Sources
// GET: Get valuations for a property from multiple sources

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PropertyValuationMultiSource } from '@/types/integrations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = decodeURIComponent(params.address)
    const searchParams = request.nextUrl.searchParams
    const city = searchParams.get('city')
    const state = searchParams.get('state')

    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      )
    }

    // Search for transactions with this address to get valuations
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id')
      .ilike('address', `%${address}%`)
      .eq('city', city)
      .eq('state', state.toUpperCase())
      .limit(1)

    let valuations = []
    let consensus_value = undefined
    let discrepancy_alert = false
    let discrepancy_details = undefined

    if (transactions && transactions.length > 0) {
      // Get valuations from database
      const { data: dbValuations } = await supabase
        .from('property_valuations')
        .select('*')
        .eq('transaction_id', transactions[0].id)
        .order('valuation_date', { ascending: false })

      valuations = (dbValuations || []).map(v => ({
        address,
        valuation_type: v.valuation_type,
        value_amount: v.value_amount,
        source: v.source || 'Database Record',
        valuation_date: v.valuation_date,
        confidence_score: v.confidence_score,
      }))

      // Calculate consensus value
      const values = valuations
        .filter(v => v.value_amount && v.confidence_score > 0.5)
        .map(v => v.value_amount)
        .sort((a, b) => a - b)

      if (values.length > 0) {
        consensus_value = values[Math.floor(values.length / 2)]

        // Check for discrepancies
        const max_val = Math.max(...values)
        const min_val = Math.min(...values)
        const variance = ((max_val - min_val) / min_val) * 100

        if (variance > 15) {
          discrepancy_alert = true
          discrepancy_details = `Valuations vary by ${variance.toFixed(1)}% (${min_val} - ${max_val})`
        }
      }
    }

    // Fetch external valuations (Zillow, tax assessor, etc.)
    // In a production system, these would call external APIs
    // For now, we'll structure the response to support them

    const response: PropertyValuationMultiSource = {
      address,
      valuations,
      consensus_value,
      value_discrepancy_alert: discrepancy_alert,
      discrepancy_details,
    }

    return NextResponse.json({
      data: response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Property valuation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
