/**
 * @jest-environment node
 */
// LEAD-POOL — the Portal's legacy claim route delegates to claim_pooled_lead()
// and never writes client_profiles itself (agents hold no direct UPDATE).
const rpc = jest.fn()
const update = jest.fn()
let user: { id: string } | null = { id: 'agent-1' }

jest.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      update: (...a: unknown[]) => { update(...a); return { eq: () => ({}) } },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'lead-1' } }) }) }),
    }),
  }),
}))

import { POST } from '../route'

const call = () => POST(new Request('http://x/api', { method: 'POST' }), { params: Promise.resolve({ id: 'lead-1' }) })

beforeEach(() => { rpc.mockReset(); update.mockReset(); user = { id: 'agent-1' } })

describe('LEAD-POOL — Portal claim route', () => {
  it.each([
    ['claimed', 200], ['taken', 409], ['not_found', 404], ['not_eligible', 403],
  ])('outcome %s → %i, through the RPC only', async (outcome, status) => {
    rpc.mockResolvedValue({ data: outcome, error: null })
    const res = await call()
    expect(res.status).toBe(status)
    expect(rpc).toHaveBeenCalledWith('claim_pooled_lead', { p_client_profile_id: 'lead-1' })
    expect(update).not.toHaveBeenCalled()
  })

  it('unauthenticated → 401 and no RPC', async () => {
    user = null
    expect((await call()).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('an RPC error is a 503, never a silent success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await call()).status).toBe(503)
  })
})
