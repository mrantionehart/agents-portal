// Marketing-profile typed client — bearer via canonical authFetch, credentials
// omit, configured Vault origin, only-image/only-phone bodies, error mapping.
import {
  getMarketingProfile, updatePreferredPublicPhone, uploadAvatar,
  MarketingProfileError, NETWORK_ERROR_CODE, NON_CONTRACT_CODE,
} from '@/src/portal/marketing-profile/api'

const authFetch = jest.fn()
// authFetch is the CANONICAL helper that attaches the cached Supabase Bearer
// token (items 1–3) and self-heals 401 — the client delegates to it.
jest.mock('@/lib/supabase', () => ({ authFetch: (...a: unknown[]) => authFetch(...a) }))
jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.test/api' }))

const STATE = {
  avatar: { hasPhoto: true, displayUrl: 'https://signed.test/x', updatedAt: 't', uploadAvailable: true },
  marketingCard: { readiness: 'ready_to_generate', missingRequirements: [], phoneUpdateAvailable: true },
  profile: { fullName: 'Ada A', cardTitle: 'Luxury Advisor', preferredPublicPhone: '(305) 555-1212', brokerageEmail: 'ada@hartfeltrealestate.com', licenseNumber: 'SL1' },
}
const jsonHeaders = { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) }
const okRes = (body: unknown) => ({ ok: true, status: 200, headers: jsonHeaders, json: async () => body } as unknown as Response)
const failRes = (status: number, body: unknown) => ({ ok: false, status, headers: jsonHeaders, json: async () => body } as unknown as Response)
// Non-JSON platform response (e.g. an undeployed route's HTML 404).
const htmlRes = (status: number) => ({ ok: false, status, headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) }, json: async () => { throw new SyntaxError('Unexpected token <') }, text: async () => '<!doctype html><h1>404</h1>' } as unknown as Response)
// JSON content-type but empty/malformed body.
const badJsonRes = (status: number) => ({ ok: false, status, headers: jsonHeaders, json: async () => { throw new SyntaxError('Unexpected end of JSON input') } } as unknown as Response)

beforeEach(() => authFetch.mockReset())

describe('getMarketingProfile (1–4,10)', () => {
  it('4: calls the configured Vault origin, GET, credentials omit; returns data', async () => {
    authFetch.mockResolvedValueOnce(okRes({ success: true, data: STATE }))
    const data = await getMarketingProfile()
    expect(authFetch).toHaveBeenCalledWith('https://vault.test/api/agent/marketing-profile', expect.objectContaining({ method: 'GET', credentials: 'omit' }))
    expect(data.profile.cardTitle).toBe('Luxury Advisor')
  })
  it('10: maps a stable server error code', async () => {
    authFetch.mockResolvedValueOnce(failRes(403, { success: false, code: 'NO_TENANT' }))
    await expect(getMarketingProfile()).rejects.toMatchObject({ code: 'NO_TENANT', status: 403 })
  })
  it('a network/CORS failure (fetch rejects) → NETWORK error', async () => {
    authFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getMarketingProfile()).rejects.toMatchObject({ code: NETWORK_ERROR_CODE })
  })
})

describe('updatePreferredPublicPhone (5–7,53)', () => {
  it('PATCH phone URL, credentials omit, body is ONLY preferred_public_phone (no target ids)', async () => {
    authFetch.mockResolvedValueOnce(okRes({ success: true, data: STATE }))
    await updatePreferredPublicPhone('3055551212')
    const [url, opts] = authFetch.mock.calls[0]
    expect(url).toBe('https://vault.test/api/agent/marketing-profile/phone')
    expect(opts.method).toBe('PATCH')
    expect(opts.credentials).toBe('omit')
    expect(JSON.parse(opts.body)).toEqual({ preferred_public_phone: '3055551212' })
  })
  it('null clears the value', async () => {
    authFetch.mockResolvedValueOnce(okRes({ success: true, data: STATE }))
    await updatePreferredPublicPhone(null)
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ preferred_public_phone: null })
  })
  it('maps a validation error code', async () => {
    authFetch.mockResolvedValueOnce(failRes(400, { success: false, code: 'PHONE_INVALID' }))
    await expect(updatePreferredPublicPhone('x')).rejects.toMatchObject({ code: 'PHONE_INVALID', status: 400 })
  })
})

