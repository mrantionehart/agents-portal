// ---------------------------------------------------------------------------
// CloseIQ AI — /api/closeiq/ai
// Claude-powered: cover letter generator, smart risk analysis
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

// ---------------------------------------------------------------------------
// Claude API call helper
// ---------------------------------------------------------------------------
async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
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
      max_tokens: 1500,
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
// POST /api/closeiq/ai
// body.action: 'cover_letter' | 'risk_analysis'
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json()
    const action = body.action

    switch (action) {
      // -----------------------------------------------------------------------
      // Cover Letter Generator
      // -----------------------------------------------------------------------
      case 'cover_letter': {
        const { offer_price, buyer_name, property_address, financing_type, close_date,
                earnest_money, inspection_days, concessions, tone_style, buyer_story } = body

        const systemPrompt = `You are a real estate offer cover letter expert. Write compelling, professional cover letters that help offers get accepted. Output valid JSON with three fields: "subject" (email subject line), "email_body" (full email to listing agent), and "sms" (short SMS version under 160 chars to listing agent). Do not include any markdown formatting — just the raw JSON object.`

        const userPrompt = `Write a cover letter for this offer:
- Buyer: ${buyer_name}
- Property: ${property_address}
- Offer Price: $${Number(offer_price).toLocaleString()}
- Financing: ${financing_type}
- Close Date: ${close_date || 'Flexible'}
- Earnest Money: $${Number(earnest_money || 0).toLocaleString()}
- Inspection: ${inspection_days || 0} days
- Concessions: $${Number(concessions || 0).toLocaleString()}
- Tone: ${tone_style || 'professional'}
${buyer_story ? `- Buyer story: ${buyer_story}` : ''}

Make the letter warm but professional. Focus on the buyer's strengths and commitment. Do not fabricate details not provided.`

        const raw = await callClaude(systemPrompt, userPrompt)

        // Parse JSON from Claude response
        let result
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/)
          result = jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: '', email_body: raw, sms: '' }
        } catch {
          result = { subject: 'Offer Submission', email_body: raw, sms: '' }
        }

        return NextResponse.json(result)
      }

      // -----------------------------------------------------------------------
      // Smart Risk Analysis (AI-enhanced)
      // -----------------------------------------------------------------------
      case 'risk_analysis': {
        const { offer_price, list_price, property_address, financing_type, inspection_days,
                appraisal_contingency, financing_contingency, buyer_readiness_score,
                property_dom, price_changes, concessions } = body

        const systemPrompt = `You are a real estate risk analyst. Analyze offer terms and identify risks. Output valid JSON with: "risk_score" (0-100, higher = riskier), "flags" (array of {type, severity, title, description, action}), "strategy" (2-3 sentence recommendation), "competitive_range" (object with low and high price estimates). Severity must be "low", "moderate", or "high". Do not include markdown.`

        const userPrompt = `Analyze this offer:
- Property: ${property_address}
- List Price: $${Number(list_price || 0).toLocaleString()}
- Offer Price: $${Number(offer_price).toLocaleString()} (${list_price ? Math.round(((offer_price / list_price) - 1) * 100) : 'N/A'}% ${offer_price > (list_price || 0) ? 'above' : 'below'} list)
- DOM: ${property_dom || 'Unknown'}
- Price Changes: ${price_changes || 0}
- Financing: ${financing_type}
- Inspection: ${inspection_days} days
- Appraisal Contingency: ${appraisal_contingency ? 'Yes' : 'No'}
- Financing Contingency: ${financing_contingency ? 'Yes' : 'No'}
- Concessions: $${Number(concessions || 0).toLocaleString()}
- Buyer Readiness: ${buyer_readiness_score || 'Unknown'}/100

Provide practical analysis. Be direct.`

        const raw = await callClaude(systemPrompt, userPrompt)

        let result
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/)
          result = jsonMatch ? JSON.parse(jsonMatch[0]) : { risk_score: 50, flags: [], strategy: raw, competitive_range: null }
        } catch {
          result = { risk_score: 50, flags: [], strategy: raw, competitive_range: null }
        }

        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: 'invalid action — use cover_letter or risk_analysis' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('CloseIQ AI error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
