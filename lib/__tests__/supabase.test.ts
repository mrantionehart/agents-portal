/**
 * @jest-environment jsdom
 */
// ============================================================================
// PORTAL.1A — cached-token authFetch / getAccessToken tests
// ============================================================================
// Verifies the fix for the getSession() LockManager hang: the request path
// must attach the CACHED access token (from onAuthStateChange) and must NEVER
// call getSession(); plus a bounded 401 refresh-and-retry self-heal.
// ============================================================================

// ── Mock @supabase/ssr with a stable, controllable auth client ─────────────
// createBrowserClient is called once at module load in lib/supabase.ts, so we
// return a single shared `auth` whose onAuthStateChange callbacks we can fire.
jest.mock('@supabase/ssr', () => {
  const callbacks: Array<(event: string, session: unknown) => void> = []
  let refreshImpl = async () => ({ data: { session: null }, error: null } as unknown)
  const getSessionSpy = jest.fn(async () => ({ data: { session: null }, error: null }))
  const refreshSpy = jest.fn(() => refreshImpl())

  const auth = {
    getSession: getSessionSpy,
    refreshSession: refreshSpy,
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      callbacks.push(cb)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const i = callbacks.indexOf(cb)
              if (i >= 0) callbacks.splice(i, 1)
            },
          },
        },
      }
    },
  }

  return {
    createBrowserClient: () => ({ auth }),
    // test-only handles (prefixed so jest's out-of-scope guard allows them)
    __getSessionSpy: getSessionSpy,
    __refreshSpy: refreshSpy,
    __setRefresh: (fn: () => Promise<unknown>) => {
      refreshImpl = fn
    },
    __trigger: (event: string, session: unknown) => {
      for (const cb of [...callbacks]) cb(event, session)
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ssrMock = require('@supabase/ssr') as {
  __getSessionSpy: jest.Mock
  __refreshSpy: jest.Mock
  __setRefresh: (fn: () => Promise<unknown>) => void
  __trigger: (event: string, session: unknown) => void
}

import { authFetch, getAccessToken, getCachedAccessToken } from '../supabase'

function mockFetchOnce(status: number) {
  return (global.fetch as jest.Mock).mockResolvedValueOnce({
    status,
    ok: status < 400,
  } as Response)
}

function lastFetchAuthHeader(callIndex = 0): string | null {
  const call = (global.fetch as jest.Mock).mock.calls[callIndex]
  const headers = call[1].headers as Headers
  return headers.get('Authorization')
}

beforeEach(() => {
  global.fetch = jest.fn()
  ssrMock.__getSessionSpy.mockClear()
  ssrMock.__refreshSpy.mockClear()
  ssrMock.__setRefresh(async () => ({ data: { session: null }, error: null }))
  // Reset the module-level cache to a known-empty state.
  ssrMock.__trigger('SIGNED_OUT', null)
})

// ── cache maintenance from onAuthStateChange ───────────────────────────────
describe('PORTAL.1A — token cache from onAuthStateChange', () => {
  it('INITIAL_SESSION updates the cache', () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'INIT' })
    expect(getCachedAccessToken()).toBe('INIT')
  })

  it('SIGNED_IN updates the cache', () => {
    ssrMock.__trigger('SIGNED_IN', { access_token: 'SIGNIN' })
    expect(getCachedAccessToken()).toBe('SIGNIN')
  })

  it('TOKEN_REFRESHED updates the cache', () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'OLD' })
    ssrMock.__trigger('TOKEN_REFRESHED', { access_token: 'NEW' })
    expect(getCachedAccessToken()).toBe('NEW')
  })

  it('SIGNED_OUT clears the cache', () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'TOK' })
    expect(getCachedAccessToken()).toBe('TOK')
    ssrMock.__trigger('SIGNED_OUT', null)
    expect(getCachedAccessToken()).toBeUndefined()
  })
})

