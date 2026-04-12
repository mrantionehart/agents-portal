'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, Check, Clock, AlertCircle, Trash2, Filter, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'

interface AvailableLead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  propertyAddress: string
  city: string
  state: string
  zip: string
  interestedIn: 'buying' | 'selling' | 'both'
  budget?: number
  timeline: 'urgent' | 'within_3_months' | 'within_6_months' | 'flexible'
  source: string
  status: 'available' | 'claimed' | 'converted'
  claimedBy?: string
  claimedAt?: string
  createdAt: string
  expiresAt: string
}

const LEAD_SOURCES = [
  'Website',
  'Facebook Ad',
  'Google Ad',
  'Referral',
  'Open House',
  'Door Knock',
  'Past Client',
  'Other',
]

const TIMELINES = [
  { id: 'urgent', label: 'Urgent (This Week)' },
  { id: 'within_3_months', label: 'Within 3 Months' },
  { id: 'within_6_months', label: 'Within 6 Months' },
  { id: 'flexible', label: 'Flexible' },
]

const INTERESTED_IN = [
  { id: 'buying', label: 'Buying' },
  { id: 'selling', label: 'Selling' },
  { id: 'both', label: 'Buying & Selling' },
]

export default function LeadDistributionPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [availableLeads, setAvailableLeads] = useState<AvailableLead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'available' | 'claimed' | 'converted' | null>(null)
  const [myClaimedLeads, setMyClaimedLeads] = useState(false)
  const [newLead, setNewLead] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    propertyAddress: '',
    city: '',
    state: 'FL',
    zip: '',
    interestedIn: 'both' as const,
    budget: '',
    timeline: 'flexible' as const,
    source: 'Website',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  })

  useEffect(() => {
    if (user) {
      loadLeads()
    }
  }, [user])

  const loadLeads = async () => {
    if (!user) return

    try {
      setLeadsLoading(true)
      setError(null)

      // Placeholder: In production, Vault API would have /api/lead-distribution endpoint
      setAvailableLeads([])
    } catch (err) {
      console.error('Error loading leads:', err)
      setError(`Failed to load leads: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLeadsLoading(false)
    }
  }

  const handleAddLead = () => {
    if (!newLead.firstName || !newLead.lastName || !newLead.email) {
      alert('Please fill in required fields')
      return
    }

    const lead: AvailableLead = {
      id: `ld${Date.now()}`,
      ...newLead,
      budget: newLead.budget ? parseInt(newLead.budget) : undefined,
      status: 'available',
      createdAt: new Date().toISOString(),
    }

    setAvailableLeads([...availableLeads, lead])
    setNewLead({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      propertyAddress: '',
      city: '',
      state: 'FL',
      zip: '',
      interestedIn: 'both',
      budget: '',
      timeline: 'flexible',
      source: 'Website',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    setShowAddForm(false)
  }

  const handleClaimLead = (leadId: string) => {
    setAvailableLeads(
      availableLeads.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              status: 'claimed',
              claimedBy: user!.email,
              claimedAt: new Date().toISOString(),
            }
          : lead
      )
    )
  }

  const handleUnclaimLead = (leadId: string) => {
    setAvailableLeads(
      availableLeads.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              status: 'available',
              claimedBy: undefined,
              claimedAt: undefined,
            }
          : lead
      )
    )
  }

  const handleDeleteLead = (leadId: string) => {
    if (confirm('Delete this lead?')) {
      setAvailableLeads(availableLeads.filter((l) => l.id !== leadId))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const filteredLeads = availableLeads.filter((lead) => {
    const matchesSearch =
      lead.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase())

    let matchesStatus = true
    if (statusFilter) {
      matchesStatus = lead.status === statusFilter
    }

    let matchesClaimed = true
    if (myClaimedLeads) {
      matchesClaimed = lead.claimedBy === user?.email
    }

    return matchesSearch && matchesStatus && matchesClaimed
  })

  const stats = {
    available: availableLeads.filter((l) => l.status === 'available').length,
    claimed: availableLeads.filter((l) => l.status === 'claimed').length,
    converted: availableLeads.filter((l) => l.status === 'converted').length,
    myClaimed: availableLeads.filter((l) => l.claimedBy === user?.email && l.status === 'claimed').length,
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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Lead Distribution</h1>
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Broker-only: Add Lead Button */}
        {(role === 'broker' || role === 'admin') && (
          <div className="mb-8">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {showAddForm ? 'Cancel' : 'Add New Lead'}
            </button>
          </div>
        )}

        {/* Add Lead Form - Broker only */}
        {showAddForm && (role === 'broker' || role === 'admin') && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Lead to Distribution Pool</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={newLead.firstName}
                  onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
                  placeholder="First name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  value={newLead.lastName}
                  onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
                  placeholder="Last name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="(305) 555-0000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Address</label>
                <input
                  type="text"
                  value={newLead.propertyAddress}
                  onChange={(e) => setNewLead({ ...newLead, propertyAddress: e.target.value })}
                  placeholder="Street address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={newLead.city}
                  onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  placeholder="Miami"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  value={newLead.state}
                  onChange={(e) => setNewLead({ ...newLead, state: e.target.value })}
                  placeholder="FL"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ZIP</label>
                <input
                  type="text"
                  value={newLead.zip}
                  onChange={(e) => setNewLead({ ...newLead, zip: e.target.value })}
                  placeholder="33101"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Interested In</label>
                <select
                  value={newLead.interestedIn}
                  onChange={(e) => setNewLead({ ...newLead, interestedIn: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {INTERESTED_IN.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                <input
                  type="number"
                  value={newLead.budget}
                  onChange={(e) => setNewLead({ ...newLead, budget: e.target.value })}
                  placeholder="$500,000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timeline</label>
                <select
                  value={newLead.timeline}
                  onChange={(e) => setNewLead({ ...newLead, timeline: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {TIMELINES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <select
                  value={newLead.source}
                  onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expires</label>
                <input
                  type="date"
                  value={newLead.expiresAt}
                  onChange={(e) => setNewLead({ ...newLead, expiresAt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleAddLead}
                className="col-span-2 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Add Lead to Pool
              </button>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Available</p>
            <p className="text-3xl font-bold text-gray-900">{stats.available}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Claimed</p>
            <p className="text-3xl font-bold text-gray-900">{stats.claimed}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Converted</p>
            <p className="text-3xl font-bold text-gray-900">{stats.converted}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium mb-1">My Claimed</p>
            <p className="text-3xl font-bold text-gray-900">{stats.myClaimed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by name, email, or property..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter((e.target.value as any) || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="claimed">Claimed</option>
            <option value="converted">Converted</option>
          </select>

          <button
            onClick={() => setMyClaimedLeads(!myClaimedLeads)}
            className={`px-4 py-2 rounded-lg transition ${
              myClaimedLeads
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            My Claimed
          </button>
        </div>

        {/* Leads Grid */}
        {leadsLoading ? (
          <div className="text-center py-12 text-gray-600">Loading leads...</div>
        ) : filteredLeads.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                <div className="p-4 border-b border-gray-200 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <p className="text-xs text-gray-600">{lead.propertyAddress}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      lead.status === 'available'
                        ? 'bg-blue-100 text-blue-800'
                        : lead.status === 'claimed'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {lead.status.replace('_', ' ').charAt(0).toUpperCase() + lead.status.slice(1)}
                  </span>
                </div>

                <div className="p-4 space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Email: {lead.email}</p>
                    {lead.phone && <p className="text-gray-600">Phone: {lead.phone}</p>}
                  </div>

                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                      {INTERESTED_IN.find((i) => i.id === lead.interestedIn)?.label}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                      {TIMELINES.find((t) => t.id === lead.timeline)?.label}
                    </span>
                  </div>

                  {lead.budget && (
                    <p className="text-gray-700 font-medium">Budget: ${lead.budget.toLocaleString()}</p>
                  )}

                  {lead.claimedBy && (
                    <p className="text-xs text-gray-600">
                      Claimed by: {lead.claimedBy}
                    </p>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    {lead.status === 'available' && lead.claimedBy !== user?.email && (
                      <button
                        onClick={() => handleClaimLead(lead.id)}
                        className="flex-1 bg-blue-600 text-white py-2 rounded text-xs font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Claim
                      </button>
                    )}

                    {lead.claimedBy === user?.email && (
                      <button
                        onClick={() => handleUnclaimLead(lead.id)}
                        className="flex-1 bg-yellow-100 text-yellow-800 py-2 rounded text-xs font-medium hover:bg-yellow-200 transition"
                      >
                        Unclaim
                      </button>
                    )}

                    {(role === 'broker' || role === 'admin') && (
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-4">
              {searchTerm || statusFilter ? 'No leads matching filters' : 'No leads available'}
            </p>
            <p className="text-gray-500 text-sm">
              {role === 'broker' || role === 'admin'
                ? 'Add leads to the distribution pool for agents to claim.'
                : 'Check back soon for available leads from your broker.'}
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Lead Distribution System</p>
              <p className="text-sm text-blue-800">
                Brokers add leads to the pool. Agents browse and claim available leads. Claimed leads are tracked and converted to deals. This system ensures fair lead distribution across your team.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
