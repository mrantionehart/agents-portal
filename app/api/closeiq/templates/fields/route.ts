// ---------------------------------------------------------------------------
// CloseIQ Template Fields — /api/closeiq/templates/fields
// Extract form fields from an existing template, or preview fields from upload
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { inflate } from 'zlib'
import { promisify } from 'util'

const inflateAsync = promisify(inflate)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
// GET /api/closeiq/templates/fields?template_id=...
// Returns the form fields and current mapping for a template
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const templateId = request.nextUrl.searchParams.get('template_id')
    if (!templateId) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

    const { data: template, error } = await db
      .from('contract_templates')
      .select('id, name, slug, form_fields, field_mapping, mapping_verified')
      .eq('id', templateId)
      .single()

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Also provide the list of offer data keys for mapping UI
    const offerDataKeys = [
      { key: 'buyer_name', label: 'Buyer Full Name' },
      { key: 'buyer_email', label: 'Buyer Email' },
      { key: 'buyer_phone', label: 'Buyer Phone' },
      { key: 'property_address', label: 'Property Address' },
      { key: 'property_city', label: 'City' },
      { key: 'property_state', label: 'State' },
      { key: 'property_zip', label: 'ZIP Code' },
      { key: 'property_mls_id', label: 'MLS Number' },
      { key: 'offer_price', label: 'Purchase Price' },
      { key: 'earnest_money', label: 'Earnest Money Deposit' },
      { key: 'financing_type', label: 'Financing Type' },
      { key: 'down_payment_pct', label: 'Down Payment %' },
      { key: 'close_date', label: 'Closing Date' },
      { key: 'inspection_days', label: 'Inspection Period (days)' },
      { key: 'concessions', label: 'Seller Concessions' },
      { key: 'agent_name', label: 'Buyer Agent Name' },
      { key: 'agent_email', label: 'Agent Email' },
      { key: 'agent_phone', label: 'Agent Phone' },
      { key: 'brokerage', label: 'Brokerage Name' },
      { key: 'offer_date', label: 'Offer Date' },
      { key: 'appraisal_contingency', label: 'Appraisal Contingency' },
      { key: 'financing_contingency', label: 'Financing Contingency' },
    ]

    return NextResponse.json({
      template_id: template.id,
      template_name: template.name,
      form_fields: template.form_fields || [],
      field_mapping: template.field_mapping || {},
      mapping_verified: template.mapping_verified,
      offer_data_keys: offerDataKeys,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/closeiq/templates/fields
// Preview: extract fields from an uploaded PDF without saving as template
// body: FormData with file
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Detect XFA and extract fields (same logic as templates/route.ts)
// ---------------------------------------------------------------------------
function isXfaPdf(pdfBytes: Buffer | Uint8Array): boolean {
  const str = Buffer.from(pdfBytes).toString('latin1', 0, Math.min(pdfBytes.length, 50000))
  return str.includes('/XFA') && str.includes('xfa-data')
}

async function extractXfaFields(pdfBytes: Buffer | Uint8Array): Promise<
  Array<{ name: string; type: string }>
> {
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

  const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'), PDFDict)
  if (!acroForm) return []

  const xfaArray = acroForm.lookup(PDFName.of('XFA'), PDFArray)
  if (!xfaArray) return []

  let datasetsIndex = -1
  for (let i = 0; i < xfaArray.size(); i += 2) {
    const key = xfaArray.lookup(i)
    if (key?.toString?.()?.includes('datasets')) {
      datasetsIndex = i + 1
      break
    }
  }
  if (datasetsIndex === -1) return []

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
    xmlStr = Buffer.from((datasetsStream as any).contents || []).toString('utf-8')
  }

  const fields: Array<{ name: string; type: string }> = []

  // Global_Info fields
  const globalMatch = xmlStr.match(/<Global_Info>([\s\S]*?)<\/Global_Info>/)
  if (globalMatch) {
    const globalXml = globalMatch[1]
    const leafPattern = /<([A-Za-z_][A-Za-z0-9_]*)\s*\/>/g
    const emptyPattern = /<([A-Za-z_][A-Za-z0-9_]*)[^>]*><\/\1>/g
    const filledPattern = /<([A-Za-z_][A-Za-z0-9_]*)>([^<]+)<\/\1>/g
    const seen = new Set<string>()
    for (const pattern of [leafPattern, emptyPattern, filledPattern]) {
      let m
      while ((m = pattern.exec(globalXml)) !== null) {
        const name = `Global_Info-${m[1]}`
        if (!seen.has(name)) { seen.add(name); fields.push({ name, type: 'text' }) }
      }
    }
  }

  // Page-level fields
  const seen = new Set<string>()
  for (const pattern of [
    /<(p\d{2}(?:tf|cb|df|nf)\d{3})\s*\/>/g,
    /<(p\d{2}(?:tf|cb|df|nf)\d{3})[^>]*>([^<]*)<\/\1>/g,
    /<(p\d{2}(?:tf|cb|df|nf)\d{3})[^>]*><\/\1>/g,
  ]) {
    let m
    while ((m = pattern.exec(xmlStr)) !== null) {
      const name = m[1]
      if (!seen.has(name)) {
        seen.add(name)
        const prefix = name.match(/(tf|cb|df|nf)/)?.[1] || 'tf'
        const type = prefix === 'cb' ? 'checkbox' : prefix === 'df' ? 'date' : prefix === 'nf' ? 'numeric' : 'text'
        fields.push({ name, type })
      }
    }
  }

  return fields
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'PDF file required' }, { status: 400 })

    const fileBytes = Buffer.from(await file.arrayBuffer())

    // Try XFA first (Florida Realtors forms)
    if (isXfaPdf(fileBytes)) {
      try {
        const xfaFields = await extractXfaFields(fileBytes)
        if (xfaFields.length > 0) {
          return NextResponse.json({
            file_name: file.name,
            field_count: xfaFields.length,
            fields: xfaFields,
            form_type: 'xfa',
            is_fillable: true,
          })
        }
      } catch (e: any) {
        console.warn('XFA extraction failed, falling back to AcroForm:', e.message)
      }
    }

    // Fall back to AcroForm
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true })
    const form = pdfDoc.getForm()
    const allFields = form.getFields()

    const fields = allFields.map(field => {
      const name = field.getName()
      const type = field.constructor.name.replace('PDF', '').replace('Field', '').toLowerCase()
      const result: { name: string; type: string; options?: string[] } = { name, type }
      if (type === 'dropdown') {
        try { result.options = (field as any).getOptions?.() || [] } catch {}
      }
      return result
    })

    return NextResponse.json({
      file_name: file.name,
      field_count: fields.length,
      fields,
      form_type: fields.length > 0 ? 'acroform' : 'none',
      is_fillable: fields.length > 0,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
