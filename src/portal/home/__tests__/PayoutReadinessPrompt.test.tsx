import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PayoutReadinessPrompt from '@/src/portal/home/PayoutReadinessPrompt'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const res = (readiness: string, ok = true) => ({ ok, json: async () => ({ readiness }) })

beforeEach(() => {
  jest.clearAllMocks()
  try { sessionStorage.clear() } catch { /* jsdom has it */ }
})

describe('PayoutReadinessPrompt', () => {
  it('renders nothing while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    const { container } = render(<PayoutReadinessPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides when payout-ready', async () => {
    mockFetch.mockResolvedValue(res('ready'))
    const { container } = render(<PayoutReadinessPrompt />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('hides when payouts not configured on the brokerage', async () => {
    mockFetch.mockResolvedValue(res('not_configured'))
    const { container } = render(<PayoutReadinessPrompt />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('hides on a non-ok response (fail silently)', async () => {
    mockFetch.mockResolvedValue(res('not_started', false))
    const { container } = render(<PayoutReadinessPrompt />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the setup prompt when not_started, CTA → /settings', async () => {
    mockFetch.mockResolvedValue(res('not_started'))
    render(<PayoutReadinessPrompt />)
    expect(await screen.findByText('Finish Your Commission Payout Setup')).toBeInTheDocument()
    const cta = screen.getByText('Set Up Payouts')
    expect(cta.closest('a')).toHaveAttribute('href', '/settings')
  })

  it('shows a verification prompt when pending_verification', async () => {
    mockFetch.mockResolvedValue(res('pending_verification'))
    render(<PayoutReadinessPrompt />)
    expect(await screen.findByText('Stripe Verification In Progress')).toBeInTheDocument()
    expect(screen.getByText('Check Status')).toBeInTheDocument()
  })

  it('Maybe Later snoozes it away', async () => {
    mockFetch.mockResolvedValue(res('incomplete'))
    const { container } = render(<PayoutReadinessPrompt />)
    fireEvent.click(await screen.findByText('Maybe Later'))
    expect(container).toBeEmptyDOMElement()
    expect(sessionStorage.getItem('hf_payout_readiness_prompt_dismissed')).toBe('1')
  })

  it('stays hidden when already snoozed', async () => {
    sessionStorage.setItem('hf_payout_readiness_prompt_dismissed', '1')
    mockFetch.mockResolvedValue(res('not_started'))
    const { container } = render(<PayoutReadinessPrompt />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
