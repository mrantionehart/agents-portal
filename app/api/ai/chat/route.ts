// ---------------------------------------------------------------------------
// POST /api/ai/chat
//
// AI Assistant endpoint for the HartFelt agents portal.
// Uses Anthropic Claude API when ANTHROPIC_API_KEY is set.
// Falls back to a smart rule-based system for common real estate queries.
//
// Auth: Supabase session cookie (portal)
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

const SYSTEM_PROMPT = `You are HartFelt AI — an expert real estate assistant for HartFelt Real Estate agents in South Florida. You are helpful, professional, and knowledgeable about:

- Miami-Dade, Broward, and Palm Beach County real estate markets
- Florida real estate law, contracts (FAR/BAR), and compliance
- Commission calculations, broker splits, and referral fees
- Fair housing laws and compliance requirements
- Market analysis, comparable properties, and pricing strategies
- Real estate marketing, lead generation, and client management
- Transaction coordination and document management
- Neighborhoods, zoning, HOA regulations, and local market trends

When asked about market analysis for a specific area:
- Provide general knowledge about the neighborhood/area
- Mention key characteristics (walkability, amenities, demographics)
- Note recent market trends if known
- Suggest what data sources to check for current pricing
- Always note that for exact current pricing, they should pull MLS comps

Keep responses concise but informative. Use a professional but friendly tone.
Do not make up specific prices or statistics — qualify any numbers as estimates or general knowledge.
If you don't know something specific, say so and suggest where to find the answer.`

async function getAuthedUser(request: NextRequest): Promise<{ userId: string } | null> {
  // 1. Bearer token (mobile / API)
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return null
      return { userId: data.user.id }
    } catch {
      return null
    }
  }

  // 2. SSR cookie (portal)
  try {
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            stubResponse.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            stubResponse.cookies.delete(name)
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return { userId: user.id }
  } catch {
    return null
  }
}

// ---- Anthropic API call ----
async function callClaude(message: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    console.error('Anthropic API error:', resp.status, errBody)
    throw new Error(`Anthropic API ${resp.status}`)
  }

  const data = await resp.json()
  return data.content?.[0]?.text || 'I was unable to generate a response. Please try again.'
}

