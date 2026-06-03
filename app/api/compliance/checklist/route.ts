import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Sprint 8B Phase 2B: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B Phase 2A:
//   transactions / Agents can view own transactions / SELECT / {public} /
//                  ((agent_id = auth.uid()) AND (deleted_at IS NULL))
//   transactions / Brokers and admins can view all transactions / SELECT /
//                  (broker/admin role check)
//   transaction_doc_requirements / doc_reqs_select / SELECT / {public} / true
//   documents / Users can view own documents       / SELECT (covers
//                uploaded_by OR deal-owner OR admin)
//   documents / documents_broker_admin_select      / SELECT (broker/admin)
//   profiles  / profiles_select                    / SELECT / {public} / true
// Net effect: agents see only their own transactions (RLS enforces); broker/
// admin see all (RLS enforces). The route's role-aware 403 short-circuit is
// no longer the sole gate — RLS does the work. The transaction read will
// simply return no row for a cross-user agent, which yields the existing
// "Transaction not found" 404 (slightly different from "Forbidden" 403, but
// indistinguishable for callers and arguably more secure — does not confirm
// the transaction exists).

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

    // Get the transaction — RLS filters: agents see own only, brokers/admins
    // see all. Cross-user agent attempts yield no row -> 404 (preferred
    // outcome — does not leak existence).
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .is('deleted_at', null)
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Get user role (own-row read via profiles_select). Used to populate
    // the response payload's `role` field; authorization itself is now
    // handled by RLS on the SELECT above.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'agent'

    // Get required documents for this transaction type (catalog read —
    // qual=true for {public}).
    const { data: requirements } = await supabase
      .from('transaction_doc_requirements')
      .select('*')
      .eq('transaction_type', transaction.type)
      .eq('is_active', true)
      .order('folder')
      .order('sort_order')

    // Get uploaded documents for this transaction.
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('transaction_id', transactionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Get agent profile (via profiles_select — qual=true).
    const { data: agentProfile } = await supabase
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
    const folderOrder = ['listing_intake', 'under_contract', 'pre_closing', 'closing', 'compliance', 'optional']
    const folderLabels: Record<string, string> = {
      listing_intake: 'Intake / Listed',
      under_contract: 'Under Contract',
      pre_closing: 'Pre-Closing',
      closing: 'Closing',
      compliance: 'Compliance',
      optional: 'Optional',
    }

    // ── Evaluate conditional requirements ──────────────────────
    // Conditions: if_financed, if_hoa, if_pre1978, if_uploaded
    const isFinanced = transaction.financing_type !== 'cash'
    const hasHoa = transaction.has_hoa === true
    const isPre1978 = transaction.year_built ? transaction.year_built < 1978 : true // default true (safer)

    for (const req of requirements || []) {
      const folder = req.folder
      if (!folders[folder]) folders[folder] = []

      const matchedDoc = docsByName[req.doc_label?.toLowerCase().trim()]
      const condition = req.condition || null

      // Evaluate whether this condition applies to this transaction
      let conditionMet = true // no condition = always applies
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
        // Optional until uploaded, then must be approved
        conditionMet = !!matchedDoc
        conditionLabel = 'Required once uploaded'
      }

      // Effective required status: base required AND condition met
      const effectiveRequired = req.is_required && conditionMet
      // For if_uploaded: becomes required once a doc is uploaded
      const isEffectiveRequired = condition === 'if_uploaded'
        ? !!matchedDoc  // required once uploaded regardless of is_required
        : effectiveRequired

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
          signature_status: matchedDoc.signature_status || null,
          signature_notes: matchedDoc.signature_notes || null,
          reviewed_by: matchedDoc.reviewed_by || null,
          reviewed_at: matchedDoc.reviewed_at || null,
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
          signature_required: false,
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
            signature_status: doc.signature_status || null,
            signature_notes: doc.signature_notes || null,
            reviewed_by: doc.reviewed_by || null,
            reviewed_at: doc.reviewed_at || null,
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
        compliance_approved: transaction.compliance_approved || false,
        compliance_approved_at: transaction.compliance_approved_at || null,
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
