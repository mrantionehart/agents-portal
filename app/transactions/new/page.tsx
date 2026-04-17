'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../../providers'
import SidebarNav from '../../components/SidebarNav'
import {
  ArrowLeft, Home, Key, Building2, Share2, Layers, DollarSign,
  MapPin, User, Phone, Mail, Calendar, FileText, Save, AlertCircle
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

const TRANSACTION_TYPES = [
  { value: 'seller', label: 'Listing (Seller)', icon: Home, color: 'bg-teal-50 border-teal-300 text-teal-700', selectedColor: 'bg-teal-600 text-white border-teal-600' },
  { value: 'buyer', label: 'Buyer', icon: Key, color: 'bg-red-50 border-red-300 text-red-700', selectedColor: 'bg-red-600 text-white border-red-600' },
  { value: 'lease', label: 'Lease', icon: Building2, color: 'bg-blue-50 border-blue-300 text-blue-700', selectedColor: 'bg-blue-600 text-white border-blue-600' },
  { value: 'referral', label: 'Referral', icon: Share2, color: 'bg-amber-50 border-amber-300 text-amber-700', selectedColor: 'bg-amber-600 text-white border-amber-600' },
  { value: 'wholesale', label: 'Wholesale', icon: Layers, color: 'bg-purple-50 border-purple-300 text-purple-700', selectedColor: 'bg-purple-600 text-white border-purple-600' },
  { value: 'double_close', label: 'Double Close', icon: DollarSign, color: 'bg-indigo-50 border-indigo-300 text-indigo-700', selectedColor: 'bg-indigo-600 text-white border-indigo-600' },
]

export default function NewTransactionPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({
    type: '',
    agent_id: '',
    property_address: '',
    city: '',
    state: '',
    zip: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    other_party_name: '',
    other_party_agent: '',
    other_party_brokerage: '',
    contract_price: '',
    earnest_money: '',
    closing_date: '',
    contract_date: '',
    lease_term_months: '',
    assignment_fee: '',
    referral_fee_pct: '',
    referral_party: '',
    commission_rate_pct: '',
    agent_split_pct: '',
    notes: '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [agents, setAgents] = useState<any[]>([])
  const isBrokerAdmin = role === 'broker' || role === 'admin'

  const loadAgents = useCallback(async () => {
    if (!isBrokerAdmin) return
    try {
      const res = await fetch('/api/pipeline')
      if (!res.ok) return
      const data = await res.json()
      setAgents(data.agents || [])
    } catch {}
  }, [isBrokerAdmin])

  useEffect(() => { if (user) loadAgents() }, [user, loadAgents])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  const handleSubmit = async () => {
    if (!form.type) { setError('Please select a transaction type'); return }
    if (!form.property_address.trim()) { setError('Property address is required'); return }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')

      router.push('/pipeline')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  const showLeaseFields = form.type === 'lease'
  const showReferralFields = form.type === 'referral'
  const showWholesaleFields = form.type === 'wholesale' || form.type === 'double_close'
  const showBuyerSellerFields = form.type === 'buyer' || form.type === 'seller'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SidebarNav onSignOut={handleSignOut} userName={user?.user_metadata?.full_name} role={role} />

      <div className="flex-1 p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/pipeline')}
            className="p-2 rounded-lg hover:bg-gray-200 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Opportunity</h1>
            <p className="text-sm text-gray-500 mt-1">
              Add a new deal to your pipeline
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Transaction Type Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Transaction Type</h2>
          <div className="grid grid-cols-3 gap-3">
            {TRANSACTION_TYPES.map(t => {
              const Icon = t.icon
              const selected = form.type === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => updateField('type', t.value)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition font-medium text-sm ${
                    selected ? t.selectedColor : t.color
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Assign to Agent (Broker/Admin only) */}
        {isBrokerAdmin && agents.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Assign to Agent
            </h2>
            <select
              value={form.agent_id}
              onChange={e => updateField('agent_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Myself</option>
              {agents.map((a: any) => (
                <option key={a.id} value={a.id}>{a.full_name} ({a.email})</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">Leave as &quot;Myself&quot; to create under your own pipeline</p>
          </div>
        )}

        {/* Property Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            Property Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Address *</label>
              <input
                type="text"
                value={form.property_address}
                onChange={e => updateField('property_address', e.target.value)}
                placeholder="123 Main Street"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => updateField('city', e.target.value)}
                  placeholder="City"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={e => updateField('state', e.target.value)}
                  placeholder="NJ"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ZIP</label>
                <input
                  type="text"
                  value={form.zip}
                  onChange={e => updateField('zip', e.target.value)}
                  placeholder="07001"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Client Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            Client Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Name</label>
              <input
                type="text"
                value={form.client_name}
                onChange={e => updateField('client_name', e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1" />Email
                </label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={e => updateField('client_email', e.target.value)}
                  placeholder="client@email.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />Phone
                </label>
                <input
                  type="tel"
                  value={form.client_phone}
                  onChange={e => updateField('client_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Other Party */}
        {(showBuyerSellerFields || showLeaseFields) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Other Party</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={form.other_party_name}
                    onChange={e => updateField('other_party_name', e.target.value)}
                    placeholder="Other party name"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Agent</label>
                  <input
                    type="text"
                    value={form.other_party_agent}
                    onChange={e => updateField('other_party_agent', e.target.value)}
                    placeholder="Their agent"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Brokerage</label>
                  <input
                    type="text"
                    value={form.other_party_brokerage}
                    onChange={e => updateField('other_party_brokerage', e.target.value)}
                    placeholder="Their brokerage"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Financial Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-500" />
            Financial Details
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contract Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={form.contract_price}
                    onChange={e => updateField('contract_price', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              {!showReferralFields && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Earnest Money</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={form.earnest_money}
                      onChange={e => updateField('earnest_money', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Commission Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Commission Rate %</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.commission_rate_pct}
                  onChange={e => updateField('commission_rate_pct', e.target.value)}
                  placeholder="3.0"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Defaults to 3% if left blank</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Agent Split %</label>
                <input
                  type="number"
                  step="1"
                  value={form.agent_split_pct}
                  onChange={e => updateField('agent_split_pct', e.target.value)}
                  placeholder="70"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Defaults to 70% if left blank</p>
              </div>
            </div>

            {/* GCI Preview */}
            {form.contract_price && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Estimated GCI</p>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-gray-500">Gross Commission</p>
                    <p className="text-lg font-bold text-blue-600">
                      ${((parseFloat(form.contract_price) || 0) * ((parseFloat(form.commission_rate_pct) || 3) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Agent Amount</p>
                    <p className="text-lg font-bold text-green-600">
                      ${((parseFloat(form.contract_price) || 0) * ((parseFloat(form.commission_rate_pct) || 3) / 100) * ((parseFloat(form.agent_split_pct) || 70) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Brokerage Amount</p>
                    <p className="text-lg font-bold text-gray-600">
                      ${((parseFloat(form.contract_price) || 0) * ((parseFloat(form.commission_rate_pct) || 3) / 100) * ((100 - (parseFloat(form.agent_split_pct) || 70)) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Referral-specific */}
            {showReferralFields && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Referral Fee %</label>
                  <input
                    type="number"
                    value={form.referral_fee_pct}
                    onChange={e => updateField('referral_fee_pct', e.target.value)}
                    placeholder="25"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Referral Party</label>
                  <input
                    type="text"
                    value={form.referral_party}
                    onChange={e => updateField('referral_party', e.target.value)}
                    placeholder="Referring agent/brokerage"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Wholesale-specific */}
            {showWholesaleFields && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignment Fee</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={form.assignment_fee}
                    onChange={e => updateField('assignment_fee', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Lease-specific */}
            {showLeaseFields && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Lease Term (Months)</label>
                <input
                  type="number"
                  value={form.lease_term_months}
                  onChange={e => updateField('lease_term_months', e.target.value)}
                  placeholder="12"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            Important Dates
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {showLeaseFields ? 'Lease Start Date' : 'Contract Date'}
              </label>
              <input
                type="date"
                value={form.contract_date}
                onChange={e => updateField('contract_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {showLeaseFields ? 'Lease End Date' : 'Expected Closing Date'}
              </label>
              <input
                type="date"
                value={form.closing_date}
                onChange={e => updateField('closing_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            Notes
          </h2>
          <textarea
            value={form.notes}
            onChange={e => updateField('notes', e.target.value)}
            placeholder="Any additional details about this opportunity..."
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pb-10">
          <button
            onClick={() => router.push('/pipeline')}
            className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-teal-600 text-white px-8 py-3 rounded-xl hover:bg-teal-700 transition flex items-center gap-2 text-sm font-bold disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Create Opportunity
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
