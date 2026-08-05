// Regression: the AuthProvider must NEVER call a lock-acquiring Supabase method
// (getSession / getUser / .from()) inside its onAuthStateChange callback. GoTrue
// invokes that callback while holding the `sb-<ref>-auth-token` navigator Web
// Lock, so a re-entrant call deadlocks it — which hung the profile page's
// fetchProfile (aggravated across tabs). Role is resolved lock-free via
// /api/auth/me instead.
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

let authCallback: ((event: string, session: unknown) => void) | undefined
const fromMock = jest.fn()
const getSessionMock = jest.fn()
const getUserMock = jest.fn()
const unsubscribe = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe } } }
      },
      signOut: jest.fn(async () => {}),
      // Lock-acquiring methods — the callback must NEVER touch these:
      getSession: (...a: unknown[]) => { getSessionMock(...a); return Promise.resolve({ data: { session: null } }) },
      getUser: (...a: unknown[]) => { getUserMock(...a); return Promise.resolve({ data: { user: null } }) },
    },
    from: (...a: unknown[]) => { fromMock(...a); return { select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) } },
  },
  authFetch: jest.fn(async () => ({ ok: true, json: async () => ({ gateOpen: true, vol1: {}, vol2: {} }) })),
}))
jest.mock('@/src/portal/tour/persistence-learner', () => ({ clearAllLearnerResumeForUser: jest.fn() }))

import { AuthProvider, useAuth } from '../providers'

function Probe() {
  const { user, role, loading } = useAuth()
  return <div data-testid="probe">{`loading:${loading}|user:${user?.id ?? 'none'}|role:${role ?? 'none'}`}</div>
}

beforeEach(() => {
  authCallback = undefined
  fromMock.mockClear(); getSessionMock.mockClear(); getUserMock.mockClear()
  global.fetch = jest.fn(async (url: unknown) => {
    const u = String(url)
    if (u.includes('/api/auth/me')) {
      return { ok: true, json: async () => ({ user: { id: 'u1', email: 'a@b.co' }, role: 'agent' }) }
    }
    if (u.includes('/api/training/gate')) {
      return { ok: true, json: async () => ({ gateOpen: true, vol1: {}, vol2: {} }) }
    }
    return { ok: false, json: async () => ({}) }
  }) as unknown as typeof fetch
})

async function flush() { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

describe('AuthProvider — no auth-lock deadlock (regression)', () => {
  it('resolves initial auth via /api/auth/me and never blocks (loading → false)', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('loading:false'))
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', expect.any(Object))
  })

  it('onAuthStateChange callback NEVER calls a lock-acquiring Supabase method', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(authCallback).toBeDefined())
    await act(async () => { authCallback?.('SIGNED_IN', { user: { id: 'u1', email: 'a@b.co' } }) })
    await flush() // let the deferred macrotask (setTimeout 0) run
    // The deadlock guard: no getSession / getUser / .from() from inside the callback.
    expect(fromMock).not.toHaveBeenCalled()
    expect(getSessionMock).not.toHaveBeenCalled()
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('resolves role from /api/auth/me (lock-free), not the client DB', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(authCallback).toBeDefined())
    ;(global.fetch as jest.Mock).mockClear()
    await act(async () => { authCallback?.('SIGNED_IN', { user: { id: 'u1', email: 'a@b.co' } }) })
    await flush()
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me')
    expect(screen.getByTestId('probe')).toHaveTextContent('role:agent')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('a null session (sign-out) clears role without any DB call', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(authCallback).toBeDefined())
    await act(async () => { authCallback?.('SIGNED_OUT', null) })
    await flush()
    expect(screen.getByTestId('probe')).toHaveTextContent('role:none')
    expect(fromMock).not.toHaveBeenCalled()
  })
})
