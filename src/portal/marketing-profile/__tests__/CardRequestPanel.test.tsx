// ============================================================================
// CardRequestPanel — mounted and driven.
// ============================================================================
// UX-DONE-1: a source assertion is not proof that a button renders or works.
// This mounts the panel and drives the actual journey — the strip shows where
// the agent stands, the button opens the form, a reason is chosen, the request
// leaves for VAULT carrying only a reason and a note, and the panel moves to
// Requested. Jest, not vitest.
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { VAULT_API_URL } from '@/lib/vault-client'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockAuthFetch = authFetch as jest.Mock

import CardRequestPanel from '../CardRequestPanel'

const URL = `${VAULT_API_URL}/agent/card-request`

const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
})
/** A platform 404: HTML, not the Vault JSON contract. */
const platform404 = () => ({
  ok: false,
  status: 404,
  headers: { get: () => 'text/html' },
  json: async () => { throw new Error('html') },
})

const state = (over: Record<string, unknown> = {}) => ({
  state: 'none', canRequest: true, suggestedReason: 'first_card',
  hasApprovedCard: false, request: null, ...over,
})

beforeEach(() => jest.clearAllMocks())

describe('where the agent stands', () => {
  it('nothing asked → the strip is absent and the button is offered', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state() }))
    render(<CardRequestPanel />)
    expect(await screen.findByText('You have not requested a brokerage business card yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Request Brokerage Business Card/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Card request progress')).not.toBeInTheDocument()
  })

  it('requested → the strip shows Requested as the current step, and asking is withdrawn', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state({
      state: 'requested', canRequest: false,
      request: { id: 'r1', status: 'open', reason: 'first_card', note: null, requestedAt: 'x', resolvedAt: null, resolutionNote: null },
    }) }))
    render(<CardRequestPanel />)
    const strip = await screen.findByLabelText('Card request progress')
    expect(strip).toBeInTheDocument()
    expect(screen.getByText('Requested')).toHaveAttribute('aria-current', 'step')
    // The SERVER decides whether asking is available; the UI must not re-offer it.
    expect(screen.queryByRole('button', { name: /Request Brokerage Business Card/i })).not.toBeInTheDocument()
  })

  it('being_made → Being made is the current step', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state({
      state: 'being_made', canRequest: false,
      request: { id: 'r1', status: 'in_progress', reason: 'reprint', note: null, requestedAt: 'x', resolvedAt: null, resolutionNote: null },
    }) }))
    render(<CardRequestPanel />)
    await screen.findByLabelText('Card request progress')
    expect(screen.getByText('Being made')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Your business card is being made now.')).toBeInTheDocument()
  })

  it('ready → Ready is current AND asking again is offered', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state({
      state: 'ready', canRequest: true, hasApprovedCard: true, suggestedReason: 'reprint',
    }) }))
    render(<CardRequestPanel />)
    await screen.findByLabelText('Card request progress')
    expect(screen.getByText('Ready')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Your business card is approved and live.')).toBeInTheDocument()
    // A reprint is a real need; Ready must not be a dead end.
    expect(screen.getByRole('button', { name: /Request Brokerage Business Card/i })).toBeInTheDocument()
  })

  it('declined → the brokerage’s reason is shown to the agent', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state({
      state: 'declined', canRequest: true,
      request: { id: 'r1', status: 'declined', reason: 'new_headshot', note: null, requestedAt: 'x', resolvedAt: 'y', resolutionNote: 'The headshot is too dark to print.' },
    }) }))
    render(<CardRequestPanel />)
    expect(await screen.findByText('The headshot is too dark to print.')).toBeInTheDocument()
  })
})

