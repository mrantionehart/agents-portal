// Task Detail Modal Component
// Full task view with comments, activity, and actions
// Supports editing, status updates, and commenting

'use client'

import React, { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  X,
  Check,
  Edit2,
  Trash2,
  MessageSquare,
  History,
  Calendar,
  AlertCircle,
  Loader2,
  Send
} from 'lucide-react'
import { Task } from './TaskDashboard'

interface TaskComment {
  id: string
  comment_text: string
  user_id: string
  user_profile?: {
    email: string
    full_name?: string
  }
  created_at: string
}

interface ActivityEntry {
  id: string
  action: string
  user_id: string
  user_profile?: {
    email: string
    full_name?: string
  }
  changes?: Record<string, any>
  created_at: string
}

interface TaskDetailModalProps {
  task: Task
  userId: string
  userRole: string
  onClose: () => void
  onRefresh: () => void
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  userId,
  userRole,
  onClose,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    due_date: task.due_date ? task.due_date.split('T')[0] : '',
    status: task.status
  })
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])

  // Fetch task details on mount
  React.useEffect(() => {
    fetchTaskDetails()
  }, [])

  const fetchTaskDetails = async () => {
    try {
      const response = await fetch(`/api/broker/tasks/${task.id}`, {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (response.ok) {
        const { data } = await response.json()
        setComments(data.comments || [])
        setActivity(data.activity || [])
      }
    } catch (error) {
      console.error('Error fetching task details:', error)
    }
  }

  const handleSaveEdit = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/broker/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      })

      if (response.ok) {
        setIsEditing(false)
        onRefresh()
        fetchTaskDetails()
      }
    } catch (error) {
      console.error('Error saving task:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    try {
      setLoading(true)
      const response = await fetch(`/api/broker/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment_text: newComment })
      })

      if (response.ok) {
        const { data } = await response.json()
        setComments([data, ...comments])
        setNewComment('')
        fetchTaskDetails()
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/broker/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setEditData({ ...editData, status: newStatus })
        onRefresh()
        fetchTaskDetails()
      }
    } catch (error) {
      console.error('Error updating task status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/broker/tasks/${task.id}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (response.ok) {
        onClose()
        onRefresh()
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = userId === task.assigned_by || userId === task.assigned_to || userRole === 'broker'
  const canDelete = userId === task.assigned_by || userRole === 'broker'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700'
      case 'in_progress':
        return 'bg-blue-50 text-blue-700'
      case 'blocked':
        return 'bg-red-50 text-red-700'
      default:
        return 'bg-gray-50 text-gray-700'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600'
      case 'high':
        return 'text-orange-600'
      case 'medium':
        return 'text-yellow-600'
      default:
        return 'text-green-600'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="w-full max-w-2xl bg-white rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{task.title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Task Header Info */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(editData.status)}`}>
                  {editData.status.replace('_', ' ')}
                </span>
                <span className={`text-sm font-medium ${getPriorityColor(editData.priority)}`}>
                  {editData.priority.toUpperCase()} Priority
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-gray-100 rounded transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {canDelete && !isEditing && (
                  <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-100 text-red-600 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Update Buttons */}
            {!isEditing && task.status !== 'completed' && (
              <div className="flex items-center gap-2">
                {task.status !== 'in_progress' && (
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm font-medium transition"
                  >
                    Start
                  </button>
                )}
                <button
                  onClick={() => handleStatusChange('completed')}
                  className="px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 text-sm font-medium transition"
                >
                  Complete
                </button>
                {task.status !== 'blocked' && (
                  <button
                    onClick={() => handleStatusChange('blocked')}
                    className="px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 text-sm font-medium transition"
                  >
                    Block
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'details'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'comments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Comments ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'activity'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <History className="w-4 h-4" />
                Activity
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-4 space-y-4">
            {activeTab === 'details' && (
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Title</label>
                      <input
                        type="text"
                        value={editData.title}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
                      <textarea
                        value={editData.description}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Priority</label>
                        <select
                          value={editData.priority}
                          onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={editData.due_date}
                          onChange={(e) => setEditData({ ...editData, due_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {task.description && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-1">Assigned To</h4>
                        <p className="text-sm text-gray-900">
                          {task.assigned_to_profile?.full_name || task.assigned_to_profile?.email}
                        </p>
                      </div>

                      {task.due_date && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-600 mb-1">Due Date</h4>
                          <p className="text-sm text-gray-900 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(task.due_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-1">Created</h4>
                        <p className="text-sm text-gray-900">{format(new Date(task.created_at), 'MMM dd, yyyy')}</p>
                      </div>

                      {task.completion_date && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-600 mb-1">Completed</h4>
                          <p className="text-sm text-gray-900">
                            {format(new Date(task.completion_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-4">
                {/* Comment Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddComment()
                      }
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={loading || !newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>

                {/* Comments List */}
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {comment.user_profile?.full_name || comment.user_profile?.email}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700">{comment.comment_text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-2">
                {activity.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
                ) : (
                  activity.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                      <p className="text-sm font-medium text-gray-900">
                        {entry.action.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        by {entry.user_profile?.full_name || entry.user_profile?.email}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaskDetailModal
