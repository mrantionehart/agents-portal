import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRateLimit, adminClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sprint 5D: per-route copies of getAuthedUser + tooManyUploads removed.
// Auth flows through requireAuth(); 429 responses flow through
// requireRateLimit() with the standardized { error: 'Too many requests' }
// shape. Existing interleaving (per-user limit BEFORE formData parse,
// per-transaction limit AFTER formData parse) is preserved.

// ============================================================================
// Server-side file signature validation (Sprint 6: M1)
// ============================================================================
// Pre-Sprint-6: allowedTypes was checked against the browser-supplied
// File.type, which any attacker can spoof by renaming an .exe to .pdf or
// by crafting a multipart request with an arbitrary Content-Type header.
//
// Post-Sprint-6: we read the first bytes of the uploaded file and verify
// the magic bytes match the claimed MIME type BEFORE writing to storage.
// Mismatches return 400 with [security:upload] log. No file contents and
// no full filenames are written to logs — only the claimed MIME, the
// claimed extension, and a redacted filename (***.<ext>).
//
// Allowed types tightened to exactly the formats checked here:
//   PDF · PNG · JPEG · DOCX · XLSX · PPTX
// DOC (application/msword) and TIFF (image/tiff) were dropped — they
// have weaker magic signatures and aren't currently used by compliance
// uploads. Operators can re-add them by extending SIGNATURE_VERIFIERS.
// ============================================================================

type SignatureVerifier = {
  /** Short label used for [security:upload] logs. */
  label: string
  /** True iff `head` matches expected magic AND extension lines up. */
  verify: (head: Uint8Array, ext: string) => boolean
}

const SIGNATURE_VERIFIERS: Record<string, SignatureVerifier> = {
  // %PDF
  'application/pdf': {
    label: 'pdf',
    verify: (head) => startsWith(head, [0x25, 0x50, 0x44, 0x46]),
  },
  // 89 50 4E 47 0D 0A 1A 0A
  'image/png': {
    label: 'png',
    verify: (head) =>
      startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  // FF D8 FF
  'image/jpeg': {
    label: 'jpeg',
    verify: (head) => startsWith(head, [0xff, 0xd8, 0xff]),
  },
  // PK\x03\x04 + .docx extension — guards against generic ZIPs being
  // accepted as Office documents.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    label: 'docx',
    verify: (head, ext) =>
      startsWith(head, [0x50, 0x4b, 0x03, 0x04]) && ext === 'docx',
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    label: 'xlsx',
    verify: (head, ext) =>
      startsWith(head, [0x50, 0x4b, 0x03, 0x04]) && ext === 'xlsx',
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    {
      label: 'pptx',
      verify: (head, ext) =>
        startsWith(head, [0x50, 0x4b, 0x03, 0x04]) && ext === 'pptx',
    },
}

const ALLOWED_LABEL = 'PDF, JPG, PNG, DOCX, XLSX, PPTX'

function startsWith(buf: Uint8Array, signature: number[]): boolean {
  if (buf.length < signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (buf[i] !== signature[i]) return false
  }
  return true
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

/**
 * Filename redaction for logs. Keeps the lowercased extension so ops can
 * see roughly what was rejected, masks the rest. Filenames have been
 * known to contain agent names, transaction addresses, deal-counterparty
 * names, etc. — none of which belong in observability streams.
 */
function redactFilename(name: string): string {
  const ext = getExtension(name)
  return ext ? `***.${ext}` : '***'
}

/**
 * Read the first 16 bytes of an upload — enough for every signature we
 * verify. Done via File.slice so the rest of the file remains streamable
 * and we don't double-buffer 50 MB into RAM just to check 4–8 bytes.
 */
async function readHeadBytes(file: File, n = 16): Promise<Uint8Array> {
  const ab = await file.slice(0, n).arrayBuffer()
  return new Uint8Array(ab)
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

    // ---- Validate claimed MIME (Sprint 6: M1, pre-check) ----
    // Cheap allowlist gate — the real defense is the magic-byte check
    // below. Both are required: this lets us 400-fast on completely
    // unsupported types without reading bytes; the magic check then
    // prevents type spoofing within the allowlist.
    const verifier = SIGNATURE_VERIFIERS[file.type]
    if (!verifier) {
      console.warn('[security:upload] disallowed claimed MIME', {
        claimedMime: file.type,
        filename: redactFilename(file.name),
      })
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_LABEL}` },
        { status: 400 }
      )
    }
    // ----------------------------------------------------------

    // Max 50MB — size gate before reading head bytes so a 1 GB upload
    // claiming PDF gets rejected before we touch ArrayBuffer.
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 50MB' }, { status: 400 })
    }

    // ---- Magic-byte validation (Sprint 6: M1) ----
    // Read first 16 bytes and verify they match the signature for the
    // claimed MIME. For Office Open XML formats (DOCX/XLSX/PPTX) the
    // ZIP-header check is paired with an extension assertion so a
    // generic ZIP cannot pose as a DOCX. file.name is never logged in
    // full — only the lowercased extension via redactFilename().
    let head: Uint8Array
    try {
      head = await readHeadBytes(file)
    } catch (headErr) {
      console.warn('[security:upload] head-bytes read failed', {
        claimedMime: file.type,
        filename: redactFilename(file.name),
        error: headErr instanceof Error ? headErr.message : String(headErr),
      })
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      )
    }
    const claimedExt = getExtension(file.name)
    if (!verifier.verify(head, claimedExt)) {
      console.warn('[security:upload] signature mismatch', {
        claimedMime: file.type,
        expected: verifier.label,
        claimedExt,
        filename: redactFilename(file.name),
        size: file.size,
      })
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      )
    }
    // ------------------------------------------------

    const admin = adminClient('compliance-upload-notification-fanout', { userId: user.id, context: 'POST /api/compliance/upload notification-fanout' })

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
