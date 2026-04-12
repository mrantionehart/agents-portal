'use client'

import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '../../providers'
import Link from 'next/link'
import { ArrowLeft, Save, Phone, Mail, Trash2, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'

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

interface Activity {
  id: string
  activity_type: string
  details: string
  created_at: string
}

export default function LeadDetailPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [leadLoading, setLeadLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Lead>>({})
  const [newActivity, setNewActivity] = useState({ activity_type: 'note', details: '' })
  const [showAddActivity, setShowAddActivity] = useState(false)

  useEffect(() => {
    if (user) {
      loadLead()
      loadActivities()
    }
  }, [user, leadId])

  const loadLead = async () => {
    if (!user) return
    try {
      setLeadLoading(true)
      const result = await vaultAPI.leads.get(leadId, user.id, role)
      setLead(result)
      setFormData(result)
    } catch (err) {
      setError(`Failed to load lead: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLeadLoading(false)
    }
  }

  const loadActivities = async () => {
    if (!user) return
    try {
      const result = await vaultAPI.leads.getActivities(leadId, user.id, role)
      setActivities(Array.isArray(result) ? result : result.activities || [])
    } catch (err) {
      console.error('Error loading activities:', err)
    }
  }

  const handleSave = async () => {
    if (!user || !lead) return

    try {
      setIsSaving(true)
      await vaultAPI.leads.update(leadId, formData, user.id, role)
      setLead({ ...lead, ...formData })
      setIsEditing(false)
      setError(null)
    } catch (err) {
      setError(`Failed to save lead: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newActivity.details) return

    try {
      await vaultAPI.leads.addActivity(leadId, newActivity, user.id, role)
      setNewActivity({ activity_type: 'note', details: '' })
      setShowAddActivity(false)
      await loadActivities()
    } catch (err) {
      setError(`Failed to add activity: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDelete = async () => {
    if (!user || !confirm('Are you sure you want to delete this lead?')) return

    try {
      await vaultAPI.leads.delete(leadId, user.id, role)
      router.push('/leads')
    } catch (err) {
      setError(`Failed to delete lead: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading || leadLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || !lead) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/leads" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Back to Leads
            </Link>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Lead Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {formData.first_name} {formData.last_name}
              </h1>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                formData.status === 'hot' ? 'bg-red-100 text-red-800' :
                formData.status === 'warm' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {formData.status === 'hot' ? '🔥' : formData.status === 'warm' ? '⏱️' : '❄️'} {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
              </div>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:bg-green-400"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setFormData(lead)
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-6">
            {formData.email && (
              <div>
                <p className="text-gray-600 text-sm mb-1">Email</p>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <a href={`mailto:${formData.email}`} className="text-blue-600 hover:underline flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {formData.email}
                  </a>
                )}
              </div>
            )}
            {formData.phone && (
              <div>
                <p className="text-gray-600 text-sm mb-1">Phone</p>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <a href={`tel:${formData.phone}`} className="text-blue-600 hover:underline flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {formData.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lead Details */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Lead Details</h2>

          <div className="space-y-6">
            {/* Status and Source */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                {isEditing ? (
                  <select
                    value={formData.status || 'warm'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'hot' | 'warm' | 'cold' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="hot">🔥 Hot</option>
                    <option value="warm">⏱️ Warm</option>
                    <option value="cold">❄️ Cold</option>
                  </select>
                ) : (
                  <p className="text-gray-900">{formData.status?.charAt(0).toUpperCase()}{formData.status?.slice(1)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lead Source</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.lead_source || ''}
                    onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.lead_source || 'Not specified'}</p>
                )}
              </div>
            </div>

            {/* Property Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Address</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.property_address || ''}
                  onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <p className="text-gray-900">{formData.property_address || 'Not specified'}</p>
              )}
            </div>

            {/* City, State, ZIP */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.city || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.state || ''}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.state || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ZIP</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.zip || ''}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.zip || 'Not specified'}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              {isEditing ? (
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">{formData.notes || 'No notes'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Activities Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Activity History</h2>
            {!showAddActivity && (
              <button
                onClick={() => setShowAddActivity(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Activity
              </button>
            )}
          </div>

          {/* Add Activity Form */}
          {showAddActivity && (
            <form onSubmit={handleAddActivity} className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
                <select
                  value={newActivity.activity_type}
                  onChange={(e) => setNewActivity({ ...newActivity, activity_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="note">Note</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Details</label>
                <textarea
                  value={newActivity.details}
                  onChange={(e) => setNewActivity({ ...newActivity, details: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Describe the activity..."
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Save Activity
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddActivity(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Activities List */}
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="border-l-4 border-blue-500 pl-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      {activity.activity_type}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {new Date(activity.created_at).toLocaleDateString()} {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-900">{activity.details}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No activities yet. Add one to get started!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
