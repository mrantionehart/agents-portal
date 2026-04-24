'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ============================================================================
// CMA Generator — Agents Portal (with address autocomplete)
// ============================================================================

interface Comp {
  address: string
  soldDate: string
  salePrice: number
  beds: string
  baths: string
  sqft: number
  pricePerSqft: number
  notes: string
}

interface PricingStep {
  step: string
  price: number
  strategy: string
  indicator: string
}

interface Adjustment {
  label: string
  value: string
}

const emptyComp: Comp = { address: '', soldDate: '', salePrice: 0, beds: '', baths: '', sqft: 0, pricePerSqft: 0, notes: '' }
const emptyStep: PricingStep = { step: '', price: 0, strategy: '', indicator: '' }

const VAULT_URL = process.env.NEXT_PUBLIC_VAULT_URL
  || (process.env.NEXT_PUBLIC_VAULT_API_URL || '').replace(/\/api\/?$/, '')
  || 'https://hartfelt-vault.vercel.app'

interface LeadAddress {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
}

interface AddressSuggestion {
  address: string
  beds: number
  baths: number
  sqft: number
  yearBuilt: number
  propertyType: string
}

export default function CMAPage() {
  const [subject, setSubject] = useState({
    address: '', city: '', state: 'FL', zip: '',
    currentList: 0, dom: 0, beds: 0, baths: 0, sqft: 0,
    lotSize: '', yearBuilt: 0, features: '', mlsNumber: '', ownerName: '',
  })

  // Address autocomplete state
  const [leadAddresses, setLeadAddresses] = useState<LeadAddress[]>([])
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch lead addresses on mount
  useEffect(() => {
    async function fetchLeads() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: leads } = await supabase
          .from('leads')
          .select('id, first_name, last_name, name, property_address, city, state, zip')
          .eq('claimed_by', user.id)
          .not('property_address', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20)
        if (leads) {
          setLeadAddresses(leads.map((l: any) => ({
            id: l.id,
            name: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.name || '',
            address: l.property_address,
            city: l.city || '',
            state: l.state || 'FL',
            zip: l.zip || '',
          })))
        }
      } catch { /* silent */ }
    }
    fetchLeads()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Filtered leads based on search
  const filteredLeads = subject.address.length >= 2
    ? leadAddresses.filter(l =>
        l.address.toLowerCase().includes(subject.address.toLowerCase()) ||
        l.name.toLowerCase().includes(subject.address.toLowerCase())
      ).slice(0, 5)
    : leadAddresses.slice(0, 5)

  // Debounced Rentcast search via Vault
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 6) {
      setSuggestions([])
      if (query.length >= 1 && leadAddresses.length > 0) setShowDropdown(true)
      return
    }
    setLoadingSuggestions(true)
    try {
      const res = await fetch(`/api/cma/autocomplete?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data)
        setShowDropdown(data.length > 0 || filteredLeads.length > 0)
      }
    } catch { /* silent */ }
    setLoadingSuggestions(false)
  }, [leadAddresses, filteredLeads.length])

  const handleAddressInput = (value: string) => {
    setSubject({ ...subject, address: value })
    if (value.length >= 1 && leadAddresses.length > 0) setShowDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 400)
  }

  const selectLeadAddress = (lead: LeadAddress) => {
    setSubject({
      ...subject,
      address: lead.address,
      city: lead.city,
      state: lead.state || 'FL',
      zip: lead.zip,
    })
    setShowDropdown(false)
    setSuggestions([])
  }

  const selectSuggestion = (s: AddressSuggestion) => {
    // Parse address into parts
    const parts = s.address.split(',').map(p => p.trim())
    const street = parts[0] || s.address
    const city = parts[1] || ''
    const stateZip = parts[2] || ''
    const [st, zp] = stateZip.split(' ').filter(Boolean)
    setSubject({
      ...subject,
      address: street,
      city: city,
      state: st || 'FL',
      zip: zp || '',
      beds: s.beds || subject.beds,
      baths: s.baths || subject.baths,
      sqft: s.sqft || subject.sqft,
      yearBuilt: s.yearBuilt || subject.yearBuilt,
    })
    setShowDropdown(false)
    setSuggestions([])
  }
  const [narrative, setNarrative] = useState('')
  const [comps, setComps] = useState<Comp[]>([{ ...emptyComp }])
  const [pricing, setPricing] = useState({
    baselineLabel: '', baselineValue: 0,
    adjustments: [{ label: '', value: '' }] as Adjustment[],
    engagementRange: '', currentVsRange: '',
  })
  const [pricingLadder, setPricingLadder] = useState<PricingStep[]>([{ ...emptyStep }])
  const [recommendation, setRecommendation] = useState('')
  const [generating, setGenerating] = useState(false)

  const updateComp = (idx: number, field: keyof Comp, value: any) => {
    const updated = [...comps];
    (updated[idx] as any)[field] = value
    if (field === 'salePrice' || field === 'sqft') {
      const price = field === 'salePrice' ? Number(value) : updated[idx].salePrice
      const sf = field === 'sqft' ? Number(value) : updated[idx].sqft
      updated[idx].pricePerSqft = sf > 0 ? Math.round(price / sf) : 0
    }
    setComps(updated)
  }

  const updateStep = (idx: number, field: keyof PricingStep, value: any) => {
    const updated = [...pricingLadder];
    (updated[idx] as any)[field] = value
    setPricingLadder(updated)
  }

  const generatePdf = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/cma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, narrative,
          comps: comps.filter((c) => c.address),
          pricing,
          pricingLadder: pricingLadder.filter((s) => s.step),
          recommendation,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert('Failed: ' + (err.error || 'Unknown error'))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CMA_${subject.address.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
    setGenerating(false)
  }

  const inputCls = 'w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none'
  const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard" className="text-sm text-amber-600 hover:text-amber-400 mb-2 inline-block">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-white">CMA Generator</h1>
          <p className="text-sm text-gray-400 mt-1">Create a branded Confidential Market Analysis PDF</p>
        </div>
        <button
          onClick={generatePdf}
          disabled={generating || !subject.address || comps.filter((c) => c.address).length === 0}
          className="bg-amber-500/100 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition"
        >
          {generating ? 'Generating...' : 'Generate PDF'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Subject Property */}
        <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Subject Property</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 relative" ref={dropdownRef}>
                <label className={labelCls}>Property Address *</label>
                <div className="relative">
                  <input
                    className={`${inputCls} pr-8`}
                    placeholder="Start typing or select from your leads..."
                    value={subject.address}
                    onChange={(e) => handleAddressInput(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                  />
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>

                {/* Address Autocomplete Dropdown */}
                {showDropdown && (filteredLeads.length > 0 || suggestions.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg shadow-xl z-50 overflow-hidden max-h-[350px] overflow-y-auto">
                    {/* Lead Addresses */}
                    {filteredLeads.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-[#1a1a2e]">
                          <span className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Your Leads</span>
                        </div>
                        {filteredLeads.map((lead) => (
                          <button
                            key={lead.id}
                            onClick={() => selectLeadAddress(lead)}
                            className="w-full text-left px-3 py-2 hover:bg-[#1a1a2e] transition-colors border-b border-[#1a1a2e]/50"
                          >
                            <div className="text-sm text-white font-medium">{lead.address}</div>
                            <div className="text-xs text-gray-400">
                              {[lead.city, lead.state, lead.zip].filter(Boolean).join(', ')}
                              {lead.name && <span className="ml-1 text-gray-400">({lead.name})</span>}
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {/* IDX / Rentcast Results */}
                    {suggestions.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-blue-500/10 border-b border-[#1a1a2e]">
                          <span className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Property Search</span>
                        </div>
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectSuggestion(s)}
                            className="w-full text-left px-3 py-2 hover:bg-[#1a1a2e] transition-colors border-b border-[#1a1a2e]/50"
                          >
                            <div className="text-sm text-white font-medium">{s.address}</div>
                            <div className="text-xs text-gray-400">
                              {s.beds > 0 && `${s.beds}bd/${s.baths}ba`}
                              {s.sqft > 0 && ` · ${s.sqft.toLocaleString()}sf`}
                              {s.propertyType && ` · ${s.propertyType}`}
                              {s.yearBuilt > 0 && ` · Built ${s.yearBuilt}`}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {loadingSuggestions && subject.address.length >= 6 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-2 z-50">
                    <span className="text-xs text-gray-400">Searching addresses...</span>
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} placeholder="Miami" value={subject.city} onChange={(e) => setSubject({ ...subject, city: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>State</label><input className={inputCls} value={subject.state} onChange={(e) => setSubject({ ...subject, state: e.target.value })} /></div>
                <div><label className={labelCls}>ZIP</label><input className={inputCls} placeholder="33176" value={subject.zip} onChange={(e) => setSubject({ ...subject, zip: e.target.value })} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className={labelCls}>List Price</label><input className={inputCls} type="number" placeholder="4725000" value={subject.currentList || ''} onChange={(e) => setSubject({ ...subject, currentList: Number(e.target.value) })} /></div>
              <div><label className={labelCls}>Days on Market</label><input className={inputCls} type="number" placeholder="69" value={subject.dom || ''} onChange={(e) => setSubject({ ...subject, dom: Number(e.target.value) })} /></div>
              <div><label className={labelCls}>Beds</label><input className={inputCls} type="number" placeholder="6" value={subject.beds || ''} onChange={(e) => setSubject({ ...subject, beds: Number(e.target.value) })} /></div>
              <div><label className={labelCls}>Baths</label><input className={inputCls} type="number" placeholder="4" value={subject.baths || ''} onChange={(e) => setSubject({ ...subject, baths: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className={labelCls}>Sq Ft</label><input className={inputCls} type="number" placeholder="5741" value={subject.sqft || ''} onChange={(e) => setSubject({ ...subject, sqft: Number(e.target.value) })} /></div>
              <div><label className={labelCls}>Lot Size</label><input className={inputCls} placeholder="0.5 acre" value={subject.lotSize} onChange={(e) => setSubject({ ...subject, lotSize: e.target.value })} /></div>
              <div><label className={labelCls}>Year Built</label><input className={inputCls} type="number" placeholder="1982" value={subject.yearBuilt || ''} onChange={(e) => setSubject({ ...subject, yearBuilt: Number(e.target.value) })} /></div>
              <div><label className={labelCls}>MLS #</label><input className={inputCls} placeholder="A10807554" value={subject.mlsNumber} onChange={(e) => setSubject({ ...subject, mlsNumber: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Owner Name</label><input className={inputCls} placeholder="Property owner name" value={subject.ownerName} onChange={(e) => setSubject({ ...subject, ownerName: e.target.value })} /></div>
              <div><label className={labelCls}>Key Features</label><input className={inputCls} placeholder="Private E-Lake frontage (operable — boating/jet ski)" value={subject.features} onChange={(e) => setSubject({ ...subject, features: e.target.value })} /></div>
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Market Narrative</h2>
          <textarea className={`${inputCls} min-h-[100px]`} placeholder="After 69 days, the market has signaled..." value={narrative} onChange={(e) => setNarrative(e.target.value)} />
        </div>

        {/* Comparable Sales */}
        <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Recent Sold Comps</h2>
          <div className="space-y-4">
            {comps.map((comp, idx) => (
              <div key={idx} className="p-4 bg-[#050507] rounded-lg border border-[#1a1a2e] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Comp #{idx + 1}</span>
                  {comps.length > 1 && <button onClick={() => setComps(comps.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">Remove</button>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2"><label className={labelCls}>Address</label><input className={inputCls} placeholder="9150 SW 124th St" value={comp.address} onChange={(e) => updateComp(idx, 'address', e.target.value)} /></div>
                  <div><label className={labelCls}>Sold Date</label><input className={inputCls} placeholder="Nov 2025" value={comp.soldDate} onChange={(e) => updateComp(idx, 'soldDate', e.target.value)} /></div>
                  <div><label className={labelCls}>Sale Price</label><input className={inputCls} type="number" placeholder="3900000" value={comp.salePrice || ''} onChange={(e) => updateComp(idx, 'salePrice', Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div><label className={labelCls}>Beds</label><input className={inputCls} placeholder="6" value={comp.beds} onChange={(e) => updateComp(idx, 'beds', e.target.value)} /></div>
                  <div><label className={labelCls}>Baths</label><input className={inputCls} placeholder="7" value={comp.baths} onChange={(e) => updateComp(idx, 'baths', e.target.value)} /></div>
                  <div><label className={labelCls}>Sq Ft</label><input className={inputCls} type="number" placeholder="6124" value={comp.sqft || ''} onChange={(e) => updateComp(idx, 'sqft', Number(e.target.value))} /></div>
                  <div><label className={labelCls}>$/SF (auto)</label><input className={`${inputCls} bg-[#0a0a0f]`} value={comp.pricePerSqft ? `$${comp.pricePerSqft}` : ''} readOnly /></div>
                  <div><label className={labelCls}>Notes</label><input className={inputCls} placeholder="Sold under list" value={comp.notes} onChange={(e) => updateComp(idx, 'notes', e.target.value)} /></div>
                </div>
              </div>
            ))}
            <button onClick={() => setComps([...comps, { ...emptyComp }])} className="text-sm text-amber-600 hover:text-amber-400 font-medium">+ Add Comp</button>
          </div>
        </div>

        {/* Pricing Math */}
        <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Pricing Math</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Baseline Label</label><input className={inputCls} placeholder="Baseline at top comparable sale ($637/SF x 5,741 SF)" value={pricing.baselineLabel} onChange={(e) => setPricing({ ...pricing, baselineLabel: e.target.value })} /></div>
              <div><label className={labelCls}>Baseline Value</label><input className={inputCls} type="number" placeholder="3657000" value={pricing.baselineValue || ''} onChange={(e) => setPricing({ ...pricing, baselineValue: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-2">
              <label className={`${labelCls} font-semibold`}>Adjustments</label>
              {pricing.adjustments.map((adj, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <input className={`${inputCls} flex-1`} placeholder="E-Lake premium" value={adj.label} onChange={(e) => { const u = [...pricing.adjustments]; u[idx].label = e.target.value; setPricing({ ...pricing, adjustments: u }) }} />
                  <input className={`${inputCls} w-40`} placeholder="+15% to +25%" value={adj.value} onChange={(e) => { const u = [...pricing.adjustments]; u[idx].value = e.target.value; setPricing({ ...pricing, adjustments: u }) }} />
                  {pricing.adjustments.length > 1 && <button onClick={() => setPricing({ ...pricing, adjustments: pricing.adjustments.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600 text-xs mt-2">Remove</button>}
                </div>
              ))}
              <button onClick={() => setPricing({ ...pricing, adjustments: [...pricing.adjustments, { label: '', value: '' }] })} className="text-sm text-amber-600 hover:text-amber-400 font-medium">+ Add Adjustment</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Engagement Range</label><input className={inputCls} placeholder="$3,950,000 - $4,300,000" value={pricing.engagementRange} onChange={(e) => setPricing({ ...pricing, engagementRange: e.target.value })} /></div>
              <div><label className={labelCls}>Current List vs. Range</label><input className={inputCls} placeholder="+$425K to +$775K above" value={pricing.currentVsRange} onChange={(e) => setPricing({ ...pricing, currentVsRange: e.target.value })} /></div>
            </div>
          </div>
        </div>

        {/* Pricing Ladder */}
        <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Pricing Ladder</h2>
          <div className="space-y-4">
            {pricingLadder.map((step, idx) => (
              <div key={idx} className="p-4 bg-[#050507] rounded-lg border border-[#1a1a2e] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Step #{idx + 1}</span>
                  {pricingLadder.length > 1 && <button onClick={() => setPricingLadder(pricingLadder.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">Remove</button>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className={labelCls}>Step Name</label><input className={inputCls} placeholder="Reposition Now" value={step.step} onChange={(e) => updateStep(idx, 'step', e.target.value)} /></div>
                  <div><label className={labelCls}>Price</label><input className={inputCls} type="number" placeholder="4495000" value={step.price || ''} onChange={(e) => updateStep(idx, 'price', Number(e.target.value))} /></div>
                  <div><label className={labelCls}>Strategy</label><input className={inputCls} placeholder="Drop below $4.5M bracket" value={step.strategy} onChange={(e) => updateStep(idx, 'strategy', e.target.value)} /></div>
                  <div><label className={labelCls}>Indicator</label><input className={inputCls} placeholder="Execute this week" value={step.indicator} onChange={(e) => updateStep(idx, 'indicator', e.target.value)} /></div>
                </div>
              </div>
            ))}
            <button onClick={() => setPricingLadder([...pricingLadder, { ...emptyStep }])} className="text-sm text-amber-600 hover:text-amber-400 font-medium">+ Add Step</button>
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Recommendation</h2>
          <textarea className={`${inputCls} min-h-[80px]`} placeholder="Reposition to $4,495,000 this week..." value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
        </div>

        {/* Generate Button */}
        <div className="flex justify-end pb-8">
          <button
            onClick={generatePdf}
            disabled={generating || !subject.address || comps.filter((c) => c.address).length === 0}
            className="bg-amber-500/100 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-lg text-sm transition"
          >
            {generating ? 'Generating CMA...' : 'Generate CMA PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
