/**
 * TaskDashboard Component
 * Broker's view of team workload and task metrics
 */

'use client';

import { useState, useEffect } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed

interface TaskMetrics {
  total_tasks: number;
  pending: number;
  in_progress: number;
  completed: number;
  blocked: number;
  overdue: number;
  high_priority_pending: number;
  critical_priority_pending: number;
}

interface AgentWorkload {
  agent_id: string;
  total_tasks: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  assigned_to_id: string;
}

interface DashboardData {
  metrics: TaskMetrics;
  agent_workload: AgentWorkload[];
  overdue_tasks: OverdueTask[];
  recent_activity: any[];
}

export default function TaskDashboard() {
  // const { data: session } = useSession(); // DISABLED: next-auth not installed
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await vaultAPI.brokerDashboard.getTaskMetrics(
        undefined,
        undefined
      );
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load task dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading task dashboard...</div>;
  }

  if (!dashboardData) {
    return <div className="text-center py-8 text-red-600">Failed to load dashboard data</div>;
  }

  const { metrics, agent_workload, overdue_tasks } = dashboardData;

  const getCompletionPercentage = () => {
    if (metrics.total_tasks === 0) return 0;
    return Math.round((metrics.completed / metrics.total_tasks) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Task Management Dashboard</h1>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-600 mb-1">Total Tasks</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.total_tasks}</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${getCompletionPercentage()}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-2">
            {getCompletionPercentage()}% completed
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-600 mb-1">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">{metrics.pending}</div>
          <div className="text-sm text-gray-600 mt-4">Awaiting start</div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-600 mb-1">In Progress</div>
          <div className="text-3xl font-bold text-blue-600">{metrics.in_progress}</div>
          <div className="text-sm text-gray-600 mt-4">Currently being worked on</div>
        </div>

        {/* Overdue Alert */}
        <div
          className={`rounded-lg border p-4 ${
            metrics.overdue > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <div
            className={`text-sm font-medium mb-1 ${
              metrics.overdue > 0 ? 'text-red-700' : 'text-green-700'
            }`}
          >
            Overdue Tasks
          </div>
          <div
            className={`text-3xl font-bold ${
              metrics.overdue > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {metrics.overdue}
          </div>
          {metrics.overdue > 0 && (
            <div className="text-sm text-red-600 mt-4">⚠️ Requires attention</div>
          )}
        </div>
      </div>

      {/* Critical Alerts */}
      {(metrics.critical_priority_pending > 0 || metrics.high_priority_pending > 0) && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-orange-800">High Priority Items</h3>
              <div className="mt-2 text-sm text-orange-700">
                {metrics.critical_priority_pending > 0 && (
                  <p>{metrics.critical_priority_pending} Critical Priority tasks pending</p>
                )}
                {metrics.high_priority_pending > 0 && (
                  <p>{metrics.high_priority_pending} High Priority tasks pending</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Workload */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-xl font-bold mb-4">Agent Workload</h2>

          <div className="space-y-4">
            {agent_workload.map((agent) => (
              <div
                key={agent.agent_id}
                onClick={() => setSelectedAgent(agent.agent_id)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-400 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Agent {agent.agent_id}</h3>
                  <span className="text-2xl font-bold text-blue-600">
                    {agent.total_tasks}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3 text-sm">
                  <div>
                    <span className="text-gray-600">Pending:</span>
                    <p className="font-medium text-gray-900">{agent.pending}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">In Progress:</span>
                    <p className="font-medium text-gray-900">{agent.in_progress}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Completed:</span>
                    <p className="font-medium text-green-600">{agent.completed}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Overdue:</span>
                    <p className={`font-medium ${agent.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {agent.overdue}
                    </p>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${agent.total_tasks > 0 ? Math.round((agent.completed / agent.total_tasks) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-xl font-bold mb-4">
            Overdue Tasks ({overdue_tasks.length})
          </h2>

          {overdue_tasks.length === 0 ? (
            <div className="text-center py-8 text-green-600">
              ✓ No overdue tasks
            </div>
          ) : (
            <div className="space-y-3">
              {overdue_tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <p className="text-sm text-red-600 mt-1">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        task.priority === 'critical'
                          ? 'bg-red-200 text-red-800'
                          : task.priority === 'high'
                          ? 'bg-orange-200 text-orange-800'
                          : 'bg-yellow-200 text-yellow-800'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-xl font-bold mb-4">Status Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{metrics.pending}</div>
            <div className="text-xs text-gray-500 mt-2">
              {metrics.total_tasks > 0
                ? Math.round((metrics.pending / metrics.total_tasks) * 100)
                : 0}%
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600">In Progress</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {metrics.in_progress}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {metrics.total_tasks > 0
                ? Math.round((metrics.in_progress / metrics.total_tasks) * 100)
                : 0}%
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600">Completed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{metrics.completed}</div>
            <div className="text-xs text-gray-500 mt-2">
              {metrics.total_tasks > 0
                ? Math.round((metrics.completed / metrics.total_tasks) * 100)
                : 0}%
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600">Blocked</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{metrics.blocked}</div>
            <div className="text-xs text-gray-500 mt-2">
              {metrics.total_tasks > 0
                ? Math.round((metrics.blocked / metrics.total_tasks) * 100)
                : 0}%
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600">Overdue</div>
            <div className={`text-2xl font-bold mt-1 ${metrics.overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.overdue}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {metrics.total_tasks > 0
                ? Math.round((metrics.overdue / metrics.total_tasks) * 100)
                : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
