/**
 * @jest-environment node
 */
// ============================================================================
// SEC.PR1 — public business card contract
// ============================================================================
// The public card is served by an ANON-KEY client. After the anonymous
// containment migration, anonymous SELECT on `profiles` is restricted to
// exactly 14 columns, and a column-level grant makes a reference to ANY
// ungranted column fail the WHOLE statement — not just omit that column.
//
// So the route's `.select()` list is not a preference, it is a contract with
// the database. Adding a column to it without widening the grant makes every
// card return 404. These tests pin that contract.
//
// `email` is excluded because `profiles.email` is the LOGIN identifier and
// there is no separate public-contact column. `role` is excluded because it
// was selected but never used.
//
// Behaviour that must NOT change: cards resolve by slug, disabled and missing
// cards still 404, and phone/website/social remain functional.
// ============================================================================


/** The exact anon grant contract. Must match the migration and the route. */
const GRANTED_COLUMNS = [
  'id',
  'full_name',
  'phone',
  'title',
  'avatar_url',
  'business_card_url',
  'card_slug',
  'card_enabled',
  'website',
  'instagram_handle',
  'facebook_url',
  'linkedin_url',
  'tiktok_handle',
  'bio',
]

const FORBIDDEN_COLUMNS = [
  'email',
  'role',
  'tenant_id',
  'broker_id',
  'stripe_account_id',
  'default_split_pct',
  'annual_cap',
  'transaction_fee',
  'split_tier',
  'license_number',
  'suspend_reason',
  'billing_suspended',
  'last_login_at',
  'is_qa_user',
]

// ── Supabase mock ───────────────────────────────────────────────────────────
let selectedColumns = ''
let eqFilters: Record<string, unknown> = {}
/** Row the fixture returns, or null to simulate "no such card". */
let row: Record<string, unknown> | null = null

const chain: any = {
  select: jest.fn((cols: string) => { selectedColumns = cols; return chain }),
  eq: jest.fn((c: string, v: unknown) => { eqFilters[c] = v; return chain }),
  single: jest.fn(async () =>
    row ? { data: row, error: null } : { data: null, error: { message: 'not found' } }
  ),
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn(() => chain) })),
}))

// Rate limiter is a pass-through here; its behaviour is covered elsewhere.
jest.mock('@/lib/security', () => ({
  clientIp: jest.fn(() => '127.0.0.1'),
  withRateLimit: jest.fn((_cfg: unknown, handler: any) => handler),
}))

const FIXTURE = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  full_name: 'Test Agent',
  phone: '+13055551234',
  title: 'Broker Associate',
  avatar_url: 'https://example.test/a.png',
  business_card_url: 'https://example.test/card.png',
  card_slug: 'test-agent',
  card_enabled: true,
  website: 'https://example.test',
  instagram_handle: 'testagent',
  facebook_url: 'https://facebook.test/testagent',
  linkedin_url: 'https://linkedin.test/in/testagent',
  tiktok_handle: 'testagent',
  bio: 'Bio text.',
}

beforeEach(() => {
  selectedColumns = ''
  eqFilters = {}
  row = { ...FIXTURE }
  jest.clearAllMocks()
})

async function call(slug: string | undefined) {
  const mod: any = await import('../[slug]/route')
  return mod.GET({} as any, { params: { slug } })
}

// ============================================================================
describe('SEC.PR1 — the select list is the anon grant contract', () => {
  it('requests exactly the 14 granted columns', async () => {
    await call('test-agent')
    const requested = selectedColumns.split(',').map((c) => c.trim()).filter(Boolean)
    // Set equality, not containment: an extra column here means every card
    // 404s in production once the grant is applied.
    expect(new Set(requested)).toEqual(new Set(GRANTED_COLUMNS))
    expect(requested).toHaveLength(14)
  })

  it.each(FORBIDDEN_COLUMNS)('does not request %s', async (col) => {
    await call('test-agent')
    const requested = selectedColumns.split(',').map((c) => c.trim())
    expect(requested).not.toContain(col)
  })

  it('filters on card_slug and card_enabled — both must stay granted', async () => {
    await call('test-agent')
    // A filter on an ungranted column fails the statement just as a projection
    // does, so these two must remain in the grant even though neither is
    // returned to the caller.
    expect(eqFilters.card_slug).toBe('test-agent')
    expect(eqFilters.card_enabled).toBe(true)
  })
})

