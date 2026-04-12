'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ComplianceFlag {
  id: string
  agent_id: string
  issue_type: string
  severity: 'warning' | 'error' | 'critical'
  title: string
  description: string
  resolved: boolean
  due_date: string | null
  created_at: string
  agent_name?: string
}

interface ComplianceReview {
  id: string
  agent_id: string
  compliance_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  issues_count: number
  critical_issues_count: number
  created_at: string
  agent_name?: string
}

const severityConfig = {
  warning: { color: 'yellow', icon: '⚠️', label: 'Warning' },
  error: { color: 'orange', icon: '❌', label: 'Error' },
  critical: { color: 'red', icon: '🔴', label: 'Critical' },
}

const riskConfig = {
  low: { color: 'green', label: 'Low Risk' },
  medium: { color: 'yellow', label: 'Medium Risk' },
  high: { color: 'orange', label: 'High Risk' },
  critical: { color: 'red', label: 'Critical Risk' },
}

export function ComplianceDashboard() {
  const [flags, setFlags] = useState<ComplianceFlag[]>([])
  const [reviews, setReviews] = useState<ComplianceReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterResolved, setFilterResolved] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null)

  useEffect(() => {
    fetchComplianceData()
  }, [])

  const fetchComplianceData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch compliance flags
      const { data: flagsData, error: flagsError } = await supabase
        .from('compliance_flags')
        .select('*')
        .eq('resolved', filterResolved)
        .order('created_at', { ascending: false })

      if (flagsError) throw flagsError

      // Fetch compliance reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('agent_compliance_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (reviewsError) throw reviewsError

      setFlags((flagsData || []) as ComplianceFlag[])
      setReviews((reviewsData || []) as ComplianceReview[])
    } catch (err) {
      console.error('Error fetching compliance data:', err)
      setError('Failed to load compliance data')
    } finally {
      setLoading(false)
    }
  }

  const resolveFlag = async (flagId: string) => {
    try {
      const { error } = await supabase
        .from('compliance_flags')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', flagId)

      if (error) throw error

      setFlags(flags.map((f) => (f.id === flagId ? { ...f, resolved: true } : f)))
    } catch (err) {
      console.error('Error resolving flag:', err)
      alert('Failed to resolve flag')
    }
  }

  const filteredFlags = flags.filter((flag) => {
    if (filterSeverity && flag.severity !== filterSeverity) return false
    return !filterResolved || flag.resolved
  })

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-center">Loading compliance data...</div>
      </div>
    )
  }

  const unresolved = flags.filter((f) => !f.resolved).length
  const critical = flags.filter((f) => f.severity === 'critical' && !f.resolved).length
  const averageScore = reviews.length > 0 ? Math.round(reviews.reduce((sum, r) => sum + r.compliance_score, 0) / reviews.length) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CheckCircle className="w-8 h-8 text-green-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Compliance Management</h2>
          <p className="text-sm text-gray-600">Track and manage agent compliance status</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-xs font-medium mb-1">Avg Compliance Score</p>
          <p className="text-3xl font-bold text-gray-900">{averageScore}%</p>
          <p className="text-xs text-gray-500 mt-1">Across all agents</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-xs font-medium mb-1">Unresolved Issues</p>
          <p className="text-3xl font-bold text-orange-600">{unresolved}</p>
          <p className="text-xs text-gray-500 mt-1">Pending review</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-xs font-medium mb-1">Critical Flags</p>
          <p className="text-3xl font-bold text-red-600">{critical}</p>
          <p className="text-xs text-gray-500 mt-1">Require immediate action</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-xs font-medium mb-1">Agents Reviewed</p>
          <p className="text-3xl font-bold text-blue-600">{reviews.length}</p>
          <p className="text-xs text-gray-500 mt-1">Recent reviews</p>
        </div>
      </div>

      {/* Compliance Flags Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Compliance Flags</h3>
            <div className="flex gap-2">
              <select
                value={filterSeverity || ''}
                onChange={(e) => setFilterSeverity(e.target.value || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Severities</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {filteredFlags.length > 0 ? (
          <div className="divide-y">
            {filteredFlags.map((flag) => {
              const config = severityConfig[flag.severity]
              return (
                <div key={flag.id} className={`p-6 border-l-4 border-${config.color}-500`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{config.icon}</span>
                        <div>
                          <h4 className="font-bold text-gray-900">{flag.title}</h4>
                          <p className="text-sm text-gray-600">{flag.issue_type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm mt-3">{flag.description}</p>
                      {flag.due_date && (
                        <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>Due: {new Date(flag.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    {!flag.resolved && (
                      <button
                        onClick={() => resolveFlag(flag.id)}
                        className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                      >
                        Resolve
                      </button>
                    )}
                    {flag.resolved && (
                      <div className="ml-4 px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                        ✓ Resolved
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No {filterResolved ? 'resolved' : 'unresolved'} compliance flags</p>
          </div>
        )}
      </div>

      {/* Compliance Reviews */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Recent Compliance Reviews</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Agent</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Compliance Score</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Risk Level</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Issues</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reviews.slice(0, 10).map((review) => {
                  const riskCfg = riskConfig[review.risk_level]
                  return (
                    <tr key={review.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{review.agent_name || 'Unknown'}</td>
                      <td className="px-6 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                review.compliance_score >= 80
                                  ? 'bg-green-600'
                                  : review.compliance_score >= 60
                                    ? 'bg-yellow-600'
                                    : 'bg-red-600'
                              }`}
                              style={{ width: `${review.compliance_score}%` }}
                            />
                          </div>
                          <span className="font-medium text-gray-900 min-w-max">{review.compliance_score}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${riskCfg.color}-100 text-${riskCfg.color}-800`}>
                          {riskCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{review.issues_count}</td>
                      <td className="px-6 py-3 text-sm">
                        {review.critical_issues_count > 0 && <span className="text-red-600 font-bold">{review.critical_issues_count}</span>}
                        {review.critical_issues_count === 0 && <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
