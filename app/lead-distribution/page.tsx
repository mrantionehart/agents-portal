'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Check, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ComplianceNotifications from '../components/compliance-notifications'

interface AvailableLead {
  id: string
  name: string
  email: string
  phone: string
  property_address: string
  lead_type: string
  urgency: string
  budget: string
  timeline: string
  notes: string
  listing_info: string
  posted_by: string
  status: 'available' | 'claimed'
  claimed_by: string | null
  claimed_by_name: string | null
  claimed_at: string | null
  created_at: string
}

// Urgency display labels
const URGENCY_LABELS: Record<string, string> = { hot: 'Hot', warm: 'Warm', new: 'New' }

export default function LeadDistributionPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [availableLeads, setAvailableLeads] = useState<AvailableLead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'available' | 'claimed' | null>(null)
  const [myClaimedLeads, setMyClaimedLeads] = useState(false)

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
      const { data, error: fetchError } = await supabase
        .from('new_leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setAvailableLeads(data || [])
    } catch (err) {
      console.error('Error loading leads:', err)
      setError(`Failed to load leads: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLeadsLoading(false)
    }
  }

  const handleClaimLead = async (leadId: string) => {
    try {
      // Check if still available
      const { data: check } = await supabase.from('new_leads').select('status').eq('id', leadId).single()
      if (check?.status !== 'available') {
        alert('This lead has already been claimed.')
        loadLeads()
        return
      }
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUser!.id).single()
      await supabase.from('new_leads').update({
        status: 'claimed',
        claimed_by: currentUser!.id,
        claimed_by_name: profile?.full_name || user?.email,
        claimed_at: new Date().toISOString(),
      }).eq('id', leadId)
      loadLeads()
    } catch (err) {
      alert('Failed to claim lead')
    }
  }

  const handleUnclaimLead = async (leadId: string) => {
    try {
      await supabase.from('new_leads').update({
        status: 'available',
        claimed_by: null,
        claimed_by_name: null,
        claimed_at: null,
      }).eq('id', leadId)
      loadLeads()
    } catch (err) {
      alert('Failed to unclaim lead')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const filteredLeads = availableLeads.filter((lead) => {
    const matchesSearch =
      (lead.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.property_address || '').toLowerCase().includes(searchTerm.toLowerCase())

    let matchesStatus = true
    if (statusFilter) {
      matchesStatus = lead.status === statusFilter
    }

    let matchesClaimed = true
    if (myClaimedLeads) {
      matchesClaimed = lead.claimed_by === user?.id
    }

    return matchesSearch && matchesStatus && matchesClaimed
  })

  const stats = {
    available: availableLeads.filter((l) => l.status === 'available').length,
    claimed: availableLeads.filter((l) => l.status === 'claimed').length,
    total: availableLeads.length,
    myClaimed: availableLeads.filter((l) => l.claimed_by === user?.id && l.status === 'claimed').length,
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

        {/* Agent info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm font-medium">Browse leads posted by your broker. Claim a lead to start working it — contact info is revealed after claiming.</p>
        </div>

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
            <p className="text-gray-600 text-sm font-medium mb-1">Total</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
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
                    <h3 className="font-bold text-gray-900">{lead.name}</h3>
                    <p className="text-xs text-gray-600">{lead.property_address || 'No address'}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      lead.urgency === 'hot' ? 'bg-red-100 text-red-800' :
                      lead.urgency === 'warm' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>{lead.urgency}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      lead.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{lead.status}</span>
                  </div>
                </div>

                <div className="p-4 space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Type: {lead.lead_type}</p>
                    {lead.email && <p className="text-gray-600">Email: {lead.email}</p>}
                    {lead.phone && <p className="text-gray-600">Phone: {lead.phone}</p>}
                  </div>

                  {lead.budget && (
                    <p className="text-gray-700 font-medium">Budget: {lead.budget}</p>
                  )}
                  {lead.notes && (
                    <p className="text-gray-500 text-xs italic">{lead.notes}</p>
                  )}

                  {lead.claimed_by_name && (
                    <p className="text-xs text-gray-600">Claimed by: {lead.claimed_by_name}</p>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    {lead.status === 'available' && lead.claimed_by !== user?.id && (
                      <button onClick={() => handleClaimLead(lead.id)} className="flex-1 bg-blue-600 text-white py-2 rounded text-xs font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" /> Claim
                      </button>
                    )}
                    {lead.claimed_by === user?.id && (
                      <button onClick={() => handleUnclaimLead(lead.id)} className="flex-1 bg-yellow-100 text-yellow-800 py-2 rounded text-xs font-medium hover:bg-yellow-200 transition">
                        Unclaim
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
              <p className="font-semibold text-blue-900 mb-1">How It Works</p>
              <p className="text-sm text-blue-800">
                Your broker posts leads here for the team. Browse available leads and claim one to start working it. First come, first served — once claimed, it&apos;s yours.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
