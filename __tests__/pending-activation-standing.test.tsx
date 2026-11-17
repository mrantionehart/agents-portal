/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'

let profile: Record<string, unknown> | null = null
let selected = ''
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))
jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.example/api' }))
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ select: (cols: string) => { selected = cols; return { eq: () => ({ single: async () => ({ data: profile, error: null }) }) } } }),
  }),
}))
import PendingActivationPage from '@/app/pending-activation/page'

async function renderPage() { render(await PendingActivationPage()) }

describe('pending-activation uses the shared account-standing predicate', () => {
  it('selects every standing column', async () => {
    profile = { is_active: true, suspended_at: null, deleted_at: null, onboarding_status: null }
    await renderPage()
    expect(selected).toContain('suspended_at'); expect(selected).toContain('deleted_at')
  })
  it('an active account sees the active copy', async () => {
    profile = { is_active: true, suspended_at: null, deleted_at: null, onboarding_status: null }
    await renderPage()
    expect(screen.getByText('Your account is active')).toBeInTheDocument()
  })
  it.each([
    ['suspended', { suspended_at: '2026-11-01T00:00:00Z', deleted_at: null }],
    ['soft-deleted', { suspended_at: null, deleted_at: '2026-11-01T00:00:00Z' }],
  ])('a %s account with is_active=true is NOT told it has full access', async (_l, extra) => {
    profile = { is_active: true, onboarding_status: null, ...extra }
    await renderPage()
    expect(screen.queryByText('Your account is active')).toBeNull()
    expect(screen.getByText(/currently inactive/i)).toBeInTheDocument()
  })
})
