import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'
import { ensureVaultForms } from '@/lib/vault-forward'
import { buildVaultChecklistItem } from '@/lib/compliance-checklist-mapping'
import { mapPortalTransactionTypeToVaultType } from '@/lib/portal-transaction-type'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// AGENT.SIGN.1B (Phase 0) — the required-document set is now sourced from Vault
// System A (deriveRequiredForms → form_instances) via ensure-forms, NOT from
// the legacy transaction_doc_requirements catalog (System B). The legacy read
// is retained ONLY as a fallback when Vault is unreachable, so the /compliance
// page never breaks. The response SHAPE (transaction / folders[] / stats /
// role) is preserved verbatim; a `source` field is added for observability.
//
// Sprint 8B Phase 2B RLS anchors (still enforced on the reads below):
//   transactions — agents see own; broker/admin see all (cross-user → 404).
//   documents    — own/deal-owner/broker-admin SELECT.
//   profiles     — profiles_select (public).

const folderOrder = [
  'listing_intake',
  'under_contract',
  'pre_closing',
  'closing',
  'compliance',
  'optional',
]
const folderLabels: Record<string, string> = {
  listing_intake: 'Intake / Listed',
  under_contract: 'Under Contract',
  pre_closing: 'Pre-Closing',
  closing: 'Closing',
  compliance: 'Compliance',
  optional: 'Optional',
}

function uploadedDocProjection(doc: any) {
  return {
    id: doc.id,
    name: doc.name,
    status: doc.status,
    file_path: doc.file_path,
    file_size: doc.file_size,
    mime_type: doc.mime_type,
    upload_date: doc.upload_date || doc.created_at,
    verified_date: doc.verified_date,
    signature_status: doc.signature_status || null,
    signature_notes: doc.signature_notes || null,
    reviewed_by: doc.reviewed_by || null,
    reviewed_at: doc.reviewed_at || null,
  }
}

