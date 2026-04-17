/**
 * TaskDetail Component
 * Full task management with checklist, comments, and activity log
 */

'use client';

import { useState, useEffect } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed

interface TaskDetailProps {
  taskId: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  assigned_to_id: string;
  created_at: string;
  task_checklist_items: Array<{
    id: string;
    title: string;
    is_completed: boolean;
    completed_at?: string;
  }>;
  task_comments: Array<{
    id: string;
    author_id: string;
    content: string;
    created_at: string;
  }>;
  task_activity_log: Array<{
    id: string;
    action: string;
    actor_id: string;
    created_at: string;
    notes: string;
  }>;
}

export default function TaskDetail({
  taskId,
  onBack,
  onTaskUpdated,
}: TaskDetailProps) {
  // const { data: session } = useSession(); // DISABLED: next-auth not installed
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    setLoading(true);
    try {
      const data = await vaultAPI.tasks.get(taskId, undefined, undefined);
      setTask(data.task);
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!task) return;
    setUpdating(true);
    try {
      await vaultAPI.tasks.update(
        taskId,
        { status: newStatus as any },
        undefined,
        undefined
      );
      await loadTask();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    setUpdating(true);
    try {
      await vaultAPI.tasks.addComment(
        taskId,
        newComment,
        undefined,
        undefined
      );
      setNewComment('');
      await loadTask();
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    setUpdating(true);
    try {
      await vaultAPI.tasks.updateChecklistItem(
        itemId,
        { is_completed: !isCompleted },
        undefined,
        undefined
      );
      await loadTask();
    } catch (error) {
      console.error('Failed to update checklist item:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim() || !task) return;
    setUpdating(true);
    try {
      await vaultAPI.tasks.addChecklistItem(
        taskId,
        newChecklistItem,
        task.task_checklist_items.length,
        undefined,
        undefined
      );
      setNewChecklistItem('');
      await loadTask();
    } catch (error) {
      console.error('Failed to add checklist item:', error);
    } finally {
      setUpdating(false);
    }
  };

  const checklistProgress = task
    ? {
        completed: task.task_checklist_items.filter((i) => i.is_completed).length,
        total: task.task_checklist_items.length,
      }
    : { completed: 0, total: 0 };

  if (loading) {
    return <div className="text-center py-8">Loading task details...</div>;
  }

  if (!task) {
    return (
      <div className="text-center py-8 text-red-600">Task not found</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{task.title}</h2>
        <div />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status & Priority */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={task.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  disabled
                  value={task.priority}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                >
                  <option value={task.priority}>{task.priority}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Checklist</h3>
              <span className="text-sm text-gray-600">
                {checklistProgress.completed}/{checklistProgress.total}
              </span>
            </div>

            {checklistProgress.total > 0 && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        checklistProgress.total > 0
                          ? Math.round((checklistProgress.completed / checklistProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {task.task_checklist_items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={() => handleToggleChecklistItem(item.id, item.is_completed)}
                    disabled={updating}
                    className="w-4 h-4 text-green-500 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <span
                    className={`ml-3 ${
                      item.is_completed
                        ? 'line-through text-gray-500'
                        : 'text-gray-900'
                    }`}
                  >
                    {item.title}
                  </span>
                </label>
              ))}
            </div>

            {/* Add Checklist Item */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddChecklistItem();
                }}
                placeholder="Add new checklist item..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddChecklistItem}
                disabled={updating || !newChecklistItem.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-bold mb-4">Comments</h3>

            <div className="space-y-3 mb-4">
              {task.task_comments.map((comment) => (
                <div
                  key={comment.id}
                  className="border-l-2 border-gray-200 pl-4 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">User</span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{comment.content}</p>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddComment}
                disabled={updating || !newComment.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:opacity-50 self-end"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-bold mb-4">Details</h3>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-600 font-medium">Due Date</label>
                <p className="text-gray-900">
                  {new Date(task.due_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <div>
                <label className="block text-gray-600 font-medium">Created</label>
                <p className="text-gray-900">
                  {new Date(task.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-bold mb-4">Activity</h3>

            <div className="space-y-2 text-sm">
              {task.task_activity_log.slice(0, 5).map((activity) => (
                <div key={activity.id} className="text-gray-600 pb-2 border-b border-gray-100">
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  {activity.notes && (
                    <p className="text-xs text-gray-500">{activity.notes}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
