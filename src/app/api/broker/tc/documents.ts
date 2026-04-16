// API Route: Document Management
// POST: Upload document
// GET: List documents
// PATCH: Update document status
// DELETE: Delete document

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    if (userRole !== 'tc' && userRole !== 'agent' && userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Insufficient permissions to upload documents' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { transaction_id, doc_type, file_url, file_name, notes } = body

    if (!transaction_id || !doc_type || !file_url || !file_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const validTypes = ['contract', 'disclosure', 'inspection', 'appraisal', 'insurance', 'title', 'other']
    if (!validTypes.includes(doc_type)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_documents')
      .insert([
        {
          transaction_id,
          doc_type,
          file_url,
          file_name,
          status: 'pending',
          notes,
          uploaded_by: userId,
          uploaded_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data?.[0] }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const transaction_id = searchParams.get('transaction_id')

    let query = supabase.from('tc_documents').select('*')

    if (transaction_id) {
      query = query.eq('transaction_id', transaction_id)
    }

    const { data, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    if (userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can verify documents' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const documentId = pathArray[pathArray.length - 1]

    if (!documentId || documentId === 'documents') {
      return NextResponse.json(
        { error: 'Missing document ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status } = body

    const validStatuses = ['pending', 'received', 'verified', 'failed']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid document status' },
        { status: 400 }
      )
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('tc_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data?.[0] }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    if (userRole !== 'broker' && userRole !== 'tc') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const documentId = pathArray[pathArray.length - 1]

    if (!documentId || documentId === 'documents') {
      return NextResponse.json(
        { error: 'Missing document ID' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_documents')
      .delete()
      .eq('id', documentId)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data?.[0] }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
