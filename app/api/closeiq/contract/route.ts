// ---------------------------------------------------------------------------
// CloseIQ Contract Generator — /api/closeiq/contract
// Fills Florida Realtors / FAR-BAR fillable PDF forms with offer data
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------
async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
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

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ---------------------------------------------------------------------------
// Default field mapping: offer data keys → common FAR-BAR PDF field names
// This serves as a fallback when a template has no custom mapping.
// Actual field names will vary per form — broker verifies mappings on upload.
// ---------------------------------------------------------------------------
const DEFAULT_FIELD_MAP: Record<string, string[]> = {
  // Buyer info
  buyer_name:         ['BuyerName', 'Buyer1Name', 'BUYER', 'Buyer Name', 'BuyerPrintedName'],
  buyer_email:        ['BuyerEmail', 'Buyer Email', 'BuyerEmailAddress'],
  buyer_phone:        ['BuyerPhone', 'Buyer Phone', 'BuyerPhoneNumber'],
  // Property
  property_address:   ['PropertyAddress', 'Property Address', 'PROPERTY_ADDRESS', 'StreetAddress', 'SubjectProperty'],
  property_city:      ['City', 'PropertyCity', 'CITY'],
  property_state:     ['State', 'PropertyState', 'STATE'],
  property_zip:       ['Zip', 'ZipCode', 'PropertyZip', 'ZIP'],
  property_mls_id:    ['MLSNumber', 'MLS', 'MLSNo', 'MLS#'],
  // Offer terms
  offer_price:        ['PurchasePrice', 'Purchase Price', 'PURCHASE_PRICE', 'OfferPrice', 'SalesPrice'],
  earnest_money:      ['EarnestMoney', 'Earnest Money', 'EMD', 'Deposit', 'EarnestMoneyDeposit'],
  financing_type:     ['FinancingType', 'Financing', 'LoanType', 'TypeOfFinancing'],
  down_payment_pct:   ['DownPayment', 'DownPaymentPercent', 'Down Payment'],
  close_date:         ['ClosingDate', 'Closing Date', 'CloseDate', 'CLOSING_DATE'],
  inspection_days:    ['InspectionPeriod', 'InspectionDays', 'Inspection Period'],
  concessions:        ['SellerConcessions', 'Concessions', 'SellerContributions'],
  // Agent info
  agent_name:         ['BuyerAgentName', 'BuyerAgent', 'Buyer Agent', 'ListingAgent'],
  agent_email:        ['BuyerAgentEmail', 'AgentEmail'],
  agent_phone:        ['BuyerAgentPhone', 'AgentPhone'],
  brokerage:          ['BrokerageName', 'Brokerage', 'Firm', 'BuyerBrokerage'],
  // Dates
  offer_date:         ['Date', 'OfferDate', 'ContractDate', 'DateOfOffer'],
  // Contingencies as text
  appraisal_contingency: ['AppraisalContingency', 'Appraisal'],
  financing_contingency: ['FinancingContingency', 'FinancingCont'],
}

