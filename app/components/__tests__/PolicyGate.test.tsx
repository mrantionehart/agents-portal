// ============================================================================
// A4 · PolicyGate — mounted-component tests (UX-DONE-1 evidence)
// ============================================================================
// The REAL PolicyGate + the REAL lib/policies/client run here. Only the
// transport (`authFetch`), the auth context and the router pathname are
// mocked. What is asserted is what the user sees and can press.
// ============================================================================
import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'

type Reply = { status: number; body?: unknown; throws?: boolean }
let requiredReplies: Reply[] = []
let acceptReplies: Reply[] = []
const authFetchMock = jest.fn()

jest.mock('@/lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
}))

let mockAuth: { user: { id: string } | null; role: string | null; loading: boolean } = {
  user: { id: 'u1' },
  role: 'agent',
  loading: false,
}
jest.mock('../../providers', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let mockPathname = '/home'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

import PolicyGate, { PolicyGateMount } from '../PolicyGate'
import RootLayout from '../../layout'

const SHA = 'AbCdEf0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const POLICY = {
  id: 'pv-1',
  policy_key: 'brokerage_manual',
  version: '2026.11',
  title: 'HartFelt Brokerage Policy Manual',
  document_sha256: SHA,
  document_url: 'https://vault.test/policies/manual-2026.11.pdf',
  effective_at: '2026-11-01T00:00:00Z',
  audience_roles: ['agent', 'new_agent', 'office_manager'],
  material_change: true,
}

function respond(r: Reply) {
  if (r.throws) return Promise.reject(new Error('network down'))
  return Promise.resolve({
    status: r.status,
    ok: r.status >= 200 && r.status < 300,
    json: async () => {
      if (r.body === undefined) throw new SyntaxError('not json')
      return r.body
    },
  })
}

beforeEach(() => {
  requiredReplies = []
  acceptReplies = []
  mockAuth = { user: { id: 'u1' }, role: 'agent', loading: false }
  mockPathname = '/home'
  window.localStorage.clear()
  authFetchMock.mockReset()
  authFetchMock.mockImplementation((url: string) => {
    if (url === '/api/policies/required') {
      return respond(requiredReplies.length > 1 ? requiredReplies.shift()! : requiredReplies[0] ?? { status: 200, body: { required: [] } })
    }
    if (url === '/api/policies/accept') {
      return respond(acceptReplies.shift() ?? { status: 500, body: { ok: false } })
    }
    throw new Error(`unexpected url ${url}`)
  })
})

const requiredCalls = () => authFetchMock.mock.calls.filter((c) => c[0] === '/api/policies/required').length
const acceptCalls = () => authFetchMock.mock.calls.filter((c) => c[0] === '/api/policies/accept')

const checkbox = () => screen.getByRole('checkbox', { name: /I have read and acknowledge HartFelt Brokerage Policy Manual, version 2026\.11/ })
const ackButton = () => screen.getByRole('button', { name: 'Acknowledge' })

