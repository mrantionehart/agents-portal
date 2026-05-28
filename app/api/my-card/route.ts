import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return null
      return data.user
    } catch { return null }
  }
  try {
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { stubResponse.cookies.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { stubResponse.cookies.delete(name) },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch { return null }
}

/**
 * GET /api/my-card
 * Returns the authenticated agent's business card data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'id, full_name, email, phone, title, role, avatar_url, business_card_url, card_slug, card_enabled, website, instagram_handle, facebook_url, linkedin_url, tiktok_handle, bio'
      )
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const shareUrl = profile.card_slug && profile.card_enabled
      ? `${process.env.NEXT_PUBLIC_APP_URL}/card/${profile.card_slug}`
      : null

    return NextResponse.json({
      success: true,
      data: {
        name: profile.full_name,
        title: profile.title || 'Real Estate Agent',
        email: profile.email,
        phone: profile.phone,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        card_image_url: profile.business_card_url,
        card_enabled: profile.card_enabled,
        slug: profile.card_slug,
        share_url: shareUrl,
        social: {
          website: profile.website,
          instagram: profile.instagram_handle,
          facebook: profile.facebook_url,
          linkedin: profile.linkedin_url,
          tiktok: profile.tiktok_handle,
        },
      },
    })
  } catch (error) {
    console.error('My card GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/my-card
 * Updates the authenticated agent's profile/card fields
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const allowedFields = [
      'title', 'phone', 'bio', 'website',
      'instagram_handle', 'facebook_url', 'linkedin_url', 'tiktok_handle',
    ]

    // Only allow whitelisted fields
    const updates: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('My card PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