// ---------------------------------------------------------------------------
// Fill PDF form fields using pdf-lib
// ---------------------------------------------------------------------------
async function fillPDFForm(
  pdfBytes: Buffer | Uint8Array,
  fieldValues: Record<string, string>,
  fieldMapping: Record<string, string> | null
): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const form = pdfDoc.getForm()
  const allFields = form.getFields()

  console.log(`PDF has ${allFields.length} form fields`)

  // Build a lookup: normalized field name → actual field object
  const fieldLookup: Record<string, any> = {}
  for (const field of allFields) {
    const name = field.getName()
    fieldLookup[name] = field
    // Also store lowercase version for fuzzy matching
    fieldLookup[name.toLowerCase()] = field
  }

  // For each piece of offer data, find the matching PDF field and fill it
  for (const [dataKey, value] of Object.entries(fieldValues)) {
    if (!value || value === 'null' || value === 'undefined') continue

    // First try custom mapping from template
    if (fieldMapping && fieldMapping[dataKey]) {
      const pdfFieldName = fieldMapping[dataKey]
      const field = fieldLookup[pdfFieldName] || fieldLookup[pdfFieldName.toLowerCase()]
      if (field) {
        try {
          const fieldType = field.constructor.name
          if (fieldType === 'PDFTextField') {
            field.setText(value)
          } else if (fieldType === 'PDFCheckBox') {
            if (value === 'true' || value === 'Yes' || value === '1') field.check()
            else field.uncheck()
          } else if (fieldType === 'PDFDropdown') {
            field.select(value)
          } else if (fieldType === 'PDFRadioGroup') {
            field.select(value)
          }
          console.log(`Filled ${pdfFieldName} = ${value.substring(0, 50)}`)
          continue // mapped successfully
        } catch (e: any) {
          console.warn(`Failed to fill mapped field ${pdfFieldName}: ${e.message}`)
        }
      }
    }

    // Fall back to default field map — try each candidate name
    const candidates = DEFAULT_FIELD_MAP[dataKey] || []
    let filled = false
    for (const candidate of candidates) {
      const field = fieldLookup[candidate] || fieldLookup[candidate.toLowerCase()]
      if (field) {
        try {
          const fieldType = field.constructor.name
          if (fieldType === 'PDFTextField') {
            field.setText(value)
          } else if (fieldType === 'PDFCheckBox') {
            if (value === 'true' || value === 'Yes' || value === '1') field.check()
            else field.uncheck()
          } else if (fieldType === 'PDFDropdown') {
            field.select(value)
          }
          console.log(`Filled ${candidate} (default map) = ${value.substring(0, 50)}`)
          filled = true
          break
        } catch (e: any) {
          console.warn(`Failed to fill ${candidate}: ${e.message}`)
        }
      }
    }

    if (!filled) {
      console.log(`No PDF field found for: ${dataKey}`)
    }
  }

  // Flatten the form so fields are rendered as static content (non-editable)
  // Comment this out if you want the output to remain fillable
  // form.flatten()

  const filledPdf = await pdfDoc.save()
  return Buffer.from(filledPdf)
}

