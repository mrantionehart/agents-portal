// ---------------------------------------------------------------------------
// GET /api/compliance/document/[id]
//
// Returns a short-lived signed URL for one compliance document in the private
// `transaction-documents` bucket.
//
// WHY THIS EXISTS
// The Portal could upload compliance documents but had no way to retrieve
// them: the checklist route hands the client a `file_path`, the bucket is
// private, and nothing minted a signed URL. Staff had no authorized retrieval
// path at all — which also blocked denying public access to the equivalent
// WordPress files, because denial without a replacement route removes staff
// access at the same moment.
//
// AUTHORIZATION — identical rule to POST /api/compliance/upload, so a document
// can be read by exactly the people who could have written it:
//
//   public.documents INSERT policy ("Users can upload documents"):
//     auth.uid() = uploaded_by
//     AND (   transactions.agent_id = auth.uid()        -- OWNER
//          OR deals.agent_id        = auth.uid()        -- OWNER (deal)
//          OR profiles.role IN ('broker','admin') )     -- STAFF
//
//   * OWNER qualifies alone — no role term, no tenant term. Owning the subject
//     is the scope.
//   * STAFF additionally requires a matching, non-null tenant, because RLS
//     would have scoped that branch per row and this route runs on
//     adminClient, which BYPASSES RLS and can reach any document by id.
//
// KEY SAFETY — the stored `file_path` must sit under the document's own
// transaction prefix. Without that check a tampered or legacy row could point
// anywhere in the bucket and this endpoint would sign it, which is the failure
// mode `/api/training/sign-video` guards against with its `training/` prefix.
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, adminClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'transaction-documents'
const SIGNED_URL_TTL_SEC = 300 // 5 minutes — long enough to download, short enough not to be a share link
const DOCUMENT_STAFF_ROLES = ['broker', 'admin'] // public.documents INSERT policy

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const rawParams = (context as any).params
    const { id } = (rawParams && typeof rawParams.then === 'function')
      ? await rawParams
      : rawParams
    if (!id) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 })
    }

    const admin = adminClient('compliance-document-download', {
      userId: user.id,
      context: 'GET /api/compliance/document/[id]',
    })

    const { data: doc } = await admin
      .from('documents')
      .select('id, transaction_id, uploaded_by, file_path, name, original_filename, mime_type')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    // A document that does not exist and one the caller may not see are the
    // same 404: the id space is not enumerable from here.
    if (!doc || !doc.file_path || !doc.transaction_id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { data: transaction } = await admin
      .from('transactions')
      .select('id, agent_id, tenant_id')
      .eq('id', doc.transaction_id)
      .is('deleted_at', null)
      .single()

    if (!transaction) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'agent'
    const ownsTransaction = transaction.agent_id === user.id
    const isDocumentStaff = DOCUMENT_STAFF_ROLES.includes(role)

    const callerTenantId = ((profile as any)?.tenant_id ?? null) as string | null
    const txTenantId = ((transaction as any)?.tenant_id ?? null) as string | null

    if (!ownsTransaction) {
      if (!isDocumentStaff) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!callerTenantId || !txTenantId) {
        return NextResponse.json(
          {
            error: 'tenant_required',
            message:
              'Caller profile or transaction is missing tenant_id; cannot scope this document',
          },
          { status: 403 },
        )
      }
      if (callerTenantId !== txTenantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Key safety: the path must belong to this document's transaction.
    if (!doc.file_path.startsWith(`${doc.transaction_id}/`)) {
      console.error('[security:compliance-document] file_path outside its transaction prefix', {
        document_id: doc.id,
        transaction_id: doc.transaction_id,
      })
      return NextResponse.json({ error: 'Document not retrievable' }, { status: 409 })
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, SIGNED_URL_TTL_SEC, {
        download: doc.original_filename || doc.name || undefined,
      })

    if (signError || !signed?.signedUrl) {
      console.error('[security:compliance-document] signing failed', {
        document_id: doc.id,
        code: (signError as any)?.message ?? null,
      })
      return NextResponse.json({ error: 'Failed to prepare download' }, { status: 500 })
    }

    return NextResponse.json({
      url: signed.signedUrl,
      expires_in: SIGNED_URL_TTL_SEC,
      name: doc.name,
      original_filename: doc.original_filename,
      mime_type: doc.mime_type,
    })
  } catch (error) {
    console.error('Compliance document download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
