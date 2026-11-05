import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { adminClient } from '@/lib/security'
import { agentLanding, loadOnboarded } from '@/lib/training/onboarding-landing'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// ── ONBOARD-001 — Root routing decider (server component) ──────────────
//
// Any authenticated visit to `/` is dispatched to the correct landing
// surface based on role and onboarding status. Mirrors the same
// three-way decision the `/api/login` route makes so that direct
// navigation to `/` (bookmark, session restore, etc.) lands at the same
// place as a fresh login.
//
//   • unauth               → /login
//   • broker/admin         → Vault dashboard (external)
//   • un-onboarded agent   → /training  (Platform Certification hero)
//   • onboarded agent      → /home      (Portal 2.0 dashboard)
//
// Onboarding signal: `training_progress { volume: 'volume-1',
// volume_completed: true }` — written by the pcert-l01 bridge
// (PILOT-D-021). This is a SOFT default-landing decision; middleware
// does not enforce it (see middleware.ts).
//
// Converted from a client component so the browser gets a straight
// server-driven redirect instead of a loading spinner + client-side
// `window.location.href` bounce.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // No-op on `/`; setting cookies from a Server Component is not
        // supported, and no auth mutations happen here.
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'agent'
  if (role === 'admin' || role === 'broker') {
    redirect('https://vault.hartfeltrealestate.com/dashboard')
  }

  // ONBOARD-002 — same server-verified evidence as the login route.
  // [service-role: onboarding-landing-read]
  const svc = adminClient('onboarding-landing-read', { userId: user.id, context: 'GET / landing' })
  const onboarded = await loadOnboarded(svc, user.id)
  redirect(agentLanding(role, onboarded))
}
