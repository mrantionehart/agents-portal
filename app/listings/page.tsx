'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Home, Bed, Bath, Maximize, ExternalLink, Share2, Mail, MessageSquare, RefreshCw } from 'lucide-react'

// ============================================================================
// Active Listings — Browse & share brokerage listings (agent view)
// ============================================================================

const VAULT_API = 'https://hartfelt-vault.vercel.app/api'
const IDX_SITE = 'https://hartfeltrealestate.idxbroker.com'

interface Listing {
  key: string
  listingID: string
  address: string
  cityName: string
  state: string
  zipcode: string
  listingPrice: string
  listPrice?: string
  bedrooms: string
  totalBaths: string
  sqFt: string
  propStatus: string
  fullDetailsURL?: string
  image?: Record<string, { url: string }>
  remarksConcat?: string
}

export default function ActiveListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadListings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${VAULT_API}/mls/featured`)
      if (res.ok) {
        const data = await res.json()
        const raw = data.data || data
        if (raw && typeof raw === 'object') {
          const parsed = Object.entries(raw).map(([key, val]: [string, any]) => ({ key, ...val }))
          setListings(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load listings:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadListings()
  }, [])

  const getListingUrl = (listing: Listing) => {
    return listing.fullDetailsURL || `${IDX_SITE}/idx/details/listing/d016/${listing.listingID}`
  }

  const getShareText = (listing: Listing) => {
    const price = listing.listingPrice || listing.listPrice || ''
    return `🏠 Check out this listing!\n\n${listing.address}\n${listing.cityName}, ${listing.state} ${listing.zipcode}\n\n💰 ${price}\n🛏 ${listing.bedrooms} Beds · 🛁 ${listing.totalBaths} Baths · 📐 ${listing.sqFt} SqFt\n\n${getListingUrl(listing)}\n\n— HartFelt Real Estate`
  }

  const handleCopyLink = async (listing: Listing) => {
    try {
      await navigator.clipboard.writeText(getShareText(listing))
      setCopiedId(listing.key)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // fallback
    }
  }

  const handleEmail = (listing: Listing) => {
    const subject = encodeURIComponent(`Property: ${listing.address} — ${listing.listingPrice}`)
    const body = encodeURIComponent(getShareText(listing))
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  const handleText = (listing: Listing) => {
    const body = encodeURIComponent(getShareText(listing))
    window.open(`sms:?body=${body}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-[#C9A84C] hover:text-[#E8D5A3] mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Active Listings</h1>
            <p className="text-gray-400 mt-1">Browse & share brokerage listings with your clients</p>
          </div>
          <button
            onClick={loadListings}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg text-gray-400 hover:text-white hover:border-[#C9A84C] transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Count */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] text-sm font-medium">
          <Home className="w-4 h-4" />
          {loading ? '...' : `${listings.length} Featured Listings`}
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-[#C9A84C] animate-spin" />
          <p className="text-gray-400 text-sm mt-3">Loading listings...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && listings.length === 0 && (
        <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-12 text-center">
          <Home className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-gray-400 text-lg font-medium mt-4">No featured listings</p>
          <p className="text-gray-500 text-sm mt-2">Featured listings from IDX Broker will appear here</p>
        </div>
      )}

      {/* Listings Grid */}
      {!loading && listings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {listings.map(listing => (
            <div
              key={listing.key}
              className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl overflow-hidden hover:border-[#C9A84C]/30 transition-colors"
            >
              {/* Photo */}
              {listing.image?.['0']?.url ? (
                <a href={getListingUrl(listing)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={listing.image['0'].url}
                    alt={listing.address}
                    className="w-full h-48 object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ) : (
                <div className="w-full h-40 bg-[#050507] flex items-center justify-center border-b-2 border-[#C9A84C]/20">
                  <Home className="w-10 h-10 text-gray-700" />
                </div>
              )}

              {/* Status badge */}
              {listing.propStatus && (
                <div className="absolute top-3 left-3">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    listing.propStatus === 'Active' ? 'bg-green-500 text-black' : 'bg-[#C9A84C] text-black'
                  }`}>
                    {listing.propStatus}
                  </span>
                </div>
              )}

              <div className="p-4">
                {/* Price */}
                <p className="text-xl font-bold text-[#C9A84C]">
                  {listing.listingPrice || listing.listPrice}
                </p>

                {/* Address */}
                <p className="text-white font-semibold mt-1">{listing.address}</p>
                <p className="text-gray-400 text-sm">
                  {listing.cityName}, {listing.state} {listing.zipcode}
                </p>

                {/* Stats */}
                <div className="flex gap-4 mt-3 text-sm text-gray-400">
                  {listing.bedrooms && (
                    <span className="flex items-center gap-1">
                      <Bed className="w-3.5 h-3.5" /> {listing.bedrooms} Beds
                    </span>
                  )}
                  {listing.totalBaths && (
                    <span className="flex items-center gap-1">
                      <Bath className="w-3.5 h-3.5" /> {listing.totalBaths} Baths
                    </span>
                  )}
                  {listing.sqFt && (
                    <span className="flex items-center gap-1">
                      <Maximize className="w-3.5 h-3.5" /> {parseInt(listing.sqFt).toLocaleString()} SqFt
                    </span>
                  )}
                </div>

                {/* MLS + View Details */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#1a1a2e]">
                  <span className="text-gray-500 text-xs">MLS# {listing.listingID}</span>
                  <a
                    href={getListingUrl(listing)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#C9A84C] text-xs font-medium hover:text-[#E8D5A3] transition-colors"
                  >
                    View Details <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Share Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleCopyLink(listing)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg text-[#C9A84C] text-xs font-medium hover:bg-[#C9A84C]/20 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {copiedId === listing.key ? 'Copied!' : 'Share'}
                  </button>
                  <button
                    onClick={() => handleEmail(listing)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-teal-400 text-xs font-medium hover:border-teal-500/30 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </button>
                  <button
                    onClick={() => handleText(listing)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-green-400 text-xs font-medium hover:border-green-500/30 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Text
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