// ---------------------------------------------------------------------------
// Build field values from offer + agent data
// ---------------------------------------------------------------------------
function buildFieldValues(offer: any, buyer: any, agentProfile: any): Record<string, string> {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const buyerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'TBD'

  return {
    buyer_name:         buyerName,
    buyer_email:        buyer.email || '',
    buyer_phone:        buyer.phone || '',
    property_address:   offer.property_address || '',
    property_city:      offer.property_city || '',
    property_state:     offer.property_state || 'FL',
    property_zip:       offer.property_zip || '',
    property_mls_id:    offer.property_mls_id || '',
    offer_price:        offer.offer_price ? Number(offer.offer_price).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '',
    earnest_money:      offer.earnest_money_amount ? Number(offer.earnest_money_amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '',
    financing_type:     (offer.financing_type || 'conventional').toUpperCase(),
    down_payment_pct:   offer.down_payment_pct ? `${offer.down_payment_pct}%` : '',
    close_date:         offer.close_date || '',
    inspection_days:    offer.inspection_days?.toString() || '10',
    concessions:        offer.concessions_requested ? Number(offer.concessions_requested).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00',
    agent_name:         agentProfile?.full_name || agentProfile?.email || 'Agent',
    agent_email:        agentProfile?.email || '',
    agent_phone:        agentProfile?.phone || '',
    brokerage:          'HartFelt Real Estate',
    offer_date:         today,
    appraisal_contingency: offer.appraisal_contingency ? 'Yes' : 'Waived',
    financing_contingency: offer.financing_contingency ? 'Yes' : 'Waived',
  }
}

// ---------------------------------------------------------------------------
// POST /api/closeiq/contract
// body: { offer_id, template_id? }
// If template_id given → fill that specific template
// If omitted → use default active contract template
// Returns: { contract_url, doc_id, file_name, fields_filled, fields_total }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const body = await request.json()
    const offerId = body.offer_id
    const templateId = body.template_id // optional — picks default if omitted

    if (!offerId) return NextResponse.json({ error: 'offer_id required' }, { status: 400 })

    // ── Fetch offer with buyer ──────────────────────────────────────────
    const { data: offer, error: offerErr } = await db
      .from('offers')
      .select('*, buyers(first_name, last_name, email, phone, financing_type, preapproval_amount)')
      .eq('id', offerId)
      .single()

    if (offerErr || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    if (offer.agent_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized for this offer' }, { status: 403 })
    }

    // ── Get agent profile ───────────────────────────────────────────────
    const { data: agentProfile } = await db
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .single()

    // ── Load template ───────────────────────────────────────────────────
    let templateQuery = db.from('contract_templates').select('*').eq('is_active', true)
    if (templateId) {
      templateQuery = templateQuery.eq('id', templateId)
    } else {
      // Default: first active contract template
      templateQuery = templateQuery.eq('category', 'contract').order('created_at', { ascending: true }).limit(1)
    }

    const { data: templates, error: tplErr } = await templateQuery

    if (tplErr || !templates || templates.length === 0) {
      return NextResponse.json({
        error: 'No contract template found. The broker needs to upload Florida Realtors form PDFs first.',
        code: 'NO_TEMPLATE',
      }, { status: 404 })
    }

    const template = templates[0]
    console.log(`Using template: ${template.name} (${template.slug})`)

    // ── Download blank PDF from storage ─────────────────────────────────
    const { data: pdfData, error: dlErr } = await db.storage
      .from('documents')
      .download(template.storage_path)

    if (dlErr || !pdfData) {
      console.error('Template download error:', dlErr?.message)
      return NextResponse.json({
        error: `Failed to load template PDF: ${dlErr?.message || 'not found'}`,
      }, { status: 500 })
    }

    const pdfBytes = Buffer.from(await pdfData.arrayBuffer())

    // ── Build field values from offer data ──────────────────────────────
    const buyer = offer.buyers || {}
    const fieldValues = buildFieldValues(offer, buyer, agentProfile)

    // ── Fill the PDF form ───────────────────────────────────────────────
    const fieldMapping = (template.field_mapping && typeof template.field_mapping === 'object')
      ? template.field_mapping as Record<string, string>
      : null

    const filledPdf = await fillPDFForm(pdfBytes, fieldValues, fieldMapping)

    // ── Upload filled PDF to storage ────────────────────────────────────
    const buyerName = `${buyer.first_name || 'buyer'}_${buyer.last_name || ''}`.trim().replace(/\s+/g, '_')
    const fileName = `${template.slug}_${buyerName}_${offerId.substring(0, 8)}_${Date.now()}.pdf`
    const storagePath = `contracts/${user.id}/${fileName}`

    const { error: uploadErr } = await db.storage
      .from('documents')
      .upload(storagePath, filledPdf, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr.message)
      // Fallback: return PDF inline as base64
      if (uploadErr.message.includes('not found') || uploadErr.message.includes('Bucket')) {
        const base64 = filledPdf.toString('base64')
        const dataUrl = `data:application/pdf;base64,${base64}`

        const { data: doc } = await db.from('offer_documents').insert({
          offer_id: offerId,
          doc_type: 'purchase_agreement',
          file_url: 'pending_storage',
          file_name: fileName,
          uploaded_by: user.id,
          template_id: template.id,
          status: 'uploaded',
        }).select().single()

        return NextResponse.json({
          contract_url: dataUrl,
          doc_id: doc?.id,
          file_name: fileName,
          template_name: template.name,
          fallback: true,
          message: 'Contract filled. Storage bucket may need to be created — PDF returned inline.',
        })
      }
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    // ── Get public URL ──────────────────────────────────────────────────
    const { data: urlData } = db.storage.from('documents').getPublicUrl(storagePath)
    const contractUrl = urlData?.publicUrl || ''

    // ── Create offer_documents record ───────────────────────────────────
    const { data: docRecord, error: docErr } = await db.from('offer_documents').insert({
      offer_id: offerId,
      doc_type: 'purchase_agreement',
      file_url: contractUrl,
      file_name: fileName,
      uploaded_by: user.id,
      template_id: template.id,
      status: 'uploaded',
    }).select().single()

    if (docErr) {
      console.error('offer_documents insert error:', docErr.message)
    }

    console.log(`Contract filled successfully: ${fileName} using template ${template.slug}`)

    return NextResponse.json({
      contract_url: contractUrl,
      doc_id: docRecord?.id,
      file_name: fileName,
      template_name: template.name,
      template_id: template.id,
    })

  } catch (err: any) {
    console.error('Contract generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/closeiq/contract?offer_id=...
// Lists all generated contracts for an offer
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const offerId = request.nextUrl.searchParams.get('offer_id')

    if (!offerId) return NextResponse.json({ error: 'offer_id required' }, { status: 400 })

    const { data: docs, error } = await db
      .from('offer_documents')
      .select('*, contract_templates(name, slug, category)')
      .eq('offer_id', offerId)
      .eq('doc_type', 'purchase_agreement')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ documents: docs || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
