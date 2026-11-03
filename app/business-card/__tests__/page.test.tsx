// ============================================================================
// HARTFELT-CARD-SELFSERVE — My Card, mounted
// ============================================================================
// UX-DONE-1: a source assertion is not proof that a button renders or works.
// The Marketing Card section already existed and was already wired to Vault —
// it was only ever mounted on /profile, which is not where an agent looks for
// their card. The nav's "My Card" points HERE. So what this suite pins is the
// entry point: the section mounts on /business-card, the headshot control is
// reachable from it, the upload actually leaves for the VAULT origin carrying
// only the image, and the page's pre-existing profile editing still works.
//
// Jest, not vitest. `npm test` is jest here; a vitest-style suite fails to
// PARSE, which reads like a broken component rather than a wrong import.
// ============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { VAULT_API_URL } from '@/lib/vault-client'

jest.mock('@/lib/supabase', () => ({
  authFetch: jest.fn(),
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: null } })) } },
}))
import { authFetch } from '@/lib/supabase'
const mockAuthFetch = authFetch as jest.Mock

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

// A STABLE context value — a fresh object per render changes `user`'s identity
// and the page's load effect depends on it (see app/leads/__tests__).
const AUTH = { user: { id: 'agent-1' }, role: 'agent', loading: false, signOut: jest.fn() }
jest.mock('../../providers', () => ({ useAuth: () => AUTH }))
jest.mock('../../components/SidebarNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="sidebar" />,
}))

import BusinessCardPage from '../page'

const MY_CARD = {
  success: true,
  data: {
    name: 'Cole Giammanco', title: 'Real Estate Agent',
    email: 'cole@hartfeltrealestate.com', phone: '', bio: '',
    avatar_url: '', card_image_url: '', card_enabled: true,
    slug: 'cole-giammanco', share_url: null,
    social: { website: '', instagram: '', facebook: '', linkedin: '', tiktok: '' },
  },
}

/** The Vault marketing-profile contract, as GET /api/agent/marketing-profile
 *  returns it. `uploadAvailable` is SERVER-owned — the browser never computes it. */
const vaultState = (over: Record<string, unknown> = {}) => ({
  avatar: { hasPhoto: false, displayUrl: null, updatedAt: null, uploadAvailable: true },
  marketingCard: { readiness: 'awaiting_headshot', missingRequirements: ['headshot'], phoneUpdateAvailable: true },
  profile: {
    fullName: 'Cole Giammanco', cardTitle: 'Real Estate Agent',
    preferredPublicPhone: null, brokerageEmail: 'cole@hartfeltrealestate.com',
    licenseNumber: 'SL3512345',
  },
  ...over,
})

const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
})

// jsdom implements no URL.createObjectURL / revokeObjectURL, and the section
// builds a local preview from the picked file. Without these the pick throws
// and the Save button never appears — a missing HARNESS capability that reads
// exactly like a broken component. Mirrors the handling already established in
// src/portal/marketing-profile/__tests__/MarketingProfileSection.test.tsx.
const createObjectURL = jest.fn(() => 'blob:preview-1')
const revokeObjectURL = jest.fn()
beforeAll(() => {
  ;(global as unknown as { URL: typeof URL }).URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
  ;(global as unknown as { URL: typeof URL }).URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
})

beforeEach(() => {
  jest.clearAllMocks()
  // The page's own GET is plain `fetch` (no bearer); everything else is authFetch.
  global.fetch = jest.fn(async () => json(MY_CARD)) as unknown as typeof fetch
  mockAuthFetch.mockImplementation(async (url: string) => {
    if (url === `${VAULT_API_URL}/agent/marketing-profile`) return json({ success: true, data: vaultState() })
    if (url === `${VAULT_API_URL}/agent/marketing-profile/phone`) {
      return json({ success: true, data: vaultState({ profile: { ...vaultState().profile, preferredPublicPhone: '(305) 555-1234' } }) })
    }
    if (url === `${VAULT_API_URL}/agent/avatar`) {
      return json({ ok: true, marketingProfile: vaultState({ avatar: { hasPhoto: true, displayUrl: 'https://signed.example/x.png', updatedAt: '2026-11-03T00:00:00Z', uploadAvailable: true } }) })
    }
    if (url === `${VAULT_API_URL}/agent/card-request`) {
      return json({ success: true, data: { state: 'none', canRequest: true, suggestedReason: 'first_card', hasApprovedCard: false, request: null } })
    }
    if (url === '/api/my-card') return json({ success: true })
    throw new Error(`unmocked authFetch: ${url}`)
  })
})

