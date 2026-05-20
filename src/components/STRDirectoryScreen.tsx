'use client'

import React, { useState, useEffect, useCallback } from 'react'

// ============================================================================
// STR Intelligence — Agent-facing Airbnb-friendly condo lookup
// ============================================================================

const STR_COMPLIANCE_DISCLAIMER =
  'Rental rules change frequently. This information is a starting point only and must be verified with the HOA, condo association, municipality, county, MLS remarks, condo docs, and current association rules before advising a client or submitting an offer.'

interface Building {
  id: string
  name: string
  address: string
  neighborhood: string | null
  city: string
  state: string
  rental_restriction: string | null
  category: string
  investor_notes: string | null
  hoa_verification: string
  last_verified_at: string | null
  source_notes: string | null
  cta_url: string | null
  cta_label: string | null
  is_featured: boolean
  created_at: string
  updated_at: string
}

const CATEGORY_META: Record<string, { label: string; color: string; bgColor: string }> = {
  daily: { label: 'Daily STR-Friendly', color: '#15803d', bgColor: '#f0fdf4' },
  weekly: { label: 'Weekly Minimum', color: '#1d4ed8', bgColor: '#eff6ff' },
  monthly_seasonal: { label: 'Monthly/Seasonal', color: '#a16207', bgColor: '#fefce8' },
  no_restrictions: { label: 'Flexible Policy', color: '#047857', bgColor: '#ecfdf5' },
  hotel_program: { label: 'Hotel Program', color: '#7c3aed', bgColor: '#f5f3ff' },
  verify: { label: 'Needs Verification', color: '#c2410c', bgColor: '#fff7ed' },
}

const VERIFICATION_META: Record<string, { label: string; emoji: string }> = {
  unverified: { label: 'Unverified', emoji: '⏳' },
  verified: { label: 'Verified', emoji: '✅' },
  disputed: { label: 'Disputed', emoji: '⚠️' },
  outdated: { label: 'Outdated — Recheck', emoji: '🔄' },
}

