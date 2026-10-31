// ============================================================================
// DEVINTEL-P3I — the Portal must never be the authorization boundary
// ============================================================================
// Entitlement is decided by Vault (`authorizeAgentOpportunityAccess`). What
// these tests pin is that the Portal cannot weaken it: no dev_* table is read
// through the Portal's own client, no request carries a tenant, agent or
// assignment parameter the server would have to trust, no broker control
// exists in this surface at all, and the checklist, progress and next step
// shown are the ones the SERVER derived.
//
// Jest, not vitest — AP runs `jest` and has no vitest config. A vitest-style
// suite here fails to parse rather than failing to pass, which reads as a
// broken component.
// ============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

import DeveloperOpportunities, { latestDecision, mapHref, parcelHref } from '@/src/portal/developer-opportunities/DeveloperOpportunities'

const OPP = 'opp-1'

const task = (id: string, done = false) => ({
  id, label: `Do ${id}`, why: `because ${id}`, settled: null, done,
})
const claim = (confidence: string, value: string | null = null, note: string | null = null) => ({
  confidence, value, note, url: null, checked: [],
})

const detail = (over: Record<string, unknown> = {}) => ({
  derived: {
    checklist: [task('contact', true), task('developer'), task('representation'), task('permits'), task('inventory')],
    progress: { done: 1, total: 5 },
    nextAction: { label: 'Work the research tasks, then approve OUTREACH', because: 'Contact material stays locked until OUTREACH is approved.', gate: 'OUTREACH', brokerOnly: false },
    representation: claim('UNKNOWN', 'UNKNOWN', 'No licensed MLS/IDX feed.'),
    developer: { name: 'EPIC DEVELOPMENTS LLC', status: claim('VERIFIED', 'VERIFIED', 'Named development company.'), url: null },
    contact: claim('UNKNOWN', 'President — RODRIGUEZ, CHRISTOPHER', 'Postal and officer only.'),
    inventory: claim('UNKNOWN', 'UNKNOWN', 'Not verifiable.'),
    sources: [{ label: 'Miami-Dade Property Appraiser', url: 'https://miamidade.gov/x' }],
    pursuitStrategy: claim('UNKNOWN', 'EXCLUSIVE_LISTING', null),
    ...(over.derived as object ?? {}),
  },
  opportunity: {
    id: OPP, opportunity_type: 'EXCLUSIVE_LISTING', stage: 'proposed', score: 104,
    assigned_agent_id: 'agent-1', assigned_at: '2026-10-22T09:00:00Z',
    research_notes: '1953 Tigertail Ave — EXCLUSIVE LISTING.', evidence_refs: [],
  },
  projects: [{
    id: 'p1', parcel_id: '0141150240310', project_name: '1953 TIGERTAIL AV',
    addresses: ['1953 TIGERTAIL AV'], category: 'luxury_single_family', category_basis: 'permit_use',
    tenure: 'for_sale', max_total_sqft: 9545, zones: ['T3-R'], units: null, asset_class: null,
    acreage: null, link: { is_primary: true, link_basis: 'primary parcel' },
  }],
  filings: [{
    project_id: 'p1', permit_stage: 'ISSUED', permit_or_case_id: 'BD24026696001B001',
    address: '1953 TIGERTAIL AV', contractor_text: 'ROC PROPERTY DEVELOPERS LLC',
    filing_type: 'NEW CONSTRUCTION', application_date: null, stage_verified_at: '2026-10-22T00:00:00Z',
    applicant_text: 'ROC PROPERTY DEVELOPERS LLC', stage_evidence_url: null, authority: 'city_of_miami',
  }],
  owners: [{
    project_id: 'p1', role: 'owner', identity_verified: true,
    source_name: 'miamidade_property_appraiser', retrieved_at: '2026-10-22T00:00:00Z',
    dev_developers: { entity_name: 'EPIC DEVELOPMENTS LLC' },
  }],
  approvals: [
    { id: 'a1', approval_type: 'RESEARCH', decision: 'approved', decided_by: 'broker', decided_at: '2026-10-22T10:00:00Z', note: null },
  ],
  followups: [],
  viewer: { isBrokerTier: false, userId: 'agent-1' },
  ...over,
})

