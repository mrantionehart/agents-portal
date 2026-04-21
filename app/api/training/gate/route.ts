// ---------------------------------------------------------------------------
// GET /api/training/gate
//
// Returns the training‐gate status for the authenticated user.
// Agents must complete ALL Volume 1 modules (1‑9) before the full app unlocks.
// Brokers / admins always pass the gate.
//
// Response shape:
// {
//   gateOpen: boolean,        // true = full app unlocked
//   role: string,             // user's role
//   vol1: { completed: number[], total: number, done: boolean },
//   vol2: { completed: number[], total: number, done: boolean },
// }
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Same module lists used by /api/training/quiz
// Vol 1 base modules (1-9) + role-specific EASE module (11=broker, 12=admin, 13=agent)
const VOL1_BASE = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const EASE_MODULE_FOR_ROLE: Record<string, number> = { broker: 11, admin: 12, agent: 13 }
const VOL2_REQUIRED = [8, 9, 10, 11, 12, 13, 14]

async function getAuthedUser(request: NextRequest) {
  // Bearer token (EASE mobile)
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
    } catch {
      return null
    }
  }

  // SSR cookie (portal)
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch role + training progress in parallel
    const [{ data: profile }, { data: progressRows }] = await Promise.all([
      admin.from('profiles').select('role').eq('id', user.id).single(),
      admin
        .from('training_progress')
        .select('volume, completed_modules, volume_completed')
        .eq('user_id', user.id),
    ])

    const role = profile?.role || 'agent'

    // Build role-specific Vol 1 required list (base 1-9 + EASE module for role)
    const easeModule = EASE_MODULE_FOR_ROLE[role] || EASE_MODULE_FOR_ROLE.agent
    const vol1Required = [...VOL1_BASE, easeModule]

    // Brokers & admins always pass the gate
    if (role === 'broker' || role === 'admin') {
      return NextResponse.json({
        gateOpen: true,
        role,
        vol1: { completed: vol1Required, total: vol1Required.length, done: true },
        vol2: { completed: [], total: VOL2_REQUIRED.length, done: false },
      })
    }

    // Find vol-1 and vol-2 progress rows
    const vol1Row = (progressRows || []).find(
      (r: any) => r.volume === 'volume-1'
    )
    const vol2Row = (progressRows || []).find(
      (r: any) => r.volume === 'volume-2'
    )

    const vol1Completed: number[] = vol1Row?.completed_modules || []
    // Gate opens when agent has completed all base modules AND their EASE module
    const vol1Done = vol1Required.every(m => vol1Completed.includes(m))
    const vol2Completed: number[] = vol2Row?.completed_modules || []
    const vol2Done = vol2Row?.volume_completed === true

    return NextResponse.json({
      gateOpen: vol1Done,
      role,
      vol1: {
        completed: vol1Completed,
        total: vol1Required.length,
        done: vol1Done,
      },
      vol2: {
        completed: vol2Completed,
        total: VOL2_REQUIRED.length,
        done: vol2Done,
      },
    })
  } catch (err) {
    console.error('Training gate error:', err)
    return NextResponse.json(
      { error: 'Failed to check training gate' },
      { status: 500 }
    )
  }
}