describe('SEC.PR1 — the public response', () => {
  it('resolves a card by slug', async () => {
    const res = await call('test-agent')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.slug).toBe('test-agent')
    expect(body.data.name).toBe('Test Agent')
  })

  it('returns the expected public field set', async () => {
    const body = await (await call('test-agent')).json()
    expect(new Set(Object.keys(body.data))).toEqual(
      new Set(['agent_id', 'name', 'title', 'phone', 'bio', 'avatar_url', 'card_image_url', 'slug', 'social'])
    )
    expect(new Set(Object.keys(body.data.social))).toEqual(
      new Set(['website', 'instagram', 'facebook', 'linkedin', 'tiktok'])
    )
  })

  it.each(['email', 'role'])('never returns %s at any depth', async (field) => {
    const raw = await (await call('test-agent')).text()
    expect(raw).not.toContain(`"${field}"`)
  })

  it('keeps phone and social links functional', async () => {
    const body = await (await call('test-agent')).json()
    expect(body.data.phone).toBe(FIXTURE.phone)
    expect(body.data.social.website).toBe(FIXTURE.website)
    expect(body.data.social.instagram).toBe(FIXTURE.instagram_handle)
    expect(body.data.social.facebook).toBe(FIXTURE.facebook_url)
    expect(body.data.social.linkedin).toBe(FIXTURE.linkedin_url)
    expect(body.data.social.tiktok).toBe(FIXTURE.tiktok_handle)
  })

  it('falls back to a default title', async () => {
    row = { ...FIXTURE, title: null }
    const body = await (await call('test-agent')).json()
    expect(body.data.title).toBe('Real Estate Agent')
  })
})

describe('SEC.PR1 — existing behaviour is preserved', () => {
  it('missing card → 404', async () => {
    row = null
    const res = await call('no-such-slug')
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Card not found')
  })

  it('disabled card → 404 via the card_enabled filter', async () => {
    // The route always filters card_enabled=true, so a disabled card is
    // indistinguishable from a missing one — that is the opt-out mechanism.
    row = null
    const res = await call('disabled-agent')
    expect(res.status).toBe(404)
    expect(eqFilters.card_enabled).toBe(true)
  })

  it('missing slug → 400', async () => {
    const res = await call(undefined)
    expect(res.status).toBe(400)
  })
})

describe('SEC.PR1 — vCard payload', () => {
  // The page builds the vCard from the API response. With no email field in
  // that response, the EMAIL: line cannot be produced. This asserts the
  // generator is well-formed on exactly the data the API now returns.
  function buildVCard(card: any): string {
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.name}`,
      `TITLE:${card.title}`,
      'ORG:HartFelt Real Estate',
      card.phone ? `TEL:${card.phone}` : '',
      card.social?.website ? `URL:${card.social.website}` : '',
      `NOTE:${card.bio || ''}`,
      'END:VCARD',
    ].filter(Boolean).join('\n')
  }

  it('generates successfully with no email field', async () => {
    const body = await (await call('test-agent')).json()
    const vcard = buildVCard(body.data)
    expect(vcard).toContain('BEGIN:VCARD')
    expect(vcard).toContain('END:VCARD')
    expect(vcard).not.toContain('EMAIL:')
    expect(vcard).not.toContain('undefined')
  })

  it('still carries phone and website', async () => {
    const body = await (await call('test-agent')).json()
    const vcard = buildVCard(body.data)
    expect(vcard).toContain(`TEL:${FIXTURE.phone}`)
    expect(vcard).toContain(`URL:${FIXTURE.website}`)
  })
})
