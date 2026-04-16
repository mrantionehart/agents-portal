// API Route: Market Data by Address
// GET: Get market analysis for the area around an address

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { MarketAnalysis } from '@/types/integrations'

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

    // Parse city and state from address or query params
    const city = searchParams.get('city')
    const state = searchParams.get('state')

    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      )
    }

    const market_area = `${city}, ${state}`
    const include_comparables = searchParams.get('include_comparables') === 'true'
    const include_trends = searchParams.get('include_trends') === 'true'

    // Get current market snapshot
    const { data: currentSnapshot } = await supabase
      .from('market_data_snapshot')
      .select('*')
      .eq('market_area', market_area)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    // Get historical market data (12 months)
    const { data: historicalSnapshots } = await supabase
      .from('market_data_snapshot')
      .select('*')
      .eq('market_area', market_area)
      .order('snapshot_date', { ascending: false })
      .limit(12)

    // Get comparable sales if requested
    let comparables = undefined
    if (include_comparables) {
      const { data: sales } = await supabase
        .from('comparable_sales')
        .select('*')
        .eq('market_area', market_area)
        .order('sale_date', { ascending: false })
        .limit(20)

      comparables = sales || undefined
    }

    // Calculate trends if requested
    let trends = undefined
    if (include_trends && historicalSnapshots && historicalSnapshots.length > 1) {
      const current = currentSnapshot?.market_metrics || {}
      const oldest = historicalSnapshots[historicalSnapshots.length - 1]?.market_metrics || {}

      const currentPrice = typeof current.median_price === 'number' ? current.median_price : 0
      const oldestPrice = typeof oldest.median_price === 'number' ? oldest.median_price : currentPrice

      const price_trend_12m = oldestPrice > 0
        ? ((currentPrice - oldestPrice) / oldestPrice) * 100
        : 0

      const currentDom = typeof current.avg_days_on_market === 'number' ? current.avg_days_on_market : 0
      const oldestDom = typeof oldest.avg_days_on_market === 'number' ? oldest.avg_days_on_market : currentDom

      const days_trend = oldestDom > 0
        ? ((currentDom - oldestDom) / oldestDom) * 100
        : 0

      const currentInv = typeof current.inventory_count === 'number' ? current.inventory_count : 0
      const oldestInv = typeof oldest.inventory_count === 'number' ? oldest.inventory_count : currentInv

      const inventory_trend = oldestInv > 0
        ? ((currentInv - oldestInv) / oldestInv) * 100
        : 0

      trends = {
        price_trend_12m,
        days_on_market_trend: days_trend,
        inventory_trend,
      }
    }

    // Generate forecast
    let forecast = undefined
    if (trends && currentSnapshot) {
      const price_trend = trends.price_trend_12m
      const direction = price_trend > 1 ? 'up' : price_trend < -1 ? 'down' : 'stable'
      const confidence = Math.min(0.95, 0.6 + (Math.abs(price_trend) / 100) * 0.35)

      forecast = {
        direction: direction as 'up' | 'down' | 'stable',
        confidence,
      }
    }

    const analysis: MarketAnalysis = {
      market_area,
      current_metrics: currentSnapshot?.market_metrics || {},
      historical_metrics: historicalSnapshots?.map(s => s.market_metrics),
      comparables,
      trends,
      forecast,
    }

    return NextResponse.json({
      data: analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Market data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
