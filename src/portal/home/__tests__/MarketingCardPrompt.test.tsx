import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import MarketingCardPrompt from '@/src/portal/home/MarketingCardPrompt'

// next/link → plain anchor so we can assert the CTA destination.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

// Reuse the existing companion contract; the prompt never computes readiness.
jest.mock('@/src/portal/marketing-profile/api', () => ({ getMarketingProfile: jest.fn() }))
import { getMarketingProfile } from '@/src/portal/marketing-profile/api'
const mockGet = getMarketingProfile as jest.Mock

const state = (missingRequirements: string[]) => ({
  avatar: { hasPhoto: false, displayUrl: null, updatedAt: null, uploadAvailable: true },
  marketingCard: {
    readiness: missingRequirements.length ? 'awaiting_headshot' : 'ready_to_generate',
    missingRequirements,
    phoneUpdateAvailable: true,
  },
  profile: { fullName: 'QA Tester' },
})

beforeEach(() => {
  jest.clearAllMocks()
  try { sessionStorage.clear() } catch { /* jsdom always has it */ }
})

describe('MarketingCardPrompt', () => {
  it('renders nothing while loading (never blocks the dashboard)', () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<MarketingCardPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides when setup is complete (no missing requirements → ready_to_generate)', async () => {
    mockGet.mockResolvedValue(state([]))
    const { container } = render(<MarketingCardPrompt />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('is visible when setup is incomplete', async () => {
    mockGet.mockResolvedValue(state(['headshot', 'preferred_public_phone']))
    render(<MarketingCardPrompt />)
    expect(await screen.findByText('Complete Your Marketing Card')).toBeInTheDocument()
    expect(screen.getByText('Finish your profile so your broker can generate your marketing card.')).toBeInTheDocument()
  })

  it('renders missingRequirements as friendly labels (from the server list)', async () => {
    mockGet.mockResolvedValue(state(['headshot', 'preferred_public_phone', 'license_number']))
    render(<MarketingCardPrompt />)
    expect(await screen.findByText('Add a headshot')).toBeInTheDocument()
    expect(screen.getByText('Add your public phone')).toBeInTheDocument()
    expect(screen.getByText('Add your license')).toBeInTheDocument()
  })

  it('CTA navigates to /profile', async () => {
    mockGet.mockResolvedValue(state(['headshot']))
    render(<MarketingCardPrompt />)
    const cta = await screen.findByRole('link', { name: 'Complete Now' })
    expect(cta.getAttribute('href')).toBe('/profile')
  })

  it('dismissal hides it and persists the snooze in sessionStorage', async () => {
    mockGet.mockResolvedValue(state(['headshot']))
    const { container } = render(<MarketingCardPrompt />)
    await screen.findByText('Complete Your Marketing Card')
    fireEvent.click(screen.getByRole('button', { name: 'Maybe Later' }))
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(sessionStorage.getItem('hf_marketing_card_prompt_dismissed')).toBe('1')
  })

  it('stays hidden within the same session once snoozed', async () => {
    sessionStorage.setItem('hf_marketing_card_prompt_dismissed', '1')
    mockGet.mockResolvedValue(state(['headshot']))
    const { container } = render(<MarketingCardPrompt />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('reappears in a new session when still incomplete (snooze cleared)', async () => {
    // simulate a prior session's snooze, then a fresh session
    sessionStorage.setItem('hf_marketing_card_prompt_dismissed', '1')
    sessionStorage.clear()
    mockGet.mockResolvedValue(state(['headshot']))
    render(<MarketingCardPrompt />)
    expect(await screen.findByText('Complete Your Marketing Card')).toBeInTheDocument()
  })

  it('hides on error (ineligible / network / non-contract)', async () => {
    mockGet.mockRejectedValue(new Error('403'))
    const { container } = render(<MarketingCardPrompt />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
