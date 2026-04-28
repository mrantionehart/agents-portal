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

// ── Send email via SendGrid ──────────────────────────────────
async function sendComplianceEmail(to: string, subject: string, htmlBody: string) {
  const sgApiKey = process.env.SENDGRID_API_KEY
  if (!sgApiKey || !to) return false

  try {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@hartfeltrealestate.com'
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sgApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: 'HartFelt Compliance' },
        subject,
        content: [{ type: 'text/html', value: htmlBody }],
      }),
    })
    return true
  } catch (err) {
    console.error('SendGrid email error:', err)
    return false
  }
}

// ── Create notification + send email ─────────────────────────
async function createNotification(
  admin: any,
  recipientId: string,
  transactionId: string,
  type: string,
  title: string,
  message: string,
  metadata: Record<string, any> = {},
  recipientEmail?: string
) {
  // Insert into compliance_notifications
  try {
    await admin.from('compliance_notifications').insert({
      recipient_id: recipientId,
      transaction_id: transactionId,
      notification_type: type,
      title,
      message,
      metadata,
    })
  } catch (err) {
    console.error('Failed to create notification:', err)
  }

  // Send email
  if (recipientEmail) {
    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agents.hartfeltrealestate.com'
    const emailSent = await sendComplianceEmail(
      recipientEmail,
      `HartFelt Compliance: ${title}`,
      `
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <h1 style="color:#1F4E78;border-bottom:3px solid #2E75B6;padding-bottom:10px;">
    ${title}
  </h1>
  <p style="font-size:16px;margin-top:20px;">${message}</p>
  ${metadata.property_address ? `
  <div style="background:#f0f9ff;padding:15px;border-left:4px solid #2E75B6;margin:20px 0;border-radius:4px;">
    <p style="margin:0;"><strong>Property:</strong> ${metadata.property_address}</p>
    ${metadata.doc_label ? `<p style="margin:8px 0 0;"><strong>Document:</strong> ${metadata.doc_label}</p>` : ''}
  </div>` : ''}
  <p>
    <a href="${portalUrl}/compliance"
       style="background:#2E75B6;color:white;padding:12px 30px;text-decoration:none;border-radius:4px;display:inline-block;">
      View in Compliance Checker
    </a>
  </p>
  <p style="margin-top:30px;padding-top:20px;border-top:1px solid #ccc;color:#999;font-size:12px;">
    From The Hart,<br><strong>HartFelt Real Estate Compliance</strong>
  </p>
</div>
</body></html>`
    )

    if (emailSent) {
      try {
        // Mark email as sent on the most recent notification
        const { data: notif } = await admin
          .from('compliance_notifications')
          .select('id')
          .eq('recipient_id', recipientId)
          .eq('notification_type', type)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (notif) {
          await admin
            .from('compliance_notifications')
            .update({ email_sent: true })
            .eq('id', notif.id)
        }
      } catch { /* non-critical */ }
    }
  }
}

// ── Check if all required docs are approved for a transaction ──
async function checkComplianceComplete(admin: any, transactionId: string): Promise<{
  complete: boolean
  missing: number
  unapproved: number
  missingSignatures: number
}> {
  // Get transaction with conditional fields
  const { data: tx } = await admin
    .from('transactions')
    .select('type, financing_type, has_hoa, year_built')
    .eq('id', transactionId)
    .single()

  if (!tx) return { complete: false, missing: 0, unapproved: 0, missingSignatures: 0 }

  // Get required documents for this type (include conditional ones)
  const { data: reqs } = await admin
    .from('transaction_doc_requirements')
    .select('doc_label, signature_required, is_required, condition')
    .eq('transaction_type', tx.type)
    .eq('is_active', true)

  if (!reqs || reqs.length === 0) return { complete: true, missing: 0, unapproved: 0, missingSignatures: 0 }

  // Get uploaded docs
  const { data: docs } = await admin
    .from('documents')
    .select('name, status, signature_status')
    .eq('transaction_id', transactionId)
    .is('deleted_at', null)

  const docsByLabel: Record<string, any> = {}
  for (const d of docs || []) {
    docsByLabel[d.name?.toLowerCase().trim()] = d
  }

  // Evaluate conditions
  const isFinanced = tx.financing_type !== 'cash'
  const hasHoa = tx.has_hoa === true
  const isPre1978 = tx.year_built ? tx.year_built < 1978 : true

  let missing = 0
  let unapproved = 0
  let missingSignatures = 0

  for (const req of reqs) {
    const doc = docsByLabel[req.doc_label?.toLowerCase().trim()]
    const condition = req.condition || null

    // Evaluate if this requirement applies
    let conditionMet = true
    if (condition === 'if_financed') conditionMet = isFinanced
    else if (condition === 'if_hoa') conditionMet = hasHoa
    else if (condition === 'if_pre1978') conditionMet = isPre1978
    else if (condition === 'if_uploaded') conditionMet = !!doc // only required if uploaded

    // Skip requirements where condition isn't met
    const effectiveRequired = condition === 'if_uploaded'
      ? !!doc  // if uploaded, must be approved
      : (req.is_required && conditionMet)

    if (!effectiveRequired) continue

    if (!doc) {
      missing++
    } else if (doc.status !== 'verified') {
      unapproved++
    }
    // Check signatures
    if (req.signature_required && doc && doc.signature_status === 'missing') {
      missingSignatures++
    }
    if (req.signature_required && !doc) {
      missingSignatures++
    }
  }

  return {
    complete: missing === 0 && unapproved === 0 && missingSignatures === 0,
    missing,
    unapproved,
    missingSignatures,
  }
}

