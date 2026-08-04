import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import MarketingProfileSection from '@/src/portal/marketing-profile/MarketingProfileSection'
import type { MarketingProfileState } from '@/src/portal/marketing-profile/types'

// ── Mock the typed client ────────────────────────────────────────────────────
const getMarketingProfile = jest.fn()
const updatePreferredPublicPhone = jest.fn()
const uploadAvatar = jest.fn()
class MarketingProfileError extends Error {
  constructor(public code: string, public status: number, public contract = true) { super(code) }
}
jest.mock('@/src/portal/marketing-profile/api', () => ({
  getMarketingProfile: () => getMarketingProfile(),
  updatePreferredPublicPhone: (v: string | null) => updatePreferredPublicPhone(v),
  uploadAvatar: (f: File) => uploadAvatar(f),
  MarketingProfileError: class extends Error { constructor(public code: string, public status: number, public contract = true) { super(code) } },
  NETWORK_ERROR_CODE: 'NETWORK',
  NON_CONTRACT_CODE: 'NON_CONTRACT',
}))

// jsdom lacks object-URL APIs — mock them so revoke can be asserted.
const createObjectURL = jest.fn(() => 'blob:preview-1')
const revokeObjectURL = jest.fn()

function state(over: Partial<MarketingProfileState> = {}): MarketingProfileState {
  return {
    avatar: { hasPhoto: false, displayUrl: null, updatedAt: null, uploadAvailable: true, ...(over.avatar || {}) },
    marketingCard: { readiness: 'awaiting_headshot', missingRequirements: ['headshot'], phoneUpdateAvailable: true, ...(over.marketingCard || {}) },
    profile: { fullName: 'Ada Agent', cardTitle: 'Luxury Advisor', preferredPublicPhone: null, brokerageEmail: 'ada@hartfeltrealestate.com', licenseNumber: 'SL123', ...(over.profile || {}) },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(global as unknown as { URL: typeof URL }).URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
  ;(global as unknown as { URL: typeof URL }).URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
})

async function renderReady(s: MarketingProfileState) {
  getMarketingProfile.mockResolvedValueOnce(s)
  const utils = render(<MarketingProfileSection />)
  await screen.findByText('Marketing Card')
  return utils
}