const summary = { id: OPP, opportunity_type: 'EXCLUSIVE_LISTING', stage: 'proposed', score: 104, assigned_agent_id: 'agent-1', assigned_at: null, research_notes: '1953 TIGERTAIL AV — EXCLUSIVE LISTING.', created_at: '2026-10-22T09:00:00Z' }

const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) })
const err = (status: number, body: unknown = {}) => ({ ok: false, status, text: async () => JSON.stringify(body) })

/** List then detail, which is the order the component asks in. */
function serve(list: unknown, det: unknown) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return ok({ id: OPP })
    if (/\/opportunities\/[^/?]+$/.test(String(url))) return ok(det)
    return ok(list)
  })
}

beforeEach(() => { mockFetch.mockReset() })

// ---------------------------------------------------------------------------

describe('[P3I-AP-1] the Portal sends nothing the server would have to trust', () => {
  it('[CRITICAL] never sends a tenant, agent or assignment parameter', async () => {
    serve({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }, detail())
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('section-project')).toBeTruthy())
    for (const call of mockFetch.mock.calls) {
      const url = String(call[0])
      const body = String((call[1] as RequestInit | undefined)?.body ?? '')
      for (const forbidden of ['tenant', 'tenantId', 'agentId', 'assigned_agent_id', 'isBrokerTier', 'stage=']) {
        expect(url.toLowerCase()).not.toContain(forbidden.toLowerCase())
        expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('[CRITICAL] reads no dev_* table through the Portal client', () => {
    // Structural: the only backend is Vault's HTTP API.
    const src = readFileSync(join(process.cwd(), 'src/portal/developer-opportunities/DeveloperOpportunities.tsx'), 'utf8')
    expect(src).not.toMatch(/from\(['"]dev_/)
    expect(src).not.toMatch(/createClient|supabase\.from|SUPABASE_SERVICE_ROLE/)
  })

  it('[CRITICAL] carries no hardcoded agent or tenant id', () => {
    const src = readFileSync(join(process.cwd(), 'src/portal/developer-opportunities/DeveloperOpportunities.tsx'), 'utf8')
    const client = readFileSync(join(process.cwd(), 'lib/development-opportunities/vault-dev-opportunities-client.ts'), 'utf8')
    for (const f of [src, client]) {
      expect(f).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
      expect(f).not.toMatch(/SERVICE_ROLE/)
    }
  })

  it('asks for a bounded page', async () => {
    serve({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }, detail())
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(String(mockFetch.mock.calls[0][0])).toContain('limit=25')
  })
})

describe('[P3I-AP-2] what an unentitled or empty agent sees', () => {
  it('[CRITICAL] a 403 is an honest state, not a crash', async () => {
    mockFetch.mockResolvedValue(err(403, { error: 'not active', code: 'profile_inactive' }))
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('not-entitled')).toBeTruthy())
    expect(screen.getByTestId('not-entitled').textContent).toContain('verified licence')
    expect(screen.queryByTestId('list-error')).toBeNull()
  })

  it('an agent with nothing assigned is told so', async () => {
    mockFetch.mockResolvedValue(ok({ opportunities: [], page: { size: 25, count: 0, nextCursor: null } }))
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('empty')).toBeTruthy())
    expect(screen.getByTestId('empty').textContent).toContain('Your broker assigns these')
  })

  it('a transport failure says so rather than showing an empty list', async () => {
    mockFetch.mockRejectedValue(new Error('network'))
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('list-error')).toBeTruthy())
  })

  it('a relationship that is not theirs reads as not assigned', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      /\/opportunities\/[^/?]+$/.test(String(url))
        ? err(404, { error: 'Not found' })
        : ok({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }))
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('detail-error')).toBeTruthy())
    expect(screen.getByTestId('detail-error').textContent).toContain('not assigned to you')
  })
})