// POST — approve, reject, or flag missing signature on a document
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check role
    const { data: profile } = await admin
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile || !['broker', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only broker/admin can review documents' }, { status: 403 })
    }

    const body = await request.json()
    const { document_id, action, signature_status, notes } = body as {
      document_id: string
      action: 'approve' | 'reject' | 'flag_signature'
      signature_status?: 'missing' | 'present'
      notes?: string
    }

    if (!document_id || !action) {
      return NextResponse.json({ error: 'Missing document_id or action' }, { status: 400 })
    }

    // Get document with transaction info
    const { data: doc } = await admin
      .from('documents')
      .select('*, transactions!inner(id, agent_id, property_address, city, type)')
      .eq('id', document_id)
      .is('deleted_at', null)
      .single()

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const agentId = doc.transactions.agent_id
    const txId = doc.transactions.id
    const propertyAddr = `${doc.transactions.property_address}, ${doc.transactions.city}`

    // Get agent profile for notifications
    const { data: agentProfile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', agentId)
      .single()

    const agentName = agentProfile?.full_name || 'Agent'
    const agentEmail = agentProfile?.email || ''

    // Handle action
    if (action === 'flag_signature') {
      // Flag missing or present signature
      const sigStatus = signature_status || 'missing'
      await admin
        .from('documents')
        .update({
          signature_status: sigStatus,
          signature_notes: notes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', document_id)

      if (sigStatus === 'missing') {
        // Notify agent about missing signature
        await createNotification(
          admin, agentId, txId,
          'missing_signature',
          `Missing Signature: ${doc.name}`,
          `${profile.full_name} flagged "${doc.name}" as missing a required signature for ${propertyAddr}. Please re-upload with the correct signature.`,
          { doc_label: doc.name, property_address: propertyAddr, reviewer: profile.full_name },
          agentEmail
        )
      }

      return NextResponse.json({
        document_id,
        signature_status: sigStatus,
        message: `Signature marked as ${sigStatus}`,
      })
    }

    // Approve or reject
    const newStatus = action === 'approve' ? 'verified' : 'rejected'
    const updateData: any = {
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      updateData.verified_date = new Date().toISOString()
      // If approving, mark signature as present (broker verified it)
      updateData.signature_status = 'present'
    }

    const { error: updateError } = await admin
      .from('documents')
      .update(updateData)
      .eq('id', document_id)

    if (updateError) throw updateError

    // Log to verification table
    try {
      await admin.from('document_verification_log').insert({
        document_id,
        verified_by: user.id,
        verification_type: 'manual',
        verification_status: action === 'approve' ? 'passed' : 'failed',
        notes: notes || `${action === 'approve' ? 'Approved' : 'Rejected'} by ${profile.full_name}`,
      })
    } catch { /* non-critical */ }

    // ── Notify agent ──────────────────────────────────────────
    if (action === 'approve') {
      await createNotification(
        admin, agentId, txId,
        'doc_approved',
        `Document Approved: ${doc.name}`,
        `${profile.full_name} approved "${doc.name}" for ${propertyAddr}.`,
        { doc_label: doc.name, property_address: propertyAddr, reviewer: profile.full_name },
        agentEmail
      )
    } else {
      await createNotification(
        admin, agentId, txId,
        'doc_rejected',
        `Document Rejected: ${doc.name}`,
        `${profile.full_name} rejected "${doc.name}" for ${propertyAddr}. ${notes ? `Reason: ${notes}` : 'Please re-upload the correct document.'}`,
        { doc_label: doc.name, property_address: propertyAddr, reviewer: profile.full_name, reason: notes },
        agentEmail
      )
    }

    // ── Check if ALL required docs are now approved ───────────
    const complianceStatus = await checkComplianceComplete(admin, txId)

    if (complianceStatus.complete) {
      // Mark transaction as compliance approved
      await admin
        .from('transactions')
        .update({
          compliance_approved: true,
          compliance_approved_at: new Date().toISOString(),
          compliance_approved_by: user.id,
        })
        .eq('id', txId)

      // Notify agent that compliance is complete & commission unlocked
      await createNotification(
        admin, agentId, txId,
        'compliance_complete',
        'Compliance Complete — Commission Unlocked!',
        `All required documents for ${propertyAddr} have been approved. Your commission is now eligible for payout.`,
        { property_address: propertyAddr },
        agentEmail
      )

      // Also notify broker
      await createNotification(
        admin, user.id, txId,
        'compliance_complete',
        `Compliance Complete: ${propertyAddr}`,
        `All required documents for ${agentName}'s transaction at ${propertyAddr} are now approved. Commission is cleared for payout.`,
        { property_address: propertyAddr, agent_name: agentName }
      )
    }

    return NextResponse.json({
      document_id,
      status: newStatus,
      reviewed_by: profile.full_name,
      compliance: complianceStatus,
      message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    })
  } catch (err) {
    console.error('Compliance review error:', err)
    return NextResponse.json({ error: 'Failed to review document' }, { status: 500 })
  }
}