// ── authFetch hot path ─────────────────────────────────────────────────────
describe('PORTAL.1A — authFetch attaches cached token, never getSession()', () => {
  it('cached token present → Authorization header is set', async () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'TOK123' })
    mockFetchOnce(200)

    const res = await authFetch('/api/x')

    expect(res.status).toBe(200)
    expect(lastFetchAuthHeader()).toBe('Bearer TOK123')
  })

  it('does NOT call getSession() on the hot path', async () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'TOK123' })
    mockFetchOnce(200)

    await authFetch('/api/x')

    expect(ssrMock.__getSessionSpy).not.toHaveBeenCalled()
  })

  it('empty cache + later listener event attaches the token', async () => {
    // Cache is cold (beforeEach cleared it). Start the request, then hydrate.
    mockFetchOnce(200)
    const p = authFetch('/api/x')
    // Simulate the browser client hydrating its session shortly after.
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'LATE' })

    const res = await p
    expect(res.status).toBe(200)
    expect(lastFetchAuthHeader()).toBe('Bearer LATE')
    expect(ssrMock.__getSessionSpy).not.toHaveBeenCalled()
  })

  it('empty cache + no listener event → tokenless request, no hang', async () => {
    jest.useFakeTimers()
    try {
      mockFetchOnce(200)
      const p = authFetch('/api/x')
      // No auth event fires; getAccessToken must give up at its bound (2000ms).
      await jest.advanceTimersByTimeAsync(2000)
      const res = await p

      expect(res.status).toBe(200)
      expect(lastFetchAuthHeader()).toBeNull()
      expect(ssrMock.__getSessionSpy).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })
})

// ── 401 self-heal ──────────────────────────────────────────────────────────
describe('PORTAL.1A — 401 refresh-and-retry self-heal', () => {
  it('401 with a used token → refreshSession succeeds → retries once with new token', async () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'STALE' })
    mockFetchOnce(401)
    mockFetchOnce(200)
    ssrMock.__setRefresh(async () => ({
      data: { session: { access_token: 'FRESH' } },
      error: null,
    }))

    const res = await authFetch('/api/x')

    expect(ssrMock.__refreshSpy).toHaveBeenCalledTimes(1)
    expect((global.fetch as jest.Mock)).toHaveBeenCalledTimes(2)
    expect(lastFetchAuthHeader(0)).toBe('Bearer STALE')
    expect(lastFetchAuthHeader(1)).toBe('Bearer FRESH')
    expect(res.status).toBe(200)
    // cache is updated to the refreshed token
    expect(getCachedAccessToken()).toBe('FRESH')
  })

  it('401 + refreshSession fails → no retry, surfaces original 401', async () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'STALE' })
    mockFetchOnce(401)
    ssrMock.__setRefresh(async () => ({
      data: { session: null },
      error: new Error('refresh failed'),
    }))

    const res = await authFetch('/api/x')

    expect(ssrMock.__refreshSpy).toHaveBeenCalledTimes(1)
    expect((global.fetch as jest.Mock)).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(401)
  })

  it('401 with NO token (logged-out) → does not attempt refresh', async () => {
    // cache cold; no listener → tokenless request that 401s must not refresh.
    jest.useFakeTimers()
    try {
      mockFetchOnce(401)
      const p = authFetch('/api/x')
      await jest.advanceTimersByTimeAsync(2000)
      const res = await p

      expect(res.status).toBe(401)
      expect(ssrMock.__refreshSpy).not.toHaveBeenCalled()
      expect((global.fetch as jest.Mock)).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })
})

// ── getAccessToken helper ──────────────────────────────────────────────────
describe('PORTAL.1A — getAccessToken bounded behavior', () => {
  it('returns cached token synchronously without waiting', async () => {
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'CACHED' })
    await expect(getAccessToken(50)).resolves.toBe('CACHED')
  })

  it('cold cache + no event resolves undefined within the bound (no hang)', async () => {
    await expect(getAccessToken(50)).resolves.toBeUndefined()
  })
})
