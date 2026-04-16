'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { MLSListing, MLSSearchQuery } from '@/types/integrations'

interface MlsSearchInterfaceProps {
  onSelectListing?: (listing: MLSListing) => void
  onLinkToTransaction?: (listing: MLSListing) => void
}

export const MlsSearchInterface: React.FC<MlsSearchInterfaceProps> = ({
  onSelectListing,
  onLinkToTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState<MLSSearchQuery>({
    page: 1,
    limit: 20,
  })
  const [results, setResults] = useState<MLSListing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedListing, setSelectedListing] = useState<MLSListing | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const handleSearch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (searchQuery.address) params.append('address', searchQuery.address)
      if (searchQuery.city) params.append('city', searchQuery.city)
      if (searchQuery.state) params.append('state', searchQuery.state)
      if (searchQuery.zip) params.append('zip', searchQuery.zip)
      if (searchQuery.status) params.append('status', searchQuery.status)
      if (searchQuery.listing_type) params.append('listing_type', searchQuery.listing_type)
      if (searchQuery.price_min) params.append('price_min', searchQuery.price_min.toString())
      if (searchQuery.price_max) params.append('price_max', searchQuery.price_max.toString())
      if (searchQuery.beds_min) params.append('beds_min', searchQuery.beds_min.toString())
      if (searchQuery.baths_min) params.append('baths_min', searchQuery.baths_min.toString())
      params.append('page', searchQuery.page?.toString() || '1')
      params.append('limit', searchQuery.limit?.toString() || '20')

      const response = await fetch(`/api/integrations/mls/search?${params.toString()}`)
      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      setResults(data.data.listings)
      setTotal(data.data.total)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  const handleSelectListing = useCallback(
    (listing: MLSListing) => {
      setSelectedListing(listing)
      setShowDetails(true)
      onSelectListing?.(listing)
    },
    [onSelectListing]
  )

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A'
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  return (
    <div className="w-full space-y-6">
      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Search MLS Listings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              placeholder="Enter address"
              value={searchQuery.address || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, address: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              placeholder="Enter city"
              value={searchQuery.city || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, city: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              placeholder="State"
              maxLength={2}
              value={searchQuery.state || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, state: e.target.value.toUpperCase(), page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Zip */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
            <input
              type="text"
              placeholder="Zip code"
              value={searchQuery.zip || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, zip: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={searchQuery.status || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, status: e.target.value as any, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
            <select
              value={searchQuery.listing_type || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, listing_type: e.target.value as any, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="land">Land</option>
              <option value="multi-family">Multi-Family</option>
            </select>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
            <input
              type="number"
              placeholder="0"
              value={searchQuery.price_min || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, price_min: parseFloat(e.target.value), page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
            <input
              type="number"
              placeholder="999999999"
              value={searchQuery.price_max || ''}
              onChange={(e) => setSearchQuery({ ...searchQuery, price_max: parseFloat(e.target.value), page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          {loading ? 'Searching...' : 'Search Listings'}
        </button>
      </div>

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Found {total} listing{total !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">List Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Beds/Baths</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">List Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{listing.address}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatPrice(listing.list_price)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        listing.status === 'active' ? 'bg-green-100 text-green-800' :
                        listing.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        listing.status === 'sold' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {listing.property_details?.beds || '?'}/{listing.property_details?.baths || '?'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {listing.list_date ? new Date(listing.list_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm space-x-2">
                      <button
                        onClick={() => handleSelectListing(listing)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View
                      </button>
                      {onLinkToTransaction && (
                        <button
                          onClick={() => onLinkToTransaction(listing)}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          Link
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              onClick={() => setSearchQuery({ ...searchQuery, page: Math.max(1, (searchQuery.page || 1) - 1) })}
              disabled={(searchQuery.page || 1) <= 1}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              Page {searchQuery.page || 1} of {Math.ceil(total / (searchQuery.limit || 20))}
            </span>

            <button
              onClick={() => setSearchQuery({ ...searchQuery, page: (searchQuery.page || 1) + 1 })}
              disabled={(searchQuery.page || 1) >= Math.ceil(total / (searchQuery.limit || 20))}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && total === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No listings found. Try adjusting your search criteria.</p>
        </div>
      )}
    </div>
  )
}

export default MlsSearchInterface
