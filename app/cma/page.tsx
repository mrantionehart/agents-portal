'use client'

import { useState } from 'react'
import Link from 'next/link'

// ============================================================================
// CMA Generator — Agents Portal (manual entry)
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

export default function CMAPage() {
  const [subject, setSubject] = useState({
    address: '', city: '', state: 'FL', zip: '',
    currentList: 0, dom: 0, beds: 0, baths: 0, sqft: 0,
    lotSize: '', yearBuilt: 0, features: '', mlsNumber: '',
  })
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

  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none'
  const labelCls = 'text-xs text-gray-500 font-medium mb-1 block'

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard" className="text-sm text-amber-600 hover:text-amber-700 mb-2 inline-block">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900">CMA Generator</h1>
          <p className="text-sm text-gray-500 mt-1">Create a branded Confidential Market Analysis PDF</p>
        </div>
        <button
          onClick={generatePdf}
          disabled={generating || !subject.address || comps.filter((c) => c.address).length === 0}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition"
        >
          {generating ? 'Generating...' : 'Generate PDF'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Subject Property */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Subject Property</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Property Address *</label>
                <input className={inputCls} placeholder="13724 SW 92nd Ct, Miami, FL 33176" value={subject.address} onChange={(e) => setSubject({ ...subject, address: e.target.value })} />
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
            <div>
              <label className={labelCls}>Key Features</label>
              <input className={inputCls} placeholder="Private E-Lake frontage (operable — boating/jet ski)" value={subject.features} onChange={(e) => setSubject({ ...subject, features: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Market Narrative</h2>
          <textarea className={`${inputCls} min-h-[100px]`} placeholder="After 69 days, the market has signaled..." value={narrative} onChange={(e) => setNarrative(e.target.value)} />
        </div>

        {/* Comparable Sales */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Recent Sold Comps</h2>
          <div className="space-y-4">
            {comps.map((comp, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
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
                  <div><label className={labelCls}>$/SF (auto)</label><input className={`${inputCls} bg-gray-100`} value={comp.pricePerSqft ? `$${comp.pricePerSqft}` : ''} readOnly /></div>
                  <div><label className={labelCls}>Notes</label><input className={inputCls} placeholder="Sold under list" value={comp.notes} onChange={(e) => updateComp(idx, 'notes', e.target.value)} /></div>
                </div>
              </div>
            ))}
            <button onClick={() => setComps([...comps, { ...emptyComp }])} className="text-sm text-amber-600 hover:text-amber-700 font-medium">+ Add Comp</button>
          </div>
        </div>

        {/* Pricing Math */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
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
              <button onClick={() => setPricing({ ...pricing, adjustments: [...pricing.adjustments, { label: '', value: '' }] })} className="text-sm text-amber-600 hover:text-amber-700 font-medium">+ Add Adjustment</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Engagement Range</label><input className={inputCls} placeholder="$3,950,000 - $4,300,000" value={pricing.engagementRange} onChange={(e) => setPricing({ ...pricing, engagementRange: e.target.value })} /></div>
              <div><label className={labelCls}>Current List vs. Range</label><input className={inputCls} placeholder="+$425K to +$775K above" value={pricing.currentVsRange} onChange={(e) => setPricing({ ...pricing, currentVsRange: e.target.value })} /></div>
            </div>
          </div>
        </div>

        {/* Pricing Ladder */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Pricing Ladder</h2>
          <div className="space-y-4">
            {pricingLadder.map((step, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
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
            <button onClick={() => setPricingLadder([...pricingLadder, { ...emptyStep }])} className="text-sm text-amber-600 hover:text-amber-700 font-medium">+ Add Step</button>
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">Recommendation</h2>
          <textarea className={`${inputCls} min-h-[80px]`} placeholder="Reposition to $4,495,000 this week..." value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
        </div>

        {/* Generate Button */}
        <div className="flex justify-end pb-8">
          <button
            onClick={generatePdf}
            disabled={generating || !subject.address || comps.filter((c) => c.address).length === 0}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-lg text-sm transition"
          >
            {generating ? 'Generating CMA...' : 'Generate CMA PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
