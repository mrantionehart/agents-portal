#!/usr/bin/env node
// ============================================================================
// DEPLOY-GUARD-1 — the ONE approved way to rebuild production (e.g. after an
// environment-variable change).
// ============================================================================
//   node scripts/deploy-guard/redeploy-production.mjs [vault|agent_portal]
//
// Never redeploy a deployment URL you remember: `vercel redeploy <url>`
// rebuilds THAT deployment's commit, which is how 82c2ccc replaced #2081 on
// 2026-11-20. This script fetches origin, finds the READY production
// deployment whose commit IS the current production-branch head, and
// redeploys exactly that one (Vercel uses the CURRENT environment variables
// on a redeploy, so nothing old is restored). The build gate checks again.
// Afterwards run verify-production.mjs; only its VERIFIED counts.
// ============================================================================
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const TEAM = 'team_LGrkwblSPf9ywhYX8Z2IenwL'
const APPS = {
  vault: { project: 'prj_KRW1cawttsFOikPmkCd5YqhnsKN2', branch: 'main' },
  agent_portal: { project: 'prj_yJt4gc4lmaWsuf8h8txnf3GYKAOv', branch: 'master' },
}
const app = process.argv[2] ?? 'vault'
if (!(app in APPS)) { console.error(`unknown app ${app}`); process.exit(2) }
const { project, branch } = APPS[app]

execFileSync('git', ['fetch', '-q', 'origin', branch])
const head = execFileSync('git', ['rev-parse', `origin/${branch}`], { encoding: 'utf8' }).trim()

const authPaths = [
  join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
  join(homedir(), '.local/share/com.vercel.cli/auth.json'),
]
let token = process.env.VERCEL_TOKEN
for (const p of authPaths) { if (token) break; try { token = JSON.parse(readFileSync(p, 'utf8')).token } catch { /* next */ } }
if (!token) { console.error('No Vercel CLI login found. Run `vercel login` first.'); process.exit(2) }

const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${project}&teamId=${TEAM}&target=production&limit=40`, {
  headers: { Authorization: `Bearer ${token}` },
})
const { deployments = [] } = await res.json()
const match = deployments.find((d) => d.state === 'READY' && d.meta?.githubCommitSha === head)
if (!match) {
  console.error(`No READY production deployment of origin/${branch} ${head.slice(0, 9)} exists. ` +
    'Push/merge to the production branch (Vercel builds it), or wait for that build to finish. Nothing redeployed.')
  process.exit(1)
}
console.log(`Redeploying ${match.url} (commit ${head.slice(0, 9)} = origin/${branch}) to production…`)
const r = spawnSync('vercel', ['redeploy', match.url, '--target', 'production', '--scope', 'hartfelt-vault'], { stdio: 'inherit' })
process.exit(r.status ?? 1)
