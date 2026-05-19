import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/broker/business-cards
 * Returns all agents with their card status for the broker management view
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !['broker', 'admin'].includes(userRole || '')) {
      return NextResponse.json(
        { error: 'Unauthorized — broker or admin only' },
        { status: 403 }
      )
    }

    const { data: agents, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, phone, title, role, avatar_url, business_card_url, card_slug, card_enabled'
      )
      .in('role', ['agent', 'broker'])
      .eq('is_active', true)
      .order('full_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: agents || [] })
  } catch (error) {
    console.error('Business cards GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/broker/business-cards
 * Upload a card image for an agent
 * Expects multipart/form-data with: agent_id, file
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !['broker', 'admin'].includes(userRole || '')) {
      return NextResponse.json(
        { error: 'Unauthorized — broker or admin only' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const agentId = formData.get('agent_id') as string
    const file = formData.get('file') as File

    if (!agentId || !file) {
      return NextResponse.json(
        { error: 'Missing agent_id or file' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use PNG, JPEG, or WebP.' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum 5MB.' },
        { status: 400 }
      )
    }

    // Get agent profile to verify they exist
    const { data: agent, error: agentError } = await supabase
      .from('profiles')
      .select('id, full_name, card_slug')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Upload to Supabase Storage
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const filePath = `${agentId}/card.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('business-cards')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload card image' },
        { status: 400 }
      )
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('business-cards')
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // Generate slug if not exists
    let slug = agent.card_slug
    if (!slug && agent.full_name) {
      slug = agent.full_name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

      // Check for uniqueness
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('card_slug', slug)
        .neq('id', agentId)
        .single()

      if (existing) {
        slug = `${slug}-${agentId.slice(0, 6)}`
      }
    }

    // Update the agent profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        business_card_url: publicUrl,
        card_slug: slug,
        card_enabled: true,
      })
      .eq('id', agentId)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        card_url: publicUrl,
        card_slug: slug,
        share_url: `${process.env.NEXT_PUBLIC_APP_URL}/card/${slug}`,
      },
    })
  } catch (error) {
    console.error('Business cards POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/broker/business-cards
 * Toggle card_enabled for an agent
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !['broker', 'admin'].includes(userRole || '')) {
      return NextResponse.json(
        { error: 'Unauthorized — broker or admin only' },
        { status: 403 }
      )
    }

    const { agent_id, card_enabled } = await req.json()

    if (!agent_id || card_enabled === undefined) {
      return NextResponse.json(
        { error: 'Missing agent_id or card_enabled' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('profiles')
      .update({ card_enabled })
      .eq('id', agent_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Business cards PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