// ---- Fallback rule-based responses ----
function fallbackResponse(message: string): string {
  const lower = message.toLowerCase()

  // Market analysis
  if (lower.includes('market analysis') || lower.includes('market trend')) {
    const area = extractArea(lower)
    if (area) {
      return `📊 **Market Analysis — ${area}**\n\nHere's what I can share about ${area}:\n\n` +
        `To get the most accurate current market data for ${area}, I'd recommend:\n` +
        `• Pull recent MLS comps (last 90 days) for the specific property type\n` +
        `• Check DOM (days on market) trends to gauge buyer demand\n` +
        `• Review price-per-square-foot trends year-over-year\n` +
        `• Look at active vs. pending vs. sold ratios\n\n` +
        `Would you like help with a specific property type or price range in ${area}?`
    }
    return `📊 I can help with market analysis! Which area or neighborhood are you interested in? ` +
      `I cover Miami-Dade, Broward, and Palm Beach counties.`
  }

  // Commission
  if (lower.includes('commission') || lower.includes('split')) {
    return `💰 **Commission Calculator**\n\n` +
      `Standard Florida commission structure:\n` +
      `• Typical total commission: 5-6% of sale price\n` +
      `• Split between listing and buyer's agent (usually 50/50)\n` +
      `• Broker split varies by agreement (commonly 70/30 to 90/10)\n` +
      `• Referral fees typically 20-25% of the referring agent's side\n\n` +
      `To calculate your net commission, tell me:\n` +
      `1. Sale price\n2. Your commission rate\n3. Your broker split\n4. Any referral fees`
  }

  // Compliance / fair housing
  if (lower.includes('compliance') || lower.includes('fair housing')) {
    return `⚖️ **Compliance Reminder**\n\n` +
      `Key Fair Housing protected classes (Federal + Florida):\n` +
      `• Race, Color, National Origin, Religion, Sex, Familial Status, Disability (Federal)\n` +
      `• Age, Marital Status (Florida additions)\n\n` +
      `Best practices:\n` +
      `• Describe properties by features, not by who lives nearby\n` +
      `• Never steer clients toward or away from neighborhoods\n` +
      `• Document all interactions consistently\n` +
      `• Use standardized language in all listings\n\n` +
      `Need help reviewing a specific document or listing for compliance?`
  }

  // Contract / document
  if (lower.includes('contract') || lower.includes('far/bar') || lower.includes('document')) {
    return `📝 **Contract & Document Help**\n\n` +
      `Common FAR/BAR contract deadlines to track:\n` +
      `• Inspection period (typically 10-15 days)\n` +
      `• Financing contingency deadline\n` +
      `• Appraisal contingency\n` +
      `• Title commitment delivery\n` +
      `• Closing date\n\n` +
      `Upload a contract on the Documents page and I can help identify key dates and compliance items.`
  }

  // General greeting
  if (lower.match(/^(hi|hello|hey|good morning|good afternoon)/)) {
    return `👋 Hello! I'm HartFelt AI, your real estate assistant. I can help with:\n\n` +
      `📊 Market analysis and neighborhood insights\n` +
      `💰 Commission calculations\n` +
      `⚖️ Fair housing and compliance\n` +
      `📝 Contract questions\n` +
      `🏠 Real estate strategies\n\n` +
      `What can I help you with today?`
  }

  // Default
  return `Great question! While I'm running in basic mode right now, here's what I can help with:\n\n` +
    `📊 **Market Analysis** — Ask about any South Florida neighborhood\n` +
    `💰 **Commissions** — Calculate splits, referrals, net income\n` +
    `⚖️ **Compliance** — Fair housing, document review\n` +
    `📝 **Contracts** — FAR/BAR deadlines, contingencies\n\n` +
    `Try asking something more specific and I'll do my best to help!`
}

function extractArea(text: string): string | null {
  // Common South Florida areas
  const areas = [
    'Wynwood', 'Brickell', 'Coral Gables', 'Coconut Grove', 'Doral',
    'Homestead', 'Kendall', 'Miami Beach', 'South Beach', 'North Miami',
    'Aventura', 'Sunny Isles', 'Hollywood', 'Fort Lauderdale', 'Plantation',
    'Weston', 'Pembroke Pines', 'Miramar', 'Hialeah', 'Little Havana',
    'Edgewater', 'Midtown', 'Design District', 'Overtown', 'Liberty City',
    'Little Haiti', 'Allapattah', 'Downtown Miami', 'Key Biscayne',
    'Pinecrest', 'Palmetto Bay', 'Cutler Bay', 'Miami Gardens',
    'Opa-locka', 'Miami Springs', 'West Palm Beach', 'Boca Raton',
    'Delray Beach', 'Boynton Beach', 'Lake Worth', 'Jupiter',
  ]

  for (const area of areas) {
    if (text.toLowerCase().includes(area.toLowerCase())) {
      return area
    }
  }

  // Try to extract from "for <area>" pattern
  const match = text.match(/(?:for|in|about|of)\s+([A-Z][a-zA-Z\s]{2,20}?)(?:\s*[?.!]|$)/i)
  if (match) {
    return match[1].trim()
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const message = body.message?.trim()

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    let responseText: string

    if (ANTHROPIC_API_KEY) {
      // Use Claude API
      responseText = await callClaude(message)
    } else {
      // Fallback to rule-based
      responseText = fallbackResponse(message)
    }

    return NextResponse.json({
      message: responseText,
      response: responseText,
      source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
    })
  } catch (err) {
    console.error('AI chat error:', err)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
