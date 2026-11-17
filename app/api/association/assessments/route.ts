import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/security'
import { forwardToVault } from '@/lib/association/forward'

// Association assessment cases (read) — forwarder to Vault. Vault shows an
// agent only their own cases, and never a staff draft.
export const dynamic = 'force-dynamic'
export const GET = withAuth(async (request: NextRequest) => forwardToVault(request, '/association/assessments', 'GET'))
