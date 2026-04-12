// Compliance Dashboard Components
// Displays agent compliance status, alerts, and onboarding progress

'use client'

import React from 'react'
import { AlertTriangle, CheckCircle, Clock, AlertCircle, Shield } from 'lucide-react'
import { ComplianceStatus, OnboardingStep } from '@/lib/complianceUtils'

interface ComplianceStatusGridProps {
  statuses: ComplianceStatus[];
  isLoading?: boolean;
  onAgentClick?: (agentId: string) => void;
}

/**
 * Grid showing all agents with compliance status
 */
export const ComplianceStatusGrid: React.FC<ComplianceStatusGridProps> = ({
  statuses,
  isLoading = false,
  onAgentClick,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <ComplianceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Shield size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-gray-600">No compliance data available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {statuses.map(status => (
        <ComplianceCard
          key={status.agentId}
          status={status}
          onClick={() => onAgentClick?.(status.agentId)}
        />
      ))}
    </div>
  );
};

interface ComplianceCardProps {
  status: ComplianceStatus;
  onClick?: () => void;
}

/**
 * Individual compliance status card
 */
const ComplianceCard: React.FC<ComplianceCardProps> = ({ status, onClick }) => {
  const riskColors = {
    low: 'bg-green-50 border-green-200',
    medium: 'bg-yellow-50 border-yellow-200',
    high: 'bg-orange-50 border-orange-200',
    critical: 'bg-red-50 border-red-200',
  };

  const riskTextColors = {
    low: 'text-green-700',
    medium: 'text-yellow-700',
    high: 'text-orange-700',
    critical: 'text-red-700',
  };

  const riskIcons = {
    low: <CheckCircle size={20} />,
    medium: <AlertCircle size={20} />,
    high: <AlertTriangle size={20} />,
    critical: <AlertTriangle size={20} />,
  };

  return (
    <div
      onClick={onClick}
      className={`${riskColors[status.riskLevel]} border rounded-lg p-6 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-lg' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">{status.agentName}</h3>
          <p className="text-xs text-gray-600">{status.agentEmail}</p>
        </div>
        <div className={`${riskTextColors[status.riskLevel]}`}>
          {riskIcons[status.riskLevel]}
        </div>
      </div>

      {/* Compliance score */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-gray-600 uppercase font-semibold">Compliance Score</p>
          <p className={`text-2xl font-bold ${riskTextColors[status.riskLevel]}`}>
            {status.complianceScore}%
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              status.riskLevel === 'low'
                ? 'bg-green-600'
                : status.riskLevel === 'medium'
                  ? 'bg-yellow-600'
                  : status.riskLevel === 'high'
                    ? 'bg-orange-600'
                    : 'bg-red-600'
            }`}
            style={{ width: `${status.complianceScore}%` }}
          />
        </div>
      </div>

      {/* Key metrics */}
      <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
        {/* Onboarding */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Onboarding</span>
          <span className={status.onboardingComplete ? 'text-green-700 font-semibold' : 'text-orange-700'}>
            {status.onboardingPercent}%
          </span>
        </div>

        {/* Documents */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Documents</span>
          <span className="font-semibold">
            {status.uploadedDocumentsCount}/{status.requiredDocumentsCount}
          </span>
        </div>

        {/* Cap utilization */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Monthly Cap</span>
          <span className={status.capExceeded ? 'text-orange-700 font-semibold' : 'text-gray-700'}>
            {status.dealsCreatedThisMonth}/{status.monthlyCapLimit}
          </span>
        </div>
      </div>

      {/* Issues count */}
      {status.complianceIssues && status.complianceIssues.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle size={16} className="text-red-600" />
          <span className="text-red-700 font-semibold">
            {status.complianceIssues.length} open issue{status.complianceIssues.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Compliance loading skeleton
 */
const ComplianceCardSkeleton: React.FC = () => {
  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-4 w-32 bg-gray-300 rounded mb-2"></div>
          <div className="h-3 w-48 bg-gray-300 rounded"></div>
        </div>
        <div className="w-6 h-6 bg-gray-300 rounded"></div>
      </div>

      <div className="h-10 bg-gray-300 rounded mb-2"></div>
      <div className="h-2 bg-gray-300 rounded-full mb-4"></div>

      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-20 bg-gray-300 rounded"></div>
            <div className="h-3 w-16 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Compliance alerts display
 */
interface ComplianceAlertsProps {
  alerts: any[];
  isLoading?: boolean;
  onResolve?: (alertId: string) => void;
}

export const ComplianceAlerts: React.FC<ComplianceAlertsProps> = ({
  alerts,
  isLoading = false,
  onResolve,
}) => {
  if (isLoading) {
    return <div className="text-center py-8">Loading alerts...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
        <p className="text-green-700 font-semibold">No compliance issues</p>
        <p className="text-sm text-green-600 mt-1">All agents are in compliance</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`border rounded-lg p-4 ${
            alert.severity === 'critical'
              ? 'bg-red-50 border-red-200'
              : alert.severity === 'error'
                ? 'bg-orange-50 border-orange-200'
                : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{alert.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>{alert.agent_name} ({alert.agent_email})</span>
                {alert.due_date && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Due: {new Date(alert.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {onResolve && (
              <button
                onClick={() => onResolve(alert.id)}
                className="ml-4 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Onboarding tracker
 */
interface OnboardingTrackerProps {
  steps: OnboardingStep[];
  agentName: string;
  isLoading?: boolean;
  onStepComplete?: (stepId: string) => void;
}

export const OnboardingTracker: React.FC<OnboardingTrackerProps> = ({
  steps,
  agentName,
  isLoading = false,
  onStepComplete,
}) => {
  const completed = steps.filter(s => s.completed).length;
  const total = steps.length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {agentName}'s Onboarding Progress
      </h3>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {completed}/{total} steps complete
          </span>
          <span className="text-sm font-bold text-blue-600">{Math.round(percentage)}%</span>
        </div>

        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map(step => (
          <div
            key={step.id}
            className={`border rounded-lg p-4 ${
              step.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">
                {step.completed ? (
                  <CheckCircle size={20} className="text-green-600" />
                ) : (
                  <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                )}
              </div>

              <div className="flex-1">
                <h4 className={`font-semibold ${step.completed ? 'text-gray-600 line-through' : 'text-gray-900'}`}>
                  {step.title}
                </h4>
                {step.description && (
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                )}
                {!step.completed && step.dueDate && (
                  <p className="text-xs text-orange-600 mt-2">
                    Due: {step.dueDate.toLocaleDateString()}
                  </p>
                )}
              </div>

              {!step.completed && onStepComplete && (
                <button
                  onClick={() => onStepComplete(step.id)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Complete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Compliance summary cards
 */
interface ComplianceSummaryProps {
  summary: {
    totalAgents: number;
    agentsInCompliance: number;
    agentsAtRisk: number;
    criticalIssues: number;
    documentComplianceRate: number;
  };
}

export const ComplianceSummary: React.FC<ComplianceSummaryProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700 uppercase font-semibold">Total Agents</p>
        <p className="text-2xl font-bold text-blue-900 mt-2">{summary.totalAgents}</p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-xs text-green-700 uppercase font-semibold">In Compliance</p>
        <p className="text-2xl font-bold text-green-900 mt-2">{summary.agentsInCompliance}</p>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-xs text-orange-700 uppercase font-semibold">At Risk</p>
        <p className="text-2xl font-bold text-orange-900 mt-2">{summary.agentsAtRisk}</p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-xs text-red-700 uppercase font-semibold">Critical Issues</p>
        <p className="text-2xl font-bold text-red-900 mt-2">{summary.criticalIssues}</p>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-xs text-purple-700 uppercase font-semibold">Doc Compliance</p>
        <p className="text-2xl font-bold text-purple-900 mt-2">{summary.documentComplianceRate}%</p>
      </div>
    </div>
  );
};
