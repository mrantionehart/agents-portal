// API Route: MLS Listing Detail
// GET: Get full MLS listing details by MLS number

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { MLSListing, ComparableSalesAnalysis } from '@/types/integrations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { mls_number: string } }
) {
  try {
    const mls_number = params.mls_number

    // Get the MLS listing
    const { data: listing, error: listingError } = await supabase
      .from('mls_listings')
      .select('*')
      .eq('mls_number', mls_number)
      .single()

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'MLS listing not found' },
        { status: 404 }
      )
    }

    // Get comparable sales for this property
    const property_details = listing.property_details || {}
    const market_area = `${listing.city}, ${listing.state}`

    let comparables: ComparableSalesAnalysis | null = null

    if (property_details.beds || property_details.baths || property_details.sqft) {
      const { data: comparableSales, error: comparablesError } = await supabase
        .from('comparable_sales')
        .select('*')
        .eq('market_area', market_area)
        .order('sale_date', { ascending: false })
        .limit(10)

      if (!comparablesError && comparableSales) {
        // Filter comparables by similarity
        const filtered = comparableSales.filter(comp => {
          const comp_details = comp.property_details || {}
          const beds_match = !property_details.beds || comp_details.beds === property_details.beds
          const baths_match = !property_details.baths || comp_details.baths === property_details.baths
          const sqft_match = !property_details.sqft || (
            comp_details.sqft &&
            comp_details.sqft >= property_details.sqft * 0.9 &&
            comp_details.sqft <= property_details.sqft * 1.1
          )
          return beds_match || baths_match || sqft_match
        })

        if (filtered.length > 0) {
          const prices = filtered.map(c => c.sale_price).filter(Boolean) as number[]
          const domsArray = filtered
            .map(c => c.days_on_market)
            .filter((d): d is number => d !== null && d !== undefined)

          comparables = {
            property_address: listing.address,
            comparables: filtered,
            statistics: {
              median_price: prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0,
              average_price: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
              price_range: {
                min: prices.length > 0 ? Math.min(...prices) : 0,
                max: prices.length > 0 ? Math.max(...prices) : 0,
              },
              average_days_on_market: domsArray.length > 0
                ? domsArray.reduce((a, b) => a + b, 0) / domsArray.length
                : undefined,
            },
          }
        }
      }
    }

    // Get market analysis
    const { data: marketSnapshot } = await supabase
      .from('market_data_snapshot')
      .select('market_metrics')
      .eq('market_area', market_area)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    // Get valuations for transactions linked to this listing
    const { data: valuations } = await supabase
      .from('property_valuations')
      .select('*')
      .in('transaction_id', [
        // Subquery to get transactions linked to this MLS listing
        (await supabase
          .from('transaction_mls_link')
          .select('transaction_id')
          .eq('mls_number', mls_number)
          .then(res => res.data?.map(r => r.transaction_id) || []))
      ])

    return NextResponse.json({
      data: {
        listing,
        comparables,
        market_data: marketSnapshot?.market_metrics,
        valuations: valuations || [],
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('MLS listing detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