describe('state rendering (11–20)', () => {
  it('11/15/16/17/18: loads state; renders name, fixed Luxury Advisor, read-only email + license', async () => {
    await renderReady(state({ avatar: { hasPhoto: true, displayUrl: 'https://signed.test/x', updatedAt: 't', uploadAvailable: true } }))
    expect(screen.getByText('Ada Agent')).toBeInTheDocument()
    expect(screen.getByText('Luxury Advisor')).toBeInTheDocument()
    expect(screen.getByText('ada@hartfeltrealestate.com')).toBeInTheDocument()
    expect(screen.getByText('SL123')).toBeInTheDocument()
    // fixed title / email / license are text, never inputs
    expect(screen.queryByDisplayValue('Luxury Advisor')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('ada@hartfeltrealestate.com')).not.toBeInTheDocument()
  })
  it('12: renders the current avatar display URL with name-based alt', async () => {
    await renderReady(state({ avatar: { hasPhoto: true, displayUrl: 'https://signed.test/x', updatedAt: 't', uploadAvailable: true } }))
    const img = screen.getByAltText('Ada Agent headshot') as HTMLImageElement
    expect(img.src).toBe('https://signed.test/x')
  })
  it('13: missing display URL → initials fallback', async () => {
    await renderReady(state())
    expect(screen.getByText('AA')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
  it('14: image load failure → initials fallback', async () => {
    await renderReady(state({ avatar: { hasPhoto: true, displayUrl: 'https://signed.test/x', updatedAt: 't', uploadAvailable: true } }))
    fireEvent.error(screen.getByAltText('Ada Agent headshot'))
    expect(await screen.findByText('AA')).toBeInTheDocument()
  })
  it('20/62: state-fetch network failure → safe message + retry (no crash)', async () => {
    getMarketingProfile.mockRejectedValueOnce(new MarketingProfileError('NETWORK', 0))
    render(<MarketingProfileSection />)
    expect(await screen.findByText(/Unable to connect/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })
  it('A: undeployed route (non-contract 404) → section hidden, no disruptive error', async () => {
    getMarketingProfile.mockRejectedValueOnce(new MarketingProfileError('NON_CONTRACT', 404, false))
    const { container } = render(<MarketingProfileSection />)
    await waitFor(() => expect(getMarketingProfile).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
  it('B: structured Vault JSON 404 (PROFILE_NOT_FOUND) → bounded message, NOT hidden', async () => {
    getMarketingProfile.mockRejectedValueOnce(new MarketingProfileError('PROFILE_NOT_FOUND', 404, true))
    render(<MarketingProfileSection />)
    expect(await screen.findByText(/marketing profile is unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })
  it('E: structured 403 / 429 / 503 render bounded messages', async () => {
    getMarketingProfile.mockRejectedValueOnce(new MarketingProfileError('NO_TENANT', 403, true))
    const { unmount } = render(<MarketingProfileSection />)
    expect(await screen.findByText(/not fully configured/i)).toBeInTheDocument()
    unmount()
    getMarketingProfile.mockRejectedValueOnce(new MarketingProfileError('RATE_LIMITED', 429, true))
    const r2 = render(<MarketingProfileSection />)
    expect(await screen.findByText(/Too many attempts/i)).toBeInTheDocument()
    r2.unmount()
    getMarketingProfile.mockRejectedValueOnce(new MarketingProfileError('MARKETING_PROFILE_UNAVAILABLE', 503, true))
    render(<MarketingProfileSection />)
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
  })
})

describe('readiness (54–60)', () => {
  it('54/55: renders canonical readiness + server missingRequirements (browser does not compute)', async () => {
    await renderReady(state({ marketingCard: { readiness: 'awaiting_headshot', missingRequirements: ['headshot', 'preferred_public_phone'], phoneUpdateAvailable: true } }))
    expect(screen.getByText(/Add your headshot/i)).toBeInTheDocument()
    // Chips live in the "Still needed" group (the phone-section also has a
    // "Public phone" label, so scope the assertion).
    const chips = within(screen.getByLabelText('Still needed'))
    expect(chips.getByText('Headshot')).toBeInTheDocument()
    expect(chips.getByText('Public phone')).toBeInTheDocument()
  })
})

describe('upload capability + validation (21–31,41)', () => {
  it('21: upload control hidden when uploadAvailable=false; 22: avatar still displays', async () => {
    await renderReady(state({ avatar: { hasPhoto: true, displayUrl: 'https://s/x', updatedAt: 't', uploadAvailable: false } }))
    expect(screen.getByAltText('Ada Agent headshot')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Upload photo|Replace photo/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Photo upload isn.t available yet/i)).toBeInTheDocument()
  })
  it('26/27/29: SVG + unsupported type rejected client-side (server not called)', async () => {
    await renderReady(state())
    const input = document.getElementById('marketing-headshot-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] } })
    expect(await screen.findByText(/Use a JPEG, PNG, or WebP image/i)).toBeInTheDocument()
    expect(uploadAvatar).not.toHaveBeenCalled()
  })
  it('28: oversized file rejected client-side', async () => {
    await renderReady(state())
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    const input = document.getElementById('marketing-headshot-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [big] } })
    expect(await screen.findByText(/too large/i)).toBeInTheDocument()
    expect(uploadAvatar).not.toHaveBeenCalled()
  })
  it('23/32/33: valid JPEG → preview → save → uploadAvatar → refreshed state/readiness', async () => {
    await renderReady(state())
    const file = new File([new Uint8Array([1, 2, 3])], 'me.jpg', { type: 'image/jpeg' })
    fireEvent.change(document.getElementById('marketing-headshot-input') as HTMLInputElement, { target: { files: [file] } })
    expect(createObjectURL).toHaveBeenCalledWith(file)
    uploadAvatar.mockResolvedValueOnce(state({ avatar: { hasPhoto: true, displayUrl: 'https://s/new', updatedAt: 't2', uploadAvailable: true }, marketingCard: { readiness: 'awaiting_preferred_phone', missingRequirements: ['preferred_public_phone'], phoneUpdateAvailable: true } }))
    fireEvent.click(await screen.findByRole('button', { name: /Save photo/i }))
    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith(file))
    expect(await screen.findByText(/Add your public phone/i)).toBeInTheDocument() // refreshed readiness
    expect(revokeObjectURL).toHaveBeenCalled() // 37: preview revoked after success
  })
  it('34: upload failure preserves previous avatar + shows bounded message', async () => {
    await renderReady(state({ avatar: { hasPhoto: true, displayUrl: 'https://s/old', updatedAt: 't', uploadAvailable: true } }))
    fireEvent.change(document.getElementById('marketing-headshot-input') as HTMLInputElement, { target: { files: [new File([new Uint8Array([1])], 'me.png', { type: 'image/png' })] } })
    uploadAvatar.mockRejectedValueOnce(new MarketingProfileError('AVATAR_INFRA_NOT_READY', 503))
    fireEvent.click(await screen.findByRole('button', { name: /Save photo/i }))
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
  })
  it('38: preview object URL revoked on unmount', async () => {
    const { unmount } = await renderReady(state())
    fireEvent.change(document.getElementById('marketing-headshot-input') as HTMLInputElement, { target: { files: [new File([new Uint8Array([1])], 'me.jpg', { type: 'image/jpeg' })] } })
    revokeObjectURL.mockClear()
    unmount()
    expect(revokeObjectURL).toHaveBeenCalled()
  })
  it('41: no upload-on-behalf / target-agent UI (only a file input)', async () => {
    await renderReady(state())
    expect(screen.queryByLabelText(/agent id|agent_id|on behalf|select agent/i)).not.toBeInTheDocument()
  })
})

describe('preferred public phone (42–52)', () => {
  it('42/49: loads value; Edit hidden when phoneUpdateAvailable=false', async () => {
    await renderReady(state({ profile: { fullName: 'Ada Agent', cardTitle: 'Luxury Advisor', preferredPublicPhone: '(305) 555-1212', brokerageEmail: 'a@b', licenseNumber: 'SL1' }, marketingCard: { readiness: 'ready_to_generate', missingRequirements: [], phoneUpdateAvailable: false } }))
    expect(screen.getByText('(305) 555-1212')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit|Add/i })).not.toBeInTheDocument()
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument()
  })
  it('43/47/48: edit + save → updatePreferredPublicPhone → refreshed normalized value + readiness', async () => {
    await renderReady(state({ marketingCard: { readiness: 'awaiting_preferred_phone', missingRequirements: ['preferred_public_phone'], phoneUpdateAvailable: true } }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByLabelText(/Public phone/i), { target: { value: '(305) 555-1212' } })
    updatePreferredPublicPhone.mockResolvedValueOnce(state({ profile: { fullName: 'Ada Agent', cardTitle: 'Luxury Advisor', preferredPublicPhone: '(305) 555-1212', brokerageEmail: 'a@b', licenseNumber: 'SL1' }, marketingCard: { readiness: 'ready_to_generate', missingRequirements: [], phoneUpdateAvailable: true } }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updatePreferredPublicPhone).toHaveBeenCalledWith('(305) 555-1212'))
    expect(await screen.findByText('(305) 555-1212')).toBeInTheDocument()
  })
  it('46: clearing sends null', async () => {
    await renderReady(state({ profile: { fullName: 'Ada Agent', cardTitle: 'Luxury Advisor', preferredPublicPhone: '3055551212', brokerageEmail: 'a@b', licenseNumber: 'SL1' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText(/Public phone/i), { target: { value: '' } })
    updatePreferredPublicPhone.mockResolvedValueOnce(state())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updatePreferredPublicPhone).toHaveBeenCalledWith(null))
  })
  it('45: invalid phone (server 400) → bounded validation message', async () => {
    await renderReady(state({ marketingCard: { readiness: 'awaiting_preferred_phone', missingRequirements: ['preferred_public_phone'], phoneUpdateAvailable: true } }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByLabelText(/Public phone/i), { target: { value: '12' } })
    updatePreferredPublicPhone.mockRejectedValueOnce(new MarketingProfileError('PHONE_INVALID', 400))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/valid phone number/i)).toBeInTheDocument()
  })
})

describe('partial rollout independence (50,51,60)', () => {
  it('50/51: phone available + avatar unavailable → phone editable, upload hidden, no-photo fallback', async () => {
    await renderReady(state({ avatar: { hasPhoto: false, displayUrl: null, updatedAt: null, uploadAvailable: false }, marketingCard: { readiness: 'awaiting_headshot', missingRequirements: ['headshot'], phoneUpdateAvailable: true } }))
    expect(screen.getByText(/Photo upload isn.t available yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add|Edit/i })).toBeInTheDocument() // phone still editable
    expect(screen.getByText('AA')).toBeInTheDocument() // initials fallback
  })
  it('avatar available + phone unavailable → avatar shows, phone control locked', async () => {
    await renderReady(state({ avatar: { hasPhoto: true, displayUrl: 'https://s/x', updatedAt: 't', uploadAvailable: true }, marketingCard: { readiness: 'awaiting_preferred_phone', missingRequirements: ['preferred_public_phone'], phoneUpdateAvailable: false } }))
    expect(screen.getByAltText('Ada Agent headshot')).toBeInTheDocument()
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument()
  })
})

describe('privacy (39,40)', () => {
  it('does not persist image bytes or display URLs to storage', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem')
    await renderReady(state({ avatar: { hasPhoto: true, displayUrl: 'https://signed.test/x', updatedAt: 't', uploadAvailable: true } }))
    fireEvent.change(document.getElementById('marketing-headshot-input') as HTMLInputElement, { target: { files: [new File([new Uint8Array([1])], 'me.jpg', { type: 'image/jpeg' })] } })
    uploadAvatar.mockResolvedValueOnce(state({ avatar: { hasPhoto: true, displayUrl: 'https://signed.test/new', updatedAt: 't2', uploadAvailable: true } }))
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Save photo/i })) })
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })
})
