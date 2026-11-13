/**
 * @jest-environment node
 */
// ============================================================================
// VAULT-FORWARD-PATH-1 — a forwarder path must NOT start with "/api/"
// ============================================================================
// `proxyToVault` prepends VAULT_API_URL, which already ends in "/api". Three
// forwarders were written as "/api/onboarding/..." and "/api/profile/...", so
// production called ".../api/api/..." and Vault answered 404 — the HartFelt
// Ready final exam (and its broker grants) never reached Vault from the Agent
// Portal since it shipped (AP #74, 2026-10-16). Measured in production
// 2026-11-12: those three 404, while "/meetings" and "/esign/status" 200.
// ============================================================================
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

jest.mock('@/lib/security', () => ({ requireAuth: async () => ({ response: null }) }))

const ROOT = join(process.cwd(), 'app', 'api')
function routes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) { if (e !== '__tests__') routes(f, out) }
    else if (e === 'route.ts') out.push(f)
  }
  return out
}

describe('proxyToVault paths', () => {
  it('no forwarder passes a path that starts with /api/ (it would become /api/api/)', () => {
    const offenders: string[] = []
    for (const f of routes(ROOT)) {
      const src = readFileSync(f, 'utf8')
      if (!src.includes('proxyToVault')) continue
      const literals = [
        ...src.matchAll(/proxyToVault\(\s*\w+\s*,\s*['"`]\w+['"`]\s*,\s*['"`](\/[^'"`]*)/g),
        ...src.matchAll(/const\s+VAULT_PATH\s*=\s*['"`](\/[^'"`]*)/g),
      ].map((m) => m[1])
      for (const p of literals) if (p.startsWith('/api/')) offenders.push(`${f.replace(process.cwd() + '/', '')}: ${p}`)
    }
    expect(offenders).toEqual([])
  })

  it('the final-exam forwarder calls exactly VAULT_API_URL + /onboarding/hartfelt-ready/final-exam', async () => {
    const calls: string[] = []
    global.fetch = jest.fn(async (u: string) => {
      calls.push(String(u))
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    const { VAULT_API_URL } = await import('@/lib/vault-client')
    const { GET } = await import('@/app/api/training/final-exam/route')
    const { NextRequest } = await import('next/server')
    const res = await GET(new NextRequest('http://ap.test/api/training/final-exam', { headers: { authorization: 'Bearer t' } }))
    expect(res.status).toBe(200)
    expect(calls).toEqual([`${VAULT_API_URL}/onboarding/hartfelt-ready/final-exam`])
    expect(calls[0]).not.toContain('/api/api/')
  })
})
