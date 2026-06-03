import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Sprint 8B Phase 1: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B-P0.1:
//   profiles / profiles_select       / SELECT / {public} / true
//   profiles / profiles_update_own   / UPDATE / {public} / (id = auth.uid())
// The PATCH path now goes through RLS under the user JWT — the policy's
// (id = auth.uid()) predicate is the actual security boundary; the
// `.eq('id', user.id)` filter in the query body remains as a query-plan
// hint and a redundant guard.

/**
 * GET /api/my-card
 * Returns the authenticated agent's business card data
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const supabase = userClient(request)

    const { data: profile, error } = await supabase
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
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

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

    const supabase = userClient(request)

    const { error } = await supabase
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
