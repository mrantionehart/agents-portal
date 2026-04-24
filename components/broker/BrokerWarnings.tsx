/**
 * BrokerWarnings Component
 * Dashboard widget for broker to manage deal timeline warnings
 */

'use client';

import { useState, useEffect } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed

interface Warning {
  id: string;
  transaction_id: string;
  warning_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  recommended_action: string;
  resolved_at: string | null;
  created_at: string;
  transactions?: {
    id: string;
    name: string;
    deal_type: string;
    closing_date: string;
  };
}

interface BrokerWarningsProps {
  userId?: string;
  userRole?: string;
  maxDisplay?: number;
  autoRefresh?: boolean;
}

const severityConfig = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: '🚨',
    badge: 'bg-red-500/100 text-white',
    text: 'text-red-900',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    icon: '⚠️',
    badge: 'bg-yellow-500/100 text-white',
    text: 'text-yellow-900',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'ℹ️',
    badge: 'bg-blue-500/100 text-white',
    text: 'text-blue-900',
  },
};

const warningTypeLabels: Record<string, string> = {
  missing_dates: 'Missing Dates',
  tight_timeline: 'Tight Timeline',
  overdue_task: 'Overdue Task',
  incomplete_prerequisites: 'Prerequisites Incomplete',
  high_risk_flags: 'High Risk Detected',
};

