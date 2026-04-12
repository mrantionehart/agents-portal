// Agent Performance Report Components
// Displays agent metrics in card, table, and chart formats

'use client'

import React from 'react'
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Calendar,
  Award,
} from 'lucide-react'
import { AgentMetrics } from '@/lib/agentPerformanceReports'

interface PerformanceCardProps {
  metric: AgentMetrics;
  comparison?: {
    dealsVsTeam: number;
    commissionVsTeam: number;
    closeRateVsTeam: number;
    ranking: number;
    totalAgents: number;
  };
  onViewDetails?: () => void;
}

/**
 * Individual agent performance card
 */
export const AgentPerformanceCard: React.FC<PerformanceCardProps> = ({
  metric,
  comparison,
  onViewDetails,
}) => {
  const isBelowAverage = comparison && comparison.commissionVsTeam < 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{metric.agentName}</h3>
          <p className="text-sm text-gray-600">{metric.agentEmail}</p>
        </div>
        {comparison && (
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              #{comparison.ranking}
            </div>
            <p className="text-xs text-gray-500">of {comparison.totalAgents}</p>
          </div>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide">Deals</p>
          <p className="text-2xl font-bold text-gray-900">{metric.dealsClosed}</p>
          <p className="text-xs text-gray-500">{metric.totalDeals} total</p>
        </div>

        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide">Commission</p>
          <p className="text-2xl font-bold text-green-600">
            ${(metric.totalCommissionEarned / 1000).toFixed(1)}k
          </p>
          <p className="text-xs text-gray-500">Earned</p>
        </div>

        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide">Close Rate</p>
          <p className="text-2xl font-bold text-blue-600">{metric.closeRate}%</p>
          <p className="text-xs text-gray-500">Success rate</p>
        </div>

        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide">Avg Deal</p>
          <p className="text-2xl font-bold text-purple-600">
            ${(metric.avgDealValue / 1000).toFixed(1)}k
          </p>
          <p className="text-xs text-gray-500">Contract value</p>
        </div>
      </div>

      {/* Comparison to team (if available) */}
      {comparison && (
        <div className="mb-4 pb-4 border-b border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">vs Team Average</span>
            <div className="flex items-center gap-2">
              {comparison.commissionVsTeam >= 0 ? (
                <TrendingUp size={16} className="text-green-600" />
              ) : (
                <TrendingDown size={16} className="text-red-600" />
              )}
              <span className={`text-sm font-semibold ${comparison.commissionVsTeam >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparison.commissionVsTeam > 0 ? '+' : ''}
                {comparison.commissionVsTeam.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {isBelowAverage ? 'Underperforming' : 'Exceeding'} team average
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Last activity: {metric.lastActivityDate?.toLocaleDateString() || 'Never'}
        </span>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View Details →
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Performance report table
 */
interface PerformanceTableProps {
  metrics: AgentMetrics[];
  isLoading?: boolean;
  onRowClick?: (metric: AgentMetrics) => void;
}

export const AgentPerformanceTable: React.FC<PerformanceTableProps> = ({
  metrics,
  isLoading = false,
  onRowClick,
}) => {
  if (isLoading) {
    return <div className="text-center py-8">Loading report...</div>;
  }

  if (metrics.length === 0) {
    return <div className="text-center py-8 text-gray-600">No agents found</div>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
              Agent
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
              Deals Closed
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
              Close Rate
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
              Total Value
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
              Commission Earned
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
              Avg Deal Value
            </th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric, idx) => (
            <tr
              key={metric.agentId}
              onClick={() => onRowClick?.(metric)}
              className={`border-b border-gray-200 ${
                onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
              } ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
            >
              <td className="px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">{metric.agentName}</p>
                  <p className="text-xs text-gray-600">{metric.agentEmail}</p>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <p className="font-semibold text-gray-900">
                  {metric.dealsClosed} / {metric.totalDeals}
                </p>
              </td>
              <td className="px-6 py-4 text-right">
                <p className="font-semibold text-blue-600">{metric.closeRate}%</p>
              </td>
              <td className="px-6 py-4 text-right">
                <p className="font-semibold text-gray-900">
                  ${(metric.totalContractValue / 1000000).toFixed(2)}M
                </p>
              </td>
              <td className="px-6 py-4 text-right">
                <p className="font-semibold text-green-600">
                  ${(metric.totalCommissionEarned / 1000).toFixed(1)}k
                </p>
              </td>
              <td className="px-6 py-4 text-right">
                <p className="text-gray-900">${(metric.avgDealValue / 1000).toFixed(1)}k</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Report header with period and export options
 */
interface ReportHeaderProps {
  period: {
    type: string;
    label: string;
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

export const PerformanceReportHeader: React.FC<ReportHeaderProps> = ({
  period,
  generatedAt,
  onExportCSV,
  onExportPDF,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Agent Performance Report
          </h1>
          <p className="text-gray-600 mt-1">{period.label}</p>
          <p className="text-sm text-gray-500 mt-2">
            {new Date(period.startDate).toLocaleDateString()} -{' '}
            {new Date(period.endDate).toLocaleDateString()}
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-3">
          {onExportCSV && (
            <button
              onClick={onExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Download size={16} />
              CSV
            </button>
          )}
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              <Download size={16} />
              PDF
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Generated on {new Date(generatedAt).toLocaleString()}
      </p>
    </div>
  )
}

/**
 * Summary statistics
 */
interface ReportSummaryProps {
  summary: {
    totalAgents: number;
    totalDeals: number;
    totalCommission: number;
    avgCloseRate: number;
  };
}

export const PerformanceReportSummary: React.FC<ReportSummaryProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700 uppercase font-semibold">Total Agents</p>
        <p className="text-2xl font-bold text-blue-900 mt-2">{summary.totalAgents}</p>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-xs text-green-700 uppercase font-semibold">Total Deals</p>
        <p className="text-2xl font-bold text-green-900 mt-2">{summary.totalDeals}</p>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-xs text-purple-700 uppercase font-semibold">Team Commission</p>
        <p className="text-2xl font-bold text-purple-900 mt-2">
          ${(summary.totalCommission / 1000000).toFixed(2)}M
        </p>
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-xs text-orange-700 uppercase font-semibold">Avg Close Rate</p>
        <p className="text-2xl font-bold text-orange-900 mt-2">{summary.avgCloseRate}%</p>
      </div>
    </div>
  )
}
