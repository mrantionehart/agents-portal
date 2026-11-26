// FINSEC closeout — the last client-set identity headers. NotificationsPanel
// and the Development Radar page sent `X-User-ID` (Radar's was a random
// localStorage id) to Vault. Vault trusts only the Supabase Bearer JWT, so
// these calls now go through authFetch and carry no X-User-* header.
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockAuthFetch = authFetch as jest.Mock

import NotificationsPanel from '@/app/components/NotificationsPanel'
import DevelopmentRadarPage from '@/app/development-radar/page'

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const names = (init?: RequestInit) => {
  const h = init?.headers
  if (!h) return []
  if (h instanceof Headers) return Array.from(h.keys()).map((k) => k.toLowerCase())
  return Object.keys(h as Record<string, string>).map((k) => k.toLowerCase())
}
let rawFetch: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthFetch.mockResolvedValue(ok({ notifications: [], data: [], presales: [], alerts: [] }))
  rawFetch = jest.fn(async () => ok({ data: [] }))
  global.fetch = rawFetch as unknown as typeof fetch
})

function expectNoIdentityHeaders() {
  for (const [, init] of [...mockAuthFetch.mock.calls, ...rawFetch.mock.calls]) {
    expect(names(init)).not.toContain('x-user-id')
    expect(names(init)).not.toContain('x-user-role')
  }
}

it('NotificationsPanel loads /notifications through authFetch with no X-User-ID', async () => {
  render(<NotificationsPanel userId="agent-1" role="agent" />)
  await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled())
  expect(mockAuthFetch.mock.calls[0][0]).toMatch(/\/notifications$/)
  expect(rawFetch.mock.calls.some(([u]) => String(u).includes('/notifications'))).toBe(false)
  expectNoIdentityHeaders()
})

it('Development Radar: saved list and Pre-Sales calls go through authFetch with no X-User-ID', async () => {
  render(<DevelopmentRadarPage />)
  await waitFor(() =>
    expect(mockAuthFetch.mock.calls.some(([u]) => /\/development-radar\/saves$/.test(u))).toBe(true),
  )
  const preSalesTab = screen.getAllByRole('button').find((b) => b.textContent?.trim() === 'Pre-Sales')
  expect(preSalesTab).toBeDefined()
  fireEvent.click(preSalesTab!)
  await waitFor(() =>
    expect(mockAuthFetch.mock.calls.some(([u]) => /\/development-radar\/presales$/.test(u))).toBe(true),
  )
  expect(mockAuthFetch.mock.calls.some(([u]) => /\/presales\/notify\?limit=20$/.test(u))).toBe(true)
  expectNoIdentityHeaders()
})
