/**
 * TaskList Component
 * Display filtered list of tasks with status and priority
 */

'use client';

import { useState, useEffect } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed
import TaskDetail from './TaskDetail';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  assigned_to_id: string;
  created_at: string;
  task_checklist_items?: Array<{
    id: string;
    is_completed: boolean;
  }>;
}

interface TaskListProps {
  transactionId?: string;
  showFilters?: boolean;
}

const statusColors = {
  pending: 'bg-[#0a0a0f] text-white',
  in_progress: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-green-500/15 text-green-400',
  blocked: 'bg-red-500/15 text-red-800',
};

const priorityColors = {
  low: 'text-gray-400',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  critical: 'text-red-500',
};

export default function TaskList({
  transactionId,
  showFilters = true,
}: TaskListProps) {
  // const { data: session } = useSession(); // DISABLED: next-auth not installed
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created_at'>('due_date');

  useEffect(() => {
    loadTasks();
  }, [transactionId, statusFilter, priorityFilter]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await vaultAPI.tasks.list(
        transactionId,
        statusFilter || undefined,
        priorityFilter || undefined,
        undefined,
        undefined
      );
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const getChecklistProgress = (task: Task) => {
    if (!task.task_checklist_items || task.task_checklist_items.length === 0) {
      return null;
    }
    const completed = task.task_checklist_items.filter((i) => i.is_completed).length;
    const total = task.task_checklist_items.length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const isOverdue = (task: Task) => {
    if (task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'due_date') {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (sortBy === 'priority') {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] -
             priorityOrder[b.priority as keyof typeof priorityOrder];
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (selectedTask) {
    return (
      <TaskDetail
        taskId={selectedTask}
        onBack={() => setSelectedTask(null)}
        onTaskUpdated={() => {
          loadTasks();
          setSelectedTask(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <div className="bg-[#0a0a0f] rounded-lg border border-[#1a1a2e] p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-[#1a1a2e] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-[#1a1a2e] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-[#1a1a2e] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              >
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
                <option value="created_at">Newest First</option>
              </select>
            </div>

            {/* Task Count */}
            <div className="flex items-end">
              <div className="text-sm text-gray-400">
                {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading tasks...</div>
      ) : sortedTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No tasks found</div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const progress = getChecklistProgress(task);
            const overdue = isOverdue(task);

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task.id)}
                className="bg-[#0a0a0f] rounded-lg border border-[#1a1a2e] hover:border-blue-400 p-4 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-white truncate">
                        {task.title}
                      </h3>
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          statusColors[task.status]
                        }`}
                      >
                        {task.status}
                      </span>
                      <span className={`text-xl ${priorityColors[task.priority]}`}>
                        ● {task.priority}
                      </span>
                    </div>

                    {/* Checklist Progress */}
                    {progress && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-400">
                            Checklist: {progress.completed}/{progress.total}
                          </span>
                          <span className="text-gray-400">{progress.percentage}%</span>
                        </div>
                        <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                          <div
                            className="bg-green-500/100 h-2 rounded-full transition-all"
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className={overdue ? 'text-red-600 font-medium' : ''}>
                        Due: {formatDate(task.due_date)}
                        {overdue && ' ⚠️ OVERDUE'}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex-shrink-0 w-2 h-12 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
