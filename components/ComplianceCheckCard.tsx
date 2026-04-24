'use client'

import React, { useState } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Zap } from 'lucide-react'
import { vaultAPI } from '@/lib/vault-api'

interface ComplianceCheckResult {
  overall_status: 'passed' | 'issues_found' | 'failed'
  score: number
  issues: Array<{
    severity: 'error' | 'warning' | 'info'
    category: string
    title: string
    description: string
  }>
  summary: string
}

interface ComplianceCheckCardProps {
  transactionId: string
  dealAddress?: string
}

export default function ComplianceCheckCard({
  transactionId,
  dealAddress,
}: ComplianceCheckCardProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplianceCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunCheck = async () => {
    if (!transactionId) {
      setError('Transaction ID is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await vaultAPI.runComplianceCheck(transactionId, 'manual')
      setResult(response.result || response.data?.result)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to run compliance check'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/15'
    if (score >= 60) return 'bg-yellow-500/15'
    return 'bg-red-500/15'
  }

  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-600'
    if (score >= 60) return 'bg-yellow-600'
    return 'bg-red-600'
  }

  return (
    <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg overflow-hidden shadow-sm shadow-black/10">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-[#1a1a2e] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-teal-600" />
          <div>
            <h3 className="text-base font-semibold text-white">Compliance Check</h3>
            <p className="text-xs text-gray-400">AI-powered transaction review</p>
          </div>
        </div>

        <button
          onClick={handleRunCheck}
          disabled={loading}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking...' : 'Check Now'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="p-6 space-y-6">
          {/* Score */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Compliance Score</p>
            <div className="flex items-center gap-4">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center ${getScoreBgColor(result.score)}`}
              >
                <span className={`text-3xl font-bold ${getScoreColor(result.score)}`}>
                  {result.score}%
                </span>
              </div>
              <div className="flex-1">
                <div className="w-full bg-[#1a1a2e] rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressBarColor(result.score)}`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="border-b border-[#1a1a2e] pb-4">
            <div className="flex items-start gap-3">
              {result.overall_status === 'passed' ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : result.overall_status === 'issues_found' ? (
                <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-white">
                  {result.overall_status === 'passed'
                    ? 'Passed'
                    : result.overall_status === 'issues_found'
                    ? 'Issues Found'
                    : 'Failed'}
                </h4>
                <p className="text-sm text-gray-400 mt-1">{result.summary}</p>
              </div>
            </div>
          </div>

          {/* Issues List */}
          {result.issues && result.issues.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-3">
                Issues ({result.issues.length})
              </h4>
              <div className="space-y-2">
                {result.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`border-l-4 p-3 rounded ${
                      issue.severity === 'error'
                        ? 'border-red-500 bg-red-500/10'
                        : issue.severity === 'warning'
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-blue-500 bg-blue-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-white text-sm">{issue.title}</p>
                        <p className="text-gray-200 text-sm mt-1">{issue.description}</p>
                        <span
                          className={`inline-block mt-2 text-xs px-2 py-1 rounded ${
                            issue.severity === 'error'
                              ? 'bg-red-500/15 text-red-400'
                              : issue.severity === 'warning'
                              ? 'bg-yellow-500/15 text-yellow-400'
                              : 'bg-blue-500/15 text-blue-400'
                          }`}
                        >
                          {issue.category}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase flex-shrink-0 ${
                          issue.severity === 'error'
                            ? 'text-red-400'
                            : issue.severity === 'warning'
                            ? 'text-yellow-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {issue.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-teal-700">
              {result.score >= 85
                ? 'Great! Your transaction meets all compliance requirements.'
                : result.score >= 70
                ? 'Please address the issues above before proceeding.'
                : 'Critical issues must be resolved for commission approval.'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !error && (
        <div className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Run a compliance check to see what's needed</p>
          <p className="text-gray-400 text-sm mt-1">
            This will analyze your deal for issues affecting commission
          </p>
        </div>
      )}
    </div>
  )
}
