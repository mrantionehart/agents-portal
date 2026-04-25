'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, Star, Heart, ExternalLink, Phone, MapPin, Filter,
  Grid3X3, Award, MessageSquare, CalendarCheck, X, ChevronDown,
  Building2, Shield, Camera, ClipboardCheck, Hammer, Sparkles,
  Truck, Home, Scale, CreditCard, Briefcase, Users, Send,
  ThumbsUp, Loader2
} from 'lucide-react'

const VAULT_API = 'https://hartfelt-vault.vercel.app/api'

const CATEGORIES = [
  'Mortgage', 'Title', 'Insurance', 'Photography', 'Inspection',
  'Contractors', 'Cleaning', 'Moving', 'Staging', 'Attorney', 'Credit Repair',
] as const

type Category = typeof CATEGORIES[number]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Mortgage: <Building2 className="w-5 h-5" />,
  Title: <Shield className="w-5 h-5" />,
  Insurance: <Shield className="w-5 h-5" />,
  Photography: <Camera className="w-5 h-5" />,
  Inspection: <ClipboardCheck className="w-5 h-5" />,
  Contractors: <Hammer className="w-5 h-5" />,
  Cleaning: <Sparkles className="w-5 h-5" />,
  Moving: <Truck className="w-5 h-5" />,
  Staging: <Home className="w-5 h-5" />,
  Attorney: <Scale className="w-5 h-5" />,
  'Credit Repair': <CreditCard className="w-5 h-5" />,
}

type Tab = 'Directory' | 'Categories' | 'Featured' | 'Reviews' | 'Book Service'

interface Vendor {
  id: string
  name: string
  category: string
  phone?: string
  email?: string
  city?: string
  state?: string
  website?: string
  booking_url?: string
  description?: string
  logo_url?: string
  rating?: number
  review_count?: number
  is_preferred?: boolean
  is_featured?: boolean
}

interface Review {
  id: string
  vendor_id: string
  vendor_name?: string
  agent_name?: string
  rating: number
  review_text: string
  created_at: string
}

interface CategoryCount {
  category: string
  count: number
}

function useAuthHeaders() {
  const getHeaders = useCallback(async () => {
    return { 'Content-Type': 'application/json' }
  }, [])

  return { getHeaders }
}

// ── Inline UI Primitives ──────────────────────────────────────────────

