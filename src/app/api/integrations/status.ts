// API Route: Integration Status
// GET: Check status of all integrations

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { IntegrationStatus_ } from '@/types/integrations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      )
    }

    // Get MLS sync status
    const { data: mlsListings, count: mlsCount } = await supabase
      .from('mls_listings')
      .select('id', { count: 'exact' })
      .limit(0)

    const { data: latestMLS } = await supabase
      .from('mls_listings')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    const mls_sync_status: IntegrationStatus_['mls_sync'] = {
      status: latestMLS && new Date(latestMLS.last_updated) > new Date(Date.now() - 24 * 60 * 60 * 1000) ? 'active' : 'inactive',
      last_sync: latestMLS?.last_updated || 'Never',
      listings_count: mlsCount || 0,
    }

    // Get service account statuses
    const { data: serviceAccounts } = await supabase
      .from('third_party_service_accounts')
      .select('service_type, status')

    const services_status: Record<string, any> = {}

    const serviceTypes = ['title_company', 'lender', 'inspector', 'appraisal', 'docusign'] as const
    for (const sType of serviceTypes) {
      const accounts = serviceAccounts?.filter(a => a.service_type === sType) || []
      const activeCount = accounts.filter(a => a.status === 'active').length
      const errorCount = accounts.filter(a => a.status === 'error').length

      services_status[sType] = {
        active_accounts: activeCount,
        status: errorCount > 0 ? 'warning' : (activeCount > 0 ? 'ok' : 'ok'),
        error: errorCount > 0 ? `${errorCount} accounts with errors` : undefined,
      }
    }

    // Get recent integration errors
    const { data: recentErrors } = await supabase
      .from('integration_logs')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5)

    const status: IntegrationStatus_ = {
      mls_sync: mls_sync_status,
      services: services_status,
      recent_errors: recentErrors || [],
    }

    return NextResponse.json({
      data: status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Integration status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
