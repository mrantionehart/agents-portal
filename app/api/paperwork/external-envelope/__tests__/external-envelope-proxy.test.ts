/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL · the proxy must carry the BODY — real handler
// ============================================================================
// 🔑🔑 [XAP-3] IS WHY THIS FILE EXISTS. The sibling compliance-review proxy
// sends no body, correctly, because that endpoint takes none. Copying it for
// an endpoint whose entire payload IS the body is a defect this codebase has
// shipped before: Vault would receive `{}` and refuse it as a malformed
// envelope ID, which reads to the agent as "your ID is wrong" when in fact it
// never left the browser.
// ============================================================================

import { NextRequest } from 'next/server'

const authState = { fail: false }
const seen: Array<{ url: string; method?: string; body?: string; auth?: string; contentType?: string }> = []
let upstream = { ok: true, status: 200, json: {} as Record<string, unknown> }

jest.mock('@/lib/security', () => ({
  // A plain Response, not NextResponse: requiring next/server inside a
  // jest.mock factory pulls in the edge Request shim and throws before any
  // test runs. The route only returns it, and the test only reads .status.
  requireAuth: async () =>
    authState.fail
      ? {
          response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
        }
      : { user: { id: 'agent-1' } },
}))

jest.mock('@/lib/vault-client', () => ({
  VAULT_API_URL: 'https://vault.test/api',
}))

const TXN = '3fbb0fac-796f-4e93-ba87-e399b55a3abf'
const FI = '35ffc269-4240-400f-9a94-efdde2063094'
const ENV = '37653a88-a887-81f9-8054-a39d821fb0c8'

beforeEach(() => {
  authState.fail = false
  seen.length = 0
  upstream = { ok: true, status: 200, json: { ok: true, status: 'sent', verified: true } }
  global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>
    seen.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? String(init.body) : undefined,
      auth: h.Authorization,
      contentType: h['Content-Type'],
    })
    return {
      ok: upstream.ok,
      status: upstream.status,
      json: async () => upstream.json,
    } as unknown as Response
  }) as unknown as typeof fetch
})

const record = async (body: unknown, auth = 'Bearer tok') => {
  const { POST } = await import(
    '../[transactionId]/[formInstanceId]/route'
  )
  const res = await POST(
    new NextRequest('https://ap.test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ transactionId: TXN, formInstanceId: FI }) },
  )
  return { status: res.status, json: await res.json() }
}

describe('[XAP] external-envelope proxy', () => {
  it('[XAP-1] unauthenticated is refused before Vault is called', async () => {
    authState.fail = true
    const r = await record({ envelope_id: ENV })
    expect(r.status).toBe(401)
    expect(seen).toHaveLength(0)
  })

  it('[XAP-2] it targets Vault\'s external-envelope route for this document', async () => {
    await record({ envelope_id: ENV })
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(
      `https://vault.test/api/paperwork/transactions/${TXN}/documents/${FI}/external-envelope`,
    )
    expect(seen[0].method).toBe('POST')
  })

  it('[XAP-3] THE BODY IS FORWARDED, verbatim', async () => {
    const body = {
      envelope_id: ENV,
      sent_at: '2026-10-30T18:00:00.000Z',
      recipients: [{ email: 'd@example.test', name: 'Daniel Sabag' }],
    }
    await record(body)
    expect(seen[0].body).toBeDefined()
    expect(JSON.parse(String(seen[0].body))).toEqual(body)
    expect(seen[0].contentType).toBe('application/json')
  })

  it('[XAP-4] the caller\'s Authorization is passed through untouched', async () => {
    await record({ envelope_id: ENV }, 'Bearer the-agents-token')
    expect(seen[0].auth).toBe('Bearer the-agents-token')
  })

  it('[XAP-5] Vault\'s status and words are returned unchanged', async () => {
    upstream = {
      ok: false, status: 422,
      json: { error: 'DocuSign does not have that envelope in the connected account.', code: 'not_owned_by_sender' },
    }
    const r = await record({ envelope_id: ENV })
    expect(r.status).toBe(422)
    expect(r.json.code).toBe('not_owned_by_sender')
    expect(r.json.error).toMatch(/connected account/)
  })

  it('[XAP-6] an unreadable Vault response is 502-shaped, not a silent success', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const r = await record({ envelope_id: ENV })
    expect(r.status).toBe(502)
    expect(r.json.error).toMatch(/Could not reach Vault/)
  })

  it('[XAP-7] the refresh proxy sends NO body and names no send surface', async () => {
    const { POST } = await import('../refresh/[envelopeRowId]/route')
    const res = await POST(
      new NextRequest('https://ap.test/x', {
        method: 'POST',
        headers: { authorization: 'Bearer tok' },
      }),
      { params: Promise.resolve({ envelopeRowId: 'row-1' }) },
    )
    expect(res.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(
      'https://vault.test/api/paperwork/envelopes/row-1/external-refresh',
    )
    expect(seen[0].body).toBeUndefined()
    // Nothing on this path may be a send.
    expect(seen[0].url).not.toMatch(/\/send\b/)
  })

  it('[XAP-8] path segments are encoded — no id can carry a path', async () => {
    const { POST } = await import('../refresh/[envelopeRowId]/route')
    await POST(
      new NextRequest('https://ap.test/x', {
        method: 'POST', headers: { authorization: 'Bearer tok' },
      }),
      { params: Promise.resolve({ envelopeRowId: '../../send' }) },
    )
    expect(seen[0].url).toContain('%2F')
    expect(seen[0].url).not.toMatch(/envelopes\/\.\.\//)
  })
})