describe('[A4-UI] owed policy', () => {
  it('[A4-UI1] renders the exact title, version, 12-char hash and a document link', async () => {
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    render(<PolicyGate />)
    const dialog = await screen.findByRole('dialog', { name: 'Policy acknowledgment required' })
    expect(within(dialog).getByRole('heading', { name: POLICY.title })).toBeInTheDocument()
    expect(screen.getByTestId('policy-version')).toHaveTextContent('2026.11')
    expect(screen.getByTestId('policy-short-hash')).toHaveTextContent(/^AbCdEf012345$/)
    expect(screen.getByText('This version changes material terms.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Read the full document/ })
    expect(link).toHaveAttribute('href', POLICY.document_url)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('[A4-UI2] Acknowledge is disabled until the checkbox is ticked; opening the document records nothing', async () => {
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    render(<PolicyGate />)
    await screen.findByRole('dialog')
    expect(ackButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('link', { name: /Read the full document/ }))
    fireEvent.click(ackButton())
    expect(acceptCalls()).toHaveLength(0)
    fireEvent.click(checkbox())
    expect(ackButton()).toBeEnabled()
    fireEvent.click(checkbox())
    expect(ackButton()).toBeDisabled()
  })

  it('[A4-UI3] success (201) records with the exact hash, removes the item, and re-reads the server', async () => {
    requiredReplies = [
      { status: 200, body: { required: [POLICY] } },
      { status: 200, body: { required: [] } },
    ]
    acceptReplies = [{ status: 201, body: { ok: true } }]
    render(<PolicyGate />)
    await screen.findByRole('dialog')
    fireEvent.click(checkbox())
    fireEvent.click(ackButton())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const [, init] = acceptCalls()[0]
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toEqual({ policy_version_id: 'pv-1', document_sha256: SHA, client: 'agent_portal' })
    // No tenant/user identity in the body — only the bearer (added by authFetch).
    expect(JSON.stringify(body)).not.toMatch(/tenant|user_id/)
    expect(requiredCalls()).toBe(2)
    // Nothing written client-side as evidence.
    expect(window.localStorage.length).toBe(0)
  })

  it('[A4-UI4] 200 already:true is also success', async () => {
    requiredReplies = [
      { status: 200, body: { required: [POLICY] } },
      { status: 200, body: { required: [] } },
    ]
    acceptReplies = [{ status: 200, body: { ok: true, already: true } }]
    render(<PolicyGate />)
    await screen.findByRole('dialog')
    fireEvent.click(checkbox())
    fireEvent.click(ackButton())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('[A4-UI5] 409 stale_document shows an error, keeps the item, and unticks the box', async () => {
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    acceptReplies = [{ status: 409, body: { ok: false, refusal: 'stale_document' } }]
    render(<PolicyGate />)
    await screen.findByRole('dialog')
    fireEvent.click(checkbox())
    fireEvent.click(ackButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(/document was updated/)
    expect(screen.getByRole('heading', { name: POLICY.title })).toBeInTheDocument()
    expect(checkbox()).not.toBeChecked()
    expect(ackButton()).toBeDisabled()
    await waitFor(() => expect(requiredCalls()).toBe(2))
  })

  it('[A4-UI6] a 500 or network failure on accept is NOT acceptance — item stays, can retry', async () => {
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    acceptReplies = [{ status: 500, body: { ok: false } }, { status: 0, throws: true }]
    render(<PolicyGate />)
    await screen.findByRole('dialog')
    fireEvent.click(checkbox())
    fireEvent.click(ackButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(/was not recorded/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(ackButton()).toBeEnabled()
    fireEvent.click(ackButton())
    await waitFor(() => expect(acceptCalls()).toHaveLength(2))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(window.localStorage.length).toBe(0)
  })

  it('[A4-UI7] a 2xx without ok:true is not acceptance', async () => {
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    acceptReplies = [{ status: 201, body: {} }]
    render(<PolicyGate />)
    await screen.findByRole('dialog')
    fireEvent.click(checkbox())
    fireEvent.click(ackButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(/was not recorded/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('[A4-UI8] sections: one checkbox per section; keys are sent', async () => {
    const withSections = { ...POLICY, sections: [{ key: 's1', title: 'Advertising' }, { key: 's2', title: 'Escrow' }] }
    requiredReplies = [
      { status: 200, body: { required: [withSections] } },
      { status: 200, body: { required: [] } },
    ]
    acceptReplies = [{ status: 201, body: { ok: true } }]
    render(<PolicyGate />)
    await screen.findByRole('dialog')
    fireEvent.click(checkbox())
    expect(ackButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Advertising/ }))
    expect(ackButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Escrow/ }))
    fireEvent.click(ackButton())
    await waitFor(() => expect(acceptCalls()).toHaveLength(1))
    expect(JSON.parse(acceptCalls()[0][1].body).sections).toEqual(['s1', 's2'])
  })
})

describe('[A4-FC] fail closed', () => {
  it('[A4-FC1] 503 shows "We couldn\'t verify" with Retry — not "nothing required"', async () => {
    requiredReplies = [
      { status: 503, body: { required: null, failClosed: true } },
      { status: 200, body: { required: [POLICY] } },
    ]
    render(<PolicyGate />)
    const alert = await screen.findByTestId('policy-gate-error')
    expect(alert).toHaveTextContent("We couldn't verify your policy acknowledgments")
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it.each([
    ['network failure', { status: 0, throws: true }],
    ['unparseable body', { status: 200 }],
    ['required:null on 200', { status: 200, body: { required: null } }],
    ['malformed item (bad hash)', { status: 200, body: { required: [{ ...POLICY, document_sha256: 'xyz' }] } }],
    ['502 from the forwarder', { status: 502, body: { required: null, failClosed: true } }],
  ] as [string, Reply][])('[A4-FC2] %s → fail-closed state', async (_n, reply) => {
    requiredReplies = [reply]
    render(<PolicyGate />)
    expect(await screen.findByTestId('policy-gate-error')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('[A4-FC3] 403 role_not_permitted (outside the audience) shows nothing', async () => {
    requiredReplies = [{ status: 403, body: { reason: 'role_not_permitted' } }]
    render(<PolicyGate />)
    await waitFor(() => expect(requiredCalls()).toBe(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('policy-gate-error')).not.toBeInTheDocument()
  })
})

describe('[A4-ROLE] every role, no client storage', () => {
  it.each(['new_agent', 'office_manager', 'broker', 'tc'])('[A4-ROLE1] role %s is prompted', async (role) => {
    mockAuth = { user: { id: 'u-' + role }, role, loading: false }
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    render(<PolicyGateMount />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('[A4-ROLE2] localStorage "accepted" does NOT suppress the prompt', async () => {
    window.localStorage.setItem('policy_accepted_u1', 'true')
    window.localStorage.setItem('policyAccepted', 'accepted')
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    render(<PolicyGateMount />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('[A4-MOUNT] mounted at the root layout for every authenticated path', () => {
  function renderRootLayout(page: React.ReactNode) {
    const html = RootLayout({ children: page }) as React.ReactElement
    const body = (html.props as { children: React.ReactElement }).children
    return render((body.props as { children: React.ReactNode }).children as React.ReactElement)
  }

  it('[A4-MOUNT1] /home: the real root layout renders the page AND the prompt', async () => {
    mockPathname = '/home'
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    renderRootLayout(<div>Home page</div>)
    expect(screen.getByText('Home page')).toBeInTheDocument()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it.each(['/transactions/new', '/workspace/new', '/dashboard', '/cma'])('[A4-MOUNT2] %s is checked', async (p) => {
    mockPathname = p
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    renderRootLayout(<div>page</div>)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it.each(['/login', '/pending-activation', '/card/jane', '/client/abc', '/portal/tok'])(
    '[A4-MOUNT3] public path %s makes no call',
    async (p) => {
      mockPathname = p
      renderRootLayout(<div>public</div>)
      await new Promise((r) => setTimeout(r, 0))
      expect(authFetchMock).not.toHaveBeenCalled()
    },
  )

  it('[A4-MOUNT4] signed-out: no call, no prompt', async () => {
    mockAuth = { user: null, role: null, loading: false }
    renderRootLayout(<div>page</div>)
    await new Promise((r) => setTimeout(r, 0))
    expect(authFetchMock).not.toHaveBeenCalled()
  })
})

describe('[A4-OFF] enforcement off: dismissible, blocks nothing', () => {
  it('[A4-OFF1] "Remind me later" collapses to a banner; "Review now" reopens; page stays usable', async () => {
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    const onClick = jest.fn()
    render(
      <>
        <button onClick={onClick}>New transaction</button>
        <PolicyGate />
      </>,
    )
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Remind me later' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('policy-gate-banner')).toHaveTextContent('1 policy acknowledgment is pending.')
    fireEvent.click(screen.getByRole('button', { name: 'New transaction' }))
    expect(onClick).toHaveBeenCalled()
    expect(acceptCalls()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Review now' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('[A4-ONCE] each version once; the server record is the only proof', () => {
  it('[A4-ONCE1] acknowledged on the server → no prompt after refresh, sign-out/sign-in or another device (fresh mounts)', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem')
    requiredReplies = [{ status: 200, body: { required: [] } }]
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(<PolicyGateMount />)
      await waitFor(() => expect(requiredCalls()).toBe(i + 1))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      unmount()
    }
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('[A4-ONCE2] after a recorded acknowledgment, the next session asks the server and shows nothing', async () => {
    requiredReplies = [
      { status: 200, body: { required: [POLICY] } },
      { status: 200, body: { required: [] } },
    ]
    acceptReplies = [{ status: 201, body: { ok: true } }]
    const first = render(<PolicyGate />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /I have read and acknowledge/ }))
    fireEvent.click(ackButton())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    first.unmount()
    render(<PolicyGate />)
    await waitFor(() => expect(requiredCalls()).toBe(3))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.length).toBe(0)
  })

  it('[A4-ONCE3] a localStorage "accepted" flag does not hide a version the server says is owed', async () => {
    window.localStorage.setItem('policy_acceptance', JSON.stringify({ [POLICY.id]: true, accepted: true }))
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    render(<PolicyGate />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('[A4-NAV] a failed check never interrupts navigation', () => {
  it('[A4-NAV1] the error is a non-modal alert; the page stays usable; navigating does not re-ask or re-open', async () => {
    requiredReplies = [{ status: 503, body: { required: null, failClosed: true } }]
    const onClick = jest.fn()
    const view = render(<><button onClick={onClick}>Open deal</button><PolicyGateMount /></>)
    expect(await screen.findByTestId('policy-gate-error')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open deal' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    for (const p of ['/transactions', '/clients', '/home']) {
      mockPathname = p
      view.rerender(<><button onClick={onClick}>Open deal</button><PolicyGateMount /></>)
    }
    await new Promise((r) => setTimeout(r, 0))
    expect(requiredCalls()).toBe(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('[A4-NAV2] an owed prompt dismissed with "Remind me later" stays collapsed while navigating', async () => {
    requiredReplies = [{ status: 200, body: { required: [POLICY] } }]
    const view = render(<PolicyGateMount />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remind me later' }))
    for (const p of ['/transactions', '/clients']) {
      mockPathname = p
      view.rerender(<PolicyGateMount />)
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('policy-gate-banner')).toBeInTheDocument()
    expect(requiredCalls()).toBe(1)
  })
})
