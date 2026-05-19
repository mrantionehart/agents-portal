import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/card/[slug]
 * Public endpoint — returns agent card data for the public card page
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    if (!slug) {
      return NextResponse.json(
        { error: 'Missing card slug' },
        { status: 400 }
      )
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, phone, title, role, avatar_url, business_card_url, card_slug, card_enabled, website, instagram_handle, facebook_url, linkedin_url, tiktok_handle, bio'
      )
      .eq('card_slug', slug)
      .eq('card_enabled', true)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      )
    }

    // Only return public-safe fields
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
        slug: profile.card_slug,
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
    console.error('Card API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
