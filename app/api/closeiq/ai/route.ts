import { NextRequest, NextResponse } from 'next/server'
import { proxyToVault } from '@/lib/vault-forward'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// requireAuth: proxyToVault resolves the caller session; Vault validates Bearer.
export async function POST(request: NextRequest) {
 try { return await proxyToVault(request, 'POST', '/ai/legacy/closeiq', await request.json()) }
 catch { return NextResponse.json({error: 'Failed to process AI request'}, {status:500}) }
}