function Card({ children, className = '', onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-[#C9A84C]/40 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

function Button({ children, variant = 'primary', className = '', disabled = false, ...props }: {
  children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string; disabled?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[#C9A84C] text-black hover:bg-[#d4b85d]',
    secondary: 'bg-[#1a1a2e] text-white border border-[#2a2a3e] hover:bg-[#2a2a3e]',
    ghost: 'text-gray-400 hover:text-white hover:bg-[#1a1a2e]',
    danger: 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  )
}

function Badge({ children, variant = 'default' }: {
  children: React.ReactNode; variant?: 'default' | 'gold' | 'green' | 'blue'
}) {
  const variants = {
    default: 'bg-[#1a1a2e] text-gray-300 border-[#2a2a3e]',
    gold: 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/30',
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  )
}

function Modal({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children: React.ReactNode; title: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0a0a0f] border border-[#1a1a2e] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0a0a0f] border-b border-[#1a1a2e] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-[#1a1a2e]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function StarRating({ rating, size = 'sm', interactive = false, onChange }: {
  rating: number; size?: 'sm' | 'md'; interactive?: boolean; onChange?: (r: number) => void
}) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sz} ${i <= rating ? 'fill-[#C9A84C] text-[#C9A84C]' : 'text-gray-600'} ${interactive ? 'cursor-pointer hover:text-[#C9A84C]' : ''}`}
          onClick={interactive ? () => onChange?.(i) : undefined}
        />
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { getHeaders } = useAuthHeaders()

  const [activeTab, setActiveTab] = useState<Tab>('Directory')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Directory filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [preferredOnly, setPreferredOnly] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Detail modal
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [vendorReviews, setVendorReviews] = useState<Review[]>([])
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Review form
  const [reviewVendorId, setReviewVendorId] = useState('')
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Book Service form
  const [bookVendorId, setBookVendorId] = useState('')
  const [clientName, setClientName] = useState('')
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  const [actionLoading, setActionLoading] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────

  const fetchVendors = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      if (preferredOnly) params.set('preferred', 'true')
      const res = await fetch(`${VAULT_API}/vendors?${params.toString()}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setVendors(Array.isArray(data) ? data : data.vendors || [])
      }
    } catch (e) {
      console.error('Failed to fetch vendors:', e)
    }
  }, [getHeaders, search, categoryFilter, preferredOnly])

  const fetchReviews = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${VAULT_API}/vendors/reviews`, { headers })
      if (res.ok) {
        const data = await res.json()
        setReviews(Array.isArray(data) ? data : data.reviews || [])
      }
    } catch (e) {
      console.error('Failed to fetch reviews:', e)
    }
  }, [getHeaders])

  const fetchCategoryCounts = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${VAULT_API}/vendors/categories`, { headers })
      if (res.ok) {
        const data = await res.json()
        setCategoryCounts(Array.isArray(data) ? data : data.categoryCounts || [])
      }
    } catch (e) {
      console.error('Failed to fetch category counts:', e)
    }
  }, [getHeaders])

  const fetchFavorites = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${VAULT_API}/vendors/favorites`, { headers })
      if (res.ok) {
        const data = await res.json()
        const favIds = Array.isArray(data) ? data.map((f: { vendor_id: string }) => f.vendor_id) : []
        setFavorites(favIds)
      }
    } catch (e) {
      console.error('Failed to fetch favorites:', e)
    }
  }, [getHeaders])

  const fetchVendorReviews = useCallback(async (vendorId: string) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${VAULT_API}/vendors/reviews?vendor_id=${vendorId}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setVendorReviews(Array.isArray(data) ? data : data.reviews || [])
      }
    } catch (e) {
      console.error('Failed to fetch vendor reviews:', e)
    }
  }, [getHeaders])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchVendors(), fetchFavorites(), fetchCategoryCounts(), fetchReviews()])
      setLoading(false)
    }
    init()
  }, [fetchVendors, fetchFavorites, fetchCategoryCounts, fetchReviews])

  // ── Actions ───────────────────────────────────────────────────────

  const toggleFavorite = async (vendorId: string) => {
    setActionLoading(true)
    try {
      const headers = await getHeaders()
      const isFav = favorites.includes(vendorId)
      if (isFav) {
        await fetch(`${VAULT_API}/vendors/favorites`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ vendor_id: vendorId }),
        })
        setFavorites((prev) => prev.filter((id) => id !== vendorId))
      } else {
        await fetch(`${VAULT_API}/vendors/favorites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ vendor_id: vendorId }),
        })
        setFavorites((prev) => [...prev, vendorId])
      }
    } catch (e) {
      console.error('Failed to toggle favorite:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const submitReview = async () => {
    if (!reviewVendorId || reviewRating === 0 || !reviewText.trim()) return
    setSubmittingReview(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${VAULT_API}/vendors/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vendor_id: reviewVendorId,
          rating: reviewRating,
          review_text: reviewText.trim(),
        }),
      })
      if (res.ok) {
        setReviewVendorId('')
        setReviewRating(0)
        setReviewText('')
        await fetchReviews()
      }
    } catch (e) {
      console.error('Failed to submit review:', e)
    } finally {
      setSubmittingReview(false)
    }
  }

  const submitReferral = async () => {
    if (!bookVendorId || !clientName.trim()) return
    setSubmittingBooking(true)
    setBookingSuccess(false)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${VAULT_API}/vendors/referrals`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vendor_id: bookVendorId,
          client_name: clientName.trim(),
        }),
      })
      if (res.ok) {
        setBookingSuccess(true)
        setClientName('')
        setBookVendorId('')
      }
    } catch (e) {
      console.error('Failed to submit referral:', e)
    } finally {
      setSubmittingBooking(false)
    }
  }

  const openVendorDetail = async (vendor: Vendor) => {
    setSelectedVendor(vendor)
    setShowDetailModal(true)
    await fetchVendorReviews(vendor.id)
  }

  // ── Derived Data ──────────────────────────────────────────────────

  const featuredVendors = vendors.filter((v) => v.is_featured)

  const tabs: { label: Tab; icon: React.ReactNode }[] = [
    { label: 'Directory', icon: <Grid3X3 className="w-4 h-4" /> },
    { label: 'Categories', icon: <Filter className="w-4 h-4" /> },
    { label: 'Featured', icon: <Award className="w-4 h-4" /> },
    { label: 'Reviews', icon: <MessageSquare className="w-4 h-4" /> },
    { label: 'Book Service', icon: <CalendarCheck className="w-4 h-4" /> },
  ]

  // ── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#C9A84C] hover:text-[#d4b85d] font-medium text-sm transition">
              &larr; Dashboard
            </Link>
            <div className="w-px h-6 bg-[#1a1a2e]" />
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#C9A84C]" />
              Vendor Marketplace
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="w-4 h-4" />
            {vendors.length} vendors
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-[#0a0a0f]/80 border-b border-[#1a1a2e] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 overflow-x-auto py-2">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.label
                    ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a2e]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ───── DIRECTORY TAB ───── */}
        {activeTab === 'Directory' && (
          <div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search vendors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition text-sm"
                />
              </div>

              {/* Category Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg text-sm text-gray-300 hover:border-[#C9A84C]/40 transition min-w-[180px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {categoryFilter || 'All Categories'}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute top-full mt-1 left-0 w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                    <button
                      onClick={() => { setCategoryFilter(''); setDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1a1a2e] transition ${!categoryFilter ? 'text-[#C9A84C]' : 'text-gray-300'}`}
                    >
                      All Categories
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setDropdownOpen(false) }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1a1a2e] transition flex items-center gap-2 ${categoryFilter === cat ? 'text-[#C9A84C]' : 'text-gray-300'}`}
                      >
                        {CATEGORY_ICONS[cat]}
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preferred Toggle */}
              <button
                onClick={() => setPreferredOnly(!preferredOnly)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
                  preferredOnly
                    ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/30'
                    : 'bg-[#0a0a0f] text-gray-400 border-[#1a1a2e] hover:border-[#C9A84C]/40'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                Preferred
              </button>
            </div>

            {/* Vendor Grid */}
            {vendors.length === 0 ? (
              <Card className="text-center py-12">
                <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No vendors found matching your filters.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.map((vendor) => (
                  <Card key={vendor.id} onClick={() => openVendorDetail(vendor)}>
                    <div className="flex items-start gap-4">
                      {/* Logo Placeholder */}
                      <div className="w-12 h-12 rounded-xl bg-[#1a1a2e] flex items-center justify-center text-[#C9A84C] font-bold text-lg flex-shrink-0 border border-[#2a2a3e]">
                        {vendor.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-white truncate">{vendor.name}</h3>
                          {vendor.is_preferred && (
                            <Badge variant="gold">Preferred</Badge>
                          )}
                        </div>
                        <Badge variant="default">{vendor.category}</Badge>
                        <div className="flex items-center gap-2 mt-2">
                          <StarRating rating={vendor.rating || 0} />
                          {vendor.review_count != null && (
                            <span className="text-xs text-gray-500">({vendor.review_count})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {vendor.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {vendor.city}{vendor.state ? `, ${vendor.state}` : ''}
                            </span>
                          )}
                          {vendor.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {vendor.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ───── CATEGORIES TAB ───── */}
        {activeTab === 'Categories' && (
          <div>
            <h2 className="text-lg font-bold mb-6">Browse by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {CATEGORIES.map((cat) => {
                const countObj = categoryCounts.find((c) => c.category === cat)
                const count = countObj?.count ?? 0
                return (
                  <Card
                    key={cat}
                    className="text-center"
                    onClick={() => { setCategoryFilter(cat); setActiveTab('Directory') }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] mx-auto mb-3">
                      {CATEGORY_ICONS[cat]}
                    </div>
                    <h3 className="font-semibold text-white text-sm">{cat}</h3>
                    <p className="text-xs text-gray-500 mt-1">{count} vendor{count !== 1 ? 's' : ''}</p>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* ───── FEATURED TAB ───── */}
        {activeTab === 'Featured' && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-[#C9A84C]" />
              <h2 className="text-lg font-bold">Featured Vendors</h2>
            </div>
            {featuredVendors.length === 0 ? (
              <Card className="text-center py-12">
                <Award className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No featured vendors at this time.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredVendors.map((vendor) => (
                  <Card key={vendor.id} onClick={() => openVendorDetail(vendor)}>
                    <div className="flex items-center gap-1 mb-3">
                      <Award className="w-4 h-4 text-[#C9A84C]" />
                      <span className="text-xs text-[#C9A84C] font-medium">Featured</span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center text-[#C9A84C] font-bold text-lg flex-shrink-0 border border-[#C9A84C]/30">
                        {vendor.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{vendor.name}</h3>
                        <Badge variant="gold">{vendor.category}</Badge>
                        <div className="flex items-center gap-2 mt-2">
                          <StarRating rating={vendor.rating || 0} />
                          {vendor.review_count != null && (
                            <span className="text-xs text-gray-500">({vendor.review_count})</span>
                          )}
                        </div>
                        {vendor.city && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {vendor.city}{vendor.state ? `, ${vendor.state}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {vendor.description && (
                      <p className="text-xs text-gray-400 mt-3 line-clamp-2">{vendor.description}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ───── REVIEWS TAB ───── */}
        {activeTab === 'Reviews' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#C9A84C]" />
                Recent Reviews
              </h2>
            </div>

            {/* Submit Review Form */}
            <Card className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-4">Leave a Review</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <select
                  value={reviewVendorId}
                  onChange={(e) => setReviewVendorId(e.target.value)}
                  className="bg-[#050507] border border-[#1a1a2e] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50 transition appearance-none"
                >
                  <option value="">Select a vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Rating:</span>
                  <StarRating rating={reviewRating} size="md" interactive onChange={setReviewRating} />
                </div>
              </div>
              <textarea
                placeholder="Write your review..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="w-full bg-[#050507] border border-[#1a1a2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition resize-none mb-3"
              />
              <Button
                variant="primary"
                onClick={submitReview}
                disabled={submittingReview || !reviewVendorId || reviewRating === 0 || !reviewText.trim()}
              >
                {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Review
              </Button>
            </Card>

            {/* Reviews List */}
            {reviews.length === 0 ? (
              <Card className="text-center py-12">
                <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No reviews yet. Be the first to leave one.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <Card key={review.id}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-white text-sm">{review.vendor_name || 'Vendor'}</p>
                        <p className="text-xs text-gray-500">by {review.agent_name || 'Agent'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-xs text-gray-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300">{review.review_text}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ───── BOOK SERVICE TAB ───── */}
        {activeTab === 'Book Service' && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <CalendarCheck className="w-5 h-5 text-[#C9A84C]" />
              <h2 className="text-lg font-bold">Book a Service</h2>
            </div>

            <Card className="max-w-lg">
              <h3 className="text-sm font-semibold text-white mb-4">Submit a Client Referral</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Select Vendor</label>
                  <select
                    value={bookVendorId}
                    onChange={(e) => setBookVendorId(e.target.value)}
                    className="w-full bg-[#050507] border border-[#1a1a2e] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50 transition appearance-none"
                  >
                    <option value="">Choose a vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} - {v.category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Client Name</label>
                  <input
                    type="text"
                    placeholder="Enter client's full name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-[#050507] border border-[#1a1a2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={submitReferral}
                  disabled={submittingBooking || !bookVendorId || !clientName.trim()}
                  className="w-full justify-center"
                >
                  {submittingBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Referral
                </Button>
                {bookingSuccess && (
                  <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                    <ThumbsUp className="w-4 h-4" />
                    Referral submitted successfully.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* ───── DETAIL MODAL ───── */}
      <Modal
        open={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedVendor(null); setVendorReviews([]) }}
        title={selectedVendor?.name || 'Vendor Details'}
      >
        {selectedVendor && (
          <div className="space-y-6">
            {/* Vendor Header */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-[#1a1a2e] flex items-center justify-center text-[#C9A84C] font-bold text-2xl flex-shrink-0 border border-[#2a2a3e]">
                {selectedVendor.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">{selectedVendor.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="gold">{selectedVendor.category}</Badge>
                  {selectedVendor.is_preferred && <Badge variant="green">Preferred</Badge>}
                  {selectedVendor.is_featured && <Badge variant="blue">Featured</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StarRating rating={selectedVendor.rating || 0} size="md" />
                  {selectedVendor.review_count != null && (
                    <span className="text-sm text-gray-500">({selectedVendor.review_count} reviews)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedVendor.description && (
              <p className="text-sm text-gray-300 leading-relaxed">{selectedVendor.description}</p>
            )}

            {/* Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedVendor.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-300 bg-[#050507] border border-[#1a1a2e] rounded-lg px-4 py-3">
                  <Phone className="w-4 h-4 text-[#C9A84C]" />
                  {selectedVendor.phone}
                </div>
              )}
              {selectedVendor.email && (
                <div className="flex items-center gap-2 text-sm text-gray-300 bg-[#050507] border border-[#1a1a2e] rounded-lg px-4 py-3">
                  <Send className="w-4 h-4 text-[#C9A84C]" />
                  {selectedVendor.email}
                </div>
              )}
              {selectedVendor.city && (
                <div className="flex items-center gap-2 text-sm text-gray-300 bg-[#050507] border border-[#1a1a2e] rounded-lg px-4 py-3">
                  <MapPin className="w-4 h-4 text-[#C9A84C]" />
                  {selectedVendor.city}{selectedVendor.state ? `, ${selectedVendor.state}` : ''}
                </div>
              )}
              {selectedVendor.website && (
                <a
                  href={selectedVendor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#C9A84C] bg-[#050507] border border-[#1a1a2e] rounded-lg px-4 py-3 hover:border-[#C9A84C]/40 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  Website
                </a>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 border-t border-[#1a1a2e] pt-4">
              <Button
                variant={favorites.includes(selectedVendor.id) ? 'danger' : 'secondary'}
                onClick={() => toggleFavorite(selectedVendor.id)}
                disabled={actionLoading}
              >
                <Heart className={`w-4 h-4 ${favorites.includes(selectedVendor.id) ? 'fill-current' : ''}`} />
                {favorites.includes(selectedVendor.id) ? 'Unfavorite' : 'Favorite'}
              </Button>
              {selectedVendor.booking_url ? (
                <a href={selectedVendor.booking_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="primary">
                    <CalendarCheck className="w-4 h-4" />
                    Book Service
                  </Button>
                </a>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    setBookVendorId(selectedVendor.id)
                    setShowDetailModal(false)
                    setSelectedVendor(null)
                    setActiveTab('Book Service')
                  }}
                >
                  <CalendarCheck className="w-4 h-4" />
                  Book Service
                </Button>
              )}
            </div>

            {/* Vendor Reviews */}
            <div className="border-t border-[#1a1a2e] pt-4">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
                Reviews
              </h4>
              {vendorReviews.length === 0 ? (
                <p className="text-sm text-gray-500">No reviews yet for this vendor.</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {vendorReviews.map((review) => (
                    <div key={review.id} className="bg-[#050507] border border-[#1a1a2e] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-300">{review.agent_name || 'Agent'}</span>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} />
                          <span className="text-xs text-gray-600">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">{review.review_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
