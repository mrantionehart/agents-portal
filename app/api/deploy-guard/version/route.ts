// DEPLOY-GUARD-1 — which commit is this deployment serving? Public, no data:
// the commit id and the Vercel environment only. Read by Vault's production
// monitor (/api/cron/deploy-guard-verify) and scripts/deploy-guard/verify-production.mjs.
import { NextResponse } from 'next/server'

export const PUBLIC_ROUTE = true
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { app: 'agent_portal', sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null, env: process.env.VERCEL_ENV ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
