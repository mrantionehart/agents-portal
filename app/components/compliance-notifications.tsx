'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Bell, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react'

interface ComplianceNotification {
  id: string
  user_id: string
  type: 'submission' | 'approval' | 'rejection' | 'review_pending' | 'revision_needed'
  title: string
  message: string
  deal_id?: string
  document_id?: string
  created_at: string
  read: boolean
}

interface ComplianceNotificationsProps {
  userId?: string
  role?: string
}

export default function ComplianceNotifications({ userId, role }: ComplianceNotificationsProps) {
  const [notifications, setNotifications] = useState<ComplianceNotification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [supabase, setSupabase] = useState<any>(null)

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey)
      setSupabase(client)

      if (userId) {
        loadNotifications(client, userId)

        // Subscribe to real-time updates
        const subscription = client
          .channel(`compliance-notifications-${userId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'compliance_notifications',
            filter: `user_id=eq.${userId}`
          }, (payload) => {
            const newNotification = payload.new as ComplianceNotification
            setNotifications(prev => [newNotification, ...prev])
            setUnreadCount(prev => prev + 1)
          })
          .subscribe()

        return () => {
          subscription.unsubscribe()
        }
      }
    }
  }, [userId])

  const loadNotifications = async (client: any, userId: string) => {
    try {
      const { data, error } = await client
        .from('compliance_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) {
        setNotifications(data)
        const unread = data.filter(n => !n.read).length
        setUnreadCount(unread)
      }
    } catch (err) {
      console.error('Error loading notifications:', err)
    }
  }

  const markAsRead = async (notificationId: string) => {
    if (!supabase) return

    try {
      await supabase
        .from('compliance_notifications')
        .update({ read: true })
        .eq('id', notificationId)

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'approval':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'rejection':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'revision_needed':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'review_pending':
        return <Clock className="w-5 h-5 text-blue-600" />
      default:
        return <Bell className="w-5 h-5 text-gray-400" />
    }
  }

  const getColor = (type: string) => {
    switch (type) {
      case 'approval':
        return 'bg-green-500/10 border-green-500/20'
      case 'rejection':
        return 'bg-red-500/10 border-red-500/20'
      case 'revision_needed':
        return 'bg-yellow-500/10 border-yellow-500/20'
      case 'review_pending':
        return 'bg-blue-500/10 border-blue-500/20'
      default:
        return 'bg-[#050507] border-[#1a1a2e]'
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-[#111] rounded-lg transition"
        title="Compliance Notifications"
      >
        <Bell className="w-6 h-6 text-gray-200" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 z-50 border border-[#1a1a2e]">
          <div className="p-4 border-b border-[#1a1a2e]">
            <h3 className="font-bold text-white">Compliance Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-400">{unreadCount} unread</p>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-[#1a1a2e] hover:bg-[#0a0a0f] transition cursor-pointer ${
                    !notification.read ? 'bg-blue-500/10' : ''
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    {getIcon(notification.type)}
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">
                        {notification.title}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {notification.message}
                      </p>
                      <p className="text-gray-400 text-xs mt-2">
                        {new Date(notification.created_at).toLocaleDateString()} at{' '}
                        {new Date(notification.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
