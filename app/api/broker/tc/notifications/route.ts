import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Fetch notifications for the current user
    const { data: notifications, error } = await supabase
      .from('tc_notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    // Count unread notifications
    const unreadCount = (notifications || []).filter((n) => !n.read_at).length

    return NextResponse.json({
      success: true,
      data: notifications || [],
      unreadCount,
    })
  } catch (error) {
    console.error('Error in notifications GET endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Only brokers and system can create notifications
    if (userRole !== 'broker') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to create notifications' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { recipient_id, transaction_id, notification_type, message } = body

    if (!recipient_id || !transaction_id || !notification_type || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create the notification
    const { data: notification, error } = await supabase
      .from('tc_notifications')
      .insert({
        recipient_id,
        transaction_id,
        notification_type,
        message,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Notification created successfully',
        data: notification,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in notifications POST endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { notification_id } = body

    if (!notification_id) {
      return NextResponse.json(
        { success: false, error: 'Missing notification_id' },
        { status: 400 }
      )
    }

    // Verify the notification belongs to the user
    const { data: notification, error: fetchError } = await supabase
      .from('tc_notifications')
      .select('recipient_id')
      .eq('id', notification_id)
      .single()

    if (fetchError || !notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (notification.recipient_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to update this notification' },
        { status: 403 }
      )
    }

    // Mark notification as read
    const { data: updatedNotification, error } = await supabase
      .from('tc_notifications')
      .update({
        read_at: new Date().toISOString(),
      })
      .eq('id', notification_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating notification:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
      data: updatedNotification,
    })
  } catch (error) {
    console.error('Error in notifications PATCH endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
