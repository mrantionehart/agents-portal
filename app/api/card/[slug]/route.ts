import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, withRateLimit } from '@/lib/security'
import { VAULT_BASE_URL } from '@/lib/vault-client'

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

    // ── the approved marketing card ────────────────────────────────────
    // Vault serves the agent's APPROVED card at a public, slug-addressed route
    // that applies the same publication gate this query does, and 404s when
    // there is no approved card.
    //
    // 🔑 Why a probe rather than a query. The select above is the ANON GRANT
    // CONTRACT, and this route runs on the anonymous client — reading
    // `agent_marketing_cards` here would mean granting anonymous SELECT on a
    // table holding every agent's DRAFT cards. The probe needs no grant, no
    // secret and no new trust: it asks the one route that is already allowed to
    // answer, and a failure of any kind simply leaves the existing artwork in
    // place.
    const approvedCardUrl = `${VAULT_BASE_URL}/api/public/agent-card/${encodeURIComponent(profile.card_slug)}`
    let cardImageUrl: string | null = profile.business_card_url
    try {
      // Bounded: a slow sibling must not hold a public page open. On timeout
      // the uploaded artwork is used, which is what the page showed before.
      const probe = await fetch(approvedCardUrl, {
        method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(2500),
      })
      if (probe.ok) cardImageUrl = approvedCardUrl
    } catch {
      // Vault unreachable — keep the uploaded artwork. A public page must not
      // break because a sibling service is down.
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
        card_image_url: cardImageUrl,
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
