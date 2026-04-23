'use client'

import { useState, useEffect } from 'react'
import { Bell, X, AlertCircle, CheckCircle, FileText, Users, TrendingUp, Clock, CalendarDays } from 'lucide-react'

interface Notification {
  id: string
  type: 'lead_assigned' | 'deal_updated' | 'document_requested' | 'tc_assigned' | 'approval_needed' | 'milestone_due' | 'event' | 'info'
  title: string
  description: string
  timestamp: Date
  read: boolean
  actionUrl?: string
}

interface NotificationsPanelProps {
  userId: string
  role: string
}

export default function NotificationsPanel({ userId, role }: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNotifications()
  }, [userId])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('https://hartfelt-vault.vercel.app/api/notifications', {
        headers: {
          'X-User-ID': userId,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const formattedNotifications = (data.notifications || []).map((notif: any) => ({
          id: notif.id,
          type: notif.type || 'info',
          title: notif.title,
          description: notif.message,
          timestamp: new Date(notif.timestamp),
          read: notif.read,
          actionUrl: notif.linked_id ? `/transaction/${notif.linked_id}` : undefined,
        }))
        setNotifications(formattedNotifications)
      } else {
        // Fallback to empty state if API fails
        setNotifications([])
      }
    } catch (err) {
      console.log('Notifications API failed:', err)
      // Use empty array as fallback
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  // Keep mock data for reference (commented out)
  const mockNotifications = [
    {
      id: '1',
      type: 'lead_assigned' as const,
      title: 'New Lead Assigned',
      description: 'John Smith assigned you a new hot lead - 123 Oak Ave',
      timestamp: new Date(Date.now() - 5 * 60000),
      read: false,
      actionUrl: '/leads',
    },
    {
      id: '2',
      type: 'deal_updated' as const,
      title: 'Deal Status Updated',
      description: '456 Maple St moved to Under Contract by Sarah Johnson',
      timestamp: new Date(Date.now() - 30 * 60000),
      read: false,
      actionUrl: '/pipeline',
    },
    {
      id: '3',
      type: 'document_requested' as const,
      title: 'Document Requested',
      description: 'TC John Doe requested your latest inspection report for 789 Pine St',
      timestamp: new Date(Date.now() - 2 * 3600000),
      read: true,
      actionUrl: '/documents',
    },
    {
      id: '4',
      type: 'tc_assigned' as const,
      title: 'TC Assigned',
      description: 'Sarah Johnson assigned as TC for your deal at 321 Elm Ave',
      timestamp: new Date(Date.now() - 5 * 3600000),
      read: true,
      actionUrl: '/transaction-coordinator',
    },
  ]

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (id: string) => {
    try {
      // Optimistically update UI
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ))

      // Call backend to persist
      await fetch('https://hartfelt-vault.vercel.app/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          notificationId: id,
          read: true,
        }),
      })
    } catch (err) {
      console.log('Failed to mark notification as read:', err)
      // Revert optimistic update on error
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, read: false } : n
      ))
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lead_assigned':
        return <Users className="w-5 h-5 text-blue-600" />
      case 'deal_updated':
        return <TrendingUp className="w-5 h-5 text-green-600" />
      case 'document_requested':
        return <FileText className="w-5 h-5 text-yellow-600" />
      case 'tc_assigned':
        return <CheckCircle className="w-5 h-5 text-purple-600" />
      case 'approval_needed':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'milestone_due':
        return <Clock className="w-5 h-5 text-orange-600" />
      case 'event':
        return <CalendarDays className="w-5 h-5 text-amber-500" />
      default:
        return <Bell className="w-5 h-5 text-gray-600" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'lead_assigned':
        return 'bg-blue-50'
      case 'deal_updated':
        return 'bg-green-50'
      case 'document_requested':
        return 'bg-yellow-50'
      case 'tc_assigned':
        return 'bg-purple-50'
      case 'approval_needed':
        return 'bg-red-50'
      case 'milestone_due':
        return 'bg-orange-50'
      case 'event':
        return 'bg-amber-50'
      default:
        return 'bg-gray-50'
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          ) : null}

          {/* Notifications List */}
          {!loading && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    markAsRead(notif.id)
                    if (notif.actionUrl) {
                      window.location.href = notif.actionUrl
                    }
                  }}
                  className={`p-4 hover:bg-gray-50 transition cursor-pointer ${getNotificationColor(notif.type)} ${
                    !notif.read ? 'border-l-4 border-amber-500' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm">
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0 mt-1"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notif.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatTime(notif.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No notifications yet</p>
            </div>
          )}

          {/* View All Link */}
          {notifications.length > 0 && (
            <div className="sticky bottom-0 p-3 border-t border-gray-200 bg-gray-50">
              <button className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700">
                View All Notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
