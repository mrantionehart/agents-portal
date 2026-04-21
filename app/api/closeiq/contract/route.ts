// ---------------------------------------------------------------------------
// CloseIQ Contract Generator — /api/closeiq/contract
// Generates purchase agreement PDF from offer data using Claude + pdf-lib
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth helper (same as main route)
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
// Claude API helper
// ---------------------------------------------------------------------------
async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Claude API error: ${resp.status} ${err}`)
  }

  const data = await resp.json()
  return data.content?.[0]?.text || ''
}

// ---------------------------------------------------------------------------
// PDF Generation using pdf-lib
// ---------------------------------------------------------------------------
async function generateContractPDF(contractText: string, metadata: {
  propertyAddress: string
  buyerName: string
  agentName: string
  offerPrice: string
  date: string
}): Promise<Buffer> {
  // Dynamic import pdf-lib
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.TimesRoman)
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const fontSize = 10
  const titleSize = 14
  const headerSize = 11
  const margin = 72 // 1 inch
  const pageWidth = 612 // Letter
  const pageHeight = 792
  const contentWidth = pageWidth - margin * 2
  const lineHeight = fontSize * 1.4
  const headerLineHeight = headerSize * 1.5

  // Helper: wrap text to fit within content width
  function wrapText(text: string, maxWidth: number, f: any, size: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const width = f.widthOfTextAtSize(testLine, size)
      if (width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  // Split contract into sections
  const sections = contractText.split('\n')
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Title
  const title = 'RESIDENTIAL PURCHASE AGREEMENT'
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: (pageWidth - titleWidth) / 2,
    y,
    size: titleSize,
    font: fontBold,
    color: rgb(0.12, 0.31, 0.47), // HartFelt blue
  })
  y -= titleSize * 2

  // Property address subtitle
  const subtitle = metadata.propertyAddress
  const subtitleWidth = font.widthOfTextAtSize(subtitle, headerSize)
  page.drawText(subtitle, {
    x: (pageWidth - subtitleWidth) / 2,
    y,
    size: headerSize,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  y -= headerSize * 2

  // Separator line
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.83, 0.69, 0.22), // HartFelt gold
  })
  y -= 20

  // Render contract body
  for (const line of sections) {
    const trimmed = line.trim()
    if (!trimmed) {
      y -= lineHeight * 0.5
      continue
    }

    // Detect section headers (lines in ALL CAPS or starting with number + period)
    const isHeader = /^[A-Z\d][A-Z\d\s.()—–-]{5,}$/.test(trimmed) || /^\d+\.\s+[A-Z]/.test(trimmed)
    const currentFont = isHeader ? fontBold : font
    const currentSize = isHeader ? headerSize : fontSize
    const currentLineHeight = isHeader ? headerLineHeight : lineHeight

    if (isHeader) y -= 6 // Extra spacing before headers

    const wrapped = wrapText(trimmed, contentWidth, currentFont, currentSize)

    for (const wLine of wrapped) {
      if (y < margin + 40) {
        // Footer on current page
        page.drawText(`${metadata.agentName} | HartFelt Real Estate`, {
          x: margin,
          y: margin - 20,
          size: 8,
          font,
          color: rgb(0.6, 0.6, 0.6),
        })
        const pageNum = `Page ${doc.getPageCount()}`
        const pnWidth = font.widthOfTextAtSize(pageNum, 8)
        page.drawText(pageNum, {
          x: pageWidth - margin - pnWidth,
          y: margin - 20,
          size: 8,
          font,
          color: rgb(0.6, 0.6, 0.6),
        })

        page = doc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }

      page.drawText(wLine, {
        x: margin,
        y,
        size: currentSize,
        font: currentFont,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= currentLineHeight
    }
  }

  // Final page footer
  page.drawText(`${metadata.agentName} | HartFelt Real Estate`, {
    x: margin,
    y: margin - 20,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6),
  })

  // Signature block
  y -= 30
  if (y < margin + 120) {
    page = doc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }

  // Signature lines
  const sigY = y - 20
  page.drawLine({ start: { x: margin, y: sigY }, end: { x: margin + 200, y: sigY }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('Buyer Signature / Date', { x: margin, y: sigY - 12, size: 8, font, color: rgb(0.5, 0.5, 0.5) })

  page.drawLine({ start: { x: pageWidth / 2 + 20, y: sigY }, end: { x: pageWidth / 2 + 220, y: sigY }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('Seller Signature / Date', { x: pageWidth / 2 + 20, y: sigY - 12, size: 8, font, color: rgb(0.5, 0.5, 0.5) })

  const sigY2 = sigY - 50
  page.drawLine({ start: { x: margin, y: sigY2 }, end: { x: margin + 200, y: sigY2 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('Buyer Agent / Date', { x: margin, y: sigY2 - 12, size: 8, font, color: rgb(0.5, 0.5, 0.5) })

  page.drawLine({ start: { x: pageWidth / 2 + 20, y: sigY2 }, end: { x: pageWidth / 2 + 220, y: sigY2 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('Listing Agent / Date', { x: pageWidth / 2 + 20, y: sigY2 - 12, size: 8, font, color: rgb(0.5, 0.5, 0.5) })

  // Set PDF metadata
  doc.setTitle(`Purchase Agreement — ${metadata.propertyAddress}`)
  doc.setAuthor('HartFelt Real Estate — CloseIQ')
  doc.setCreator('HartFelt CloseIQ')
  doc.setProducer('pdf-lib')

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

// ---------------------------------------------------------------------------
// POST /api/closeiq/contract
// body: { offer_id: string }
// Returns: { contract_url, doc_id }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const body = await request.json()
    const offerId = body.offer_id

    if (!offerId) return NextResponse.json({ error: 'offer_id required' }, { status: 400 })

    // Fetch offer with buyer data
    const { data: offer, error: offerErr } = await db
      .from('offers')
      .select('*, buyers(first_name, last_name, email, phone, financing_type, preapproval_amount, preapproval_status)')
      .eq('id', offerId)
      .single()

    if (offerErr || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    // Verify the agent owns this offer
    if (offer.agent_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized for this offer' }, { status: 403 })
    }

    // Get agent profile
    const { data: agentProfile } = await db.from('profiles').select('full_name, email, phone').eq('id', user.id).single()
    const agentName = agentProfile?.full_name || agentProfile?.email || 'Agent'
    const agentEmail = agentProfile?.email || ''
    const agentPhone = agentProfile?.phone || ''

    const buyer = offer.buyers || {}
    const buyerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'TBD'
    const buyerEmail = buyer.email || ''
    const buyerPhone = buyer.phone || ''

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    // Generate contract text via Claude
    const systemPrompt = `You are a real estate contract attorney assistant. Generate a complete, professional Residential Purchase Agreement based on the provided offer details.

