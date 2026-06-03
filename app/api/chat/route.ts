import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Sprint 8B Phase 2B: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B Phase 2A:
//   chat_messages / Anyone can read chat messages / SELECT / {authenticated} / true
//   chat_messages / Users can send messages      / INSERT / {authenticated} /
//                   WITH CHECK (auth.uid() = sender_id)
// Channel-broadcast model: all authenticated users can read any channel.
// INSERT gated by RLS WITH CHECK on sender_id = caller — passing user.id
// explicitly keeps the route's intent visible.

// GET — load messages for a channel
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || 'general'

    const supabase = userClient(request)

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) throw error

    return NextResponse.json({ messages: data || [] })
  } catch (err) {
    console.error('Chat load error:', err)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }
}

// POST — send a message
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const body = await request.json()
    const { channel, message } = body as { channel: string; message: string }

    if (!channel || !message?.trim()) {
      return NextResponse.json({ error: 'Missing channel or message' }, { status: 400 })
    }

    const supabase = userClient(request)

    // Get sender name from profile (own-row read via profiles_select)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const senderName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Agent'

    const { data, error } = await supabase.from('chat_messages').insert({
      channel,
      sender_id: user.id,
      sender_name: senderName,
      message: message.trim(),
    }).select().single()

    if (error) throw error

    return NextResponse.json({ message: data })
  } catch (err) {
    console.error('Chat send error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
