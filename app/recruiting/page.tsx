'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, Users, Mail, Phone, MapPin, TrendingUp, AlertCircle, Trash2, Edit, CheckCircle, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'

interface Recruit {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  experience: 'entry' | 'intermediate' | 'experienced'
  status: 'prospect' | 'interested' | 'pipeline' | 'hired' | 'declined'
  source: string
  notes?: string
  createdAt: string
  recruiterEmail: string
}

const STATUS_TYPES = [
  { id: 'prospect', label: 'Prospect', color: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-300' },
  { id: 'interested', label: 'Interested', color: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-300' },
  { id: 'pipeline', label: 'In Pipeline', color: 'bg-orange-100', textColor: 'text-orange-800', borderColor: 'border-orange-300' },
  { id: 'hired', label: 'Hired', color: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-300' },
  { id: 'declined', label: 'Declined', color: 'bg-red-100', textColor: 'text-red-800', borderColor: 'border-red-300' },
]

const EXPERIENCE_LEVELS = [
  { id: 'entry', label: 'Entry Level' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'experienced', label: 'Experienced' },
]

export default function RecruitingPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [recruits, setRecruits] = useState<Recruit[]>([])
  const [recruitsLoading, setRecruitsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [newRecruit, setNewRecruit] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    experience: 'entry' as const,
    status: 'prospect' as const,
    source: 'Referral',
    notes: '',
  })

  useEffect(() => {
    if (user) {
      loadRecruits()
    }
  }, [user])

  const loadRecruits = async () => {
    if (!user) return

    try {
      setRecruitsLoading(true)
      setError(null)

      // Placeholder: In production, Vault API would have /api/recruits endpoint
      setRecruits([])
    } catch (err) {
      console.error('Error loading recruits:', err)
      setError(`Failed to load recruits: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRecruitsLoading(false)
    }
  }

  const handleAddRecruit = () => {
    if (!newRecruit.firstName || !newRecruit.lastName || !newRecruit.email) {
      alert('Please fill in required fields')
      return
    }

    const recruit: Recruit = {
      id: `r${Date.now()}`,
      ...newRecruit,
      recruiterEmail: user!.email || '',
      createdAt: new Date().toISOString(),
    }

    setRecruits([...recruits, recruit])
    setNewRecruit({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      experience: 'entry',
      status: 'prospect',
      source: 'Referral',
      notes: '',
    })
    setShowAddForm(false)
  }

  const handleDeleteRecruit = (recruitId: string) => {
    if (confirm('Remove this recruit?')) {
      setRecruits(recruits.filter((r) => r.id !== recruitId))
    }
  }

  const handleStatusChange = (recruitId: string, newStatus: Recruit['status']) => {
    setRecruits(
      recruits.map((r) =>
        r.id === recruitId ? { ...r, status: newStatus } : r
      )
    )
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const filteredRecruits = recruits.filter((r) => {
    const matchesSearch =
      r.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: recruits.length,
    prospects: recruits.filter((r) => r.status === 'prospect').length,
    interested: recruits.filter((r) => r.status === 'interested').length,
    pipeline: recruits.filter((r) => r.status === 'pipeline').length,
    hired: recruits.filter((r) => r.status === 'hired').length,
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
            <h1 className="text-2xl font-bold text-gray-900">Recruiting</h1>
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

        {/* Add Recruit Button */}
        <div className="mb-8">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancel' : 'Add New Recruit'}
          </button>
        </div>

        {/* Add Recruit Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Recruit</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={newRecruit.firstName}
                  onChange={(e) => setNewRecruit({ ...newRecruit, firstName: e.target.value })}
                  placeholder="First name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  value={newRecruit.lastName}
                  onChange={(e) => setNewRecruit({ ...newRecruit, lastName: e.target.value })}
                  placeholder="Last name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={newRecruit.email}
                  onChange={(e) => setNewRecruit({ ...newRecruit, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={newRecruit.phone}
                  onChange={(e) => setNewRecruit({ ...newRecruit, phone: e.target.value })}
                  placeholder="(305) 555-0000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={newRecruit.location}
                  onChange={(e) => setNewRecruit({ ...newRecruit, location: e.target.value })}
                  placeholder="Miami, FL"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                <select
                  value={newRecruit.experience}
                  onChange={(e) => setNewRecruit({ ...newRecruit, experience: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <input
                  type="text"
                  value={newRecruit.source}
                  onChange={(e) => setNewRecruit({ ...newRecruit, source: e.target.value })}
                  placeholder="e.g., Referral, Job Board, Network"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Initial Status</label>
                <select
                  value={newRecruit.status}
                  onChange={(e) => setNewRecruit({ ...newRecruit, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_TYPES.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={newRecruit.notes}
                  onChange={(e) => setNewRecruit({ ...newRecruit, notes: e.target.value })}
                  placeholder="Any additional notes about this recruit"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleAddRecruit}
                className="col-span-2 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Add Recruit
              </button>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Total</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
            <p className="text-gray-600 text-sm font-medium mb-1">Prospects</p>
            <p className="text-3xl font-bold text-gray-900">{stats.prospects}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Interested</p>
            <p className="text-3xl font-bold text-gray-900">{stats.interested}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Pipeline</p>
            <p className="text-3xl font-bold text-gray-900">{stats.pipeline}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Hired</p>
            <p className="text-3xl font-bold text-gray-900">{stats.hired}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUS_TYPES.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Recruits List */}
        {recruitsLoading ? (
          <div className="text-center py-12 text-gray-600">Loading recruits...</div>
        ) : filteredRecruits.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecruits.map((recruit) => {
              const statusType = STATUS_TYPES.find((t) => t.id === recruit.status)
              return (
                <div key={recruit.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                  <div className={`${statusType?.color} rounded-t-lg p-4 border-b-2 ${statusType?.borderColor}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className={`font-bold ${statusType?.textColor}`}>
                          {recruit.firstName} {recruit.lastName}
                        </h3>
                        <p className={`text-xs ${statusType?.textColor} opacity-75`}>
                          {EXPERIENCE_LEVELS.find((l) => l.id === recruit.experience)?.label}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${statusType?.color} ${statusType?.borderColor} border`}>
                        {statusType?.label}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <a href={`mailto:${recruit.email}`} className="text-blue-600 hover:text-blue-700">
                        {recruit.email}
                      </a>
                    </div>

                    {recruit.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${recruit.phone}`} className="text-blue-600 hover:text-blue-700">
                          {recruit.phone}
                        </a>
                      </div>
                    )}

                    {recruit.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {recruit.location}
                      </div>
                    )}

                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Source: {recruit.source}
                    </div>

                    {recruit.notes && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {recruit.notes}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <select
                        value={recruit.status}
                        onChange={(e) => handleStatusChange(recruit.id, e.target.value as any)}
                        className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        {STATUS_TYPES.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.label}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleDeleteRecruit(recruit.id)}
                        className="px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-4">
              {searchTerm || statusFilter ? 'No recruits matching filters' : 'No recruits yet'}
            </p>
            <p className="text-gray-500 text-sm">Start adding recruits to build your recruitment pipeline.</p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Recruitment Pipeline</p>
              <p className="text-sm text-blue-800">
                Manage your recruitment pipeline and track potential agents. Follow prospects through prospect → interested → pipeline → hired. This feature helps you build your team.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
