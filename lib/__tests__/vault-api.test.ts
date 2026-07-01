/**
 * @jest-environment jsdom
 */
// ============================================================================
// PORTAL.1A — vault-api axios interceptor uses the cached token (not getSession)
// ============================================================================

// Capture the request interceptor axios registers so we can invoke it directly.
// The holder lives inside the mock factory (module side effects run at import
// hoist time, before any top-level `let` is initialized).
type Interceptor = (config: { headers: Record<string, string> }) => Promise<{ headers: Record<string, string> }>

jest.mock('axios', () => {
  const holder: { fn?: Interceptor } = {}
  const instance = {
    interceptors: {
      request: {
        use: (fn: Interceptor) => {
          holder.fn = fn
        },
      },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  }
  return { __esModule: true, default: { create: () => instance }, __holder: holder }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axiosMock = require('axios') as { __holder: { fn?: Interceptor } }
const capturedInterceptor = () => axiosMock.__holder.fn

// Same controllable @supabase/ssr mock as the supabase suite.
jest.mock('@supabase/ssr', () => {
  const callbacks: Array<(event: string, session: unknown) => void> = []
  const getSessionSpy = jest.fn(async () => ({ data: { session: null }, error: null }))
  const auth = {
    getSession: getSessionSpy,
    refreshSession: jest.fn(),
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      callbacks.push(cb)
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
  }
  return {
    createBrowserClient: () => ({ auth }),
    __getSessionSpy: getSessionSpy,
    __trigger: (event: string, session: unknown) => {
      for (const cb of [...callbacks]) cb(event, session)
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ssrMock = require('@supabase/ssr') as {
  __getSessionSpy: jest.Mock
  __trigger: (event: string, session: unknown) => void
}

// Importing vault-api instantiates VaultAPI → registers the interceptor.
import '../vault-api'

describe('PORTAL.1A — vault-api interceptor', () => {
  it('registers a request interceptor', () => {
    expect(typeof capturedInterceptor()).toBe('function')
  })

  it('attaches the cached token and never calls getSession()', async () => {
    ssrMock.__getSessionSpy.mockClear()
    ssrMock.__trigger('INITIAL_SESSION', { access_token: 'VAULT_TOK' })

    const config = { headers: {} as Record<string, string> }
    const out = await capturedInterceptor()!(config)

    expect(out.headers.Authorization).toBe('Bearer VAULT_TOK')
    expect(ssrMock.__getSessionSpy).not.toHaveBeenCalled()
  })

  it('logged-out (no cached token) → no Authorization header', async () => {
    ssrMock.__trigger('SIGNED_OUT', null)
    // getAccessToken will briefly wait then resolve undefined; keep the bound
    // short by not firing an event — jsdom real timers, but this is fast enough
    // because the interceptor awaits getAccessToken(2000). Use fake timers.
    jest.useFakeTimers()
    try {
      const config = { headers: {} as Record<string, string> }
      const p = capturedInterceptor()!(config)
      await jest.advanceTimersByTimeAsync(2000)
      const out = await p
      expect(out.headers.Authorization).toBeUndefined()
    } finally {
      jest.useRealTimers()
    }
  })
})
