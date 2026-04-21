// ---------------------------------------------------------------------------
// CloseIQ Contract Generator — /api/closeiq/contract
// Fills Florida Realtors / FAR-BAR XFA + AcroForm PDF forms with offer data
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { inflate } from 'zlib'
import { promisify } from 'util'

const inflateAsync = promisify(inflate)

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
// XFA Global_Info field mapping: offer data keys → XFA XML paths
// Florida Realtors forms use XFA (XML Forms Architecture) with nested paths
// ---------------------------------------------------------------------------
const XFA_GLOBAL_MAP: Record<string, string> = {
  buyer_name:       'Buyer/Entity/Name',
  agent_name:       'Buyer/Broker/Agents/Agent/Name',
  brokerage:        'Buyer/Broker/Entity/Name',
  property_address: 'Property/Location/Address/Full',
  property_county:  'Property/Location/County/Name',
  property_parcel:  'Property/Location/County/Parcel',
  legal_description:'Property/Legal/Description/Full',
  offer_price:      'Sale/Price/Amount',
  close_date:       'Sale/ProjectedClosing/Date/Full',
  escrow_agent:     'Services/Provider/EscrowCompany/Agent/Name',
  escrow_address:   'Services/Provider/EscrowCompany/Agent/CompanyAddress',
  escrow_phone:     'Services/Provider/EscrowCompany/Agent/Phone',
  escrow_email:     'Services/Provider/EscrowCompany/Agent/Email',
  seller_name:      'Seller/Entity/Name',
  seller_agent:     'Seller/Broker/Agents/Agent/Name',
  seller_brokerage: 'Seller/Broker/Entity/Name',
}

// AcroForm fallback mapping (for non-XFA fillable PDFs)
const DEFAULT_FIELD_MAP: Record<string, string[]> = {
  buyer_name:         ['BuyerName', 'Buyer1Name', 'BUYER', 'Buyer Name'],
  buyer_email:        ['BuyerEmail', 'Buyer Email'],
  buyer_phone:        ['BuyerPhone', 'Buyer Phone'],
  property_address:   ['PropertyAddress', 'Property Address', 'StreetAddress'],
  property_city:      ['City', 'PropertyCity'],
  property_state:     ['State', 'PropertyState'],
  property_zip:       ['Zip', 'ZipCode', 'PropertyZip'],
  property_mls_id:    ['MLSNumber', 'MLS', 'MLSNo'],
  offer_price:        ['PurchasePrice', 'Purchase Price', 'OfferPrice', 'SalesPrice'],
  earnest_money:      ['EarnestMoney', 'Earnest Money', 'EMD', 'Deposit'],
  financing_type:     ['FinancingType', 'Financing', 'LoanType'],
  down_payment_pct:   ['DownPayment', 'DownPaymentPercent'],
  close_date:         ['ClosingDate', 'Closing Date', 'CloseDate'],
  inspection_days:    ['InspectionPeriod', 'InspectionDays'],
  concessions:        ['SellerConcessions', 'Concessions'],
  agent_name:         ['BuyerAgentName', 'BuyerAgent'],
  agent_email:        ['BuyerAgentEmail', 'AgentEmail'],
  agent_phone:        ['BuyerAgentPhone', 'AgentPhone'],
  brokerage:          ['BrokerageName', 'Brokerage', 'Firm'],
  offer_date:         ['Date', 'OfferDate', 'ContractDate'],
  appraisal_contingency: ['AppraisalContingency', 'Appraisal'],
  financing_contingency: ['FinancingContingency', 'FinancingCont'],
}

// ---------------------------------------------------------------------------
// Detect if a PDF is XFA-based
// ---------------------------------------------------------------------------
function isXfaPdf(pdfBytes: Buffer | Uint8Array): boolean {
  const str = Buffer.from(pdfBytes).toString('latin1', 0, Math.min(pdfBytes.length, 50000))
  return str.includes('/XFA')
}