The contract should include all standard sections:
1. PARTIES (buyer and seller info)
2. PROPERTY DESCRIPTION (address, legal description placeholder)
3. PURCHASE PRICE AND FINANCING (price, financing type, down payment, earnest money)
4. EARNEST MONEY DEPOSIT (amount, holder, timeline)
5. CLOSING DATE AND POSSESSION
6. CONTINGENCIES (inspection, appraisal, financing — based on offer terms)
7. INSPECTION PERIOD (days, scope, remedies)
8. APPRAISAL CONTINGENCY (if applicable)
9. FINANCING CONTINGENCY (if applicable)
10. TITLE AND SURVEY
11. SELLER DISCLOSURES
12. CLOSING COSTS AND CONCESSIONS
13. DEFAULT AND REMEDIES
14. ADDITIONAL TERMS
15. SIGNATURES (placeholder lines)

Use professional legal language but keep it readable. Fill in all provided values. Use "TBD" or "[TO BE DETERMINED]" for unknown values. Include standard protective clauses for both parties.

Output ONLY the contract text — no JSON wrapper, no markdown formatting. Use plain text with section headers in ALL CAPS.`

    const userPrompt = `Generate a Residential Purchase Agreement with these details:

PARTIES:
- Buyer: ${buyerName}
- Buyer Email: ${buyerEmail}
- Buyer Phone: ${buyerPhone}
- Buyer Agent: ${agentName}, HartFelt Real Estate
- Agent Email: ${agentEmail}
- Agent Phone: ${agentPhone}
- Seller: [TO BE DETERMINED — Listing Agent to provide]

