/**
 * DealTimeline Component
 * Visualize transaction timeline with all key dates and tasks
 */

'use client';

import { useState, useEffect } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed

interface TimelineItem {
  date_type: string;
  scheduled_date: string;
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
  };
  days_until: number;
  is_critical?: boolean;
}

interface DealTimelineProps {
  transactionId: string;
}

const priorityColors: Record<string, string> = {
  critical: 'border-red-500 bg-red-50',
  high: 'border-orange-500 bg-orange-50',
  medium: 'border-yellow-500 bg-yellow-50',
};

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
};

export default function DealTimeline({
  transactionId,
}: DealTimelineProps) {
  // const { data: session } = useSession(); // DISABLED: next-auth not installed
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');

  useEffect(() => {
    loadTimeline();
  }, [transactionId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await vaultAPI.timeline.getTimeline(
        transactionId,
        undefined,
        undefined
      );
      setTimeline(data);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading timeline...</div>;
  }

  if (!timeline) {
    return <div className="text-center py-8 text-gray-500">No timeline data available</div>;
  }

  const now = new Date();
  let dates = [...(timeline.dates?.items || [])];

  // Sort by selected criteria
  if (sortBy === 'priority') {
    dates.sort((a: any, b: any) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const aPriority = a.is_critical ? 'critical' : 'medium';
      const bPriority = b.is_critical ? 'critical' : 'medium';
      return (priorityOrder[aPriority as keyof typeof priorityOrder] || 2) -
             (priorityOrder[bPriority as keyof typeof priorityOrder] || 2);
    });
  }

  // Group dates into past, upcoming, and future
  const pastDates = dates.filter((d: any) => new Date(d.scheduled_date) < now);
  const upcomingDates = dates.filter((d: any) => {
    const dateObj = new Date(d.scheduled_date);
    const daysUntil = Math.floor((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return dateObj >= now && daysUntil <= 14;
  });
  const futureDates = dates.filter((d: any) => {
    const dateObj = new Date(d.scheduled_date);
    const daysUntil = Math.floor((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil > 14;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntil = (dateString: string) => {
    const days = Math.floor(
      (new Date(dateString).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const renderDateItem = (date: any) => {
    const daysUntil = getDaysUntil(date.scheduled_date);
    const isPast = daysUntil < 0;
    const isCritical = daysUntil >= 0 && daysUntil <= 3;

    return (
      <div
        key={date.id}
        className={`border-l-4 p-4 mb-3 rounded ${
          isCritical ? priorityColors.critical : ''
        } ${isPast ? 'opacity-60' : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 capitalize">
              {date.date_type.replace(/_/g, ' ')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {formatDate(date.scheduled_date)}
            </p>

            {daysUntil >= 0 && (
              <p
                className={`text-xs font-medium mt-2 ${
                  isCritical
                    ? 'text-red-600'
                    : daysUntil <= 7
                    ? 'text-orange-600'
                    : 'text-gray-600'
                }`}
              >
                {daysUntil === 0 ? 'TODAY' : `${daysUntil} days away`}
              </p>
            )}

            {isPast && (
              <p className="text-xs text-gray-500 mt-2">
                {Math.abs(daysUntil)} days ago
              </p>
            )}
          </div>

          {date.is_critical && (
            <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded">
              URGENT
            </span>
          )}
        </div>

        {date.confidence_score && (
          <div className="mt-3 text-xs text-gray-500">
            Confidence: {Math.round(date.confidence_score * 100)}%
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Deal Timeline</h2>
          {timeline.closing_date && (
            <p className="text-sm text-gray-600 mt-1">
              Closing: {new Date(timeline.closing_date).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
          </select>

          <button
            onClick={loadTimeline}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{timeline.dates?.total || 0}</div>
          <div className="text-xs text-gray-600">Total Dates</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{timeline.dates?.critical || 0}</div>
          <div className="text-xs text-yellow-700">Critical</div>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{timeline.dates?.overdue || 0}</div>
          <div className="text-xs text-red-700">Overdue</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{timeline.tasks?.total || 0}</div>
          <div className="text-xs text-blue-700">Tasks</div>
        </div>
      </div>

      {/* Timeline Sections */}
      {upcomingDates.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-orange-200 p-4">
          <h3 className="text-lg font-bold text-orange-900 mb-3">
            🚨 Upcoming (Next 14 Days)
          </h3>
          <div className="space-y-2">
            {upcomingDates.map((date: any) => renderDateItem(date))}
          </div>
        </div>
      )}

      {futureDates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            📅 Future Dates
          </h3>
          <div className="space-y-2">
            {futureDates.map((date: any) => renderDateItem(date))}
          </div>
        </div>
      )}

      {pastDates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            ✓ Past Dates
          </h3>
          <div className="space-y-2">
            {pastDates.map((date: any) => renderDateItem(date))}
          </div>
        </div>
      )}

      {/* Associated Tasks */}
      {timeline.tasks?.items && timeline.tasks.items.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            📋 Generated Tasks
          </h3>
          <div className="space-y-2">
            {timeline.tasks.items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-gray-100"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {item.tasks?.[0]?.title || 'Task'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {item.deadline_type}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    statusColors[item.tasks?.[0]?.status || 'pending'] ||
                    statusColors.pending
                  }`}
                >
                  {item.tasks?.[0]?.status || 'pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Status */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h3 className="font-bold text-blue-900 mb-2">Timeline Health</h3>
        <div className="space-y-1 text-sm text-blue-800">
          <p>
            ✓ Closing Date:{' '}
            <span className="font-medium">
              {timeline.health?.has_closing_date ? 'Set' : 'Not Set'}
            </span>
          </p>
          <p>
            ✓ Timeline:{' '}
            <span className="font-medium">
              {timeline.health?.timeline_complete ? 'Complete' : 'Incomplete'}
            </span>
          </p>
          <p>
            ⚠️ Critical Dates:{' '}
            <span className="font-medium">
              {timeline.health?.critical_dates_approaching ? 'Yes' : 'None'}
            </span>
          </p>
          <p>
            ⚠️ Active Warnings:{' '}
            <span className="font-medium">
              {timeline.health?.active_warnings || 0}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
