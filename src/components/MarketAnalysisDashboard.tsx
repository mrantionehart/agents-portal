'use client'

import React, { useState, useEffect } from 'react'
import { MarketAnalysis } from '@/types/integrations'

interface MarketAnalysisDashboardProps {
  address: string
  city: string
  state: string
  includeComparables?: boolean
  includeTrends?: boolean
}

export const MarketAnalysisDashboard: React.FC<MarketAnalysisDashboardProps> = ({
  address,
  city,
  state,
  includeComparables = true,
  includeTrends = true,
}) => {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMarketData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          city,
          state,
          include_comparables: includeComparables.toString(),
          include_trends: includeTrends.toString(),
        })

        const response = await fetch(
          `/api/integrations/market-data/${encodeURIComponent(address)}?${params.toString()}`
        )
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()
        setAnalysis(data.data)
      } catch (error) {
        console.error('Fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMarketData()
  }, [address, city, state, includeComparables, includeTrends])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading market analysis...</div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Market data not available</div>
      </div>
    )
  }

  const metrics = analysis.current_metrics || {}
  const trends = analysis.trends

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A'
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const getMarketHeat = () => {
    const trend = trends?.price_trend_12m || 0
    if (trend > 5) return { label: 'Hot', color: 'bg-red-100 text-red-800', indicator: 'text-red-600' }
    if (trend > 2) return { label: 'Warm', color: 'bg-orange-100 text-orange-800', indicator: 'text-orange-600' }
    if (trend > -2) return { label: 'Stable', color: 'bg-blue-100 text-blue-800', indicator: 'text-blue-600' }
    if (trend > -5) return { label: 'Cool', color: 'bg-cyan-100 text-cyan-800', indicator: 'text-cyan-600' }
    return { label: 'Cold', color: 'bg-gray-100 text-gray-800', indicator: 'text-gray-600' }
  }

  const heat = getMarketHeat()

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Market Analysis</h2>
        <p className="text-sm text-gray-600">{analysis.market_area}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium mb-2">Median Price</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatPrice(metrics.median_price as number)}
          </p>
          {trends && (
            <p className={`text-xs mt-2 ${trends.price_trend_12m > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trends.price_trend_12m > 0 ? '+' : ''}{trends.price_trend_12m?.toFixed(1)}% (12mo)
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium mb-2">Avg Days on Market</p>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.avg_days_on_market || 'N/A'}
          </p>
          {trends && (
            <p className={`text-xs mt-2 ${trends.days_on_market_trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trends.days_on_market_trend < 0 ? '' : '+'}{trends.days_on_market_trend?.toFixed(1)}% (12mo)
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium mb-2">Inventory</p>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.inventory_count || 'N/A'}
          </p>
          {trends && (
            <p className={`text-xs mt-2 ${trends.inventory_trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trends.inventory_trend < 0 ? '' : '+'}{trends.inventory_trend?.toFixed(1)}% (12mo)
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium mb-2">Market Heat</p>
          <p className={`text-xl font-bold px-3 py-1 rounded inline-block ${heat.color}`}>
            {heat.label}
          </p>
          {analysis.forecast && (
            <p className="text-xs mt-2 text-gray-600">
              Forecast: <span className="font-medium capitalize">{analysis.forecast.direction}</span>
            </p>
          )}
        </div>
      </div>

      {/* Market Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Market Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Key Metrics</h4>
            <dl className="space-y-2 text-sm">
              {metrics.price_per_sqft && (
                <>
                  <dt className="text-gray-600">Price per Sqft</dt>
                  <dd className="text-gray-900 font-medium mb-3">
                    ${typeof metrics.price_per_sqft === 'number' ? metrics.price_per_sqft.toFixed(2) : 'N/A'}
                  </dd>
                </>
              )}
              {metrics.sales_count && (
                <>
                  <dt className="text-gray-600">Recent Sales</dt>
                  <dd className="text-gray-900 font-medium mb-3">{metrics.sales_count}</dd>
                </>
              )}
              {metrics.new_listings && (
                <>
                  <dt className="text-gray-600">New Listings</dt>
                  <dd className="text-gray-900 font-medium mb-3">{metrics.new_listings}</dd>
                </>
              )}
            </dl>
          </div>

          {trends && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">12-Month Trends</h4>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-600">Price Trend</dt>
                  <dd className={`font-medium ${trends.price_trend_12m > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trends.price_trend_12m > 0 ? '+' : ''}{trends.price_trend_12m?.toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Days on Market Trend</dt>
                  <dd className={`font-medium ${trends.days_on_market_trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trends.days_on_market_trend < 0 ? '' : '+'}{trends.days_on_market_trend?.toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Inventory Trend</dt>
                  <dd className={`font-medium ${trends.inventory_trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trends.inventory_trend < 0 ? '' : '+'}{trends.inventory_trend?.toFixed(1)}%
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Market Forecast */}
      {analysis.forecast && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-blue-900 mb-2">Market Forecast</h3>
          <p className="text-sm text-blue-800">
            Market direction: <span className="font-semibold capitalize">{analysis.forecast.direction}</span>
            <br />
            Confidence: {(analysis.forecast.confidence * 100).toFixed(0)}%
          </p>
        </div>
      )}

      {/* Export Option */}
      <div className="flex gap-2">
        <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
          Export Report
        </button>
        <button className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors">
          Print
        </button>
      </div>
    </div>
  )
}

export default MarketAnalysisDashboard
