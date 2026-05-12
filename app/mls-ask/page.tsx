'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Mic,
  MicOff,
  Loader2,
  Home,
  Bed,
  Bath,
  Maximize,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Share2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Filter,
  RotateCcw,
  Clock,
  Waves,
  Droplets,
  Car,
  FolderPlus,
} from 'lucide-react'
import { VAULT_API_URL } from '@/lib/vault-client'

// ============================================================================
// Ask MLS — Natural language MLS search powered by AI
// ============================================================================

const VAULT_API = VAULT_API_URL
const IDX_SITE = 'https://hartfeltrealestate.idxbroker.com'

interface MLSListing {
  id: string
  listingId: string
  address: string
  city: string
  state: string
  zipCode: string
  county: string
  price: number
  beds: number
  baths: number
  halfBaths: number
  sqft: number
  lotSize: number
  yearBuilt: number
  propertyType: string
  propertySubType: string
  status: string
  daysOnMarket: number
  description: string
  photos: string[]
  latitude: number
  longitude: number
  listingAgent: string
  listingOffice: string
  listDate: string
  modifiedDate: string
  features: string[]
  waterfront: boolean
  pool: boolean
  garage: boolean
  garageSpaces: number
  stories: number
  hoaFee: number
  taxAmount: number
  mlsSource: string
}

