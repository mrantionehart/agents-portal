#!/usr/bin/env node
// ============================================================================
// DEPLOY-GUARD-1 — production build gate (identical copy in Vault and the
// Agent Portal; EASE uses the same database rule from its OTA workflow).
// ============================================================================
// Usage (package.json):  "prebuild":  "node scripts/deploy-guard/deploy-guard.mjs pre <app> && ..."
//                        "postbuild": "node scripts/deploy-guard/deploy-guard.mjs post <app>"
//
// Runs on EVERY Vercel production build — a Git push, `vercel deploy --prod`,
// `vercel redeploy`, a dashboard "Redeploy" — because they all run the build
// command. It asks Vault's database (public.deploy_guard_check) whether this
// commit may become production:
//   pre   before compiling: is this commit the newest recorded push to the
//         production branch (or an active Broker-of-Record rollback target)?
//         If the push has not been recorded yet, wait for it.
//   post  after compiling: is it STILL the newest? A build that was current
//         when it started but superseded while it compiled fails here, so it
//         never replaces the newer one.
// A refusal exits 1, which fails the build, so Vercel never promotes it.
//
// Fails CLOSED on a production build that cannot reach the decision (missing
// credentials, database unreachable). The only pass-through is a database
// where the guard is not installed yet (function absent) — the state before
// the migration is applied.
//
// Never prints a credential or an environment VALUE. Environment variable
// NAMES are recorded so a rollback can be checked against today's settings.
// ============================================================================

import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [, , phaseArg, appArg] = process.argv
const PHASES = new Set(['pre', 'post'])
const APPS = new Set(['vault', 'agent_portal', 'ease'])
const MIGRATION_CUTOFF = '20260617' // same cutoff as REL.1
const POLL_MS = Number(process.env.DEPLOY_GUARD_POLL_MS || 10_000)
const OBSERVE_WAIT_CAP_S = 60

const log = (m) => console.log(`[deploy-guard] ${m}`)
const fail = (m) => {
  console.error(`[deploy-guard] REFUSED: ${m}`)
  process.exit(1)
}

export function treeMigrations(root = process.cwd()) {
  const out = new Set()
  for (const dir of ['supabase/migrations', 'supabase/migrations-pending']) {
    const p = join(root, dir)
    if (!existsSync(p)) continue
    for (const f of readdirSync(p)) {
      const m = f.match(/^(\d{8}|\d{14})[_.]/)
      if (m && m[1] >= MIGRATION_CUTOFF && f.endsWith('.sql')) out.add(m[1])
    }
  }
  return [...out].sort()
}

const SYSTEM_PREFIXES = ['VERCEL', 'npm_', 'NPM_', 'NODE', 'TURBO', 'NX_', 'CI', 'HOME', 'PATH', 'PWD', 'SHLVL', 'HOSTNAME',
  'LANG', 'TZ', 'USER', 'SHELL', 'TERM', 'OLDPWD', 'AWS_', 'LAMBDA', 'LD_', '_', 'INIT_CWD', 'COREPACK', 'ENABLE_', 'DEPLOY_GUARD_']
export function envNames(env = process.env) {
  return Object.keys(env)
    .filter((k) => /^[A-Z][A-Z0-9_]*$/.test(k) && !SYSTEM_PREFIXES.some((p) => k.startsWith(p)))
    .sort()
}

/** What this build would do, before any network call. Pure; exported for tests. */
export function classifyEnvironment(env = process.env) {
  if (env.VERCEL !== '1') return { skip: 'not a Vercel build (local build is never production)' }
  if (env.VERCEL_ENV !== 'production') return { skip: `VERCEL_ENV=${env.VERCEL_ENV || '(unset)'} is not production` }
  if (env.BPO_STAGING_PROJECT === '1') return { skip: 'staging project (BPO_STAGING_PROJECT=1)' }
  return { skip: null }
}

async function rpc(url, key, body) {
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/deploy_guard_check`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      if (res.ok) return { ok: true, data: JSON.parse(text) }
      let code = null
      try { code = JSON.parse(text).code } catch { /* not json */ }
      if (code === 'PGRST202' || code === '42883') return { ok: false, notInstalled: true }
      lastErr = `HTTP ${res.status} ${code ?? ''}`.trim()
      if (res.status < 500) break
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt))
  }
  return { ok: false, error: lastErr }
}

export async function main(env = process.env) {
  if (!PHASES.has(phaseArg) || !APPS.has(appArg)) fail(`usage: deploy-guard.mjs <pre|post> <vault|agent_portal|ease>`)
  const cls = classifyEnvironment(env)
  if (cls.skip) { log(`skipped: ${cls.skip}`); return }

  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('production build without the Supabase URL / service key needed to check deployment eligibility')

  const sha = (env.VERCEL_GIT_COMMIT_SHA || '').toLowerCase()
  const ref = env.VERCEL_GIT_COMMIT_REF || ''
  const source = {
    path: 'vercel_build',
    deployment_id: env.VERCEL_DEPLOYMENT_ID || null,
    deployment_url: env.VERCEL_URL || null,
    project_production_url: env.VERCEL_PROJECT_PRODUCTION_URL || null,
    git_provider: env.VERCEL_GIT_PROVIDER || null,
    commit_author: env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN || null,
    region: env.VERCEL_REGION || null,
  }
  const body = (phase) => ({
    p_app: appArg, p_sha: sha, p_ref: ref, p_phase: phase, p_source: source,
    p_tree_migrations: appArg === 'vault' ? treeMigrations() : null,
    p_env_names: envNames(env),
  })

  log(`${phaseArg}: ${appArg} commit ${sha.slice(0, 9) || '(none)'} on ${ref || '(no branch)'}`)
  const started = Date.now()
  let r = await rpc(url, key, body(phaseArg))
  while (r.ok && r.data.effective === 'wait') {
    const limit = (r.data.enforce ? Number(r.data.wait_seconds) || 600 : OBSERVE_WAIT_CAP_S) * 1000
    if (Date.now() - started >= limit) { r = await rpc(url, key, body('pre_timeout')); break }
    log(`commit not recorded as a production-branch push yet; waiting (${Math.round((Date.now() - started) / 1000)}s)`)
    await new Promise((res) => setTimeout(res, POLL_MS))
    r = await rpc(url, key, body('pre'))
  }
  if (!r.ok && r.notInstalled) { log('guard not installed in the database yet — passing (pre-activation state)'); return }
  if (!r.ok) fail(`could not reach the deployment guard (${r.error}). Production builds fail closed.`)

  const d = r.data
  if (d.effective === 'allow') { log(`allowed (${d.reason})`); return }
  if (d.effective === 'allow_observe') {
    log(`OBSERVE MODE — would have refused: ${d.reason}. ${d.message ?? ''} (recorded; not enforced)`)
    return
  }
  fail(`${d.reason}. ${d.message ?? ''} Production head: ${(d.head_sha || '?').slice(0, 9)}. ` +
       'Deploy the current production-branch head, or ask the Broker of Record to authorize a rollback in Vault → Ops Health.')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
}