describe('My Card — the agent self-service entry point', () => {
  it('mounts the Marketing Card section, so the headshot control is reachable from My Card', async () => {
    render(<BusinessCardPage />)
    expect(await screen.findByRole('heading', { name: 'Marketing Card' })).toBeInTheDocument()
    // The capability came from Vault, not from this page.
    expect(mockAuthFetch).toHaveBeenCalledWith(
      `${VAULT_API_URL}/agent/marketing-profile`,
      expect.objectContaining({ method: 'GET', credentials: 'omit' }),
    )
    expect(screen.getByText('Upload photo')).toBeInTheDocument()
  })

  it('sends a picked headshot to the VAULT avatar route carrying only the image', async () => {
    render(<BusinessCardPage />)
    await screen.findByRole('heading', { name: 'Marketing Card' })

    const file = new File([new Uint8Array([1, 2, 3])], 'cole.png', { type: 'image/png' })
    const input = document.getElementById('marketing-headshot-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const save = await screen.findByRole('button', { name: /Save photo/i })
    fireEvent.click(save)

    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${VAULT_API_URL}/agent/avatar`,
        expect.objectContaining({ method: 'POST', credentials: 'omit' }),
        expect.any(Number),
      ),
    )
    const call = mockAuthFetch.mock.calls.find((c) => c[0] === `${VAULT_API_URL}/agent/avatar`)!
    const body = call[1].body as FormData
    // SELF-service: the target is the authenticated caller. The browser must not
    // be able to name an agent, a tenant, or a storage location.
    expect([...body.keys()]).toEqual(['file'])
    expect(body.get('file')).toBe(file)
    // Proof it reached the agent: the refreshed state shows a photo.
    await waitFor(() => expect(screen.getByText('Replace photo')).toBeInTheDocument())
  })

  it('saves the public phone to Vault, not to the local profile row', async () => {
    render(<BusinessCardPage />)
    await screen.findByRole('heading', { name: 'Marketing Card' })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByLabelText(/Public phone/i), { target: { value: '3055551234' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${VAULT_API_URL}/agent/marketing-profile/phone`,
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'omit',
          body: JSON.stringify({ preferred_public_phone: '3055551234' }),
        }),
      ),
    )
    await waitFor(() => expect(screen.getByText('(305) 555-1234')).toBeInTheDocument())
  })

  it('still saves the page’s own profile fields — the pre-existing journey is preserved', async () => {
    render(<BusinessCardPage />)
    await screen.findByRole('heading', { name: 'Marketing Card' })

    const bio = screen.getByPlaceholderText(/A brief description about yourself/i)
    fireEvent.change(bio, { target: { value: 'Serving Broward since 2019.' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => {
      const call = mockAuthFetch.mock.calls.find((c) => c[0] === '/api/my-card')
      expect(call).toBeDefined()
      expect(JSON.parse(call![1].body).bio).toBe('Serving Broward since 2019.')
    })
  })

  it('hides itself when the Vault route is absent, leaving My Card usable', async () => {
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === `${VAULT_API_URL}/agent/marketing-profile`) {
        return { ok: false, status: 404, headers: { get: () => 'text/html' }, json: async () => { throw new Error('html') } }
      }
      return json({ success: true })
    })
    render(<BusinessCardPage />)
    expect(await screen.findByRole('heading', { name: 'My Business Card' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Marketing Card' })).not.toBeInTheDocument())
  })
})

describe('My Card — asking the brokerage for a card', () => {
  it('mounts the request panel, so the ask is reachable from My Card', async () => {
    render(<BusinessCardPage />)
    expect(await screen.findByRole('heading', { name: 'Your brokerage card' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Request a card/i })).toBeInTheDocument()
    expect(mockAuthFetch).toHaveBeenCalledWith(
      `${VAULT_API_URL}/agent/card-request`,
      expect.objectContaining({ method: 'GET', credentials: 'omit' }),
    )
  })

  it('both panels mount together — asking and supplying a headshot are one journey', async () => {
    render(<BusinessCardPage />)
    expect(await screen.findByRole('heading', { name: 'Your brokerage card' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Marketing Card' })).toBeInTheDocument()
  })
})