describe('[P3I-AP-3] the rules come from Vault', () => {
  beforeEach(() => serve({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }, detail()))

  it('[CRITICAL] renders the SERVER-derived checklist and progress', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('checklist')).toBeTruthy())
    expect(screen.getAllByRole('checkbox')).toHaveLength(5)
    expect(screen.getByTestId('progress').textContent).toBe('1/5 complete')
    expect((screen.getByTestId('check-contact') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('check-developer') as HTMLInputElement).checked).toBe(false)
  })

  it('[CRITICAL] renders the SERVER-derived next step, not one it computed', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('next-step')).toBeTruthy())
    expect(screen.getByTestId('next-step').textContent).toContain('then approve OUTREACH')
    expect(screen.getByTestId('next-step').textContent).toContain('stays locked until OUTREACH is approved')
  })

  it('renders the confidence labels it was given', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('fact-developer')).toBeTruthy())
    expect(screen.getByTestId('fact-developer').textContent).toContain('VERIFIED')
    expect(screen.getByTestId('fact-developer').textContent).toContain('EPIC DEVELOPMENTS LLC')
    expect(screen.getByTestId('fact-representation').textContent).toContain('UNKNOWN')
    expect(screen.getByTestId('fact-representation').textContent).toContain('Not established either way')
  })

  it('never states a phone or email it does not have', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('fact-contact')).toBeTruthy())
    expect(screen.getByTestId('fact-contact').textContent).toContain('No verified business phone or email')
    expect(document.body.textContent).not.toMatch(/\b\d{3}-\d{3}-\d{4}\b/)
  })
})

describe('[P3I-AP-4] the checklist writes through Vault only', () => {
  beforeEach(() => serve({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }, detail()))

  it('[CRITICAL] a tick sends ONLY that task', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('check-developer')).toBeTruthy())
    fireEvent.click(screen.getByTestId('check-developer'))
    await waitFor(() => expect(mockFetch.mock.calls.some((c) => (c[1] as RequestInit)?.method === 'PATCH')).toBe(true))
    const patch = mockFetch.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'PATCH')!
    expect(String(patch[0])).toContain('/research')
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({ checklist: { developer: true } })
  })

  it('[CRITICAL] puts the tick back when the server refuses', async () => {
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return err(403, { error: 'Not assigned to you', code: 'not_assignee' })
      if (/\/opportunities\/[^/?]+$/.test(String(url))) return ok(detail())
      return ok({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } })
    })
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('check-developer')).toBeTruthy())
    fireEvent.click(screen.getByTestId('check-developer'))
    await waitFor(() => expect(screen.getByTestId('detail-error')).toBeTruthy())
    expect((screen.getByTestId('check-developer') as HTMLInputElement).checked).toBe(false)
    expect(screen.getByTestId('progress').textContent).toBe('1/5 complete')
  })

  it('research notes save through the research route', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('edit-research')).toBeTruthy())
    fireEvent.click(screen.getByTestId('edit-research'))
    fireEvent.change(screen.getByTestId('research-notes'), { target: { value: 'spoke to the manager' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save research' }))
    await waitFor(() => expect(mockFetch.mock.calls.some((c) => (c[1] as RequestInit)?.method === 'PATCH')).toBe(true))
    const patch = mockFetch.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'PATCH')!
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({ research_notes: 'spoke to the manager' })
  })
})