export const STRDirectoryScreen: React.FC = () => {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [verificationFilter, setVerificationFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [copied, setCopied] = useState(false)
  const [cities, setCities] = useState<string[]>([])

  const fetchBuildings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (search) params.set('search', search)
      if (cityFilter) params.set('city', cityFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (verificationFilter) params.set('verification', verificationFilter)

      const res = await fetch(`/api/broker/str-directory?${params}`)
      const data = await res.json()
      setBuildings(data.buildings || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      console.error('Failed to fetch STR buildings:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, cityFilter, categoryFilter, verificationFilter])

  // Fetch all cities on mount for filter dropdown
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await fetch('/api/broker/str-directory?limit=100')
        const data = await res.json()
        const allCities = [...new Set((data.buildings || []).map((b: Building) => b.city))] as string[]
        setCities(allCities.sort())
      } catch (err) {
        console.error('Failed to fetch cities:', err)
      }
    }
    fetchCities()
  }, [])

  useEffect(() => {
    fetchBuildings()
  }, [fetchBuildings])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const generateClientExplanation = (b: Building): string => {
    const cat = CATEGORY_META[b.category] || CATEGORY_META.verify
    const ver = VERIFICATION_META[b.hoa_verification] || VERIFICATION_META.unverified
    let text = `🏢 ${b.name}\n📍 ${b.address}\n🏙️ ${b.city}${b.neighborhood ? ` — ${b.neighborhood}` : ''}\n\n`
    text += `📋 Rental Policy: ${cat.label}\n`
    if (b.rental_restriction) text += `📝 Details: ${b.rental_restriction}\n`
    text += `✓ Status: ${ver.label}\n\n`
    if (b.investor_notes) text += `💡 Notes: ${b.investor_notes}\n\n`
    text += `⚠️ ${STR_COMPLIANCE_DISCLAIMER}`
    return text
  }

  const copyClientExplanation = async (b: Building) => {
    const text = generateClientExplanation(b)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '24px 32px',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
          🏢 Airbnb Friendly Intelligence
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Airbnb-friendly condos — {total} buildings in South Florida
        </p>
      </div>

      {/* Compliance Banner */}
      <div
        style={{
          margin: '16px 32px 0',
          padding: '12px 16px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          fontSize: 12,
          color: '#92400e',
          lineHeight: 1.6,
        }}
      >
        ⚠️ {STR_COMPLIANCE_DISCLAIMER}
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '16px 32px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 400 }}>
          <input
            type="text"
            placeholder="Search buildings, addresses, neighborhoods..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 14,
              color: '#9ca3af',
            }}
          >
            🔍
          </span>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setPage(1)
          }}
          style={{
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            background: '#fff',
          }}
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_META).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value)
            setPage(1)
          }}
          style={{
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            background: '#fff',
          }}
        >
          <option value="">All Cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <select
          value={verificationFilter}
          onChange={(e) => {
            setVerificationFilter(e.target.value)
            setPage(1)
          }}
          style={{
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            background: '#fff',
          }}
        >
          <option value="">All Statuses</option>
          <option value="verified">✅ Verified</option>
          <option value="unverified">⏳ Unverified</option>
          <option value="disputed">⚠️ Disputed</option>
          <option value="outdated">🔄 Outdated</option>
        </select>

        {(search || cityFilter || categoryFilter || verificationFilter) && (
          <button
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setCityFilter('')
              setCategoryFilter('')
              setVerificationFilter('')
              setPage(1)
            }}
            style={{
              padding: '10px 14px',
              fontSize: 13,
              color: '#6b7280',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
          >
            ✕ Clear Filters
          </button>
        )}
      </div>

      {/* Buildings Grid */}
      <div style={{ padding: '0 32px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        ) : buildings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🏢</p>
            <p>No buildings found matching your filters.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 16,
            }}
          >
            {buildings.map((b) => {
              const cat = CATEGORY_META[b.category] || CATEGORY_META.verify
              const ver = VERIFICATION_META[b.hoa_verification] || VERIFICATION_META.unverified
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBuilding(b)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  {b.is_featured && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        fontSize: 14,
                      }}
                      title="Featured"
                    >
                      ⭐
                    </span>
                  )}
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e', margin: '0 0 6px' }}>
                    {b.name}
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>
                    📍 {b.address}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
                    {b.neighborhood ? `${b.neighborhood} · ` : ''}
                    {b.city}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        color: cat.color,
                        background: cat.bgColor,
                        border: `1px solid ${cat.color}22`,
                      }}
                    >
                      {cat.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {ver.emoji} {ver.label}
                    </span>
                  </div>
                  {b.rental_restriction && (
                    <p
                      style={{
                        fontSize: 11,
                        color: '#6b7280',
                        marginTop: 10,
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {b.rental_restriction}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 20,
              padding: '12px 0',
            }}
          >
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              Page {page} of {totalPages} ({total} buildings)
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.4 : 1,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedBuilding && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setSelectedBuilding(null)}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 480,
              background: '#fff',
              overflowY: 'auto',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: '#fff',
                borderBottom: '1px solid #e2e8f0',
                padding: '20px 24px',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                  {selectedBuilding.name}
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  {selectedBuilding.city}
                  {selectedBuilding.neighborhood ? ` · ${selectedBuilding.neighborhood}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedBuilding(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '24px' }}>
              {/* Address */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>ADDRESS</p>
                <p style={{ fontSize: 14, color: '#1e293b' }}>{selectedBuilding.address}</p>
              </div>

              {/* Category + Verification */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>RENTAL CATEGORY</p>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      color: (CATEGORY_META[selectedBuilding.category] || CATEGORY_META.verify).color,
                      background: (CATEGORY_META[selectedBuilding.category] || CATEGORY_META.verify).bgColor,
                    }}
                  >
                    {(CATEGORY_META[selectedBuilding.category] || CATEGORY_META.verify).label}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>VERIFICATION</p>
                  <p style={{ fontSize: 13, color: '#1e293b' }}>
                    {(VERIFICATION_META[selectedBuilding.hoa_verification] || VERIFICATION_META.unverified).emoji}{' '}
                    {(VERIFICATION_META[selectedBuilding.hoa_verification] || VERIFICATION_META.unverified).label}
                  </p>
                </div>
              </div>

              {/* Rental Restriction */}
              {selectedBuilding.rental_restriction && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>RENTAL RESTRICTION</p>
                  <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>
                    {selectedBuilding.rental_restriction}
                  </p>
                </div>
              )}

              {/* Investor Notes */}
              {selectedBuilding.investor_notes && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>INVESTOR NOTES</p>
                  <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>
                    {selectedBuilding.investor_notes}
                  </p>
                </div>
              )}

              {/* Last Verified */}
              {selectedBuilding.last_verified_at && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>LAST VERIFIED</p>
                  <p style={{ fontSize: 13, color: '#1e293b' }}>
                    {new Date(selectedBuilding.last_verified_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Compliance */}
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 24,
                }}
              >
                <p style={{ fontSize: 11, color: '#92400e', lineHeight: 1.6, margin: 0 }}>
                  ⚠️ {STR_COMPLIANCE_DISCLAIMER}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => copyClientExplanation(selectedBuilding)}
                  style={{
                    padding: '12px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    background: '#1a1a2e',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Client Explanation'}
                </button>

                <button
                  onClick={() => {
                    // Placeholder: request current units
                    alert(
                      'Request sent to broker for current available units at ' +
                        selectedBuilding.name +
                        '. You will be notified when listings are ready.'
                    )
                  }}
                  style={{
                    padding: '12px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1a1a2e',
                    background: '#fff',
                    border: '1px solid #1a1a2e',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  🔍 Request Current Units
                </button>

                <button
                  onClick={() => {
                    // Placeholder: save to client profile (needs client profile integration)
                    alert(
                      'Save to Client Profile — Coming soon. This will link ' +
                        selectedBuilding.name +
                        ' to a selected client profile in Client Intelligence.'
                    )
                  }}
                  style={{
                    padding: '12px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#6b7280',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  💾 Save to Client Profile
                </button>
              </div>

              {/* Timestamps */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>
                  Added {new Date(selectedBuilding.created_at).toLocaleDateString()}
                  {selectedBuilding.source_notes && ` · Source: ${selectedBuilding.source_notes}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default STRDirectoryScreen
