import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

// ============================================================================
// HARTFELT-P8.1A — the agent's own brokerage leads
// ============================================================================
// 🔑 A SERVER-SIDE PROXY, NOT A BROWSER CALL, AND THE REASON IS CORS. AP's
// other Vault reads (`MyFollowUps`) call `${VAULT_API_URL}/crm/followups`
// straight from the browser, because THAT route carries
// `Access-Control-Allow-Origin` and an `OPTIONS` handler.
// `/api/client-intelligence` carries neither, so the same call from
// `agents.hartfeltrealestate.com` is blocked before Vault sees it.
//
// The alternative was to add wildcard CORS to `/api/client-intelligence`. That
// route also serves the broker-tier unassigned queue, the assignable-agent
// roster and profile creation, and Vault is the broker/admin control plane —
// opening it to every origin to serve one agent-scoped branch widens far more
// than it fixes. Forwarding the Authorization header from this origin does not.
//
// 🔒 THIS PROXY ADDS NO AUTHORITY. It forwards the caller's bearer token and
// nothing else: no service-role key, no header Vault would read as identity.
// Who may see which lead is decided in Vault by `?assigned=mine` and, beneath
// it, by `cp_agent_select_tenant`.
//
// 🔑 `withAuth` IS THE GATE, not a presence check on the header. The first
// version read `authorization` and 401'd when it was absent, which the repo's
// route-security guard correctly rejected as unmarked: an absent header and an
// INVALID one are different, and only the wrapper can tell them apart. It also
// means a token Vault would refuse is refused here first.
// ============================================================================

export const dynamic = 'force-dynamic'

/** Only the knobs the leads page turns. An unlisted param is not forwarded. */
const FORWARDED = ['search', 'status', 'type', 'limit', 'offset'] as const

export const GET = withAuth(async (request: NextRequest) => {
  try {
    // Forwarded verbatim so Vault authenticates the same caller `withAuth`
    // just did, rather than this origin vouching for them.
    const authHeader = request.headers.get('authorization') || ''

    const incoming = new URL(request.url).searchParams
    const qs = new URLSearchParams({ assigned: 'mine' })
    for (const key of FORWARDED) {
      const v = incoming.get(key)
      if (v !== null && v !== '') qs.set(key, v)
    }

    const response = await fetch(
      `${VAULT_API_URL}/client-intelligence?${qs.toString()}`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    )

    const data = await response.json().catch(() => null)
    if (data === null) {
      // 🔒 An unreadable body is not an empty one. Returning `{data: []}` here
      // would render "No leads assigned to you" over a failure.
      return NextResponse.json(
        { error: 'Leads could not be read.', code: 'vault_leads_unreadable' },
        { status: 502 },
      )
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { error: 'Leads could not be read.', code: 'vault_leads_unreachable' },
      { status: 502 },
    )
  }
})
