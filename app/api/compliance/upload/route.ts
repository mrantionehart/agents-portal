import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

// Map doc_label to a document_type enum value
function inferDocType(label: string): string {
  const lower = label.toLowerCase()
  if (lower.includes('agreement') || lower.includes('contract') || lower.includes('purchase'))
    return 'contract'
  if (lower.includes('disclosure') || lower.includes('fraud') || lower.includes('consent'))
    return 'disclosure'
  if (lower.includes('inspection'))
    return 'inspection'
  if (lower.includes('appraisal'))
    return 'appraisal'
  if (lower.includes('title') || lower.includes('commitment'))
    return 'title'
  if (lower.includes('insurance') || lower.includes('warranty'))
    return 'insurance'
  if (lower.includes('closing') || lower.includes('earnest'))
    return 'financial'
  if (lower.includes('form') || lower.includes('checklist') || lower.includes('authorization'))
    return 'form'
  return 'other'
}

// POST — upload a compliance document
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const transactionId = formData.get('transaction_id') as string
    const docLabel = formData.get('doc_label') as string
    const folder = formData.get('folder') as string

    if (!file || !transactionId || !docLabel) {
      return NextResponse.json(
        { error: 'Missing required fields: file, transaction_id, doc_label' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, DOCX, DOC, JPG, PNG, TIFF' },
        { status: 400 }
      )
    }

    // Max 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 50MB' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify transaction exists and user has access
    const { data: transaction } = await admin
      .from('transactions')
      .select('id, agent_id, type')
      .eq('id', transactionId)
      .is('deleted_at', null)
      .single()

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'agent'
    if (role === 'agent' && transaction.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Upload file to Supabase Storage
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${transactionId}/${folder || 'general'}/${timestamp}_${safeName}`

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('transaction-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Check if a document with this label already exists for this transaction
    const { data: existing } = await admin
      .from('documents')
      .select('id')
      .eq('transaction_id', transactionId)
      .ilike('name', docLabel)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      // Soft delete the old document
      await admin
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }

    // Create document record
    const docType = inferDocType(docLabel)
    const { data: newDoc, error: insertError } = await admin
      .from('documents')
      .insert({
        transaction_id: transactionId,
        uploaded_by: user.id,
        document_type: docType,
        name: docLabel,
        description: `${folder || 'general'} - ${docLabel}`,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Document insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 })
    }

    return NextResponse.json({
      document: newDoc,
      message: 'Document uploaded successfully',
    })
  } catch (err) {
    console.error('Compliance upload error:', err)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}
