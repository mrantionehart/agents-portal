'use client'

import React, { useState, useEffect } from 'react'
import { ComparableSalesAnalysis } from '@/types/integrations'

interface ComparableSalesWidgetProps {
  transactionId: string
}

export const ComparableSalesWidget: React.FC<ComparableSalesWidgetProps> = ({
  transactionId,
}) => {
  const [analysis, setAnalysis] = useState<ComparableSalesAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'price' | 'date'>('date')

  useEffect(() => {
    const fetchComparables = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/broker/transactions/${transactionId}/comparable-sales?limit=15`
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

    fetchComparables()
  }, [transactionId])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading comparable sales...</div>
      </div>
    )
  }

  if (!analysis || analysis.comparables.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">No comparable sales data available</div>
      </div>
    )
  }

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`
  }

  const sortedComparables = [...analysis.comparables].sort((a, b) => {
    if (sortBy === 'price') {
      return (b.sale_price || 0) - (a.sale_price || 0)
    }
    return new Date(b.sale_date || '').getTime() - new Date(a.sale_date || '').getTime()
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Comparable Sales Analysis</h2>

        {/* Statistics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="text-xs text-gray-600 font-medium mb-1">Median Price</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatPrice(analysis.statistics.median_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-medium mb-1">Average Price</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatPrice(analysis.statistics.average_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-medium mb-1">Price Range</p>
            <p className="text-sm text-gray-900">
              {formatPrice(analysis.statistics.price_range.min)} - {formatPrice(analysis.statistics.price_range.max)}
            </p>
          </div>
          {analysis.statistics.average_days_on_market && (
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">Avg Days on Market</p>
              <p className="text-lg font-semibold text-gray-900">
                {Math.round(analysis.statistics.average_days_on_market)}
              </p>
            </div>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSortBy('date')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              sortBy === 'date'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            By Date
          </button>
          <button
            onClick={() => setSortBy('price')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              sortBy === 'price'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            By Price
          </button>
        </div>

        {/* Comparables Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Address</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Sold Date</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Price</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Beds/Baths</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Sqft</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">$/Sqft</th>
                {analysis.comparables.some(c => c.days_on_market) && (
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Days on Market</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedComparables.map((comp) => (
                <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {comp.property_details?.address || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {comp.sale_date ? new Date(comp.sale_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">
                    {formatPrice(comp.sale_price || 0)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {comp.property_details?.beds || '?'}/{comp.property_details?.baths || '?'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {comp.property_details?.sqft?.toLocaleString() || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {comp.price_per_sqft ? `$${comp.price_per_sqft.toFixed(2)}` : 'N/A'}
                  </td>
                  {analysis.comparables.some(c => c.days_on_market) && (
                    <td className="px-4 py-3 text-right text-gray-700">
                      {comp.days_on_market || 'N/A'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ComparableSalesWidget
