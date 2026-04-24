'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { Plus, Search, Trash2, Edit, Phone, Mail, AlertCircle, CheckCircle, Clock, Briefcase } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'

interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  property_address: string
  city: string
  state: string
  zip: string
  lead_source: string
  status: 'hot' | 'warm' | 'cold'
  notes: string
  created_at: string
}

export default function LeadsPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedLeadForConvert, setSelectedLeadForConvert] = useState<Lead | null>(null)
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null)
  const [dealData, setDealData] = useState({
    contract_price: '',
    notes: '',
  })
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    property_address: '',
    city: '',
    state: '',
    zip: '',
    lead_source: '',
    status: 'warm' as const,
    notes: '',
  })

  useEffect(() => {
    if (user) {
      loadLeads()
    }
  }, [user])

  useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, statusFilter])

  const loadLeads = async () => {
    if (!user) return
    try {
      setLeadsLoading(true)
      setError(null)
      const result = await vaultAPI.leads.list(user.id, role)
      const leadsArray = Array.isArray(result) ? result : result.leads || []
      setLeads(leadsArray)
    } catch (err) {
      console.error('Error loading leads:', err)
      // Silently fail - just set empty data instead of showing error
      setLeads([])
    } finally {
      setLeadsLoading(false)
    }
  }

  const filterLeads = () => {
    let filtered = leads

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(lead =>
        lead.first_name.toLowerCase().includes(term) ||
        lead.last_name.toLowerCase().includes(term) ||
        lead.email.toLowerCase().includes(term) ||
        lead.phone.includes(term) ||
        lead.property_address.toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter)
    }

    setFilteredLeads(filtered)
  }

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const newLead = {
        ...formData,
        agent_id: user.id,
      }
      await vaultAPI.leads.create(newLead, user.id, role)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        property_address: '',
        city: '',
        state: '',
        zip: '',
        lead_source: '',
        status: 'warm',
        notes: '',
      })
      setShowAddForm(false)
      await loadLeads()
    } catch (err) {
      setError(`Failed to add lead: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!user || !confirm('Are you sure you want to delete this lead?')) return

    try {
      await vaultAPI.leads.delete(leadId, user.id, role)
      await loadLeads()
    } catch (err) {
      setError(`Failed to delete lead: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleConvertToDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedLeadForConvert) return

    try {
      setConvertingLeadId(selectedLeadForConvert.id)
      const newDeal = await vaultAPI.deals.create(
        {
          client_name: `${selectedLeadForConvert.first_name} ${selectedLeadForConvert.last_name}`,
          property_address: selectedLeadForConvert.property_address,
          contract_price: parseFloat(dealData.contract_price) || 0,
          stage: 'new',
          status: 'new',
          notes: dealData.notes || selectedLeadForConvert.notes,
          agent_id: user.id,
          created_at: new Date().toISOString(),
        },
        user.id,
        role
      )

      // Clear the form
      setDealData({ contract_price: '', notes: '' })
      setShowConvertModal(false)
      setSelectedLeadForConvert(null)

      // Refresh leads and optionally redirect to pipeline
      await loadLeads()
      alert(`✅ Lead converted to deal! Redirecting to pipeline...`)
      router.push('/pipeline')
    } catch (err) {
      setError(`Failed to convert lead: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setConvertingLeadId(null)
    }
  }

  const openConvertModal = (lead: Lead) => {
    setSelectedLeadForConvert(lead)
    setShowConvertModal(true)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hot':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'warm':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'cold':
        return <CheckCircle className="w-4 h-4 text-blue-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot':
        return 'bg-red-500/15 text-red-800 border-red-300'
      case 'warm':
        return 'bg-yellow-500/15 text-yellow-400 border-yellow-300'
      case 'cold':
        return 'bg-blue-500/15 text-blue-400 border-blue-300'
      default:
        return 'bg-[#0a0a0f] text-white border-[#1a1a2e]'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 font-medium">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">My Leads</h1>
          </div>
          <div className="flex items-center gap-4">
            <ComplianceNotifications userId={user?.id} role={role} />
            <button
              onClick={handleSignOut}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Top Actions */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancel' : 'Add Lead'}
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 mb-8">
          {(['all', 'hot', 'warm', 'cold'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg transition ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0a0a0f] text-gray-200 border border-[#1a1a2e] hover:bg-[#0a0a0f]'
              }`}
            >
              {status === 'all' ? 'All Leads' : `${status.charAt(0).toUpperCase() + status.slice(1)} (${leads.filter(l => l.status === status).length})`}
            </button>
          ))}
        </div>

        {/* Add Lead Form */}
        {showAddForm && (
          <div className="bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Lead</h2>
            <form onSubmit={handleAddLead} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Property Address</label>
                <input
                  type="text"
                  value={formData.property_address}
                  onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                    placeholder="FL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">ZIP</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Lead Source</label>
                  <select
                    value={formData.lead_source}
                    onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  >
                    <option value="">Select source...</option>
                    <option value="Referral">Referral</option>
                    <option value="Website">Website</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Door Knock">Door Knock</option>
                    <option value="Farm">Farm</option>
                    <option value="Sphere">Sphere</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  >
                    <option value="hot">🔥 Hot</option>
                    <option value="warm">⏱️ Warm</option>
                    <option value="cold">❄️ Cold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                  placeholder="Add any notes about this lead..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Add Lead
              </button>
            </form>
          </div>
        )}

        {/* Convert to Deal Modal */}
        {showConvertModal && selectedLeadForConvert && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0a0a0f] rounded-lg shadow-xl max-w-md w-full p-8">
              <h2 className="text-2xl font-bold text-white mb-2">Convert to Deal</h2>
              <p className="text-gray-400 mb-6">
                Converting <strong>{selectedLeadForConvert.first_name} {selectedLeadForConvert.last_name}</strong> to a deal
              </p>

              <form onSubmit={handleConvertToDeal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Contract Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">$</span>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={dealData.contract_price}
                      onChange={(e) => setDealData({ ...dealData, contract_price: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-green-500"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Additional Notes</label>
                  <textarea
                    value={dealData.notes}
                    onChange={(e) => setDealData({ ...dealData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Any notes for this deal..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConvertModal(false)
                      setSelectedLeadForConvert(null)
                      setDealData({ contract_price: '', notes: '' })
                    }}
                    className="flex-1 px-4 py-2 border border-[#1a1a2e] text-gray-200 rounded-lg hover:bg-[#0a0a0f] transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={convertingLeadId === selectedLeadForConvert.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:bg-green-400"
                  >
                    {convertingLeadId === selectedLeadForConvert.id ? 'Converting...' : 'Convert to Deal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Leads List */}
        {leadsLoading ? (
          <div className="text-center py-12 text-gray-400">Loading leads...</div>
        ) : filteredLeads.length > 0 ? (
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="bg-[#0a0a0f] rounded-lg shadow p-6 hover:shadow-lg shadow-black/20 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {lead.first_name} {lead.last_name}
                      </h3>
                      <div className={`px-3 py-1 rounded-full border text-sm font-medium flex items-center gap-1 ${getStatusColor(lead.status)}`}>
                        {getStatusIcon(lead.status)}
                        {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {lead.email && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Mail className="w-4 h-4" />
                          <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Phone className="w-4 h-4" />
                          <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {lead.property_address && (
                      <p className="text-gray-200 mb-2">
                        <span className="font-semibold">Property:</span> {lead.property_address}
                        {lead.city && `, ${lead.city}`}
                        {lead.state && `, ${lead.state}`}
                        {lead.zip && ` ${lead.zip}`}
                      </p>
                    )}

                    {lead.lead_source && (
                      <p className="text-gray-400 text-sm mb-2">
                        <span className="font-semibold">Source:</span> {lead.lead_source}
                      </p>
                    )}

                    {lead.notes && (
                      <p className="text-gray-400 text-sm italic">
                        <span className="font-semibold">Notes:</span> {lead.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openConvertModal(lead)}
                      className="px-4 py-2 bg-green-500/15 text-green-400 hover:bg-green-200 rounded-lg transition text-sm font-medium flex items-center gap-2"
                      title="Convert to deal"
                    >
                      <Briefcase className="w-4 h-4" />
                      Convert
                    </button>
                    <button
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="p-2 text-blue-600 hover:bg-blue-500/10 rounded-lg transition"
                      title="View details"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLead(lead.id)}
                      className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition"
                      title="Delete lead"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#0a0a0f] rounded-lg shadow p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 font-medium mb-4">
              {searchTerm || statusFilter !== 'all' ? 'No leads match your filters.' : 'No leads yet. Add your first lead to get started!'}
            </p>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Add Your First Lead
              </button>
            )}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-12">
          <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
            <p className="text-gray-400 text-sm font-medium mb-2">Total Leads</p>
            <p className="text-3xl font-bold text-white">{leads.length}</p>
          </div>
          <div className="bg-red-500/10 rounded-lg shadow p-6 border border-red-500/20">
            <p className="text-red-600 text-sm font-medium mb-2">🔥 Hot Leads</p>
            <p className="text-3xl font-bold text-red-600">{leads.filter(l => l.status === 'hot').length}</p>
          </div>
          <div className="bg-yellow-500/10 rounded-lg shadow p-6 border border-yellow-500/20">
            <p className="text-yellow-600 text-sm font-medium mb-2">⏱️ Warm Leads</p>
            <p className="text-3xl font-bold text-yellow-600">{leads.filter(l => l.status === 'warm').length}</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg shadow p-6 border border-blue-500/20">
            <p className="text-blue-600 text-sm font-medium mb-2">❄️ Cold Leads</p>
            <p className="text-3xl font-bold text-blue-600">{leads.filter(l => l.status === 'cold').length}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
