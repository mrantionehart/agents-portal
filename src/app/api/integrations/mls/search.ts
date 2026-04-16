// API Route: MLS Search
// GET: Search MLS listings with filters

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { MLSSearchQuery, MLSSearchResponse } from '@/types/integrations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const address = searchParams.get('address')
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const zip = searchParams.get('zip')
    const status = searchParams.get('status')
    const listing_type = searchParams.get('listing_type')
    const price_min = searchParams.get('price_min')
    const price_max = searchParams.get('price_max')
    const beds_min = searchParams.get('beds_min')
    const baths_min = searchParams.get('baths_min')
    const sqft_min = searchParams.get('sqft_min')
    const list_date_from = searchParams.get('list_date_from')
    const list_date_to = searchParams.get('list_date_to')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    // Start query
    let query = supabase
      .from('mls_listings')
      .select('*', { count: 'exact' })

    // Apply filters
    if (address) {
      query = query.ilike('address', `%${address}%`)
    }
    if (city) {
      query = query.ilike('city', `%${city}%`)
    }
    if (state) {
      query = query.eq('state', state.toUpperCase())
    }
    if (zip) {
      query = query.eq('zip', zip)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (listing_type) {
      query = query.eq('listing_type', listing_type)
    }
    if (price_min) {
      query = query.gte('list_price', parseFloat(price_min))
    }
    if (price_max) {
      query = query.lte('list_price', parseFloat(price_max))
    }
    if (beds_min) {
      const beds_int = parseInt(beds_min, 10)
      query = query.gte('property_details->beds', beds_int)
    }
    if (baths_min) {
      const baths_int = parseInt(baths_min, 10)
      query = query.gte('property_details->baths', baths_int)
    }
    if (sqft_min) {
      const sqft_int = parseInt(sqft_min, 10)
      query = query.gte('property_details->sqft', sqft_int)
    }
    if (list_date_from) {
      query = query.gte('list_date', list_date_from)
    }
    if (list_date_to) {
      query = query.lte('list_date', list_date_to)
    }

    // Order by most recent
    query = query.order('list_date', { ascending: false })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to search MLS listings', details: error.message },
        { status: 500 }
      )
    }

    const response: MLSSearchResponse = {
      listings: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    }

    return NextResponse.json({
      data: response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('MLS search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
