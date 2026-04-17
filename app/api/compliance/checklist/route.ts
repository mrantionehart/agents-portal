import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return null
      return data.user
    } catch { return null }
  }
  try {
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { stubResponse.cookies.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { stubResponse.cookies.delete(name) },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch { return null }
}

// GET — document checklist for a transaction
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transaction_id')

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the transaction
    const { data: transaction, error: txError } = await admin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .is('deleted_at', null)
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Get user role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'agent'

    // Agents can only see their own transactions
    if (role === 'agent' && transaction.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get required documents for this transaction type
    const { data: requirements } = await admin
      .from('transaction_doc_requirements')
      .select('*')
      .eq('transaction_type', transaction.type)
      .eq('is_active', true)
      .order('folder')
      .order('sort_order')

    // Get uploaded documents for this transaction
    const { data: documents } = await admin
      .from('documents')
      .select('*')
      .eq('transaction_id', transactionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Get agent profile
    const { data: agentProfile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', transaction.agent_id)
      .single()

    // Match documents to requirements
    const docsByName: Record<string, any> = {}
    for (const doc of documents || []) {
      // Match by name (doc_label)
      const key = doc.name?.toLowerCase().trim()
      if (key && !docsByName[key]) {
        docsByName[key] = doc
      }
    }

    // Build checklist grouped by folder
    const folders: Record<string, any[]> = {}
    const folderOrder = ['listing_intake', 'under_contract', 'closing', 'compliance', 'optional']
    const folderLabels: Record<string, string> = {
      listing_intake: 'Listed',
      under_contract: 'Under Contract',
      closing: 'Closed',
      compliance: 'Compliance',
      optional: 'Optional',
    }

    for (const req of requirements || []) {
      const folder = req.folder
      if (!folders[folder]) folders[folder] = []

      const matchedDoc = docsByName[req.doc_label?.toLowerCase().trim()]

      folders[folder].push({
        requirement_id: req.id,
        doc_label: req.doc_label,
        is_required: req.is_required,
        folder: req.folder,
        sort_order: req.sort_order,
        // Document info (if uploaded)
        document: matchedDoc ? {
          id: matchedDoc.id,
          name: matchedDoc.name,
          status: matchedDoc.status,
          file_path: matchedDoc.file_path,
          file_size: matchedDoc.file_size,
          mime_type: matchedDoc.mime_type,
          upload_date: matchedDoc.upload_date || matchedDoc.created_at,
          verified_date: matchedDoc.verified_date,
        } : null,
        status: matchedDoc
          ? matchedDoc.status === 'verified' ? 'approved'
          : matchedDoc.status === 'rejected' ? 'rejected'
          : 'uploaded'
          : 'missing',
      })
    }

    // Also include any uploaded docs that don't match a requirement
    const matchedLabels = new Set((requirements || []).map(r => r.doc_label?.toLowerCase().trim()))
    const unmatchedDocs = (documents || []).filter(d => !matchedLabels.has(d.name?.toLowerCase().trim()))

    if (unmatchedDocs.length > 0) {
      if (!folders['additional']) folders['additional'] = []
      for (const doc of unmatchedDocs) {
        folders['additional'].push({
          requirement_id: null,
          doc_label: doc.name,
          is_required: false,
          folder: 'additional',
          sort_order: 99,
          document: {
            id: doc.id,
            name: doc.name,
            status: doc.status,
            file_path: doc.file_path,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            upload_date: doc.upload_date || doc.created_at,
            verified_date: doc.verified_date,
          },
          status: doc.status === 'verified' ? 'approved'
            : doc.status === 'rejected' ? 'rejected'
            : 'uploaded',
        })
      }
    }

    // Build ordered result
    const orderedFolders = folderOrder
      .filter(f => folders[f] && folders[f].length > 0)
      .map(f => ({
        id: f,
        label: folderLabels[f] || f,
        items: folders[f],
        stats: {
          total: folders[f].length,
          required: folders[f].filter(i => i.is_required).length,
          uploaded: folders[f].filter(i => i.document).length,
          approved: folders[f].filter(i => i.status === 'approved').length,
        },
      }))

    // Add "additional" folder if present
    if (folders['additional']?.length) {
      orderedFolders.push({
        id: 'additional',
        label: 'Additional Documents',
        items: folders['additional'],
        stats: {
          total: folders['additional'].length,
          required: 0,
          uploaded: folders['additional'].length,
          approved: folders['additional'].filter(i => i.status === 'approved').length,
        },
      })
    }

    // Overall stats
    const allItems = Object.values(folders).flat()
    const stats = {
      total_required: allItems.filter(i => i.is_required).length,
      total_docs: allItems.length,
      uploaded: allItems.filter(i => i.document).length,
      approved: allItems.filter(i => i.status === 'approved').length,
      rejected: allItems.filter(i => i.status === 'rejected').length,
      missing: allItems.filter(i => i.is_required && !i.document).length,
    }

    return NextResponse.json({
      transaction: {
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        property_address: transaction.property_address,
        city: transaction.city,
        state: transaction.state,
        client_name: transaction.client_name,
        contract_price: transaction.contract_price,
        closing_date: transaction.closing_date,
        contract_date: transaction.contract_date,
        agent_id: transaction.agent_id,
        agent_name: agentProfile?.full_name || 'Unknown',
        agent_email: agentProfile?.email || '',
      },
      folders: orderedFolders,
      stats,
      role,
    })
  } catch (err) {
    console.error('Compliance checklist error:', err)
    return NextResponse.json({ error: 'Failed to load checklist' }, { status: 500 })
  }
}
