#!/usr/bin/env node
// ============================================================================
// DEPLOY-GUARD-1 — "is production actually serving the production head?"
// ============================================================================
//   node scripts/deploy-guard/verify-production.mjs [vault|agent_portal] [--expect <sha>]
//
// Exit 0 ONLY when the production domain reports serving exactly the current
// production-branch head (fetched fresh from origin), and — with --expect —
// that head contains the given commit. Anything else exits 1 and prints
// UNVERIFIED or FAILED. A merged PR or a finished build is not a deployment;
// report what this prints, never what you expect.
// ============================================================================
import { execFileSync } from 'node:child_process'

const APPS = {
  vault: { url: 'https://vault.hartfeltrealestate.com', branch: 'main' },
  agent_portal: { url: 'https://agents.hartfeltrealestate.com', branch: 'master' },
}
const args = process.argv.slice(2)
const app = args.find((a) => !a.startsWith('--') && a in APPS) ?? 'vault'
const expectIdx = args.indexOf('--expect')
const expected = expectIdx >= 0 ? args[expectIdx + 1] : null
const { url, branch } = APPS[app]

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim()
const out = (status, msg) => { console.log(`${status}: ${app} — ${msg}`); process.exit(status === 'VERIFIED' ? 0 : 1) }

try { git('fetch', '-q', 'origin', branch) } catch { out('UNVERIFIED', `could not fetch origin/${branch}`) }
const head = git('rev-parse', `origin/${branch}`)

let served
try {
  const res = await fetch(`${url}/api/deploy-guard/version`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) out('UNVERIFIED', `${url} answered HTTP ${res.status} (version endpoint missing or app down)`)
  served = ((await res.json()).sha ?? '').toLowerCase()
} catch (e) {
  out('FAILED', `${url} did not answer (${e instanceof Error ? e.message : e})`)
}
if (!served) out('UNVERIFIED', 'production did not report a commit')
if (served !== head) {
  let rel = 'unrelated'
  try { git('merge-base', '--is-ancestor', served, head); rel = 'OLDER than the head' } catch { /* not an ancestor */ }
  out('FAILED', `production serves ${served.slice(0, 9)}, origin/${branch} is ${head.slice(0, 9)} (${rel})`)
}
if (expected) {
  try { git('merge-base', '--is-ancestor', expected, served) } catch {
    out('FAILED', `serving ${served.slice(0, 9)} does not contain ${expected}`)
  }
}
out('VERIFIED', `serving ${served.slice(0, 9)} = origin/${branch}${expected ? `, contains ${expected}` : ''}`)
