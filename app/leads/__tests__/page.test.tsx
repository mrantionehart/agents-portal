// ============================================================================
// HARTFELT-P8.1A — My Leads, mounted
// ============================================================================
// UX-DONE-1: a source assertion is not proof that a button renders or works, so
// this mounts the page and drives it. What it pins is the agent's actual
// journey — the leads appear, a lead opens, its follow-up history is visible,
// and Convert to Transaction creates a DRAFT and says so.
//
// Jest, not vitest. `npm test` is jest here; a vitest-style suite fails to
// PARSE, which reads like a broken component rather than a wrong import.
// ============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
// 🔑 A STABLE value, deliberately. Returning a fresh object from `useAuth()`
// on every render changes `user`'s identity each pass, and the page's load
// effect depends on it — the first version of this mock did that and the page
// re-fetched forever, never leaving "Loading your leads…". The real provider
// supplies one context value, so a per-render object was the MOCK lying about
// the environment, not the page misbehaving.
const AUTH = { user: { id: 'agent-1' }, role: 'agent', loading: false, signOut: jest.fn() }
jest.mock('../../providers', () => ({ useAuth: () => AUTH }))

import LeadsPage from '../page'

const LEAD = {
  id: '11111111-1111-4111-8111-111111111111',
  full_name: 'Christopher Allen',
  email: 'callen0817@example.test',
  phone: '3012545556',
  status: 'new',
  profile_type: 'buyer',
  temperature: 'warm',
  source: 'consultation',
  created_at: '2026-09-13T00:00:00Z',
  assigned_at: '2026-09-13T00:00:00Z',
}

const leadsOk = (data: unknown[], extra: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data,
    lead_count: data.length,
    page: { limit: 25, offset: 0, has_more: false },
    ...extra,
  }),
})
const followupsOk = (rows: unknown[]) => ({ ok: true, status: 200, json: async () => ({ data: rows }) })

/** Route the mock by URL — the page reads leads and follow-ups from different places. */
function routeFetch(handlers: {
  leads?: unknown
  followups?: unknown
  create?: unknown
}) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/api/vault/leads')) return handlers.leads ?? leadsOk([LEAD])
    if (url.includes('/crm/followups')) return handlers.followups ?? followupsOk([])
    if (url.includes('/api/transactions/create')) {
      return handlers.create ?? { ok: true, status: 201, json: async () => ({ transaction: { id: 'tx-1' } }) }
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
}

const callsTo = (fragment: string) =>
  mockFetch.mock.calls.filter(([u]) => String(u).includes(fragment))

beforeEach(() => {
  jest.clearAllMocks()
  routeFetch({})
})

