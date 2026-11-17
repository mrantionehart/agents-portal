/** @jest-environment node */
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { GET } from '@/app/auth/confirm/route'
import { middleware } from '@/middleware'

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
const createClient = createServerClient as jest.Mock
const verifyOtp = jest.fn()
const getUser = jest.fn()

function request(params: Record<string, string> = {}) {
  const url = new URL('https://ap.example/auth/confirm')
  url.search = new URLSearchParams(params).toString()
  return new NextRequest(url, { headers: { cookie: 'existing=session' } })
}
const valid = { token_hash: 'secret-token', type: 'magiclink' }
const invalidUrl = 'https://ap.example/login?error=link_invalid_or_expired'

beforeEach(() => {
  jest.clearAllMocks()
  verifyOtp.mockReset().mockResolvedValue({ error: null })
  getUser.mockResolvedValue({ data: { user: null } })
  createClient.mockReturnValue({ auth: { verifyOtp, getUser } })
})

it.each(['magiclink', 'email', 'recovery', 'invite'])('verifies %s with exact arguments and redirects to next', async (type) => {
  const response = await GET(request({ ...valid, type, next: '/dashboard?tab=one' }))
  expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: 'secret-token' })
  expect(response.headers.get('location')).toBe('https://ap.example/dashboard?tab=one')
  expect(response.headers.get('cache-control')).toBe('no-store')
})

it('reads incoming cookies and writes session cookies onto the redirect', async () => {
  verifyOtp.mockImplementation(async () => {
    const { cookies } = createClient.mock.calls[0][2]
    expect(cookies.get('existing')).toBe('session')
    cookies.set('ap-session', 'verified', { httpOnly: true, path: '/' })
    cookies.remove('old-session', { path: '/', maxAge: 0 })
    return { error: null }
  })
  const response = await GET(request(valid))
  expect(response.cookies.get('ap-session')?.value).toBe('verified')
  expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  expect(response.cookies.get('old-session')?.value).toBe('')
})

it.each([
  '//evil.example', '/\\evil.example', '\\evil.example', 'https://evil.example',
  'javascript:alert(1)', 'dashboard', '/path\\evil', '/path\r\nLocation:evil',
  '%2f%2fevil.example', '/%2fevil.example', '/%5cevil.example', '/path%0d%0aevil',
  '/%252fevil.example', '/%255cevil.example', '/path%250aevil', '/bad%encoding',
])('rejects unsafe next %j', async (next) => {
  const response = await GET(request({ ...valid, next }))
  expect(response.headers.get('location')).toBe('https://ap.example/')
})

it.each([
  {}, { type: 'email' }, { token_hash: 'secret-token' },
  { ...valid, type: '' }, { ...valid, type: 'sms' }, { ...valid, type: 'signup' },
  { ...valid, type: 'MAGICLINK' }, { ...valid, token_hash: '' },
])('rejects missing or invalid credentials %j', async (params) => {
  const response = await GET(request(params))
  expect(response.headers.get('location')).toBe(invalidUrl)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(createClient).not.toHaveBeenCalled()
})

it.each(['error', 'throw'])('handles verification failure: %s', async (mode) => {
  if (mode === 'throw') verifyOtp.mockRejectedValue(new Error('secret-token'))
  else verifyOtp.mockResolvedValue({ error: { message: 'secret-token' } })
  const response = await GET(request(valid))
  expect(response.headers.get('location')).toBe(invalidUrl)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.text()).not.toContain('secret-token')
})

it('defaults recovery links to reset-password', async () => {
  const response = await GET(request({ ...valid, type: 'recovery' }))
  expect(response.headers.get('location')).toBe('https://ap.example/reset-password')
})

it('treats only the exact confirmation path as public', async () => {
  const response = await middleware(request(valid))
  expect(response.headers.get('location')).toBeNull()
  expect(createClient).not.toHaveBeenCalled()
  for (const path of ['/auth/confirmX', '/auth/confirm/x']) {
    const protectedResponse = await middleware(new NextRequest(`https://ap.example${path}`))
    expect(new URL(protectedResponse.headers.get('location')!).pathname).toBe('/login')
  }
  expect(getUser).toHaveBeenCalledTimes(2)
})

it.each([
  { is_active: false },
  { is_active: true, suspended_at: '2026-01-01' },
  { is_active: true, deleted_at: '2026-01-01' },
])('keeps the standing gate on the next protected request: %j', async (profile) => {
  await GET(request(valid))
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  createClient.mockReturnValue({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile }) }) }) }),
  })
  const response = await middleware(new NextRequest('https://ap.example/dashboard'))
  expect(response.headers.get('location')).toBe('https://ap.example/pending-activation')
})
