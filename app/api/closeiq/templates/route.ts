// ---------------------------------------------------------------------------
// CloseIQ Template Admin — /api/closeiq/templates
// Upload, list, and manage Florida Realtors fillable PDF form templates
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
// Extract form field names from a fillable PDF using pdf-lib
// ---------------------------------------------------------------------------
async function extractFormFields(pdfBytes: Buffer | Uint8Array): Promise<{
  fields: Array<{ name: string; type: string; options?: string[] }>
  total: number
}> {
  const { PDFDocument } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const form = pdfDoc.getForm()
  const allFields = form.getFields()

  const fields = allFields.map(field => {
    const name = field.getName()
    const type = field.constructor.name
      .replace('PDF', '')
      .replace('Field', '')
      .toLowerCase() // e.g. "text", "checkbox", "dropdown", "radiogroup"

    const result: { name: string; type: string; options?: string[] } = { name, type }

    // For dropdowns, get the options
    if (type === 'dropdown') {
      try {
        result.options = (field as any).getOptions?.() || []
      } catch { /* ignore */ }
    }

    return result
  })

  return { fields, total: fields.length }
}

// ---------------------------------------------------------------------------
// AI-assisted field mapping: use Claude to map offer data keys to PDF fields
// ---------------------------------------------------------------------------
async function suggestFieldMapping(
  pdfFieldNames: string[],
  offerDataKeys: string[]
): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return {}

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `You are a real estate form mapping assistant. Given a list of PDF form field names and a list of offer data keys, create a JSON mapping from offer data keys to PDF field names. Only map fields where there is a clear match. Output ONLY a valid JSON object — no markdown, no explanation.`,
        messages: [{
          role: 'user',
          content: `Map these offer data keys to PDF form fields.

Offer data keys: ${JSON.stringify(offerDataKeys)}

PDF form field names: ${JSON.stringify(pdfFieldNames)}

Return a JSON object where keys are offer data keys and values are the matching PDF field names. Only include confident matches.`,
        }],
      }),
    })

    if (!resp.ok) return {}

    const data = await resp.json()
    const raw = data.content?.[0]?.text || ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch (e) {
    console.error('AI mapping suggestion failed:', e)
    return {}
  }
}

// ---------------------------------------------------------------------------
// GET /api/closeiq/templates
// List all templates (agents see active, broker sees all)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()

    // Check if user is broker
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    const isBroker = profile?.role === 'broker'

    let query = db.from('contract_templates').select('id, name, slug, category, description, form_version, is_active, mapping_verified, created_at, updated_at')

    if (!isBroker) {
      query = query.eq('is_active', true)
    }

    const { data: templates, error } = await query.order('category').order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates: templates || [], is_broker: isBroker })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/closeiq/templates
// Upload a new fillable PDF form template (broker only)
// body: FormData with file + metadata
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()

    // Verify broker role
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'broker') {
      return NextResponse.json({ error: 'Only brokers can upload templates' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string || ''
    const slug = formData.get('slug') as string || ''
    const category = formData.get('category') as string || 'contract'
    const description = formData.get('description') as string || ''
    const formVersion = formData.get('form_version') as string || ''

    if (!file) return NextResponse.json({ error: 'PDF file required' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Template name required' }, { status: 400 })
    if (!slug) return NextResponse.json({ error: 'Template slug required (e.g. far-bar-as-is)' }, { status: 400 })

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    // Read file bytes
    const fileBytes = Buffer.from(await file.arrayBuffer())

    // Extract form fields from the PDF
    let formFields: Array<{ name: string; type: string; options?: string[] }> = []
    let fieldCount = 0
    try {
      const extracted = await extractFormFields(fileBytes)
      formFields = extracted.fields
      fieldCount = extracted.total
      console.log(`Extracted ${fieldCount} form fields from ${file.name}`)
    } catch (e: any) {
      console.warn('Field extraction failed (may not be a fillable PDF):', e.message)
    }

    // Upload blank PDF to storage
    const storagePath = `templates/${slug}_${Date.now()}.pdf`
    const { error: uploadErr } = await db.storage
      .from('documents')
      .upload(storagePath, fileBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadErr) {
      console.error('Template upload error:', uploadErr.message)
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    // AI-suggest field mapping if we found fields
    let suggestedMapping: Record<string, string> = {}
    if (formFields.length > 0) {
      const offerDataKeys = [
        'buyer_name', 'buyer_email', 'buyer_phone',
        'property_address', 'property_city', 'property_state', 'property_zip', 'property_mls_id',
        'offer_price', 'earnest_money', 'financing_type', 'down_payment_pct',
        'close_date', 'inspection_days', 'concessions',
        'agent_name', 'agent_email', 'agent_phone', 'brokerage',
        'offer_date', 'appraisal_contingency', 'financing_contingency',
      ]
      const pdfFieldNames = formFields.map(f => f.name)
      suggestedMapping = await suggestFieldMapping(pdfFieldNames, offerDataKeys)
    }

    // Insert template record
    const { data: template, error: insertErr } = await db.from('contract_templates').insert({
      uploaded_by: user.id,
      name,
      slug,
      category,
      description,
      storage_path: storagePath,
      file_name: file.name,
      form_fields: formFields,
      field_mapping: suggestedMapping,
      mapping_verified: false,
      form_version: formVersion || null,
      is_active: true,
    }).select().single()

    if (insertErr) {
      console.error('Template insert error:', insertErr.message)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      template,
      form_fields: formFields,
      field_count: fieldCount,
      suggested_mapping: suggestedMapping,
      message: fieldCount > 0
        ? `Template uploaded with ${fieldCount} form fields detected. Review the suggested field mapping and verify.`
        : 'Template uploaded but no fillable form fields were detected. This may not be a fillable PDF.',
    })

  } catch (err: any) {
    console.error('Template upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/closeiq/templates
// Update field mapping or template settings (broker only)
// body: { template_id, field_mapping?, is_active?, mapping_verified?, name?, description? }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()

    // Verify broker role
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'broker') {
      return NextResponse.json({ error: 'Only brokers can update templates' }, { status: 403 })
    }

    const body = await request.json()
    const templateId = body.template_id
    if (!templateId) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

    // Build update payload — only include fields that were sent
    const updates: Record<string, any> = {}
    if (body.field_mapping !== undefined) updates.field_mapping = body.field_mapping
    if (body.mapping_verified !== undefined) updates.mapping_verified = body.mapping_verified
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.form_version !== undefined) updates.form_version = body.form_version

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: template, error } = await db
      .from('contract_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ template })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