// ---------------------------------------------------------------------------
// Fill XFA PDF: modify XFA datasets XML inside the PDF
// Works with Florida Realtors .xdp-based forms
// ---------------------------------------------------------------------------
async function fillXfaPdf(
  pdfBytes: Buffer | Uint8Array,
  fieldValues: Record<string, string>,
  fieldMapping: Record<string, string> | null
): Promise<Buffer> {
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

  // Access the raw AcroForm → XFA array
  const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'), PDFDict)
  if (!acroForm) throw new Error('No AcroForm found in PDF')

  const xfaArray = acroForm.lookup(PDFName.of('XFA'), PDFArray)
  if (!xfaArray) throw new Error('No XFA array found — not an XFA PDF')

  // Find the datasets stream index (key "datasets" followed by stream)
  let datasetsIndex = -1
  for (let i = 0; i < xfaArray.size(); i += 2) {
    const key = xfaArray.lookup(i)
    if (key?.toString?.()?.includes('datasets')) {
      datasetsIndex = i + 1
      break
    }
  }
  if (datasetsIndex === -1) throw new Error('datasets stream not found in XFA')

  // Read the datasets stream bytes
  const datasetsRef = xfaArray.get(datasetsIndex)
  const datasetsStream = pdfDoc.context.lookup(datasetsRef)
  let xmlStr: string

  if (datasetsStream instanceof PDFRawStream) {
    const rawBytes = datasetsStream.contents
    const filterDict = (datasetsStream as any).dict
    const filter = filterDict?.get?.(PDFName.of('Filter'))
    if (filter && filter.toString().includes('FlateDecode')) {
      const inflated = await inflateAsync(Buffer.from(rawBytes))
      xmlStr = inflated.toString('utf-8')
    } else {
      xmlStr = Buffer.from(rawBytes).toString('utf-8')
    }
  } else {
    // Fallback: try direct access
    xmlStr = Buffer.from((datasetsStream as any).contents || []).toString('utf-8')
  }

  // Normalize XFA XML: Form Simplicity outputs newlines before > and />
  xmlStr = xmlStr.replace(/\n\s*>/g, '>').replace(/\n\s*\/>/g, '/>')

  console.log(`XFA datasets XML: ${xmlStr.length} bytes`)

  // ── Fill Global_Info fields via XML string manipulation ──────────────
  // The Global_Info section has nested XML like:
  //   <Global_Info><Buyer><Entity><Name/></Entity></Buyer>...
  // We replace empty self-closing tags or empty element pairs with values
  let filledCount = 0

  for (const [dataKey, value] of Object.entries(fieldValues)) {
    if (!value || value === 'null' || value === 'undefined') continue

    // Check custom mapping first
    const xfaPath = fieldMapping?.[dataKey] || XFA_GLOBAL_MAP[dataKey]
    if (!xfaPath) continue

    // The XFA path like "Buyer/Entity/Name" means we need to find
    // the leaf element "Name" inside the nested path and set its text
    const parts = xfaPath.split('/')
    const leafTag = parts[parts.length - 1]

    // Build regex patterns to match the leaf element in context
    // Handle both self-closing <Name/> and empty <Name></Name> and <Name\n/>
    const escapedTag = leafTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Try self-closing first: <Name/> or <Name \n/>
    const selfClosing = new RegExp(`(<${escapedTag})\\s*/>`, 'g')
    // Try empty pair: <Name></Name> or <Name\n></Name\n>
    const emptyPair = new RegExp(`(<${escapedTag}[^>]*>)\\s*(</${escapedTag}[^>]*>)`, 'g')

    const xmlBefore = xmlStr
    // Escape XML special chars in value
    const safeValue = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // Replace self-closing
    xmlStr = xmlStr.replace(selfClosing, `<${leafTag}>${safeValue}</${leafTag}>`)
    // Replace empty pairs
    if (xmlStr === xmlBefore) {
      xmlStr = xmlStr.replace(emptyPair, `<${leafTag}>${safeValue}</${leafTag}>`)
    }

    if (xmlStr !== xmlBefore) {
      console.log(`XFA filled: ${dataKey} → ${leafTag} = ${value.substring(0, 40)}`)
      filledCount++
    }
  }

  // ── Also fill page-level fields (p01tf001, etc.) if custom mapping ──
  if (fieldMapping) {
    for (const [dataKey, pdfFieldName] of Object.entries(fieldMapping)) {
      const value = fieldValues[dataKey]
      if (!value || value === 'null' || value === 'undefined') continue
      // Skip if already handled by XFA_GLOBAL_MAP
      if (XFA_GLOBAL_MAP[dataKey]) continue

      const escaped = pdfFieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const safeValue = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

      const selfClosing = new RegExp(`(<${escaped})\\s*/>`)
      const emptyPair = new RegExp(`(<${escaped}[^>]*>)\\s*(</${escaped}[^>]*>)`)

      const before = xmlStr
      xmlStr = xmlStr.replace(selfClosing, `<${pdfFieldName}>${safeValue}</${pdfFieldName}>`)
      if (xmlStr === before) {
        xmlStr = xmlStr.replace(emptyPair, `<${pdfFieldName}>${safeValue}</${pdfFieldName}>`)
      }
      if (xmlStr !== before) {
        console.log(`XFA page field: ${pdfFieldName} = ${value.substring(0, 40)}`)
        filledCount++
      }
    }
  }

  console.log(`XFA form: filled ${filledCount} fields`)

  // Write modified XML back as a new stream
  const newXmlBytes = Buffer.from(xmlStr, 'utf-8')
  const newStream = pdfDoc.context.stream(newXmlBytes)
  xfaArray.set(datasetsIndex, pdfDoc.context.register(newStream))

  const savedPdf = await pdfDoc.save()
  return Buffer.from(savedPdf)
}