// GET — document checklist for a transaction
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transaction_id')

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 })
    }

    const supabase = userClient(request)

    // RLS: agents see own only; cross-user agent → no row → 404 (no leak).
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .is('deleted_at', null)
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role || 'agent'

    // Uploaded documents for this transaction (used for upload/file status).
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('transaction_id', transactionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', transaction.agent_id)
      .single()

    // Match uploaded documents by name.
    const docsByName: Record<string, any> = {}
    for (const doc of documents || []) {
      const key = doc.name?.toLowerCase().trim()
      if (key && !docsByName[key]) docsByName[key] = doc
    }

    const folders: Record<string, any[]> = {}
    let source: 'vault' | 'legacy' = 'legacy'

    // ── AGENT.SIGN.1B — Vault System A (authoritative) ────────────────
    // Map the portal transaction type onto the Vault dispatch vocabulary
    // (AGENT.SIGN.1B.5). Unsupported legacy types (referral/wholesale/
    // double_close) are NOT sent to Vault; they use the legacy catalog.
    // Otherwise use Vault when it returns a NON-EMPTY rule set (supported
    // types always return their always_required forms, so length>0 is a
    // reliable "System A covers this" signal).
    const mapped = mapPortalTransactionTypeToVaultType(transaction.type)
    const ensured =
      mapped.supported && mapped.vaultType
        ? await ensureVaultForms(request, transactionId, mapped.vaultType)
        : { ok: false, status: 0, body: null }
    const vaultRequirements = ensured.ok ? ensured.body?.requirements : undefined

    if (Array.isArray(vaultRequirements) && vaultRequirements.length > 0) {
      source = 'vault'
      const vaultDocs = ensured.body?.documents || []
      const vaultDocByForm = new Map(vaultDocs.map((d) => [d.form_id, d]))

      let idx = 0
      for (const req of vaultRequirements) {
        const vaultDoc = vaultDocByForm.get(req.form_id) || null
        const matchedDoc = docsByName[req.form_name?.toLowerCase().trim()]
        const item = buildVaultChecklistItem(
          req,
          vaultDoc,
          matchedDoc ? uploadedDocProjection(matchedDoc) : null,
          idx++
        )
        if (!folders[item.folder]) folders[item.folder] = []
        folders[item.folder].push(item)
      }
    } else {
      // ── Legacy fallback: transaction_doc_requirements catalog ─────────
      // Only runs when Vault ensure-forms is unreachable/errored.
      const { data: requirements } = await supabase
        .from('transaction_doc_requirements')
        .select('*')
        .eq('transaction_type', transaction.type)
        .eq('is_active', true)
        .order('folder')
        .order('sort_order')

      const isFinanced = transaction.financing_type !== 'cash'
      const hasHoa = transaction.has_hoa === true
      const isPre1978 = transaction.year_built ? transaction.year_built < 1978 : true

      for (const req of requirements || []) {
        const folder = req.folder
        if (!folders[folder]) folders[folder] = []

        const matchedDoc = docsByName[req.doc_label?.toLowerCase().trim()]
        const condition = req.condition || null

        let conditionMet = true
        let conditionLabel: string | null = null
        if (condition === 'if_financed') {
          conditionMet = isFinanced
          conditionLabel = 'Required if Financed'
        } else if (condition === 'if_hoa') {
          conditionMet = hasHoa
          conditionLabel = 'Required if HOA'
        } else if (condition === 'if_pre1978') {
          conditionMet = isPre1978
          conditionLabel = 'Required if Pre-1978'
        } else if (condition === 'if_uploaded') {
          conditionMet = !!matchedDoc
          conditionLabel = 'Required once uploaded'
        }

        const effectiveRequired = req.is_required && conditionMet
        const isEffectiveRequired =
          condition === 'if_uploaded' ? !!matchedDoc : effectiveRequired

        folders[folder].push({
          requirement_id: req.id,
          doc_label: req.doc_label,
          is_required: isEffectiveRequired,
          signature_required: req.signature_required || false,
          condition,
          condition_met: conditionMet,
          condition_label: conditionLabel,
          folder: req.folder,
          sort_order: req.sort_order,
          document: matchedDoc ? uploadedDocProjection(matchedDoc) : null,
          status: matchedDoc
            ? matchedDoc.status === 'verified'
              ? 'approved'
              : matchedDoc.status === 'rejected'
              ? 'rejected'
              : 'uploaded'
            : 'missing',
        })
      }
    }

    // Include uploaded docs that don't match any requirement (both branches).
    const matchedLabels = new Set(
      Object.values(folders)
        .flat()
        .map((i: any) => i.doc_label?.toLowerCase().trim())
    )
    const unmatchedDocs = (documents || []).filter(
      (d) => !matchedLabels.has(d.name?.toLowerCase().trim())
    )
    if (unmatchedDocs.length > 0) {
      if (!folders['additional']) folders['additional'] = []
      for (const doc of unmatchedDocs) {
        folders['additional'].push({
          requirement_id: null,
          doc_label: doc.name,
          is_required: false,
          signature_required: false,
          folder: 'additional',
          sort_order: 99,
          document: uploadedDocProjection(doc),
          status:
            doc.status === 'verified'
              ? 'approved'
              : doc.status === 'rejected'
              ? 'rejected'
              : 'uploaded',
        })
      }
    }

    // Ordered folders + stats (unchanged shape).
    const orderedFolders = folderOrder
      .filter((f) => folders[f] && folders[f].length > 0)
      .map((f) => ({
        id: f,
        label: folderLabels[f] || f,
        items: folders[f],
        stats: {
          total: folders[f].length,
          required: folders[f].filter((i: any) => i.is_required).length,
          uploaded: folders[f].filter((i: any) => i.document).length,
          approved: folders[f].filter((i: any) => i.status === 'approved').length,
        },
      }))

    if (folders['additional']?.length) {
      orderedFolders.push({
        id: 'additional',
        label: 'Additional Documents',
        items: folders['additional'],
        stats: {
          total: folders['additional'].length,
          required: 0,
          uploaded: folders['additional'].length,
          approved: folders['additional'].filter((i: any) => i.status === 'approved')
            .length,
        },
      })
    }

    const allItems = Object.values(folders).flat()
    const stats = {
      total_required: allItems.filter((i: any) => i.is_required).length,
      total_docs: allItems.length,
      uploaded: allItems.filter((i: any) => i.document).length,
      approved: allItems.filter((i: any) => i.status === 'approved').length,
      rejected: allItems.filter((i: any) => i.status === 'rejected').length,
      missing: allItems.filter((i: any) => i.is_required && !i.document).length,
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
        compliance_approved: transaction.compliance_approved || false,
        compliance_approved_at: transaction.compliance_approved_at || null,
      },
      folders: orderedFolders,
      stats,
      role,
      source,
    })
  } catch (err) {
    console.error('Compliance checklist error:', err)
    return NextResponse.json({ error: 'Failed to load checklist' }, { status: 500 })
  }
}
