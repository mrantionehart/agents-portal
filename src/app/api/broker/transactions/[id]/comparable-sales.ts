// API Route: Get Comparable Sales for Transaction Property
// GET: Get comparable sales for the transaction's property

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ComparableSalesAnalysis } from '@/types/integrations'

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
    const searchParams = request.nextUrl.searchParams

    // Get query parameters
    const distance_miles = parseInt(searchParams.get('distance') || '5', 10)
    const sqft_variance = parseInt(searchParams.get('variance') || '10', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Verify user has access and get transaction details
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, agent_id, broker_id, address, city, state, zip')
      .eq('id', transaction_id)
      .single()

    if (!transaction || (transaction.agent_id !== userId && transaction.broker_id !== userId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Try to get property details from linked MLS listing
    const { data: mlsLink } = await supabase
      .from('transaction_mls_link')
      .select('mls_number')
      .eq('transaction_id', transaction_id)
      .single()

    let property_details: any = {}

    if (mlsLink) {
      const { data: mlsListing } = await supabase
        .from('mls_listings')
        .select('property_details')
        .eq('mls_number', mlsLink.mls_number)
        .single()

      if (mlsListing) {
        property_details = mlsListing.property_details || {}
      }
    }

    // Get comparable sales
    const market_area = `${transaction.city}, ${transaction.state}`

    let query = supabase
      .from('comparable_sales')
      .select('*')
      .eq('market_area', market_area)
      .order('sale_date', { ascending: false })

    // Filter by property characteristics
    if (property_details.beds) {
      query = query.eq('property_details->beds', property_details.beds)
    }
    if (property_details.baths) {
      query = query.eq('property_details->baths', property_details.baths)
    }

    const { data: comparables, error } = await query.limit(limit * 2) // Get extra to filter

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch comparable sales' },
        { status: 500 }
      )
    }

    // Filter by sqft variance if available
    let filtered = comparables || []

    if (property_details.sqft) {
      const min_sqft = property_details.sqft * (1 - sqft_variance / 100)
      const max_sqft = property_details.sqft * (1 + sqft_variance / 100)

      filtered = filtered.filter(comp => {
        const comp_sqft = comp.property_details?.sqft
        return comp_sqft && comp_sqft >= min_sqft && comp_sqft <= max_sqft
      })
    }

    // Take only requested limit
    const results = filtered.slice(0, limit)

    // Calculate statistics
    const prices = results
      .map(c => c.sale_price)
      .filter((p): p is number => p !== null && p !== undefined)

    const domsArray = results
      .map(c => c.days_on_market)
      .filter((d): d is number => d !== null && d !== undefined)

    const sorted_prices = prices.sort((a, b) => a - b)

    const analysis: ComparableSalesAnalysis = {
      property_address: transaction.address || 'Unknown',
      comparables: results,
      statistics: {
        median_price: sorted_prices.length > 0
          ? sorted_prices[Math.floor(sorted_prices.length / 2)]
          : 0,
        average_price: prices.length > 0
          ? prices.reduce((a, b) => a + b, 0) / prices.length
          : 0,
        price_range: {
          min: prices.length > 0 ? Math.min(...prices) : 0,
          max: prices.length > 0 ? Math.max(...prices) : 0,
        },
        average_days_on_market: domsArray.length > 0
          ? domsArray.reduce((a, b) => a + b, 0) / domsArray.length
          : undefined,
        median_price_per_sqft: results.length > 0
          ? results
              .map(c => c.price_per_sqft)
              .filter((p): p is number => p !== null && p !== undefined)
              .sort((a, b) => a - b)[Math.floor(results.length / 2)]
          : undefined,
      },
    }

    return NextResponse.json({
      data: analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Comparable sales error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