describe('raising a request', () => {
  it('sends ONLY a reason and a note, to the VAULT origin', async () => {
    mockAuthFetch.mockImplementation(async (_u: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return json({ success: true, data: state({
          state: 'requested', canRequest: false,
          request: { id: 'r-new', status: 'open', reason: 'new_headshot', note: 'photo attached', requestedAt: 'x', resolvedAt: null, resolutionNote: null },
        }) }, 201)
      }
      return json({ success: true, data: state() })
    })
    render(<CardRequestPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Request Brokerage Business Card/i }))

    fireEvent.click(screen.getByLabelText('I have a new headshot'))
    fireEvent.change(screen.getByLabelText(/Anything the brokerage should know/i), {
      target: { value: '  photo attached  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Send request/i }))

    await waitFor(() => {
      const post = mockAuthFetch.mock.calls.find((c) => c[1]?.method === 'POST')
      expect(post).toBeDefined()
      expect(post![0]).toBe(URL)
      expect(post![1].credentials).toBe('omit')
      // The browser cannot name an agent, a tenant, a status or a resolver.
      expect(JSON.parse(post![1].body)).toEqual({ reason: 'new_headshot', note: 'photo attached' })
    })
    // and the panel has moved
    expect(await screen.findByLabelText('Card request progress')).toBeInTheDocument()
    expect(screen.getByText('Requested')).toHaveAttribute('aria-current', 'step')
  })

  it('omits the note entirely when it is blank', async () => {
    mockAuthFetch.mockImplementation(async (_u: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ success: true, data: state({ state: 'requested', canRequest: false }) }, 201)
        : json({ success: true, data: state() }))
    render(<CardRequestPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Request Brokerage Business Card/i }))
    fireEvent.change(screen.getByLabelText(/Anything the brokerage should know/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /Send request/i }))
    await waitFor(() => {
      const post = mockAuthFetch.mock.calls.find((c) => c[1]?.method === 'POST')
      expect(JSON.parse(post![1].body)).toEqual({ reason: 'first_card' })
    })
  })

  it('preselects the reason the SERVER suggested, not a hardcoded one', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state({
      state: 'ready', hasApprovedCard: true, suggestedReason: 'reprint',
    }) }))
    render(<CardRequestPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Request Brokerage Business Card/i }))
    expect((screen.getByLabelText('I need more printed') as HTMLInputElement).checked).toBe(true)
  })

  it('a 409 is treated as success — their request is already waiting', async () => {
    let getCount = 0
    mockAuthFetch.mockImplementation(async (_u: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return json({ success: false, code: 'REQUEST_ALREADY_OPEN', error: 'already' }, 409)
      }
      getCount += 1
      return json({ success: true, data: getCount === 1
        ? state()
        : state({ state: 'requested', canRequest: false }) })
    })
    render(<CardRequestPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Request Brokerage Business Card/i }))
    fireEvent.click(screen.getByRole('button', { name: /Send request/i }))

    // Reloaded, not scolded: the strip appears and no error is shown.
    expect(await screen.findByLabelText('Card request progress')).toBeInTheDocument()
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/already have a business card request/i)).not.toBeInTheDocument()
  })

  it('a rate limit shows a bounded message and leaves the form open', async () => {
    mockAuthFetch.mockImplementation(async (_u: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ success: false, code: 'RATE_LIMITED', error: 'slow down' }, 429)
        : json({ success: true, data: state() }))
    render(<CardRequestPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Request Brokerage Business Card/i }))
    fireEvent.click(screen.getByRole('button', { name: /Send request/i }))
    expect(await screen.findByText('Too many attempts. Please try again shortly.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send request/i })).toBeInTheDocument()
  })
})

describe('partial rollout', () => {
  it('an UNDEPLOYED Vault route hides the panel entirely', async () => {
    mockAuthFetch.mockResolvedValue(platform404())
    const { container } = render(<CardRequestPanel />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('the feature switched OFF hides the panel too', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: false, code: 'CARD_REQUESTS_DISABLED', error: 'off' }, 404))
    const { container } = render(<CardRequestPanel />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('a STRUCTURED Vault error is shown and retryable — never hidden', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: false, code: 'CARD_REQUEST_UNAVAILABLE', error: 'x' }, 503))
    render(<CardRequestPanel />)
    expect(await screen.findByText('This is temporarily unavailable. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('a network or CORS failure is shown, not swallowed', async () => {
    mockAuthFetch.mockRejectedValue(new Error('cors'))
    render(<CardRequestPanel />)
    expect(await screen.findByText(/Unable to reach the brokerage/i)).toBeInTheDocument()
  })
})

// ── The product is the BROKERAGE's ──────────────────────────────────────────
// The clarification that prompted this naming: the card is HartFelt Real
// Estate's official business card. The agent asks for one; the brokerage owns
// the design, the generation, the approval and the publication. These pin the
// agent-facing vocabulary, and that the request carries no design input of any
// kind — not because it is stripped, but because the panel has no such field.
describe('it is a Brokerage Business Card, and the agent does not design it', () => {
  it('names the product the way the brokerage does', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state() }))
    render(<CardRequestPanel />)
    expect(await screen.findByRole('heading', { name: 'Brokerage Business Card' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Request Brokerage Business Card/i })).toBeInTheDocument()
    expect(screen.getByText(/HartFelt Real Estate designs and produces your official business card/i)).toBeInTheDocument()
  })

  it('offers no control over logo, layout, colour or branding', async () => {
    mockAuthFetch.mockResolvedValue(json({ success: true, data: state() }))
    render(<CardRequestPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Request Brokerage Business Card/i }))
    // The only inputs are the four reasons and one free-text note.
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(4)
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    for (const forbidden of [/logo/i, /colou?r/i, /layout/i, /template/i, /font/i, /brand/i]) {
      expect(screen.queryByLabelText(forbidden)).toBeNull()
    }
  })

  it('sends a reason and a note — never a design field', async () => {
    mockAuthFetch.mockImplementation(async (_u: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ success: true, data: state({ state: 'requested', canRequest: false }) }, 201)
        : json({ success: true, data: state() }))
    render(<CardRequestPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Request Brokerage Business Card/i }))
    fireEvent.click(screen.getByLabelText('I need more printed'))
    fireEvent.click(screen.getByRole('button', { name: /Send request/i }))
    await waitFor(() => {
      const post = mockAuthFetch.mock.calls.find((c) => c[1]?.method === 'POST')
      expect(Object.keys(JSON.parse(post![1].body))).toEqual(['reason'])
    })
  })
})
