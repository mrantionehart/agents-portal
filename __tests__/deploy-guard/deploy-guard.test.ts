/**
 * @jest-environment node
 *
 * DEPLOY-GUARD-1 (Agent Portal). The decision rule itself lives in Vault's
 * database and is proven there (hartfelt-vault deploy-guard.pg.test.ts); the
 * same script is exercised end to end in Vault's deploy-guard-script.test.ts.
 * Here: the portal's build is wired to the gate before AND after `next build`,
 * the gate refuses (exit 1) a production build it cannot verify, skips
 * non-production builds, and the version endpoint reports the serving commit.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SCRIPT = 'scripts/deploy-guard/deploy-guard.mjs'
const run = (env: Record<string, string>) =>
  spawnSync(process.execPath, [SCRIPT, 'pre', 'agent_portal'], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } })

describe('Agent Portal deploy guard', () => {
  it('runs before and after next build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.scripts.prebuild).toMatch(/^node scripts\/deploy-guard\/deploy-guard\.mjs pre agent_portal && /)
    expect(pkg.scripts.postbuild).toBe('node scripts/deploy-guard/deploy-guard.mjs post agent_portal')
  })

  it('skips local and preview builds', () => {
    expect(run({}).status).toBe(0)
    expect(run({ VERCEL: '1', VERCEL_ENV: 'preview' }).status).toBe(0)
  })

  it('fails CLOSED on a production build without the credentials to check eligibility', () => {
    const r = run({ VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), VERCEL_GIT_COMMIT_REF: 'master' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('REFUSED')
  })

  it('fails CLOSED when the guard cannot be reached', () => {
    const r = run({
      VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), VERCEL_GIT_COMMIT_REF: 'master',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'k',
    })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('fail closed')
    expect(r.stderr + r.stdout).not.toContain('"k"')
  }, 30_000)

  it('the version endpoint reports the serving commit and is an explicit public route', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'c'.repeat(40)
    process.env.VERCEL_ENV = 'production'
    const mod = await import('../../app/api/deploy-guard/version/route')
    expect(mod.PUBLIC_ROUTE).toBe(true)
    const body = await mod.GET().json()
    expect(body).toEqual({ app: 'agent_portal', sha: 'c'.repeat(40), env: 'production' })
  })
})