describe('[P3I-AP-5] broker work is absent, not hidden', () => {
  beforeEach(() => serve({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }, detail()))

  it('[CRITICAL] no approve, reject, assign or outreach control exists', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('section-decisions')).toBeTruthy())
    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    for (const n of names) {
      expect(n).not.toMatch(/\b(approve|reject|assign|reassign|send|outreach|proposal|agreement)\b/i)
    }
    // And structurally — there is no such control in the file to be hidden.
    const src = readFileSync(join(process.cwd(), 'src/portal/developer-opportunities/DeveloperOpportunities.tsx'), 'utf8')
    expect(src).not.toMatch(/\/approvals|\/assign\b|approvalType|decision:\s*['"]approved/)
  })

  it('[CRITICAL] the client exposes no approval or assignment CALL', () => {
    // It legitimately TYPES the approvals it is handed — they render read-only.
    // What must not exist is a request that could make or change one.
    const client = readFileSync(join(process.cwd(), 'lib/development-opportunities/vault-dev-opportunities-client.ts'), 'utf8')
    const requestPaths = [...client.matchAll(/request\(\s*`([^`]*)`/g)].map((m) => m[1])
      .concat([...client.matchAll(/request\(\s*(?:qs \? )?`([^`]*)`/g)].map((m) => m[1]))
    for (const path of requestPaths) {
      expect(path).not.toMatch(/approvals|assign/)
    }
    expect(client).not.toMatch(/approvalType/)
    // DEVINTEL-P12A · the write surface is now TWO calls, so it is pinned as
    // the exact set rather than "no POST at all" — which was a proxy for the
    // real claim and would have had to be dropped rather than tightened.
    const methods = [...client.matchAll(/method:\s*['"](\w+)['"]/g)].map((m) => m[1])
    expect(new Set(methods)).toEqual(new Set(['PATCH', 'POST']))
    // The only POST is the submit, and it is the ONLY one.
    const posts = [...client.matchAll(/`\$\{BASE\}([^`]*)`[\s\S]{0,200}?method:\s*'POST'/g)]
    const postPaths = [...client.matchAll(/request\(\s*`([^`]*)`,\s*\{\s*\n?\s*method:\s*'POST'/g)].map((m) => m[1])
    expect(postPaths).toEqual(['/${encodeURIComponent(id)}/research/submit'])
    expect(posts.length).toBe(0)   // nothing posts to a raw BASE path
  })

  it('[CRITICAL] the agent client cannot RECORD a review — only read one', () => {
    // `research/reviews` POST is the broker's Accept / Request changes. Vault
    // refuses an agent token there, and this side must not call it at all.
    const client = readFileSync(join(process.cwd(), 'lib/development-opportunities/vault-dev-opportunities-client.ts'), 'utf8')
    const src = readFileSync(join(process.cwd(), 'src/portal/developer-opportunities/DeveloperOpportunities.tsx'), 'utf8')
    // The reviews path is REQUESTED exactly once, and that request is a GET.
    // Matched on `request(...)` rather than on the bare string, so the comment
    // explaining why there is no review call does not read as a second use.
    const reviewRequests = [...client.matchAll(/request\(\s*`[^`]*research\/reviews`([^)]*)\)/g)]
    expect(reviewRequests).toHaveLength(1)
    expect(reviewRequests[0][1]).not.toMatch(/method:/)   // a bare request() is a GET
    // Over what is SENT, not the whole file: the client legitimately TYPES
    // `decision: 'accepted' | 'changes_requested'` on the review rows it
    // RENDERS, and a file-wide match read that type as a review being posted.
    const sent = [...client.matchAll(/JSON\.stringify\(([\s\S]*?)\),?\n/g)].map((m) => m[1])
      .concat([...src.matchAll(/JSON\.stringify\(([\s\S]*?)\),?\n/g)].map((m) => m[1]))
    expect(sent.length).toBeGreaterThan(0)
    for (const body of sent) {
      expect(body).not.toContain('decision')
      expect(body).not.toContain('submissionId')   // the review body's own field
    }
    // And the component issues no request of its own at all — every call goes
    // through the client above. Matched on a CALL SITE, since the file's own
    // header legitimately mentions `authFetch` in prose.
    expect(src).not.toMatch(/\b(?:await\s+)?(?:authFetch|window\.fetch|globalThis\.fetch)\s*\(/)
    expect(src).not.toMatch(/[^.\w]fetch\s*\(/)
  })

  it('[CRITICAL] the submit sends no findings of its own', () => {
    // Vault snapshots the SAVED row. If this posted what the screen held, an
    // agent could submit notes and evidence that were never saved, and the
    // broker's verdict would name something not in the record.
    const client = readFileSync(join(process.cwd(), 'lib/development-opportunities/vault-dev-opportunities-client.ts'), 'utf8')
    const fn = client.slice(client.indexOf('export async function submitResearchForReview'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    expect(body).toContain('JSON.stringify({})')
    for (const field of ['research_notes', 'evidence', 'tasks_done', 'tasksDone', 'notes']) {
      expect(body).not.toContain(field)
    }
  })

  it('[CRITICAL] a source is sent as addSource, never as a whole evidence_refs array', () => {
    const client = readFileSync(join(process.cwd(), 'lib/development-opportunities/vault-dev-opportunities-client.ts'), 'utf8')
    expect(client).toMatch(/addSource:\s*\{/)
    // Sending the array would hand the developer attribution and the
    // representation finding to a client that does not hold the real copy.
    // Asserted over what is SENT: the client legitimately TYPES `evidence_refs`
    // on the detail it is handed, so the file-wide form of this was a false
    // positive on a type declaration.
    const bodies = [...client.matchAll(/JSON\.stringify\(([\s\S]*?)\),?\n/g)].map((m) => m[1])
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) {
      expect(body).not.toContain('evidence_refs')
      expect(body).not.toContain('evidence_snapshot')
    }
  })

  it('shows the four gates as read-only facts', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('gate-RESEARCH')).toBeTruthy())
    expect(screen.getByTestId('gate-state-RESEARCH').textContent).toBe('approved')
    for (const g of ['OUTREACH', 'PROPOSAL', 'AGREEMENT']) {
      expect(screen.getByTestId(`gate-state-${g}`).textContent).toBe('not decided')
    }
    expect(screen.getByTestId('section-decisions').textContent).toContain('Read-only')
  })

  it('[CRITICAL] a gate approved then rejected reads as rejected', async () => {
    serve({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }, detail({
      approvals: [
        { id: 'a1', approval_type: 'OUTREACH', decision: 'approved', decided_by: 'b', decided_at: '2026-10-22T10:00:00Z', note: null },
        { id: 'a2', approval_type: 'OUTREACH', decision: 'rejected', decided_by: 'b', decided_at: '2026-10-22T11:00:00Z', note: null },
      ],
    }))
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('gate-state-OUTREACH')).toBeTruthy())
    expect(screen.getByTestId('gate-state-OUTREACH').textContent).toBe('rejected')
  })
})

describe('[P3I-AP-6] project detail and links', () => {
  beforeEach(() => serve({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } }, detail()))

  it('links the map and the parcel record for the parcel they belong to', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('view-map')).toBeTruthy())
    expect(screen.getByTestId('view-map').getAttribute('href')).toContain(encodeURIComponent('1953 TIGERTAIL AV'))
    expect(screen.getByTestId('pa-0141150240310').getAttribute('href')).toContain('folio=0141150240310')
  })

  it('shows the permit filing and names the contractor as the contractor', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('permits-0141150240310')).toBeTruthy())
    const t = screen.getByTestId('permits-0141150240310').textContent ?? ''
    expect(t).toContain('ISSUED')
    expect(t).toContain('Contractor: ROC PROPERTY DEVELOPERS LLC')
    expect(screen.getByTestId('section-contact').textContent).toContain('never promoted to developer')
  })

  it('points at the existing My Follow-Ups rather than a second system', async () => {
    render(<DeveloperOpportunities />)
    await waitFor(() => expect(screen.getByTestId('followups-link')).toBeTruthy())
    expect(screen.getByTestId('followups-link').getAttribute('href')).toBe('/follow-ups')
    expect(screen.getByTestId('followups-empty').textContent).toContain('No follow-up linked')
  })
})

describe('[P3I-AP-7] pure helpers', () => {
  it('latestDecision takes the newest per gate', () => {
    const a = [
      { approval_type: 'OUTREACH', decision: 'approved', decided_at: '2026-01-01T00:00:00Z' },
      { approval_type: 'OUTREACH', decision: 'rejected', decided_at: '2026-02-01T00:00:00Z' },
      { approval_type: 'RESEARCH', decision: 'approved', decided_at: '2026-01-01T00:00:00Z' },
    ]
    expect(latestDecision(a, 'OUTREACH')!.decision).toBe('rejected')
    expect(latestDecision(a, 'RESEARCH')!.decision).toBe('approved')
    expect(latestDecision(a, 'AGREEMENT')).toBeNull()
  })

  it('mapHref returns null rather than a link to nowhere', () => {
    expect(mapHref('685 NE 77 ST')).toContain('google.com/maps')
    for (const bad of [null, undefined, '', '   ']) expect(mapHref(bad)).toBeNull()
  })

  it('[CRITICAL] parcelHref refuses a folio that is not 13 digits', () => {
    expect(parcelHref('0141150240310')).toContain('folio=0141150240310')
    expect(parcelHref('01-4115-024-0310')).toContain('folio=0141150240310')
    for (const bad of [null, '', '014115024', '01411502403100']) expect(parcelHref(bad)).toBeNull()
  })
})