describe('[P81A-U] the agent opens My Leads', () => {
  it('[P81A-U1] 🔑 their assigned leads appear', async () => {
    render(<LeadsPage />)
    expect(await screen.findByText('Christopher Allen')).toBeInTheDocument()
    expect(screen.getByText(/1 lead assigned to you/)).toBeInTheDocument()
  })

  it('[P81A-U2] with none assigned, it says so', async () => {
    routeFetch({ leads: leadsOk([]) })
    render(<LeadsPage />)
    expect(await screen.findByText('No leads assigned to you')).toBeInTheDocument()
    expect(
      screen.getByText(/When the broker assigns you a lead it appears here/),
    ).toBeInTheDocument()
  })

  it('[P81A-U3] 🔒 a FAILURE is not shown as an empty list', async () => {
    routeFetch({ leads: { ok: false, status: 500, json: async () => ({}) } })
    render(<LeadsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load your leads/i)
    // The empty-state copy is a claim about the brokerage. It must not appear.
    expect(screen.queryByText('No leads assigned to you')).not.toBeInTheDocument()
  })

  it('[P81A-U4] 🔑 search is sent to the SERVER, not filtered in the browser', async () => {
    render(<LeadsPage />)
    await screen.findByText('Christopher Allen')
    fireEvent.change(screen.getByLabelText('Search leads'), { target: { value: 'chris' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(callsTo('search=chris').length).toBeGreaterThan(0)
    })
  })

  it('[P81A-U5] opening a lead shows contact details and follow-up history', async () => {
    routeFetch({
      followups: followupsOk([
        { id: 'f1', title: 'Call follow-up', task_type: 'follow_up', status: 'pending', due_at: '2026-10-28T14:00:00Z', completed_at: null },
      ]),
    })
    render(<LeadsPage />)
    fireEvent.click(await screen.findByText('Christopher Allen'))
    expect(await screen.findByText('3012545556')).toBeInTheDocument()
    expect(screen.getByText('callen0817@example.test')).toBeInTheDocument()
    expect(await screen.findByText('Call follow-up')).toBeInTheDocument()
    // and it asked for THIS lead's history
    expect(callsTo(`client_profile_id=${LEAD.id}`).length).toBe(1)
  })

  it('[P81A-U6] a lead with no follow-ups says so, rather than showing nothing', async () => {
    render(<LeadsPage />)
    fireEvent.click(await screen.findByText('Christopher Allen'))
    expect(await screen.findByText('No follow-ups recorded for this lead.')).toBeInTheDocument()
  })
})

describe('[P81A-V] Convert to Transaction', () => {
  const openConvert = async () => {
    render(<LeadsPage />)
    fireEvent.click(await screen.findByText('Christopher Allen'))
    fireEvent.click(await screen.findByRole('button', { name: /Convert to Transaction/ }))
    fireEvent.change(await screen.findByLabelText('Property address'), {
      target: { value: '12 Elm St' },
    })
  }

  it('[P81A-V1] 🔑 the button is reachable and creates a DRAFT, linked to the lead', async () => {
    await openConvert()
    fireEvent.click(screen.getByRole('button', { name: 'Create draft transaction' }))

    await waitFor(() => expect(callsTo('/api/transactions/create').length).toBe(1))
    const body = JSON.parse(callsTo('/api/transactions/create')[0][1].body as string)
    expect(body.client_profile_id).toBe(LEAD.id)
    expect(body.property_address).toBe('12 Elm St')
    expect(body.business_line).toBe('brokerage')
    // 🔒 It must not try to set a status. The route writes `draft`; a client
    // that could choose would be the create-as-approved hole all over again.
    expect(body.status).toBeUndefined()
  })

  it('[P81A-V2] the agent is told it is a draft awaiting the broker', async () => {
    await openConvert()
    fireEvent.click(screen.getByRole('button', { name: 'Create draft transaction' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      /draft.*broker reviews it before anything is sent/i,
    )
  })

  it('[P81A-V3] 🔒 shows the SERVER\'S actual refusal, not a generic failure', async () => {
    routeFetch({
      create: {
        ok: false,
        status: 403,
        json: async () => ({
          error: 'That lead is not assigned to you',
          code: 'CLIENT_PROFILE_NOT_ASSIGNED',
        }),
      },
    })
    await openConvert()
    fireEvent.click(screen.getByRole('button', { name: 'Create draft transaction' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That lead is not assigned to you')
  })

  it('[P81A-V4] 🔒 a double click cannot create two transactions', async () => {
    let release: (v: unknown) => void = () => {}
    const pending = new Promise((r) => { release = r })
    routeFetch({
      create: pending.then(() => ({ ok: true, status: 201, json: async () => ({ transaction: { id: 'tx-1' } }) })) as never,
    })
    // The handler returns the same pending promise for every call, so a second
    // click would show up as a second recorded call if it were allowed.
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/vault/leads')) return leadsOk([LEAD])
      if (url.includes('/crm/followups')) return followupsOk([])
      if (url.includes('/api/transactions/create')) {
        await pending
        return { ok: true, status: 201, json: async () => ({ transaction: { id: 'tx-1' } }) }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await openConvert()
    const submit = screen.getByRole('button', { name: 'Create draft transaction' })
    fireEvent.click(submit)
    // While in flight the control is disabled and relabelled.
    expect(await screen.findByRole('button', { name: 'Creating draft…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Creating draft…' }))
    release(null)
    await waitFor(() => expect(callsTo('/api/transactions/create').length).toBe(1))
  })
})

describe('[P81A-N] paging', () => {
  it('[P81A-N1] Next is disabled when the server says there is no more', async () => {
    render(<LeadsPage />)
    await screen.findByText('Christopher Allen')
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()
  })

  it('[P81A-N2] Next asks the server for the next offset', async () => {
    routeFetch({
      leads: {
        ok: true,
        status: 200,
        json: async () => ({ data: [LEAD], lead_count: 40, page: { limit: 25, offset: 0, has_more: true } }),
      },
    })
    render(<LeadsPage />)
    await screen.findByText('Christopher Allen')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await waitFor(() => expect(callsTo('offset=25').length).toBeGreaterThan(0))
  })
})

describe('[P81A-W] the double-submit guard is the HANDLER, not the attribute', () => {
  // 🔑 [P81A-V4] clicks, waits for the control to go disabled, then clicks
  // again — so it proves the `disabled` ATTRIBUTE. A mutant that deleted the
  // handler's own guard survived it untouched, because a disabled button
  // swallows the second click in jsdom either way.
  //
  // This fires both clicks back-to-back with no await between them, and it
  // PASSES on the shipped code — so what it establishes is that the UI cannot
  // double-submit, not which of the two guards stops it. RTL wraps every
  // `fireEvent` in `act()`, which flushes the state update, so `disabled` is
  // already applied before the second click lands.
  //
  // 🔑 That makes the deleted-handler-guard mutant EQUIVALENT rather than a
  // coverage hole: with `disabled={converting}` present there is no reachable
  // behaviour that distinguishes them. Recorded as equivalent instead of
  // chased, because a test written only to tell two redundant guards apart
  // would be testing the implementation, not the agent's journey.
  it('[P81A-W1] 🔒 two clicks in a row create ONE transaction', async () => {
    let settle: (v: unknown) => void = () => {}
    const pending = new Promise((r) => { settle = r })
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/vault/leads')) return leadsOk([LEAD])
      if (url.includes('/crm/followups')) return followupsOk([])
      if (url.includes('/api/transactions/create')) {
        await pending
        return { ok: true, status: 201, json: async () => ({ transaction: { id: 'tx-1' } }) }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    render(<LeadsPage />)
    fireEvent.click(await screen.findByText('Christopher Allen'))
    fireEvent.click(await screen.findByRole('button', { name: /Convert to Transaction/ }))
    fireEvent.change(await screen.findByLabelText('Property address'), {
      target: { value: '12 Elm St' },
    })

    const submit = screen.getByRole('button', { name: 'Create draft transaction' })
    // Both in the same tick — no await between them.
    fireEvent.click(submit)
    fireEvent.click(submit)
    settle(null)

    await waitFor(() => expect(callsTo('/api/transactions/create').length).toBeGreaterThan(0))
    expect(callsTo('/api/transactions/create')).toHaveLength(1)
  })
})
