import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, requireRateLimit } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sprint 5D: per-route copies of getAuthedUser + tooManyUploads removed.
// Auth flows through requireAuth(); 429 responses flow through
// requireRateLimit() with the standardized { error: 'Too many requests' }
// shape. Existing interleaving (per-user limit BEFORE formData parse,
// per-transaction limit AFTER formData parse) is preserved.

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
    return 'general'
  if (lower.includes('insurance') || lower.includes('warranty'))
    return 'general'
  if (lower.includes('closing') || lower.includes('earnest'))
    return 'closing_doc'
  if (lower.includes('form') || lower.includes('checklist') || lower.includes('authorization'))
    return 'general'
  return 'general'
}

// POST — upload a compliance document
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    // ---- Rate limit: per-user (Sprint 5B: H3; refactored Sprint 5D) ----
    // Caps any single account at 20 uploads/min regardless of which
    // transaction. Runs BEFORE formData parsing so a flood of large
    // payloads can't burn bandwidth past this gate. KV-backed; fails
    // open with telemetry if KV is unavailable.
    const userLimit = await requireRateLimit(
      {
        name: 'compliance-upload-user',
        identifier: user.id,
        limit: 20,
        window: '1 m',
      },
      request
    )
    if (userLimit.response) return userLimit.response
    // --------------------------------------------------------------------

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

    // ---- Rate limit: per-transaction (Sprint 5B: H3; refactored Sprint 5D) ----
    // Caps any single transaction at 5 uploads/min regardless of which
    // user. Multi-agent collaboration on one transaction stays below
    // this in normal use; protects against runaway scripts targeting
    // a single transaction_id. Runs after we know transactionId but
    // BEFORE the storage write so blocked attempts mutate nothing.
    const txLimit = await requireRateLimit(
      {
        name: 'compliance-upload-transaction',
        identifier: transactionId,
        limit: 5,
        window: '1 m',
      },
      request
    )
    if (txLimit.response) return txLimit.response
    // --------------------------------------------------------------------------

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
      .select('id, agent_id, type, property_address')
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
        original_filename: file.name,
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

    // ── Notify all brokers/admins that a doc was uploaded ─────
    try {
      const { data: brokers } = await admin
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['broker', 'admin'])

      const { data: uploaderProfile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const uploaderName = uploaderProfile?.full_name || user.email?.split('@')[0] || 'An agent'

      // ── 5-min notification debounce (Sprint 5B: M2) ────────────
      // Code-only check (no migration). For each broker, look back
      // 5 minutes for a doc_uploaded notification on this same
      // (recipient_id, transaction_id, doc_label) triple. If one
      // exists, skip the insert AND the SendGrid send so repeated
      // saves of the same document don't multiply broker emails.
      // We compute the cutoff once, outside the loop.
      const debounceCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      for (const broker of brokers || []) {
        // Debounce probe — query by columns + metadata->>doc_label so we
        // catch the same logical document under the same recipient even
        // if title/message text drifts.
        const { data: recent } = await admin
          .from('compliance_notifications')
          .select('id')
          .eq('recipient_id', broker.id)
          .eq('transaction_id', transactionId)
          .eq('notification_type', 'doc_uploaded')
          .eq('metadata->>doc_label', docLabel)
          .gte('created_at', debounceCutoff)
          .limit(1)
          .maybeSingle()

        if (recent) {
          // Identifier-bearing fields (broker email, doc body) stay out
          // of the log; we only emit IDs needed for ops correlation.
          console.log(
            '[security:compliance-upload] notification debounced',
            {
              recipient_id: broker.id,
              transaction_id: transactionId,
              notification_type: 'doc_uploaded',
              window_minutes: 5,
            }
          )
          continue
        }

        // In-app notification
        await admin.from('compliance_notifications').insert({
          recipient_id: broker.id,
          transaction_id: transactionId,
          notification_type: 'doc_uploaded',
          title: `Document Uploaded: ${docLabel}`,
          message: `${uploaderName} uploaded "${docLabel}" for ${transaction.property_address || 'a transaction'}. Review needed.`,
          metadata: {
            doc_label: docLabel,
            folder,
            property_address: transaction.property_address,
            agent_name: uploaderName,
          },
        }).then(undefined, () => {})

        // Email notification
        const sgApiKey = process.env.SENDGRID_API_KEY
        if (sgApiKey && broker.email) {
          const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agents.hartfeltrealestate.com'
          fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sgApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: broker.email }] }],
              from: { email: process.env.SENDGRID_FROM_EMAIL || 'info@hartfeltrealestate.com', name: 'HartFelt Compliance' },
              subject: `Document Uploaded: ${docLabel} — Review Needed`,
              content: [{
                type: 'text/html',
                value: `
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <h1 style="color:#1F4E78;border-bottom:3px solid #2E75B6;padding-bottom:10px;">Document Review Needed</h1>
  <p><strong>${uploaderName}</strong> uploaded a document that needs your review.</p>
  <div style="background:#f0f9ff;padding:15px;border-left:4px solid #2E75B6;margin:20px 0;border-radius:4px;">
    <p style="margin:0;"><strong>Document:</strong> ${docLabel}</p>
    <p style="margin:8px 0 0;"><strong>Property:</strong> ${transaction.property_address || 'N/A'}</p>
    <p style="margin:8px 0 0;"><strong>Folder:</strong> ${folder || 'General'}</p>
  </div>
  <p><a href="${portalUrl}/compliance" style="background:#2E75B6;color:white;padding:12px 30px;text-decoration:none;border-radius:4px;display:inline-block;">Review Document</a></p>
  <p style="margin-top:30px;padding-top:20px;border-top:1px solid #ccc;color:#999;font-size:12px;">From The Hart,<br><strong>HartFelt Compliance</strong></p>
</div></body></html>`,
              }],
            }),
          }).catch(() => {})
        }
      }
    } catch (notifErr) {
      console.error('Notification error (non-critical):', notifErr)
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