describe('uploadAvatar (5–8,30,41)', () => {
  it('POST avatar URL, credentials omit, multipart with ONLY the image file', async () => {
    authFetch.mockResolvedValueOnce(okRes({ ok: true, marketingProfile: STATE }))
    const file = new File([new Uint8Array([1, 2, 3])], 'me.jpg', { type: 'image/jpeg' })
    const data = await uploadAvatar(file)
    const [url, opts] = authFetch.mock.calls[0]
    expect(url).toBe('https://vault.test/api/agent/avatar')
    expect(opts.method).toBe('POST')
    expect(opts.credentials).toBe('omit')
    expect(opts.body).toBeInstanceOf(FormData)
    // ONLY 'file' — no agent_id/tenant_id/profile_id/bucket/path/hash.
    expect([...(opts.body as FormData).keys()]).toEqual(['file'])
    // We never set Content-Type (the browser sets the multipart boundary).
    expect(opts.headers).toBeUndefined()
    expect(data.avatar.hasPhoto).toBe(true)
  })
  it('maps upload rejection codes', async () => {
    authFetch.mockResolvedValueOnce(failRes(415, { ok: false, code: 'AVATAR_MIME_UNSUPPORTED' }))
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    await expect(uploadAvatar(file)).rejects.toMatchObject({ code: 'AVATAR_MIME_UNSUPPORTED', status: 415 })
  })
})

describe('response parsing — undeployed vs structured (8–11)', () => {
  it('1/2: non-JSON platform 404 → NON_CONTRACT (contract=false); structured JSON 404 → PROFILE_NOT_FOUND (contract=true)', async () => {
    authFetch.mockResolvedValueOnce(htmlRes(404))
    await expect(getMarketingProfile()).rejects.toMatchObject({ code: NON_CONTRACT_CODE, status: 404, contract: false })
    authFetch.mockResolvedValueOnce(failRes(404, { success: false, code: 'PROFILE_NOT_FOUND', error: 'Profile unavailable.' }))
    await expect(getMarketingProfile()).rejects.toMatchObject({ code: 'PROFILE_NOT_FOUND', status: 404, contract: true })
  })
  it('8/9: empty/malformed JSON body → NON_CONTRACT (safe)', async () => {
    authFetch.mockResolvedValueOnce(badJsonRes(500))
    await expect(getMarketingProfile()).rejects.toMatchObject({ code: NON_CONTRACT_CODE, contract: false })
  })
  it('10/11: raw HTML/text is never read into the thrown error (only code + status)', async () => {
    authFetch.mockResolvedValueOnce(htmlRes(502))
    let err: MarketingProfileError | undefined
    try { await getMarketingProfile() } catch (e) { err = e as MarketingProfileError }
    const dump = JSON.stringify({ code: err?.code, status: err?.status, message: err?.message })
    expect(dump).not.toContain('<')
    expect(dump).not.toContain('doctype')
    expect(err?.code).toBe(NON_CONTRACT_CODE)
  })
  it('a non-JSON 200 is still treated as non-contract (never trusts HTML as data)', async () => {
    authFetch.mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => 'text/html' }, json: async () => { throw new Error('x') } } as unknown as Response)
    await expect(getMarketingProfile()).rejects.toMatchObject({ code: NON_CONTRACT_CODE, contract: false })
  })
})

describe('MarketingProfileError', () => {
  it('carries code + status + contract flag, never raw server internals', () => {
    const e = new MarketingProfileError('RATE_LIMITED', 429)
    expect(e.code).toBe('RATE_LIMITED')
    expect(e.status).toBe(429)
    expect(e.contract).toBe(true)
  })
})