PROPERTY:
- Address: ${offer.property_address}
- City: ${offer.property_city || '[City]'}, ${offer.property_state || '[State]'} ${offer.property_zip || '[ZIP]'}
- MLS #: ${offer.property_mls_id || 'N/A'}
- List Price: $${Number(offer.property_list_price || 0).toLocaleString()}

OFFER TERMS:
- Purchase Price: $${Number(offer.offer_price).toLocaleString()}
- Financing Type: ${offer.financing_type || 'conventional'}
- Down Payment: ${offer.down_payment_pct || 20}%
- Earnest Money: $${Number(offer.earnest_money_amount || 0).toLocaleString()}
- Inspection Period: ${offer.inspection_days || 10} days
- Appraisal Contingency: ${offer.appraisal_contingency ? 'Yes' : 'Waived'}
- Financing Contingency: ${offer.financing_contingency ? 'Yes' : 'Waived'}
- Closing Date: ${offer.close_date || '30 days from acceptance'}
- Seller Concessions Requested: $${Number(offer.concessions_requested || 0).toLocaleString()}
- Escalation Clause: ${offer.escalation_flag ? `Yes, up to $${Number(offer.escalation_max || 0).toLocaleString()}` : 'None'}

${offer.cover_letter_text ? `BUYER NOTES: ${offer.cover_letter_text.substring(0, 200)}` : ''}

Date: ${today}`

    console.log('Generating contract for offer:', offerId)
    const contractText = await callClaude(systemPrompt, userPrompt, 4000)

    // Generate PDF
    const pdfBuffer = await generateContractPDF(contractText, {
      propertyAddress: offer.property_address,
      buyerName,
      agentName,
      offerPrice: `$${Number(offer.offer_price).toLocaleString()}`,
      date: today,
    })

    // Upload to Supabase storage
    const fileName = `purchase_agreement_${offerId.substring(0, 8)}_${Date.now()}.pdf`
    const storagePath = `contracts/${user.id}/${fileName}`

    const { error: uploadErr } = await db.storage
      .from('documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr.message)
      // If storage bucket doesn't exist, return the PDF directly
      if (uploadErr.message.includes('not found') || uploadErr.message.includes('Bucket')) {
        // Create a data URL as fallback
        const base64 = pdfBuffer.toString('base64')
        const dataUrl = `data:application/pdf;base64,${base64}`

        // Still create the offer_documents record with inline data marker
        const { data: doc } = await db.from('offer_documents').insert({
          offer_id: offerId,
          doc_type: 'purchase_agreement',
          file_url: 'pending_storage',
          file_name: fileName,
          uploaded_by: user.id,
          status: 'uploaded',
        }).select().single()

        return NextResponse.json({
          contract_url: dataUrl,
          doc_id: doc?.id,
          file_name: fileName,
          fallback: true,
          message: 'Contract generated. Storage bucket may need to be created — PDF returned inline.',
        })
      }
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = db.storage.from('documents').getPublicUrl(storagePath)
    const contractUrl = urlData?.publicUrl || ''

    // Create offer_documents record
    const { data: docRecord, error: docErr } = await db.from('offer_documents').insert({
      offer_id: offerId,
      doc_type: 'purchase_agreement',
      file_url: contractUrl,
      file_name: fileName,
      uploaded_by: user.id,
      status: 'uploaded',
    }).select().single()

    if (docErr) {
      console.error('offer_documents insert error:', docErr.message)
    }

    console.log('Contract generated successfully:', fileName)

    return NextResponse.json({
      contract_url: contractUrl,
      doc_id: docRecord?.id,
      file_name: fileName,
    })

  } catch (err: any) {
    console.error('Contract generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