// ---------------------------------------------------------------------------
// Fill AcroForm PDF (standard fillable PDFs — non-XFA)
// ---------------------------------------------------------------------------
async function fillAcroFormPdf(
  pdfBytes: Buffer | Uint8Array,
  fieldValues: Record<string, string>,
  fieldMapping: Record<string, string> | null
): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const form = pdfDoc.getForm()
  const allFields = form.getFields()

  console.log(`AcroForm PDF has ${allFields.length} form fields`)

  const fieldLookup: Record<string, any> = {}
  for (const field of allFields) {
    const name = field.getName()
    fieldLookup[name] = field
    fieldLookup[name.toLowerCase()] = field
  }

  for (const [dataKey, value] of Object.entries(fieldValues)) {
    if (!value || value === 'null' || value === 'undefined') continue

    // Custom mapping first
    if (fieldMapping && fieldMapping[dataKey]) {
      const pdfFieldName = fieldMapping[dataKey]
      const field = fieldLookup[pdfFieldName] || fieldLookup[pdfFieldName.toLowerCase()]
      if (field) {
        try {
          const fieldType = field.constructor.name
          if (fieldType === 'PDFTextField') field.setText(value)
          else if (fieldType === 'PDFCheckBox') {
            if (value === 'true' || value === 'Yes' || value === '1') field.check()
            else field.uncheck()
          } else if (fieldType === 'PDFDropdown') field.select(value)
          console.log(`Filled ${pdfFieldName} = ${value.substring(0, 50)}`)
          continue
        } catch (e: any) {
          console.warn(`Failed to fill ${pdfFieldName}: ${e.message}`)
        }
      }
    }

    // Default field map fallback
    const candidates = DEFAULT_FIELD_MAP[dataKey] || []
    for (const candidate of candidates) {
      const field = fieldLookup[candidate] || fieldLookup[candidate.toLowerCase()]
      if (field) {
        try {
          const fieldType = field.constructor.name
          if (fieldType === 'PDFTextField') field.setText(value)
          else if (fieldType === 'PDFCheckBox') {
            if (value === 'true' || value === 'Yes' || value === '1') field.check()
            else field.uncheck()
          } else if (fieldType === 'PDFDropdown') field.select(value)
          console.log(`Filled ${candidate} (default) = ${value.substring(0, 50)}`)
          break
        } catch (e: any) {
          console.warn(`Failed to fill ${candidate}: ${e.message}`)
        }
      }
    }
  }

  const filledPdf = await pdfDoc.save()
  return Buffer.from(filledPdf)
}

// ---------------------------------------------------------------------------
// Unified fill: auto-detects XFA vs AcroForm
// ---------------------------------------------------------------------------
async function fillPDFForm(
  pdfBytes: Buffer | Uint8Array,
  fieldValues: Record<string, string>,
  fieldMapping: Record<string, string> | null
): Promise<Buffer> {
  if (isXfaPdf(pdfBytes)) {
    console.log('Detected XFA PDF — using XFA filler')
    return fillXfaPdf(pdfBytes, fieldValues, fieldMapping)
  } else {
    console.log('Detected AcroForm PDF — using standard filler')
    return fillAcroFormPdf(pdfBytes, fieldValues, fieldMapping)
  }
}

// ---------------------------------------------------------------------------
// Build field values from offer + agent data
// ---------------------------------------------------------------------------
function buildFieldValues(offer: any, buyer: any, agentProfile: any): Record<string, string> {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const buyerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'TBD'

  // Build full address for XFA forms (street, city, state zip)
  const fullAddress = [
    offer.property_address,
    offer.property_city,
    `${offer.property_state || 'FL'} ${offer.property_zip || ''}`
  ].filter(Boolean).join(', ')

  return {
    // ── Core fields (used by both XFA and AcroForm) ──
    buyer_name:         buyerName,
    buyer_email:        buyer.email || '',
    buyer_phone:        buyer.phone || '',
    property_address:   fullAddress || offer.property_address || '',
    property_city:      offer.property_city || '',
    property_state:     offer.property_state || 'FL',
    property_zip:       offer.property_zip || '',
    property_mls_id:    offer.property_mls_id || '',
    property_county:    offer.property_county || 'Miami-Dade',
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
    const templateSlug = body.template_slug // optional — alternative to template_id

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
    } else if (templateSlug) {
      templateQuery = templateQuery.eq('slug', templateSlug)
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
    console.log(`Using template: ${template.name} (${template.slug}) [form_type=${template.form_type || 'auto-detect'}]`)

    // Warn (but don't block) if mapping hasn't been broker-verified
    const mappingWarning = !template.mapping_verified
      ? 'Field mapping has not been verified by the broker — some fields may be incorrect.'
      : null

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

    // Use stored form_type if available, otherwise auto-detect
    let filledPdf: Buffer
    if (template.form_type === 'xfa') {
      console.log('Using stored form_type: XFA')
      filledPdf = await fillXfaPdf(pdfBytes, fieldValues, fieldMapping)
    } else if (template.form_type === 'acroform') {
      console.log('Using stored form_type: AcroForm')
      filledPdf = await fillAcroFormPdf(pdfBytes, fieldValues, fieldMapping)
    } else {
      // Auto-detect fallback
      filledPdf = await fillPDFForm(pdfBytes, fieldValues, fieldMapping)
    }

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
          ...(mappingWarning && { warning: mappingWarning }),
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
      ...(mappingWarning && { warning: mappingWarning }),
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