export default function BrokerWarnings({
  userId,
  userRole,
  maxDisplay = 10,
  autoRefresh = true,
}: BrokerWarningsProps) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterResolved, setFilterResolved] = useState<string>('false');
  const [selectedWarnings, setSelectedWarnings] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadWarnings();
    if (autoRefresh) {
      const interval = setInterval(loadWarnings, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [filterSeverity, filterResolved]);

  const loadWarnings = async () => {
    setLoading(true);
    try {
      const resolved = filterResolved === 'false' ? false : filterResolved === 'true' ? true : undefined;
      const data = await vaultAPI.timeline.getWarnings(
        resolved,
        filterSeverity || undefined,
        undefined,
        userId,
        userRole
      );

      setSummary(data.summary);
      setWarnings(data.warnings || []);
    } catch (error) {
      console.error('Failed to load warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveWarnings = async () => {
    if (selectedWarnings.size === 0) {
      alert('Please select warnings to resolve');
      return;
    }

    try {
      await vaultAPI.timeline.resolveWarnings(
        Array.from(selectedWarnings),
        'Resolved by broker',
        userId,
        userRole
      );
      setSelectedWarnings(new Set());
      await loadWarnings();
    } catch (error) {
      console.error('Failed to resolve warnings:', error);
      alert('Error resolving warnings');
    }
  };

  const handleDismissWarnings = async () => {
    if (selectedWarnings.size === 0) {
      alert('Please select warnings to dismiss');
      return;
    }

    try {
      await vaultAPI.timeline.dismissWarnings(
        Array.from(selectedWarnings),
        userId,
        userRole
      );
      setSelectedWarnings(new Set());
      await loadWarnings();
    } catch (error) {
      console.error('Failed to dismiss warnings:', error);
      alert('Error dismissing warnings');
    }
  };

  const toggleWarningSelection = (warningId: string) => {
    const newSelected = new Set(selectedWarnings);
    if (newSelected.has(warningId)) {
      newSelected.delete(warningId);
    } else {
      newSelected.add(warningId);
    }
    setSelectedWarnings(newSelected);
  };

  const toggleAllWarnings = () => {
    if (selectedWarnings.size === warnings.length) {
      setSelectedWarnings(new Set());
    } else {
      setSelectedWarnings(new Set(warnings.map((w) => w.id)));
    }
  };

  const displayedWarnings = warnings.slice(0, maxDisplay);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Deal Timeline Warnings</h2>
        <button
          onClick={loadWarnings}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-500/100 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#0a0a0f] rounded-lg border border-[#1a1a2e] p-3 text-center">
            <div className="text-2xl font-bold text-white">{summary.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="bg-red-500/10 rounded-lg border border-red-500/20 p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{summary.by_severity.critical}</div>
            <div className="text-xs text-red-400">Critical</div>
          </div>
          <div className="bg-yellow-500/10 rounded-lg border border-yellow-500/20 p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.by_severity.warning}</div>
            <div className="text-xs text-yellow-400">Warning</div>
          </div>
          <div className="bg-[#050507] rounded-lg border border-[#1a1a2e] p-3 text-center">
            <div className="text-2xl font-bold text-gray-400">{summary.unresolved}</div>
            <div className="text-xs text-gray-200">Unresolved</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 border border-[#1a1a2e] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical Only</option>
          <option value="warning">Warnings Only</option>
          <option value="info">Info Only</option>
        </select>

        <select
          value={filterResolved}
          onChange={(e) => setFilterResolved(e.target.value)}
          className="px-3 py-2 border border-[#1a1a2e] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
        >
          <option value="false">Unresolved Only</option>
          <option value="true">Resolved Only</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Warnings List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading warnings...</div>
      ) : warnings.length === 0 ? (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
          <p className="text-lg font-medium text-green-900">✓ No Active Warnings</p>
          <p className="text-sm text-green-400 mt-1">All deals are on track</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Bulk Actions */}
          {displayedWarnings.length > 0 && (
            <div className="flex items-center justify-between bg-[#050507] p-3 rounded-lg border border-[#1a1a2e]">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedWarnings.size === displayedWarnings.length && displayedWarnings.length > 0}
                  onChange={toggleAllWarnings}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-200">
                  {selectedWarnings.size > 0
                    ? `${selectedWarnings.size} selected`
                    : 'Select all'}
                </span>
              </label>

              {selectedWarnings.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleResolveWarnings}
                    className="px-3 py-1 text-sm bg-green-500/100 text-white rounded hover:bg-green-600"
                  >
                    Resolve ({selectedWarnings.size})
                  </button>
                  <button
                    onClick={handleDismissWarnings}
                    className="px-3 py-1 text-sm bg-[#050507]0 text-white rounded hover:bg-[#1a1a2e]"
                  >
                    Dismiss ({selectedWarnings.size})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Individual Warnings */}
          {displayedWarnings.map((warning) => {
            const config = severityConfig[warning.severity];

            return (
              <div
                key={warning.id}
                className={`border-l-4 p-4 rounded ${config.bg} border ${config.border}`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedWarnings.has(warning.id)}
                    onChange={() => toggleWarningSelection(warning.id)}
                    className="w-4 h-4 mt-1"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{config.icon}</span>
                      <span className={`text-sm font-bold ${config.text}`}>
                        {warningTypeLabels[warning.warning_type] || warning.warning_type}
                      </span>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${config.badge}`}>
                        {warning.severity}
                      </span>
                    </div>

                    {/* Message */}
                    <p className={`text-sm font-medium ${config.text} mb-2`}>
                      {warning.message}
                    </p>

                    {/* Recommended Action */}
                    {warning.recommended_action && (
                      <p className={`text-sm ${config.text} mb-2`}>
                        💡 {warning.recommended_action}
                      </p>
                    )}

                    {/* Transaction Info */}
                    {warning.transactions && (
                      <div className={`text-xs ${config.text} opacity-75 mb-2`}>
                        <p>
                          Deal: <span className="font-medium">{warning.transactions.name}</span>
                        </p>
                        {warning.transactions.closing_date && (
                          <p>
                            Closing:{' '}
                            <span className="font-medium">
                              {new Date(warning.transactions.closing_date).toLocaleDateString()}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className={`text-xs ${config.text} opacity-60`}>
                      Created: {new Date(warning.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedWarnings(new Set([warning.id]));
                        setTimeout(() => handleResolveWarnings(), 0);
                      }}
                      className="px-2 py-1 text-xs bg-green-500/100 text-white rounded hover:bg-green-600 whitespace-nowrap"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedWarnings(new Set([warning.id]));
                        setTimeout(() => handleDismissWarnings(), 0);
                      }}
                      className="px-2 py-1 text-xs bg-[#050507]0 text-white rounded hover:bg-[#1a1a2e] whitespace-nowrap"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Show More Link */}
          {warnings.length > maxDisplay && (
            <div className="text-center pt-2">
              <button className="text-sm text-blue-600 hover:text-blue-400">
                Show {warnings.length - maxDisplay} more warnings
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
