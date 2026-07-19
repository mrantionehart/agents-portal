import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, withRateLimit } from '@/lib/security'

// Sprint 8B Phase 1: service role removed. Anon key + RLS now serve this
// route. Policy anchor verified in Sprint 8B-P0.1:
//   profiles / profiles_select / SELECT / {public} / qual = true
//   anon grant on profiles.SELECT present
// The route's own .eq('card_enabled', true) filter remains the user-facing
// gate. Behavior unchanged for any caller that sees the response shape.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Intentionally-public endpoint — anyone with a card slug can view it.
// Rate limit below throttles roster scraping / slug enumeration.
// Sprint 5D marker: declares CI-enforced public intent.
export const PUBLIC_ROUTE = true

/**
 * GET /api/card/[slug]
 * Public endpoint — returns agent card data for the public card page.
 *
 * Sprint 5D: rate limit moved from inline checkRateLimit() to the
 * withRateLimit() HOF. Identical semantics — KV-backed sliding window,
 * 30 req/min/IP, fail-open on KV outage with [security:ratelimit] log.
 * Standardized { error: 'Too many requests' } 429 shape from the wrapper.
 */
export const GET = withRateLimit<{ slug: string }>(
  {
    name: 'card-ip',
    identifier: (req) => clientIp(req.headers),
    limit: 30,
    window: '1 m',
  },
  async (_req: NextRequest, { params }) => {
  try {
    const slug = params?.slug

    if (!slug) {
      return NextResponse.json(
        { error: 'Missing card slug' },
        { status: 400 }
      )
    }

    // SEC.PR1 — `email` and `role` are deliberately NOT selected.
    //
    // `profiles.email` is the LOGIN identifier. There is no separate
    // public-contact column, so publishing it would publish the username half
    // of every credential pair for any agent with a live card. It is treated
    // as an authentication identifier unless explicitly designated a public
    // business contact — which the schema cannot currently express.
    //
    // `role` was selected but never returned, filtered on, or otherwise used.
    //
    // This select is also the ANON GRANT CONTRACT. Anonymous SELECT on
    // profiles is restricted to exactly these 14 columns, and a column-level
    // grant makes a reference to ANY ungranted column fail the entire
    // statement — so adding a column here without widening the grant returns
    // 404 for every card. `card_slug` and `card_enabled` are filters, not
    // output, and must stay granted for that reason.
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, phone, title, avatar_url, business_card_url, card_slug, card_enabled, website, instagram_handle, facebook_url, linkedin_url, tiktok_handle, bio'
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
        agent_id: profile.id,
        name: profile.full_name,
        title: profile.title || 'Real Estate Agent',
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
)
