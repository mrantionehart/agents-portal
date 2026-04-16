// API Route: Integration Logs
// GET: View integration execution logs (admin only)

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can view integration logs' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const service_type = searchParams.get('service_type')
    const status = searchParams.get('status')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('integration_logs')
      .select('*', { count: 'exact' })

    if (service_type) {
      query = query.eq('service_type', service_type)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (date_from) {
      query = query.gte('created_at', date_from)
    }
    if (date_to) {
      query = query.lte('created_at', date_to)
    }

    // Order and paginate
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch integration logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Integration logs fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
