// ---------------------------------------------------------------------------
// CloseIQ Template Fields — /api/closeiq/templates/fields
// Extract form fields from an existing template, or preview fields from upload
// ---------------------------------------------------------------------------
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
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'PDF file required' }, { status: 400 })

    const { PDFDocument } = await import('pdf-lib')
    const fileBytes = Buffer.from(await file.arrayBuffer())
    const pdfDoc = await PDFDocument.load(fileBytes)
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
      is_fillable: fields.length > 0,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
