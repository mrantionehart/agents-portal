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
      .select('id, agent_id, tenant_id, type, property_address')
      .eq('id', transactionId)
      .is('deleted_at', null)
      .single()

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check role
    // SEC-COMPLIANCE-TENANT-1 — also pull tenant_id so both the access
    // decision below and the recipient fan-out further down are bounded to
    // one tenant. Neither MUST cross tenants under any role, including the
    // platform super-admin (same contract as P0-41 on calendar/events).
    const { data: profile } = await admin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    // SEC-COMPLIANCE-TENANT-1 — mirror the authorization the database
    // already states for this table rather than inventing a band. The
    // INSERT policy on public.documents ("Users can upload documents") is:
    //
    //   auth.uid() = uploaded_by
    //   AND (   transactions.agent_id = auth.uid()            -- owns the txn
    //        OR deals.agent_id        = auth.uid()            -- owns the deal
    //        OR profiles.role IN ('broker','admin') )         -- staff
    //
    // Two things follow, and the structure below mirrors both.
    //
    // (1) The owner branches carry NO role term and NO tenant term. Owning
    //     the subject is itself the scope: `transactions.agent_id` can only
    //     point at the caller for work assigned to the caller. So ownership
    //     qualifies on its own, whatever the role. That is why the previous
    //     `role === 'agent'` literal was wrong in both directions — too
    //     narrow, because `new_agent` also owns transactions
    //     (app/api/transactions/create/route.ts), and too permissive,
    //     because every role other than 'agent' skipped the check entirely.
    //
    // (2) The staff branch carries no tenant term either, but RLS evaluates
    //     it per row under a real session. This route runs on `adminClient`,
    //     which BYPASSES RLS, and it reaches any transaction by id. Tenant
    //     containment is the code-side equivalent of the row scope RLS
    //     would have applied, so it is required on the staff branch:
    //     without it a broker in tenant A could upload onto a tenant-B
    //     transaction and fan the notification out across every tenant.
    //     Precedent for inline tenant derivation via `adminClient` is
    //     documented in lib/security/withServiceRole.ts
    //     (`sec3a-new-leads-tenant-scope`, `r3b-intakes-tenant-scope`).
    //
    // On the deal branch: this route's insert never sets `documents.deal_id`
    // (see the insert below — a guard test pins that), so for every row it
    // writes `documents.deal_id` is NULL and the policy's `deals` EXISTS is
    // false by construction. The policy therefore reduces, for THIS route's
    // writes, to ownership-of-the-transaction OR staff. If `deal_id` is ever
    // added to that insert, this check has to be extended to deal owners.
    //
    // `user_role` is a Postgres enum with 8 labels: agent, admin, broker,
    // tc, manager, new_agent, office_manager, internal_staff. Being outside
    // ('broker','admin') means no STAFF-level reach — it is NOT a
    // categorical denial of the role, because any of them still qualifies
    // by owning the transaction.
    const DOCUMENT_STAFF_ROLES = ['broker', 'admin'] // public.documents INSERT policy

    const role = profile?.role || 'agent'
    const ownsTransaction = transaction.agent_id === user.id
    const isDocumentStaff = DOCUMENT_STAFF_ROLES.includes(role)

    // Anchor on the TRANSACTION's tenant_id: it is written by the
    // `trg_set_transaction_tenant_id` BEFORE INSERT trigger, so it is
    // populated for every row rather than depending on an insert payload.
    const callerTenantId = ((profile as any)?.tenant_id ?? null) as
      | string
      | null
    const txTenantId = ((transaction as any)?.tenant_id ?? null) as
      | string
      | null

    if (!ownsTransaction) {
      if (!isDocumentStaff) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // Staff branch only. Fail closed when either side has no tenant: a
      // tenant-less caller has no scope to act in, and a tenant-less
      // transaction none to be acted on.
      if (!callerTenantId || !txTenantId) {
        return NextResponse.json(
          {
            error: 'tenant_required',
            message:
              'Caller profile or transaction is missing tenant_id; cannot scope this compliance upload',
          },
          { status: 403 },
        )
      }
      if (callerTenantId !== txTenantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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
    // SEC-COMPLIANCE-TENANT-1 — these outcomes used to be discarded. The
    // insert was `.then(undefined, () => {})` and the mail send was
    // `.catch(() => {})`, so both failed invisibly: production holds 0
    // `compliance_notifications` rows against existing `documents`, which
    // is only consistent with the insert having been failing all along.
    //
    // The upload itself still succeeds when a notification fails — a stored
    // compliance document must not be lost because a notification broke —
    // but the failure is now counted, logged and returned instead of
    // silently dropped. Only the insert is awaited, so only insert counts
    // are settled by the time we respond; mail is still dispatched without
    // blocking and its outcome is logged, not reported.
    const notify = { recipients: 0, inserted: 0, insertFailed: 0, debounced: 0, failed: false, untenanted: false }
    try {
      // SEC-COMPLIANCE-TENANT-1 — tenant-scoped recipient query. The prior
      // version selected every broker/admin profile with no tenant filter,
      // so a compliance document uploaded on one tenant's transaction
      // notified brokers/admins in every tenant (in-app row AND SendGrid
      // mail). Anchored on the transaction's tenant — the subject of the
      // notification — which the guard above proved equals the caller's.
      // Profiles with tenant_id IS NULL are naturally excluded because
      // PostgREST `.eq('tenant_id', X)` compares by equality (NULL never
      // equals X).
      // An owner may upload to a transaction with no tenant_id (the owner
      // branch has no tenant term). There is no audience to scope to in
      // that case, so fan out to nobody rather than to everybody.
      if (!txTenantId) {
        notify.untenanted = true
        console.warn('[security:compliance-upload] transaction has no tenant_id; notification fan-out skipped', {
          transaction_id: transactionId,
        })
      }

      const { data: brokers } = txTenantId
        ? await admin
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['broker', 'admin'])
        .eq('tenant_id', txTenantId)
        // Deactivated accounts must not keep receiving compliance
        // documents. requireAuth() already gates is_active for the
        // CALLER, but recipients are not callers. Safe to filter on
        // equality here: no profiles row has is_active IS NULL.
        .eq('is_active', true)
        // Precedent (P0-41 on calendar/events) excludes the actor from
        // their own fan-out on every channel.
        .neq('id', user.id)
        : { data: [] as { id: string; email: string | null; full_name: string | null }[] }

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

      notify.recipients = (brokers || []).length

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
          notify.debounced++
          continue
        }

        // In-app notification
        const { error: notifError } = await admin.from('compliance_notifications').insert({
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
        })

        if (notifError) {
          notify.insertFailed++
          // IDs and the driver's own codes only. No broker email, no
          // document body, no property address.
          console.error('[security:compliance-upload] notification insert failed', {
            recipient_id: broker.id,
            transaction_id: transactionId,
            notification_type: 'doc_uploaded',
            code: notifError.code ?? null,
            message: notifError.message ?? null,
          })
        } else {
          notify.inserted++
        }

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
          })
            .then((mailRes) => {
              if (!mailRes.ok) {
                console.error('[security:compliance-upload] notification mail rejected', {
                  recipient_id: broker.id,
                  transaction_id: transactionId,
                  status: mailRes.status,
                })
              }
            })
            .catch((mailErr) => {
              console.error('[security:compliance-upload] notification mail threw', {
                recipient_id: broker.id,
                transaction_id: transactionId,
                message: mailErr instanceof Error ? mailErr.message : null,
              })
            })
        }
      }
    } catch (notifErr) {
      notify.failed = true
      console.error('Notification error (non-critical):', notifErr)
    }

    return NextResponse.json({
      document: newDoc,
      message: 'Document uploaded successfully',
      // Settled insert outcomes. `failed: true` means the fan-out block
      // itself threw, so the counts below are incomplete.
      notifications: notify,
    })
  } catch (err) {
    console.error('Compliance upload error:', err)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}
