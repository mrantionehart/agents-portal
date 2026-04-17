'use client'

import { useEffect, useState } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface TCNotification {
  id: string
  notification_type: string
  message: string
  read_at: string | null
  created_at: string
}

export default function TCNotifications({
  userId,
  userRole,
}: {
  userId: string
  userRole: string
}) {
  const [notifications, setNotifications] = useState<TCNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  useEffect(() => {
    fetchNotifications()
    subscribeToNotifications()
  }, [userId])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/broker/tc/notifications', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.data || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToNotifications = () => {
    try {
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tc_notifications',
            filter: `recipient_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as TCNotification, ...prev])
            setUnreadCount((prev) => prev + 1)
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    } catch (err) {
      console.error('Error subscribing to notifications:', err)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/broker/tc/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          notification_id: notificationId,
        }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const handleDismiss = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
  }

  return (
    <div className="relative">
      {/* Notification Bell Icon */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showPanel && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 border border-gray-200">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition ${
                    !notification.read_at ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Indicator */}
                    <div className="flex-shrink-0 mt-1">
                      {!notification.read_at ? (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {getNotificationTitle(notification.notification_type)}
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {!notification.read_at && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(notification.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-500">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getNotificationTitle(type: string): string {
  switch (type) {
    case 'transaction_created':
      return 'Transaction Created'
    case 'doc_uploaded':
      return 'Document Uploaded'
    case 'milestone_completed':
      return 'Milestone Completed'
    case 'status_changed':
      return 'Status Changed'
    case 'assignment_approved':
      return 'Assignment Approved'
    case 'deadline_approaching':
      return 'Deadline Approaching'
    default:
      return 'New Notification'
  }
}