const EXAMPLE_QUERIES = [
  '3 bed waterfront in Miami Beach under 800k with pool',
  'Condo in Brickell under 500k with bay view',
  '4+ bed single family in Coral Gables, 2500+ sqft',
  'Oceanfront penthouse in Sunny Isles, $2M+',
  'Investment property in Aventura under 400k',
  'New construction in Doral, 3 bed 2 bath',
]

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    const m = price / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `$${price.toLocaleString()}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getStatusColor(status: string): string {
  const s = status?.toLowerCase() || ''
  if (s.includes('active')) return 'bg-green-500 text-black'
  if (s.includes('pending')) return 'bg-yellow-500 text-black'
  if (s.includes('sold') || s.includes('closed')) return 'bg-red-500 text-white'
  if (s.includes('coming')) return 'bg-blue-500 text-white'
  return 'bg-[#C9A84C] text-black'
}

export default function AskMLSPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MLSListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [savedListings, setSavedListings] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [collectionSaved, setCollectionSaved] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery || query).trim()
    if (!q) return

    setQuery(q)
    setLoading(true)
    setError(null)
    setHasSearched(true)
    setCollectionSaved(false)
    setExpandedCards(new Set())
    const start = performance.now()

    try {
      const res = await fetch(`${VAULT_API}/mls/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Search failed (${res.status})`)
      }

      const data = await res.json()
      const listings = data.results || data.listings || data.data || []
      setResults(Array.isArray(listings) ? listings : [])
      setSearchTime(Math.round(performance.now() - start))
    } catch (err: any) {
      setError(err.message || 'Failed to search MLS')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSaveToClient = (listing: MLSListing) => {
    setSavedListings(prev => {
      const next = new Set(prev)
      next.has(listing.id) ? next.delete(listing.id) : next.add(listing.id)
      return next
    })
  }

  const handleShare = async (listing: MLSListing) => {
    const text = `🏠 ${listing.address}\n${listing.city}, ${listing.state} ${listing.zipCode}\n\n💰 ${formatPrice(listing.price)}\n🛏 ${listing.beds} Beds · 🛁 ${listing.baths} Baths · 📐 ${listing.sqft?.toLocaleString()} SqFt\n\nMLS# ${listing.listingId}\n\n— HartFelt Real Estate`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(listing.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // clipboard fallback
    }
  }

  const handleSaveCollection = () => {
    setCollectionSaved(true)
    setTimeout(() => setCollectionSaved(false), 3000)
  }

  // Voice input
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setQuery(transcript)
      setIsListening(false)
      // Auto-search after voice
      setTimeout(() => handleSearch(transcript), 300)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const handleReset = () => {
    setQuery('')
    setResults([])
    setHasSearched(false)
    setError(null)
    setSearchTime(null)
    setCollectionSaved(false)
    setExpandedCards(new Set())
    setSavedListings(new Set())
    inputRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[#C9A84C] hover:text-[#E8D5A3] mb-3 transition-colors"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#C9A84C]/10 rounded-lg">
            <Sparkles className="w-6 h-6 text-[#C9A84C]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Ask MLS</h1>
            <p className="text-gray-400 mt-0.5">
              Search listings with natural language — powered by AI
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 3 bed waterfront in Miami Beach under 800k with pool..."
              className="w-full pl-12 pr-4 py-4 bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl text-white placeholder-gray-500 text-base focus:outline-none focus:border-[#C9A84C]/50 focus:ring-1 focus:ring-[#C9A84C]/20 transition-all"
            />
          </div>

          {/* Voice Button */}
          <button
            onClick={toggleVoice}
            className={`p-4 rounded-xl border transition-all ${
              isListening
                ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                : 'bg-[#0a0a0f] border-[#1a1a2e] text-gray-400 hover:text-white hover:border-[#C9A84C]/30'
            }`}
            title={isListening ? 'Stop listening' : 'Voice search'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Search Button */}
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-6 py-4 bg-[#C9A84C] text-black font-semibold rounded-xl hover:bg-[#E8D5A3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            Search
          </button>
        </div>

        {/* Reset */}
        {hasSearched && (
          <button
            onClick={handleReset}
            className="mt-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New search
          </button>
        )}
      </div>

      {/* Example Queries */}
      {!hasSearched && (
        <div className="max-w-4xl mx-auto mb-12">
          <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Try one of these
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXAMPLE_QUERIES.map((eq, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(eq)
                  handleSearch(eq)
                }}
                className="text-left px-4 py-3 bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl text-sm text-gray-300 hover:border-[#C9A84C]/30 hover:text-white transition-all group"
              >
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-[#C9A84C] opacity-0 group-hover:opacity-100 transition-opacity" />
                  {eq}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-[#C9A84C] animate-spin" />
            <Sparkles className="w-4 h-4 text-[#C9A84C] absolute -top-1 -right-1 animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm mt-4">Searching MLS listings...</p>
          <p className="text-gray-600 text-xs mt-1">Analyzing your query with AI</p>
        </div>
      )}

      {/* Results */}
      {!loading && hasSearched && results.length > 0 && (
        <div className="max-w-6xl mx-auto">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] text-sm font-medium">
                <Home className="w-4 h-4" />
                {results.length} {results.length === 1 ? 'Listing' : 'Listings'} Found
              </span>
              {searchTime !== null && (
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="w-3 h-3" />
                  {searchTime}ms
                </span>
              )}
            </div>
            <button
              onClick={handleSaveCollection}
              disabled={collectionSaved}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                collectionSaved
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C]/20'
              }`}
            >
              <FolderPlus className="w-4 h-4" />
              {collectionSaved ? 'Collection Saved!' : 'Save Collection'}
            </button>
          </div>

          {/* Listing Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {results.map(listing => {
              const isExpanded = expandedCards.has(listing.id)
              const isSaved = savedListings.has(listing.id)
              const hasPhotos = listing.photos && listing.photos.length > 0

              return (
                <div
                  key={listing.id}
                  className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl overflow-hidden hover:border-[#C9A84C]/20 transition-all"
                >
                  {/* Photo Area */}
                  <div className="relative h-48 overflow-hidden">
                    {hasPhotos ? (
                      <img
                        src={listing.photos[0]}
                        alt={listing.address}
                        className="w-full h-full object-cover"
                        onError={e => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                          const parent = (e.target as HTMLImageElement).parentElement
                          if (parent) parent.classList.add('gradient-placeholder')
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] via-[#0a0a0f] to-[#C9A84C]/10 flex items-center justify-center">
                        <Home className="w-12 h-12 text-gray-700" />
                      </div>
                    )}

                    {/* Status Badge */}
                    {listing.status && (
                      <div className="absolute top-3 left-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${getStatusColor(listing.status)}`}
                        >
                          {listing.status}
                        </span>
                      </div>
                    )}

                    {/* Days on Market */}
                    {listing.daysOnMarket > 0 && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-xs text-gray-300">
                          {listing.daysOnMarket}d on market
                        </span>
                      </div>
                    )}

                    {/* Feature Badges */}
                    <div className="absolute bottom-3 left-3 flex gap-1.5">
                      {listing.waterfront && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/80 backdrop-blur-sm rounded-md text-xs text-white font-medium">
                          <Waves className="w-3 h-3" /> Waterfront
                        </span>
                      )}
                      {listing.pool && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-cyan-500/80 backdrop-blur-sm rounded-md text-xs text-white font-medium">
                          <Droplets className="w-3 h-3" /> Pool
                        </span>
                      )}
                      {listing.garage && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-500/80 backdrop-blur-sm rounded-md text-xs text-white font-medium">
                          <Car className="w-3 h-3" /> {listing.garageSpaces || ''}Garage
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5">
                    {/* Price */}
                    <p className="text-2xl font-bold text-[#C9A84C]">
                      {formatPrice(listing.price)}
                    </p>

                    {/* Address */}
                    <p className="text-white font-semibold mt-1">{listing.address}</p>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {listing.city}, {listing.state} {listing.zipCode}
                    </p>

                    {/* Stats Row */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-400">
                      {listing.beds > 0 && (
                        <span className="flex items-center gap-1">
                          <Bed className="w-3.5 h-3.5" /> {listing.beds} Beds
                        </span>
                      )}
                      {listing.baths > 0 && (
                        <span className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5" />{' '}
                          {listing.baths}
                          {listing.halfBaths > 0 ? `.${listing.halfBaths}` : ''} Baths
                        </span>
                      )}
                      {listing.sqft > 0 && (
                        <span className="flex items-center gap-1">
                          <Maximize className="w-3.5 h-3.5" />{' '}
                          {listing.sqft.toLocaleString()} SqFt
                        </span>
                      )}
                      {listing.yearBuilt > 0 && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {listing.yearBuilt}
                        </span>
                      )}
                    </div>

                    {/* Property Type + MLS */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#1a1a2e]">
                      <span className="text-gray-500 text-xs">
                        {listing.propertyType}
                        {listing.propertySubType ? ` · ${listing.propertySubType}` : ''} ·
                        MLS# {listing.listingId}
                      </span>
                      {listing.listDate && (
                        <span className="text-gray-600 text-xs">
                          Listed {formatDate(listing.listDate)}
                        </span>
                      )}
                    </div>

                    {/* Expandable Details */}
                    <button
                      onClick={() => toggleExpanded(listing.id)}
                      className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" /> Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" /> Show Details
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 pt-3 border-t border-[#1a1a2e] space-y-3 text-sm">
                        {/* Description */}
                        {listing.description && (
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                              Description
                            </p>
                            <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                              {listing.description}
                            </p>
                          </div>
                        )}

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {listing.lotSize > 0 && (
                            <div className="bg-[#050507] rounded-lg px-3 py-2">
                              <span className="text-gray-500">Lot Size</span>
                              <p className="text-white font-medium">
                                {listing.lotSize.toLocaleString()} sqft
                              </p>
                            </div>
                          )}
                          {listing.stories > 0 && (
                            <div className="bg-[#050507] rounded-lg px-3 py-2">
                              <span className="text-gray-500">Stories</span>
                              <p className="text-white font-medium">{listing.stories}</p>
                            </div>
                          )}
                          {listing.hoaFee > 0 && (
                            <div className="bg-[#050507] rounded-lg px-3 py-2">
                              <span className="text-gray-500">HOA Fee</span>
                              <p className="text-white font-medium">
                                ${listing.hoaFee.toLocaleString()}/mo
                              </p>
                            </div>
                          )}
                          {listing.taxAmount > 0 && (
                            <div className="bg-[#050507] rounded-lg px-3 py-2">
                              <span className="text-gray-500">Annual Tax</span>
                              <p className="text-white font-medium">
                                ${listing.taxAmount.toLocaleString()}
                              </p>
                            </div>
                          )}
                          {listing.county && (
                            <div className="bg-[#050507] rounded-lg px-3 py-2">
                              <span className="text-gray-500">County</span>
                              <p className="text-white font-medium">{listing.county}</p>
                            </div>
                          )}
                          {listing.garageSpaces > 0 && (
                            <div className="bg-[#050507] rounded-lg px-3 py-2">
                              <span className="text-gray-500">Garage Spaces</span>
                              <p className="text-white font-medium">{listing.garageSpaces}</p>
                            </div>
                          )}
                        </div>

                        {/* Features */}
                        {listing.features && listing.features.length > 0 && (
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">
                              Features
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {listing.features.slice(0, 12).map((feat, fi) => (
                                <span
                                  key={fi}
                                  className="px-2 py-1 bg-[#050507] border border-[#1a1a2e] rounded text-xs text-gray-400"
                                >
                                  {feat}
                                </span>
                              ))}
                              {listing.features.length > 12 && (
                                <span className="px-2 py-1 text-xs text-gray-600">
                                  +{listing.features.length - 12} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Agent / Office */}
                        <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-[#1a1a2e]">
                          <span>
                            {listing.listingAgent && `Agent: ${listing.listingAgent}`}
                            {listing.listingAgent && listing.listingOffice && ' · '}
                            {listing.listingOffice && `Office: ${listing.listingOffice}`}
                          </span>
                          {listing.mlsSource && <span>{listing.mlsSource}</span>}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleSaveToClient(listing)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          isSaved
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                            : 'bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        {isSaved ? 'Saved' : 'Save to Client'}
                      </button>
                      <button
                        onClick={() => handleShare(listing)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#050507] border border-[#1a1a2e] rounded-lg text-teal-400 text-xs font-medium hover:border-teal-500/30 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {copiedId === listing.id ? 'Copied!' : 'Share'}
                      </button>
                      <a
                        href={`${IDX_SITE}/idx/details/listing/d016/${listing.listingId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#050507] border border-[#1a1a2e] rounded-lg text-blue-400 text-xs font-medium hover:border-blue-500/30 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Full Details
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && hasSearched && results.length === 0 && !error && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-12 text-center">
            <Search className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-gray-400 text-lg font-medium mt-4">No listings found</p>
            <p className="text-gray-500 text-sm mt-2">
              Try adjusting your search criteria or using different keywords
            </p>
            <button
              onClick={handleReset}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/20 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Try another search
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
