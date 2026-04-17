'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Download, TrendingUp, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PerformanceMetric {
  agent_id: string
  agent_name: string
  deals_closed: number
  total_commission: number
  average_deal_size: number
  commission_percentage: number
}

interface ReportData {
  id: string
  report_type: string
  period_label: string
  period_start: string
  period_end: string
  metrics_data: PerformanceMetric[]
  generated_at: string
  csv_data?: string
  pdf_data?: string
}

export function AgentPerformanceReport() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReports()
    subscribeToReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('agent_performance_reports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(10)

      if (fetchError) throw fetchError

      setReports((data || []) as ReportData[])
      if (data && data.length > 0) {
        setSelectedReport((data[0] as ReportData))
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToReports = () => {
    const subscription = supabase
      .channel('reports-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_performance_reports',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New report generated, add to list
            const newReport = payload.new as ReportData
            setReports(prev => [newReport, ...prev].slice(0, 10))
            if (!selectedReport) {
              setSelectedReport(newReport)
            }
          } else if (payload.eventType === 'UPDATE') {
            // Report updated, refresh the list
            setReports(prev =>
              prev.map(r => r.id === (payload.new as ReportData).id ? (payload.new as ReportData) : r)
            )
            if (selectedReport?.id === (payload.new as ReportData).id) {
              setSelectedReport(payload.new as ReportData)
            }
          } else if (payload.eventType === 'DELETE') {
            // Report deleted, remove from list
            setReports(prev => prev.filter(r => r.id !== (payload.old as ReportData).id))
            if (selectedReport?.id === (payload.old as ReportData).id) {
              setSelectedReport(null)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }

  const downloadCSV = async (report: ReportData) => {
    if (!report.csv_data) {
      alert('CSV data not available for this report')
      return
    }

    const blob = new Blob([report.csv_data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-performance-${report.period_label}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-center">Loading reports...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agent Performance Reports</h2>
          <p className="text-sm text-gray-600">Monthly and quarterly performance metrics</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Report Selection Tabs */}
      {reports.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 overflow-x-auto">
            <div className="flex">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition ${
                    selectedReport?.id === report.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{report.period_label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Report Details */}
          {selectedReport && (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-gray-600 text-sm">Report Type</p>
                  <p className="text-gray-900 font-medium capitalize">{selectedReport.report_type}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Period</p>
                  <p className="text-gray-900 font-medium">
                    {new Date(selectedReport.period_start).toLocaleDateString()} - {new Date(selectedReport.period_end).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Agent Metrics Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Agent</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Deals Closed</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Avg Deal Size</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total Commission</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Commission %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Array.isArray(selectedReport.metrics_data) &&
                      selectedReport.metrics_data.map((metric: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">{metric.agent_name || 'Unknown'}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{metric.deals_closed || 0}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">${((metric.average_deal_size || 0) / 1000000).toFixed(2)}M</td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">${((metric.total_commission || 0) / 1000).toFixed(2)}K</td>
                          <td className="px-6 py-3 text-sm">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-green-600 font-medium">{(metric.commission_percentage || 0).toFixed(1)}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Download Button */}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => downloadCSV(selectedReport)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {reports.length === 0 && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-2">No Reports Generated Yet</h3>
          <p className="text-gray-700 text-sm">
            Agent performance reports are generated automatically on a schedule. Reports will appear here once available.
          </p>
        </div>
      )}
    </div>
  )
}
