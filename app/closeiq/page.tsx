'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
// ─── Inline UI primitives (no external deps) ──────────────────────────────────
const Card = ({ children, className = '', ...props }: any) => (
  <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`} {...props}>{children}</div>
)
const CardHeader = ({ children, className = '', ...props }: any) => (
  <div className={`p-6 pb-2 ${className}`} {...props}>{children}</div>
)
const CardTitle = ({ children, className = '', ...props }: any) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>{children}</h3>
)
const CardContent = ({ children, className = '', ...props }: any) => (
  <div className={`p-6 pt-2 ${className}`} {...props}>{children}</div>
)
const CardDescription = ({ children, className = '', ...props }: any) => (
  <p className={`text-sm text-gray-500 ${className}`} {...props}>{children}</p>
)
const Button = ({ children, className = '', variant = 'default', size = 'default', disabled, ...props }: any) => {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none'
  const variants: Record<string, string> = {
    default: 'bg-amber-600 text-white hover:bg-amber-700',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
    ghost: 'hover:bg-gray-100 text-gray-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  }
  const sizes: Record<string, string> = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10',
  }
  return <button className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`} disabled={disabled} {...props}>{children}</button>
}
const Badge = ({ children, className = '', variant = 'default', ...props }: any) => {
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant] || variants.default} ${className}`} {...props}>{children}</span>
}
import {
  Loader2, LayoutDashboard, FilePlus, Users, FileText,
  AlertCircle, CheckCircle2, ChevronRight, ChevronLeft,
  DollarSign, TrendingUp, Clock, Copy, Check, Sparkles,
  Shield, Percent, Calendar, Home, Phone, Mail, CreditCard,
  MapPin, Hash, ArrowUpRight, X, Edit3, ChevronDown, ChevronUp,
  Mic, MicOff, FileDown,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'new-offer' | 'buyers' | 'cover-letters'

type OfferStatus = 'draft' | 'pending_approval' | 'approved' | 'submitted' | 'countered' | 'accepted' | 'rejected'

interface Buyer {
  id: string; name?: string; first_name?: string; last_name?: string; email: string; phone: string
  preapproval_amount: number; financing_type: string
  readiness_score: number; checklist: Record<string, boolean>
  created_at: string
}

function buyerDisplayName(b?: Buyer | null): string {
  if (!b) return ''
  if (b.first_name || b.last_name) return `${b.first_name || ''} ${b.last_name || ''}`.trim()
  return b.name || ''
}

interface Offer {
  id: string; buyer_id: string; buyer_name?: string
  property_address: string; city: string; state: string; zip: string
  property_city?: string; property_state?: string
  list_price: number; mls_id: string; offer_price: number
  down_payment_pct: number; earnest_money: number
  inspection_days: number; contingencies: string[]
  close_date: string; concessions: number; escalation_cap: number
  status: OfferStatus; readiness_score: number
  risk_flags: { label: string; severity: 'high' | 'moderate' | 'low' }[]
  created_at: string; preset_name?: string
  buyers?: { first_name?: string; last_name?: string; email?: string; phone?: string }
}

interface Preset { id: string; label: string; name?: string; description: string; defaults: Record<string, any>; config?: Record<string, any> }

interface CommissionPreview { gross: number; brokerage_split: number; agent_net: number }

const STATUS_BADGE: Record<OfferStatus, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'default' },
  pending_approval: { label: 'Pending Approval', variant: 'yellow' },
  approved: { label: 'Approved', variant: 'green' },
  submitted: { label: 'Submitted', variant: 'blue' },
  countered: { label: 'Countered', variant: 'purple' },
  accepted: { label: 'Accepted', variant: 'emerald' },
  rejected: { label: 'Rejected', variant: 'red' },
}

const READINESS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  strong: { bg: 'bg-green-100', text: 'text-green-700', label: 'Strong' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ready' },
  weak: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Weak' },
  not_ready: { bg: 'bg-red-100', text: 'text-red-700', label: 'Not Ready' },
}

function readinessLevel(score: number) {
  if (score >= 85) return 'strong'
  if (score >= 65) return 'ready'
  if (score >= 40) return 'weak'
  return 'not_ready'
}

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) }

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function CloseIQPage() {
  const { user, loading, signOut, role } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" /> Loading...
    </div>
  )
  if (!user) return null

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'new-offer', label: 'New Offer', icon: FilePlus },
    { key: 'buyers', label: 'Buyers', icon: Users },
    { key: 'cover-letters', label: 'Cover Letters', icon: FileText },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#1E2761] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#D4AF37] hover:text-[#e6c44a] font-medium text-sm">
              &larr; Dashboard
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-[#D4AF37]" /> CloseIQ
              </h1>
              <p className="text-xs text-gray-300 mt-0.5">Offer Intelligence &amp; Buyer Readiness</p>
            </div>
          </div>
          <button onClick={() => { signOut(); router.push('/login') }} className="text-sm text-gray-300 hover:text-white transition">
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 py-2">
            {tabs.map(t => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#1E2761] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'dashboard' && <DashboardTab userId={user.id} />}
        {tab === 'new-offer' && <NewOfferTab userId={user.id} onComplete={() => setTab('dashboard')} />}
        {tab === 'buyers' && <BuyersTab userId={user.id} />}
        {tab === 'cover-letters' && <CoverLettersTab userId={user.id} />}
      </main>
    </div>
  )
}

// ─── API Helper ─────────────────────────────────────────────────────────────────
async function api(method: string, path: string, body?: any) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ userId }: { userId: string }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('GET', `/api/closeiq?entity=offers`)
      .then(d => setOffers(d.offers || d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const active = offers.filter(o => !['accepted', 'rejected'].includes(o.status)).length
  const pending = offers.filter(o => o.status === 'pending_approval').length
  const avgReadiness = offers.length ? Math.round(offers.reduce((s, o) => s + (o.readiness_score || 0), 0) / offers.length) : 0
  const pipeline = offers.reduce((s, o) => s + (o.offer_price || 0), 0)

  if (loading) return <LoadingState />

  const stats = [
    { label: 'Active Offers', value: active, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Pending Approvals', value: pending, icon: Clock, color: 'text-yellow-600' },
    { label: 'Avg Readiness', value: `${avgReadiness}%`, icon: Shield, color: 'text-green-600' },
    { label: 'Pipeline Value', value: fmt(pipeline), icon: DollarSign, color: 'text-[#D4AF37]' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-gray-50 ${s.color}`}><Icon className="w-5 h-5" /></div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Offers</CardTitle>
          <CardDescription>Your latest offer activity</CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No offers yet. Create your first offer to get started.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {offers.slice(0, 10).map(o => {
                const badge = STATUS_BADGE[o.status] || STATUS_BADGE.draft
                return (
                  <div key={o.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{o.property_address}</p>
                      <p className="text-xs text-gray-500">{o.buyers ? `${o.buyers.first_name || ''} ${o.buyers.last_name || ''}`.trim() : 'Unknown Buyer'} &middot; {o.property_city || o.city}, {o.property_state || o.state}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <ReadinessBadge score={o.readiness_score} />
                      <Badge variant={badge.variant as any}>{badge.label}</Badge>
                      <span className="text-sm font-semibold text-gray-700 w-24 text-right">{fmt(o.offer_price)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — NEW OFFER WIZARD
// ═══════════════════════════════════════════════════════════════════════════════
const WIZARD_STEPS = ['Buyer', 'Property', 'Mode', 'Terms', 'Review']

function NewOfferTab({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [saving, setSaving] = useState(false)

  // Form state
  const [buyerId, setBuyerId] = useState('')
  const [newBuyer, setNewBuyer] = useState({ name: '', email: '', phone: '', preapproval_amount: '', financing_type: 'conventional' })
  const [property, setProperty] = useState({ address: '', unit: '', city: '', state: '', zip: '', list_price: '', mls_id: '' })
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [terms, setTerms] = useState({
    offer_price: '', down_payment_pct: '20', earnest_money: '5000',
    inspection_days: '10', contingencies: ['inspection', 'financing', 'appraisal'],
    close_date: '', concessions: '0', escalation_cap: '0',
  })

  // Voice input state
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [voiceParsing, setVoiceParsing] = useState(false)

  // Review data
  const [riskFlags, setRiskFlags] = useState<Offer['risk_flags']>([])
  const [readinessScore, setReadinessScore] = useState(0)
  const [commission, setCommission] = useState<CommissionPreview | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [letterLoading, setLetterLoading] = useState(false)

  useEffect(() => {
    api('GET', '/api/closeiq?entity=buyers').then(d => setBuyers(d.buyers || d.data || [])).catch(() => {})
    api('GET', '/api/closeiq?entity=presets').then(d => setPresets(d.presets || d.data || [])).catch(() => {
      setPresets([
        { id: 'strong', label: 'Strong', name: 'Strong', description: 'Above asking, minimal contingencies, fast close', defaults: { down_payment_pct: 25, inspection_days: 7, contingencies: ['inspection'] }, config: { down_payment_pct: 25, inspection_days: 7, contingencies: ['inspection'] } },
        { id: 'clean', label: 'Clean', name: 'Clean', description: 'At asking, standard terms, balanced risk', defaults: { down_payment_pct: 20, inspection_days: 10, contingencies: ['inspection', 'financing'] }, config: { down_payment_pct: 20, inspection_days: 10, contingencies: ['inspection', 'financing'] } },
        { id: 'investor', label: 'Investor', name: 'Investor', description: 'Cash offer, no contingencies, quick close', defaults: { down_payment_pct: 100, inspection_days: 0, contingencies: [] }, config: { down_payment_pct: 100, inspection_days: 0, contingencies: [] } },
        { id: 'fha', label: 'FHA/VA', name: 'FHA/VA', description: 'Government-backed, standard contingencies', defaults: { down_payment_pct: 3.5, inspection_days: 14, contingencies: ['inspection', 'financing', 'appraisal'] }, config: { down_payment_pct: 3.5, inspection_days: 14, contingencies: ['inspection', 'financing', 'appraisal'] } },
      ])
    })
  }, [])

  const parseVoiceOffer = async () => {
    if (!voiceText.trim()) return
    setVoiceParsing(true)
    try {
      const result = await api('POST', '/api/closeiq/ai', { action: 'parse_voice', transcript: voiceText })

      // Fill buyer
      if (result.buyer_name) setNewBuyer((prev: any) => ({ ...prev, name: result.buyer_name }))
      if (result.buyer_email) setNewBuyer((prev: any) => ({ ...prev, email: result.buyer_email }))
      if (result.buyer_phone) setNewBuyer((prev: any) => ({ ...prev, phone: result.buyer_phone }))
      if (result.financing_type) {
        const ft = result.financing_type.toLowerCase()
        const match = ['Conventional', 'FHA', 'VA', 'USDA', 'Cash', 'Hard Money', 'Other'].find(f => f.toLowerCase() === ft)
        if (match) setNewBuyer((prev: any) => ({ ...prev, financing_type: match }))
      }

      // Fill property
      if (result.property_address) setProperty(prev => ({ ...prev, address: result.property_address }))
      if (result.property_city) setProperty(prev => ({ ...prev, city: result.property_city }))
      if (result.property_state) setProperty(prev => ({ ...prev, state: result.property_state }))
      if (result.property_zip) setProperty(prev => ({ ...prev, zip: result.property_zip }))
      if (result.list_price) setProperty(prev => ({ ...prev, list_price: String(result.list_price) }))

      // Fill terms
      if (result.offer_price) setTerms(prev => ({ ...prev, offer_price: String(result.offer_price) }))
      if (result.earnest_money) setTerms(prev => ({ ...prev, earnest_money: String(result.earnest_money) }))
      if (result.inspection_days != null) setTerms(prev => ({ ...prev, inspection_days: String(result.inspection_days) }))
      if (result.close_date) setTerms(prev => ({ ...prev, close_date: result.close_date }))
      if (result.down_payment_pct) setTerms(prev => ({ ...prev, down_payment_pct: String(result.down_payment_pct) }))
      if (result.concessions) setTerms(prev => ({ ...prev, concessions: String(result.concessions) }))
      if (result.escalation_cap) setTerms(prev => ({ ...prev, escalation_cap: String(result.escalation_cap) }))

      // Auto-select preset
      if (result.waive_inspection && result.waive_appraisal) setSelectedPreset('clean')
      else if (result.financing_type === 'cash') setSelectedPreset('investor')
      else if (result.financing_type === 'fha' || result.financing_type === 'va') setSelectedPreset('fha')

      setVoiceMode(false)
      setVoiceText('')
      alert(`Offer parsed (confidence: ${result.confidence || 'medium'}). Review each step and adjust as needed.${result.notes ? '\n\nNotes: ' + result.notes : ''}`)
    } catch (e: any) {
      alert('Parse failed: ' + (e?.message || 'Unknown error'))
    } finally { setVoiceParsing(false) }
  }

  const applyPreset = (preset: Preset) => {
    setSelectedPreset(preset.id)
    const cfg = preset.defaults || preset.config || {}
    setTerms(prev => ({
      ...prev,
      down_payment_pct: String(cfg.down_payment_pct || prev.down_payment_pct),
      inspection_days: String(cfg.inspection_days ?? prev.inspection_days),
      contingencies: cfg.contingencies || prev.contingencies,
    }))
  }

  const canAdvance = () => {
    switch (step) {
      case 0: return buyerId || (newBuyer.name && newBuyer.phone)
      case 1: return property.address && property.city && property.state && property.list_price
      case 2: return !!selectedPreset
      case 3: return terms.offer_price && terms.close_date
      default: return true
    }
  }

  const goNext = async () => {
    if (step === 0 && !buyerId && newBuyer.name) {
      try {
        const nameParts = newBuyer.name.trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''
        const res = await api('POST', '/api/closeiq', { entity: 'buyer', data: { first_name: firstName, last_name: lastName, email: newBuyer.email, phone: newBuyer.phone, financing_type: (newBuyer.financing_type || 'conventional').toLowerCase(), preapproval_amount: Number(newBuyer.preapproval_amount) || 0 } })
        setBuyerId(res.buyer?.id || res.data?.id || '')
        setBuyers(prev => [...prev, res.buyer || res.data])
      } catch (e: any) {
        console.error('Buyer creation failed:', e)
        alert('Failed to create buyer: ' + (e?.message || 'Unknown error'))
        return // don't advance step if buyer creation failed
      }
    }
    if (step === 3) {
      // Load review data
      const price = Number(terms.offer_price)
      try {
        const [commRes] = await Promise.all([
          api('GET', `/api/closeiq?entity=commission&price=${price}&split=80`).catch(() => null),
        ])
        if (commRes) setCommission(commRes.commission || commRes.data || { gross: price * 0.03, brokerage_split: price * 0.03 * 0.2, agent_net: price * 0.03 * 0.8 })
      } catch {}

      // Compute readiness score locally as fallback
      let score = 50
      if (buyerId) score += 15
      if (Number(terms.down_payment_pct) >= 20) score += 10
      if (terms.contingencies.length <= 2) score += 10
      if (Number(terms.escalation_cap) > 0) score += 5
      setReadinessScore(Math.min(score, 100))

      // Risk flags
      const flags: Offer['risk_flags'] = []
      const listPrice = Number(property.list_price)
      if (price < listPrice * 0.9) flags.push({ label: 'Offer more than 10% below list price', severity: 'high' })
      if (price > listPrice * 1.1) flags.push({ label: 'Offer more than 10% above list price', severity: 'moderate' })
      if (terms.contingencies.length === 0) flags.push({ label: 'No contingencies — high risk to buyer', severity: 'moderate' })
      if (Number(terms.inspection_days) > 14) flags.push({ label: 'Long inspection period may weaken offer', severity: 'low' })
      if (Number(terms.concessions) > listPrice * 0.03) flags.push({ label: 'Seller concessions exceed 3% of list', severity: 'moderate' })
      setRiskFlags(flags)
    }
    setStep(s => Math.min(s + 1, 4))
  }

  const generateCoverLetter = async () => {
    setLetterLoading(true)
    try {
      const buyer = buyers.find(b => b.id === buyerId)
      const res = await api('POST', '/api/closeiq/ai', {
        action: 'cover_letter',
        buyer_name: buyerDisplayName(buyer) || newBuyer.name,
        property_address: property.address,
        offer_price: Number(terms.offer_price),
        financing_type: buyer?.financing_type || newBuyer.financing_type,
        close_date: terms.close_date,
        earnest_money: Number(terms.earnest_money),
        inspection_days: Number(terms.inspection_days),
        concessions: Number(terms.concessions),
      })
      setCoverLetter(res.email_body || res.letter || res.data || '')
    } catch {
      setCoverLetter('Unable to generate cover letter. Please try again or write manually.')
    } finally { setLetterLoading(false) }
  }

  const submitOffer = async () => {
    if (!buyerId) {
      alert('Please select or create a buyer first.')
      return
    }
    setSaving(true)
    try {
      // Step 1: Create the offer
      const offerRes = await api('POST', '/api/closeiq', {
        entity: 'offer',
        data: {
          buyer_id: buyerId,
          property_address: property.address,
          property_city: property.city,
          property_state: property.state,
          property_zip: property.zip,
          property_list_price: Number(property.list_price) || null,
          property_mls_id: property.mls_id || null,
          offer_mode: selectedPreset || 'standard',
          offer_price: Number(terms.offer_price),
          financing_type: (buyers.find(b => b.id === buyerId)?.financing_type || 'conventional').toLowerCase(),
          down_payment_pct: Number(terms.down_payment_pct) || null,
          earnest_money_amount: Number(terms.earnest_money) || null,
          inspection_days: Number(terms.inspection_days) || 10,
          appraisal_contingency: terms.contingencies.includes('appraisal'),
          financing_contingency: terms.contingencies.includes('financing'),
          close_date: terms.close_date || null,
          concessions_requested: Number(terms.concessions) || 0,
          escalation_flag: Number(terms.escalation_cap) > 0,
          escalation_max: Number(terms.escalation_cap) || null,
          cover_letter_text: coverLetter || null,
          status: 'draft',
        },
      })
      const offerId = offerRes.offer?.id
      if (!offerId) throw new Error('Failed to create offer')

      // Step 2: Submit for broker approval
      await api('POST', '/api/closeiq', {
        entity: 'submit_for_approval',
        offer_id: offerId,
      })
      onComplete()
    } catch (e: any) {
      console.error('Submit failed:', e)
      alert('Submit to broker failed: ' + (e?.message || 'Unknown error'))
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Voice Input Toggle */}
      {!voiceMode ? (
        <button onClick={() => setVoiceMode(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 transition text-left"
        >
          <Mic className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-sm font-medium text-[#D4AF37]">Speak or type your offer — AI fills in all fields</span>
          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
        </button>
      ) : (
        <Card className="border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/5 to-transparent">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-semibold text-[#1E2761]">Voice / Text Offer Input</span>
              </div>
              <button onClick={() => setVoiceMode(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500">
              Example: &quot;325 thousand on 742 Oak Street, Miami FL for James Wilson, conventional financing, 30-day close, 5000 earnest money, 10-day inspection&quot;
            </p>
            <textarea value={voiceText} onChange={e => setVoiceText(e.target.value)} rows={3}
              placeholder="Type or paste what the agent said about the offer..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={parseVoiceOffer} disabled={voiceParsing || !voiceText.trim()}>
                {voiceParsing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Parse with AI
              </Button>
              <Button variant="outline" onClick={() => { setVoiceMode(false); setVoiceText('') }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-[#D4AF37] text-white shadow-lg' : 'bg-gray-200 text-gray-500'
              }`}>
                {i < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 ${i === step ? 'text-[#D4AF37] font-semibold' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-12px] ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {step === 0 && (
            <BuyerStep buyers={buyers} buyerId={buyerId} setBuyerId={setBuyerId} newBuyer={newBuyer} setNewBuyer={setNewBuyer} />
          )}
          {step === 1 && <PropertyStep property={property} setProperty={setProperty} />}
          {step === 2 && <ModeStep presets={presets} selected={selectedPreset} onSelect={applyPreset} />}
          {step === 3 && <TermsStep terms={terms} setTerms={setTerms} listPrice={Number(property.list_price)} />}
          {step === 4 && (
            <ReviewStep
              riskFlags={riskFlags} readinessScore={readinessScore}
              commission={commission} coverLetter={coverLetter}
              onGenerateLetter={generateCoverLetter} letterLoading={letterLoading}
              setCoverLetter={setCoverLetter}
              property={property} terms={terms}
              buyer={buyers.find(b => b.id === buyerId)} newBuyerName={newBuyer.name}
              presetName={selectedPreset}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < 4 ? (
          <Button variant="gold" onClick={goNext} disabled={!canAdvance()}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button variant="gold" onClick={submitOffer} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
            Submit to Broker
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Wizard Steps ───────────────────────────────────────────────────────────────
function BuyerStep({ buyers, buyerId, setBuyerId, newBuyer, setNewBuyer }: {
  buyers: Buyer[]; buyerId: string; setBuyerId: (v: string) => void
  newBuyer: any; setNewBuyer: (v: any) => void
}) {
  const [mode, setMode] = useState<'select' | 'new'>(buyers.length ? 'select' : 'new')

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#1E2761]">Select or Create Buyer</h3>

      <div className="flex gap-2">
        <button onClick={() => setMode('select')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'select' ? 'bg-[#1E2761] text-white' : 'bg-gray-100 text-gray-600'}`}>
          Existing Buyer
        </button>
        <button onClick={() => { setMode('new'); setBuyerId('') }} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'new' ? 'bg-[#1E2761] text-white' : 'bg-gray-100 text-gray-600'}`}>
          New Buyer
        </button>
      </div>

      {mode === 'select' ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {buyers.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">No buyers found. Create a new buyer.</p>}
          {buyers.map(b => (
            <div key={b.id} onClick={() => setBuyerId(b.id)}
              className={`p-3 rounded-lg border cursor-pointer transition ${buyerId === b.id ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{buyerDisplayName(b)}</p>
                  <p className="text-xs text-gray-500">{b.email} &middot; {b.financing_type}</p>
                </div>
                <ReadinessBadge score={b.readiness_score} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField icon={Users} label="Full Name" value={newBuyer.name} onChange={v => setNewBuyer({ ...newBuyer, name: v })} required />
          <InputField icon={Mail} label="Email" value={newBuyer.email} onChange={v => setNewBuyer({ ...newBuyer, email: v })} type="email" />
          <InputField icon={Phone} label="Phone" value={newBuyer.phone} onChange={v => setNewBuyer({ ...newBuyer, phone: v })} required />
          <InputField icon={CreditCard} label="Pre-Approval Amount" value={newBuyer.preapproval_amount} onChange={v => setNewBuyer({ ...newBuyer, preapproval_amount: v })} type="number" />
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Financing Type</label>
            <select value={newBuyer.financing_type} onChange={e => setNewBuyer({ ...newBuyer, financing_type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
            >
              {['Conventional', 'FHA', 'VA', 'USDA', 'Cash', 'Hard Money', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

function PropertyStep({ property, setProperty }: { property: any; setProperty: (v: any) => void }) {
  const set = (k: string, v: string) => setProperty({ ...property, [k]: v })
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#1E2761]">Property Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <InputField icon={Home} label="Property Address" value={property.address} onChange={v => set('address', v)} required />
        </div>
        <InputField icon={Hash} label="Unit / Apt #" value={property.unit} onChange={v => set('unit', v)} />
        <InputField icon={MapPin} label="City" value={property.city} onChange={v => set('city', v)} required />
        <div className="grid grid-cols-2 gap-4">
          <InputField label="State" value={property.state} onChange={v => set('state', v)} required />
          <InputField label="ZIP" value={property.zip} onChange={v => set('zip', v)} />
        </div>
        <InputField icon={DollarSign} label="List Price" value={property.list_price} onChange={v => set('list_price', v)} type="number" required />
        <InputField icon={Hash} label="MLS ID" value={property.mls_id} onChange={v => set('mls_id', v)} />
      </div>
    </div>
  )
}

function ModeStep({ presets, selected, onSelect }: { presets: Preset[]; selected: string; onSelect: (p: Preset) => void }) {
  const presetIcons: Record<string, string> = { strong: '💪', clean: '✨', investor: '🏦', fha: '🏛️', first_time: '🏠', escalation: '📈', seller_time: '⏳', as_is: '🔧' }
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#1E2761]">Choose Offer Mode</h3>
      <p className="text-sm text-gray-500">Select a preset to auto-fill terms, then customize in the next step.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {presets.map(p => (
          <div key={p.id} onClick={() => onSelect(p)}
            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
              selected === p.id
                ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-md'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{presetIcons[p.id] || '📋'}</span>
              <div>
                <p className="font-semibold text-[#1E2761]">{p.label || p.name}</p>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
              </div>
            </div>
            {selected === p.id && <CheckCircle2 className="w-5 h-5 text-[#D4AF37] mt-2 ml-auto" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function TermsStep({ terms, setTerms, listPrice }: { terms: any; setTerms: (v: any) => void; listPrice: number }) {
  const set = (k: string, v: any) => setTerms({ ...terms, [k]: v })
  const contingencyOptions = ['inspection', 'financing', 'appraisal', 'sale_of_home', 'title', 'hoa']

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#1E2761]">Offer Terms</h3>
      {listPrice > 0 && <p className="text-sm text-gray-500">List price: <span className="font-semibold">{fmt(listPrice)}</span></p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField icon={DollarSign} label="Offer Price" value={terms.offer_price} onChange={v => set('offer_price', v)} type="number" required />
        <InputField icon={Percent} label="Down Payment %" value={terms.down_payment_pct} onChange={v => set('down_payment_pct', v)} type="number" />
        <InputField icon={DollarSign} label="Earnest Money" value={terms.earnest_money} onChange={v => set('earnest_money', v)} type="number" />
        <InputField icon={Clock} label="Inspection Days" value={terms.inspection_days} onChange={v => set('inspection_days', v)} type="number" />
        <InputField icon={Calendar} label="Close Date" value={terms.close_date} onChange={v => set('close_date', v)} type="date" required />
        <InputField icon={DollarSign} label="Concessions ($)" value={terms.concessions} onChange={v => set('concessions', v)} type="number" />
        <div className="sm:col-span-2">
          <InputField icon={ArrowUpRight} label="Escalation Cap ($)" value={terms.escalation_cap} onChange={v => set('escalation_cap', v)} type="number" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Contingencies</label>
        <div className="flex flex-wrap gap-2">
          {contingencyOptions.map(c => {
            const active = terms.contingencies.includes(c)
            return (
              <button key={c} onClick={() => set('contingencies', active ? terms.contingencies.filter((x: string) => x !== c) : [...terms.contingencies, c])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  active ? 'bg-[#1E2761] text-white border-[#1E2761]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {c.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ReviewStep({ riskFlags, readinessScore, commission, coverLetter, onGenerateLetter, letterLoading, setCoverLetter, property, terms, buyer, newBuyerName, presetName }: {
  riskFlags: Offer['risk_flags']; readinessScore: number; commission: CommissionPreview | null
  coverLetter: string; onGenerateLetter: () => void; letterLoading: boolean; setCoverLetter: (v: string) => void
  property: any; terms: any; buyer?: Buyer; newBuyerName: string; presetName: string
}) {
  const level = readinessLevel(readinessScore)
  const rc = READINESS_COLOR[level]
  const severityColor = { high: 'text-red-500', moderate: 'text-yellow-500', low: 'text-gray-400' }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#1E2761]">Review &amp; Submit</h3>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500 text-xs">Property</p>
          <p className="font-medium truncate">{property.address}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500 text-xs">Buyer</p>
          <p className="font-medium">{buyerDisplayName(buyer) || newBuyerName}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500 text-xs">Offer Price</p>
          <p className="font-bold text-[#1E2761]">{fmt(Number(terms.offer_price))}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500 text-xs">Mode</p>
          <p className="font-medium capitalize">{presetName}</p>
        </div>
      </div>

      {/* Readiness & Flags */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium mb-2">Offer Readiness</p>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg ${rc.bg} ${rc.text}`}>
              {readinessScore}
            </div>
            <div>
              <p className={`font-semibold ${rc.text}`}>{rc.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{readinessScore >= 85 ? 'Highly competitive offer' : readinessScore >= 65 ? 'Solid offer with room to improve' : 'Consider strengthening terms'}</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium mb-2">Risk Flags</p>
          {riskFlags.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> No risk flags detected</div>
          ) : (
            <div className="space-y-2">
              {riskFlags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${severityColor[f.severity]}`} />
                  <span className="text-gray-700">{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Commission Preview */}
      {commission && (
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium mb-3">Commission Preview</p>
          <div className="flex items-center gap-3">
            <CommBox label="Gross Commission" value={fmt(commission.gross)} />
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            <CommBox label="Brokerage Split" value={fmt(commission.brokerage_split)} sub="20%" />
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            <CommBox label="Your Net" value={fmt(commission.agent_net)} highlight />
          </div>
        </div>
      )}

      {/* Cover Letter */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium">Cover Letter</p>
          <Button variant="outline" size="sm" onClick={onGenerateLetter} disabled={letterLoading}>
            {letterLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
            Generate with AI
          </Button>
        </div>
        <textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value)} rows={5} placeholder="AI-generated cover letter will appear here, or write your own..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] resize-none"
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — BUYERS
// ═══════════════════════════════════════════════════════════════════════════════
function BuyersTab({ userId }: { userId: string }) {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Buyer>>({})

  useEffect(() => {
    api('GET', '/api/closeiq?entity=buyers')
      .then(d => setBuyers(d.buyers || d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveBuyer = async (id: string) => {
    try {
      await api('PATCH', '/api/closeiq', { entity: 'buyer', data: { id, ...editData } })
      setBuyers(prev => prev.map(b => b.id === id ? { ...b, ...editData } : b))
      setEditing(null)
    } catch { /* handle error */ }
  }

  if (loading) return <LoadingState />

  const CHECKLIST_ITEMS = ['preapproval', 'id_verified', 'proof_of_funds', 'agent_agreement', 'preferences_set']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1E2761]">Buyer Directory</h2>
        <span className="text-sm text-gray-500">{buyers.length} buyer{buyers.length !== 1 ? 's' : ''}</span>
      </div>

      {buyers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No buyers yet. Add your first buyer in the New Offer tab.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {buyers.map(b => {
            const level = readinessLevel(b.readiness_score)
            const rc = READINESS_COLOR[level]
            const isExpanded = expanded === b.id
            const isEditing = editing === b.id
            const checklist = b.checklist || {}
            const checkCount = CHECKLIST_ITEMS.filter(k => checklist[k]).length
            const checkPct = Math.round((checkCount / CHECKLIST_ITEMS.length) * 100)

            return (
              <Card key={b.id} className="overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : b.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${rc.bg} ${rc.text}`}>
                        {b.readiness_score}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{buyerDisplayName(b)}</p>
                        <p className="text-xs text-gray-500">{b.financing_type} &middot; {b.email || 'No email'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={rc.bg.includes('green') ? 'green' : rc.bg.includes('blue') ? 'blue' : rc.bg.includes('yellow') ? 'yellow' : 'red'}>
                        {rc.label}
                      </Badge>
                      {/* Checklist mini bar */}
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[#D4AF37] rounded-full transition-all" style={{ width: `${checkPct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{checkPct}%</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50 space-y-4">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InputField label="First Name" value={editData.first_name ?? b.first_name ?? ''} onChange={v => setEditData({ ...editData, first_name: v })} />
                        <InputField label="Last Name" value={editData.last_name ?? b.last_name ?? ''} onChange={v => setEditData({ ...editData, last_name: v })} />
                        <InputField label="Email" value={editData.email ?? b.email} onChange={v => setEditData({ ...editData, email: v })} />
                        <InputField label="Phone" value={editData.phone ?? b.phone} onChange={v => setEditData({ ...editData, phone: v })} />
                        <InputField label="Pre-Approval" value={String(editData.preapproval_amount ?? b.preapproval_amount)} onChange={v => setEditData({ ...editData, preapproval_amount: Number(v) })} type="number" />
                        <div className="sm:col-span-2 flex gap-2">
                          <Button size="sm" variant="gold" onClick={() => saveBuyer(b.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div><p className="text-gray-400 text-xs">Phone</p><p className="font-medium">{b.phone || '--'}</p></div>
                          <div><p className="text-gray-400 text-xs">Pre-Approval</p><p className="font-medium">{b.preapproval_amount ? fmt(b.preapproval_amount) : '--'}</p></div>
                          <div><p className="text-gray-400 text-xs">Financing</p><p className="font-medium">{b.financing_type}</p></div>
                          <div><p className="text-gray-400 text-xs">Added</p><p className="font-medium">{new Date(b.created_at).toLocaleDateString()}</p></div>
                        </div>

                        {/* Checklist */}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">Readiness Checklist</p>
                          <div className="flex flex-wrap gap-2">
                            {CHECKLIST_ITEMS.map(item => (
                              <span key={item} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                checklist[item] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {checklist[item] ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                                {item.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setEditing(b.id); setEditData({}) }}>
                          <Edit3 className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — COVER LETTERS
// ═══════════════════════════════════════════════════════════════════════════════
function CoverLettersTab({ userId }: { userId: string }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOffer, setSelectedOffer] = useState('')
  const [tone, setTone] = useState('professional')
  const [buyerStory, setBuyerStory] = useState('')
  const [manualDetails, setManualDetails] = useState({ buyer_name: '', property_address: '', offer_price: '', financing_type: 'conventional' })
  const [result, setResult] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'offer' | 'manual'>('offer')

  useEffect(() => {
    api('GET', '/api/closeiq?entity=offers')
      .then(d => setOffers(d.offers || d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      let params: any = { action: 'cover_letter', tone, buyer_story: buyerStory }
      if (mode === 'offer' && selectedOffer) {
        const offer = offers.find(o => o.id === selectedOffer)
        if (offer) {
          params.buyer_name = (offer as any).buyers ? `${(offer as any).buyers.first_name || ''} ${(offer as any).buyers.last_name || ''}`.trim() : 'Buyer'
          params.property_address = offer.property_address
          params.offer_price = offer.offer_price
        }
      } else {
        params = { ...params, ...manualDetails, offer_price: Number(manualDetails.offer_price) }
      }
      const res = await api('POST', '/api/closeiq/ai', params)
      setResult(res.email_body || res.letter || res.data || '')
    } catch {
      setResult('Failed to generate. Please try again.')
    } finally { setGenerating(false) }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <LoadingState />

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#D4AF37]" /> Cover Letter Generator</CardTitle>
          <CardDescription>Generate a personalized cover letter to accompany your offer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source toggle */}
          <div className="flex gap-2">
            <button onClick={() => setMode('offer')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'offer' ? 'bg-[#1E2761] text-white' : 'bg-gray-100 text-gray-600'}`}>
              From Offer
            </button>
            <button onClick={() => setMode('manual')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'manual' ? 'bg-[#1E2761] text-white' : 'bg-gray-100 text-gray-600'}`}>
              Manual Entry
            </button>
          </div>

          {mode === 'offer' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Select Offer</label>
              <select value={selectedOffer} onChange={e => setSelectedOffer(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
              >
                <option value="">Choose an offer...</option>
                {offers.map(o => <option key={o.id} value={o.id}>{o.property_address} - {(o as any).buyers ? `${(o as any).buyers.first_name || ''} ${(o as any).buyers.last_name || ''}`.trim() : 'Unknown'}</option>)}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Buyer Name" value={manualDetails.buyer_name} onChange={v => setManualDetails({ ...manualDetails, buyer_name: v })} />
              <InputField label="Property Address" value={manualDetails.property_address} onChange={v => setManualDetails({ ...manualDetails, property_address: v })} />
              <InputField label="Offer Price" value={manualDetails.offer_price} onChange={v => setManualDetails({ ...manualDetails, offer_price: v })} type="number" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Financing Type</label>
                <select value={manualDetails.financing_type} onChange={e => setManualDetails({ ...manualDetails, financing_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
                >
                  {[{v:'conventional',l:'Conventional'},{v:'fha',l:'FHA'},{v:'va',l:'VA'},{v:'cash',l:'Cash'},{v:'other',l:'Other'}].map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Tone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Tone</label>
            <div className="flex gap-2">
              {['professional', 'warm', 'confident', 'empathetic'].map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition ${
                    tone === t ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Buyer Story */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Buyer Story <span className="text-gray-400">(optional)</span></label>
            <textarea value={buyerStory} onChange={e => setBuyerStory(e.target.value)} rows={3} placeholder="Tell us about the buyer — first-time homebuyer, growing family, relocating for work, etc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] resize-none"
            />
          </div>

          <Button variant="gold" onClick={generate} disabled={generating || (mode === 'offer' && !selectedOffer)}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Cover Letter
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Generated Letter</CardTitle>
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <textarea value={result} onChange={e => setResult(e.target.value)} rows={12}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] resize-y"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function InputField({ label, value, onChange, type = 'text', icon: Icon, required }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; icon?: any; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className={`w-full border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] ${Icon ? 'pl-9 pr-3' : 'px-3'}`}
        />
      </div>
    </div>
  )
}

function ReadinessBadge({ score }: { score: number }) {
  if (!score && score !== 0) return null
  const level = readinessLevel(score)
  const rc = READINESS_COLOR[level]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${rc.bg} ${rc.text}`}>
      {score}%
    </span>
  )
}

function CommBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`flex-1 text-center p-3 rounded-lg ${highlight ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30' : 'bg-gray-50'}`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${highlight ? 'text-[#D4AF37]' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading...
    </div>
  )
}
