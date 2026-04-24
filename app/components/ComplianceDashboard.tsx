'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Clock, FileText, Flag, Eye } from 'lucide-react'

interface ComplianceAlert {
  id: string
  type: 'document_missing' | 'deadline_approaching' | 'violation' | 'review_pending'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
  related_transaction: string
  related_agent: string
  created_at: string
  reviewed_at?: string
  reviewed_by?: string
  status: 'pending' | 'reviewed' | 'resolved'
}

interface ComplianceDashboardProps {
  userId: string
  role: string
}

export default function ComplianceDashboard({ userId, role }: ComplianceDashboardProps) {
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending')

  useEffect(() => {
    fetchComplianceAlerts()
  }, [userId])

  const fetchComplianceAlerts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('https://hartfelt-vault.vercel.app/api/compliance/alerts', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': role,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAlerts(data.alerts || [])
      } else if (response.status === 403) {
        setError('You do not have permission to view compliance alerts')
      } else {
        setAlerts([])
      }
    } catch (err) {
      console.log('Compliance alerts API failed:', err)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const markAsReviewed = async (alertId: string) => {
    try {
      // Optimistic update
      setAlerts(alerts.map(a =>
        a.id === alertId
          ? { ...a, status: 'reviewed', reviewed_at: new Date().toISOString(), reviewed_by: userId }
          : a
      ))

      // Persist to backend
      await fetch('https://hartfelt-vault.vercel.app/api/compliance/alerts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': role,
        },
        body: JSON.stringify({
          alertId,
          status: 'reviewed',
        }),
      })
    } catch (err) {
      console.log('Failed to mark alert as reviewed:', err)
      // Revert optimistic update on error
      fetchComplianceAlerts()
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/10 border-red-500/20'
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/20'
      case 'low':
        return 'bg-blue-500/10 border-blue-500/20'
      default:
        return 'bg-[#050507] border-[#1a1a2e]'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Flag className="w-5 h-5 text-red-600" />
      case 'medium':
        return <Clock className="w-5 h-5 text-yellow-600" />
      case 'low':
        return <AlertCircle className="w-5 h-5 text-blue-600" />
      default:
        return <FileText className="w-5 h-5 text-gray-400" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'document_missing':
        return 'Missing Document'
      case 'deadline_approaching':
        return 'Deadline Approaching'
      case 'violation':
        return 'Compliance Violation'
      case 'review_pending':
        return 'Pending Review'
      default:
        return type
    }
  }

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true
    if (filter === 'pending') return a.status === 'pending'
    if (filter === 'reviewed') return a.status === 'reviewed' || a.status === 'resolved'
    return true
  })

  const pendingCount = alerts.filter(a => a.status === 'pending').length
  const reviewedCount = alerts.filter(a => a.status === 'reviewed').length
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length

  if (loading) {
    return <div className="text-center py-8">Loading compliance alerts...</div>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0a0a0f] rounded-lg shadow p-4 border-l-4 border-red-500">
          <p className="text-gray-400 text-sm font-medium">Pending Review</p>
          <p className="text-2xl font-bold text-white mt-1">{pendingCount}</p>
        </div>

        <div className="bg-[#0a0a0f] rounded-lg shadow p-4 border-l-4 border-blue-500">
          <p className="text-gray-400 text-sm font-medium">Reviewed</p>
          <p className="text-2xl font-bold text-white mt-1">{reviewedCount}</p>
        </div>

        <div className="bg-[#0a0a0f] rounded-lg shadow p-4 border-l-4 border-green-500">
          <p className="text-gray-400 text-sm font-medium">Resolved</p>
          <p className="text-2xl font-bold text-white mt-1">{resolvedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-[#0a0a0f] rounded-lg shadow">
        <div className="flex gap-4 p-4 border-b border-[#1a1a2e]">
          {(['all', 'pending', 'reviewed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded font-medium transition ${
                filter === tab
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-gray-400 hover:bg-[#0a0a0f]'
              }`}
            >
              {tab === 'all' && 'All Alerts'}
              {tab === 'pending' && 'Pending'}
              {tab === 'reviewed' && 'Reviewed'}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        {filteredAlerts.length > 0 ? (
          <div className="divide-y divide-[#1a1a2e]">
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 border-l-4 ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">
                          {alert.title}
                        </h4>
                        <span className="text-xs px-2 py-1 bg-[#1a1a2e] text-gray-200 rounded">
                          {getTypeLabel(alert.type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{alert.description}</p>
                      <div className="flex gap-4 text-xs text-gray-400">
                        {alert.related_transaction && (
                          <span>📋 Transaction: {alert.related_transaction}</span>
                        )}
                        {alert.related_agent && (
                          <span>👤 Agent: {alert.related_agent}</span>
                        )}
                      </div>
                      {alert.status === 'reviewed' && alert.reviewed_at && (
                        <div className="mt-2 text-xs text-green-400">
                          ✓ Reviewed {new Date(alert.reviewed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {alert.status === 'pending' && (role === 'compliance' || role === 'broker' || role === 'admin') && (
                    <button
                      onClick={() => markAsReviewed(alert.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium flex gap-2 items-center whitespace-nowrap"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Reviewed
                    </button>
                  )}

                  {alert.status === 'pending' && role !== 'compliance' && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      Pending review
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Eye className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No compliance alerts</p>
          </div>
        )}
      </div>
    </div>
  )
}
