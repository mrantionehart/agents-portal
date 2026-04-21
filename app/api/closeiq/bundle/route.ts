// ---------------------------------------------------------------------------
// CloseIQ Offer Bundle — /api/closeiq/bundle
// Merges contract PDF + cover letter + supporting docs into one package
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth helper (shared pattern)
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
// Build a cover letter page as a simple PDF
// Uses pdf-lib to create a single page with the letter text
// ---------------------------------------------------------------------------
async function createCoverLetterPdf(text: string, buyerName: string, propertyAddress: string): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.TimesRoman)
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold)

  const pageWidth = 612  // US Letter
  const pageHeight = 792
  const margin = 72       // 1 inch
  const lineHeight = 16
  const fontSize = 11
  const maxWidth = pageWidth - margin * 2

  // Word-wrap helper
  function wrapText(txt: string, fnt: typeof font, size: number, max: number): string[] {
    const lines: string[] = []
    const paragraphs = txt.split('\n')
    for (const para of paragraphs) {
      if (!para.trim()) { lines.push(''); continue }
      const words = para.split(/\s+/)
      let currentLine = ''
      for (const word of words) {
        const test = currentLine ? `${currentLine} ${word}` : word
        if (fnt.widthOfTextAtSize(test, size) <= max) {
          currentLine = test
        } else {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        }
      }
      if (currentLine) lines.push(currentLine)
    }
    return lines
  }

  const lines = wrapText(text, font, fontSize, maxWidth)

  // Paginate
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Header
  page.drawText('OFFER COVER LETTER', { x: margin, y, font: boldFont, size: 14, color: rgb(0.12, 0.15, 0.38) })
  y -= 24
  page.drawText(`Property: ${propertyAddress}`, { x: margin, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 14
  page.drawText(`Buyer: ${buyerName}`, { x: margin, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 8

  // Horizontal rule
  y -= 8
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 20

  // Body
  for (const line of lines) {
    if (y < margin + 40) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
    if (line === '') {
      y -= lineHeight * 0.6
      continue
    }
    page.drawText(line, { x: margin, y, font, size: fontSize, color: rgb(0.15, 0.15, 0.15) })
    y -= lineHeight
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

// ---------------------------------------------------------------------------
// POST /api/closeiq/bundle
// body: { offer_id, include_cover_letter?: boolean, include_contracts?: boolean,
//         additional_doc_ids?: string[] }
// Returns: merged PDF as download or uploads to storage
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const body = await request.json()
    const offerId = body.offer_id
    const includeCoverLetter = body.include_cover_letter !== false
    const includeContracts = body.include_contracts !== false
    const additionalDocIds: string[] = body.additional_doc_ids || []

    if (!offerId) return NextResponse.json({ error: 'offer_id required' }, { status: 400 })

    // ── Fetch offer with buyer ──────────────────────────────────────────
    const { data: offer, error: offerErr } = await db
      .from('offers')
      .select('*, buyers(first_name, last_name, email, phone)')
      .eq('id', offerId)
      .single()

    if (offerErr || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    if (offer.agent_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized for this offer' }, { status: 403 })
    }

    const buyer = offer.buyers || {}
    const buyerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Buyer'
    const propertyAddress = offer.property_address || 'Property'

    const { PDFDocument } = await import('pdf-lib')
    const mergedDoc = await PDFDocument.create()
    const pdfSources: { name: string; success: boolean }[] = []

    // ── 1. Cover Letter (generated from offer data) ─────────────────────
    if (includeCoverLetter && offer.cover_letter_text) {
      try {
        const clPdfBytes = await createCoverLetterPdf(offer.cover_letter_text, buyerName, propertyAddress)
        const clDoc = await PDFDocument.load(clPdfBytes)
        const pages = await mergedDoc.copyPages(clDoc, clDoc.getPageIndices())
        pages.forEach(p => mergedDoc.addPage(p))
        pdfSources.push({ name: 'Cover Letter', success: true })
      } catch (e: any) {
        console.warn('Cover letter PDF failed:', e.message)
        pdfSources.push({ name: 'Cover Letter', success: false })
      }
    }

    // ── 2. Contract PDFs (from offer_documents) ─────────────────────────
    if (includeContracts) {
      const { data: contracts } = await db
        .from('offer_documents')
        .select('id, file_url, file_name, doc_type')
        .eq('offer_id', offerId)
        .eq('doc_type', 'purchase_agreement')
        .order('created_at', { ascending: false })

      if (contracts && contracts.length > 0) {
        for (const contract of contracts) {
          try {
            if (!contract.file_url || contract.file_url === 'pending_storage') continue

            let pdfBytes: Buffer
            if (contract.file_url.startsWith('data:')) {
              // Base64 inline PDF
              const b64 = contract.file_url.split(',')[1]
              pdfBytes = Buffer.from(b64, 'base64')
            } else {
              // Download from URL or storage
              const resp = await fetch(contract.file_url)
              if (!resp.ok) continue
              pdfBytes = Buffer.from(await resp.arrayBuffer())
            }

            const contractDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
            const pages = await mergedDoc.copyPages(contractDoc, contractDoc.getPageIndices())
            pages.forEach(p => mergedDoc.addPage(p))
            pdfSources.push({ name: contract.file_name || 'Contract', success: true })
          } catch (e: any) {
            console.warn(`Contract merge failed (${contract.id}):`, e.message)
            pdfSources.push({ name: contract.file_name || 'Contract', success: false })
          }
        }
      }
    }

    // ── 3. Additional documents (pre-approval, proof of funds, etc.) ────
    if (additionalDocIds.length > 0) {
      const { data: docs } = await db
        .from('offer_documents')
        .select('id, file_url, file_name, doc_type')
        .in('id', additionalDocIds)

      if (docs) {
        for (const doc of docs) {
          try {
            if (!doc.file_url || doc.file_url === 'pending_storage') continue
            const resp = await fetch(doc.file_url)
            if (!resp.ok) continue
            const pdfBytes = Buffer.from(await resp.arrayBuffer())
            const extraDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
            const pages = await mergedDoc.copyPages(extraDoc, extraDoc.getPageIndices())
            pages.forEach(p => mergedDoc.addPage(p))
            pdfSources.push({ name: doc.file_name || doc.doc_type || 'Document', success: true })
          } catch (e: any) {
            console.warn(`Additional doc merge failed (${doc.id}):`, e.message)
            pdfSources.push({ name: doc.file_name || 'Document', success: false })
          }
        }
      }
    }

    // ── Check we have at least one page ─────────────────────────────────
    if (mergedDoc.getPageCount() === 0) {
      return NextResponse.json({
        error: 'No documents to bundle. Generate a contract or cover letter first.',
        sources: pdfSources,
      }, { status: 400 })
    }

    // ── Set document metadata ───────────────────────────────────────────
    mergedDoc.setTitle(`Offer Package — ${propertyAddress}`)
    mergedDoc.setAuthor('HartFelt Real Estate — CloseIQ')
    mergedDoc.setSubject(`Offer from ${buyerName}`)
    mergedDoc.setCreationDate(new Date())

    const bundleBytes = Buffer.from(await mergedDoc.save())

    // ── Upload to storage ───────────────────────────────────────────────
    const safeBuyer = buyerName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    const fileName = `offer_package_${safeBuyer}_${offerId.substring(0, 8)}_${Date.now()}.pdf`
    const storagePath = `bundles/${user.id}/${fileName}`

    const { error: uploadErr } = await db.storage
      .from('documents')
      .upload(storagePath, bundleBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    let bundleUrl: string
    if (uploadErr) {
      console.warn('Bundle upload failed, returning inline:', uploadErr.message)
      bundleUrl = `data:application/pdf;base64,${bundleBytes.toString('base64')}`
    } else {
      const { data: urlData } = db.storage.from('documents').getPublicUrl(storagePath)
      bundleUrl = urlData?.publicUrl || ''
    }

    // ── Record the bundle as an offer document ──────────────────────────
    const { data: bundleDoc } = await db.from('offer_documents').insert({
      offer_id: offerId,
      doc_type: 'offer_package',
      file_url: bundleUrl.startsWith('data:') ? 'pending_storage' : bundleUrl,
      file_name: fileName,
      uploaded_by: user.id,
      status: 'uploaded',
    }).select().single()

    console.log(`Offer package created: ${fileName} (${mergedDoc.getPageCount()} pages, ${pdfSources.length} documents)`)

    return NextResponse.json({
      bundle_url: bundleUrl,
      doc_id: bundleDoc?.id,
      file_name: fileName,
      page_count: mergedDoc.getPageCount(),
      sources: pdfSources,
    })

  } catch (err: any) {
    console.error('Bundle error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/closeiq/bundle?offer_id=...
// Lists all bundles for an offer
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
      .select('id, file_url, file_name, doc_type, status, created_at')
      .eq('offer_id', offerId)
      .eq('doc_type', 'offer_package')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ bundles: docs || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
