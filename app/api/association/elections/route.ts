import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/security'
import { forwardToVault } from '@/lib/association/forward'

// Association membership elections — forwarder to Vault (see lib/association/forward.ts).
export const dynamic = 'force-dynamic'
export const GET = withAuth(async (request: NextRequest) => forwardToVault(request, '/association/elections', 'GET'))
export const POST = withAuth(async (request: NextRequest) => forwardToVault(request, '/association/elections', 'POST'))
