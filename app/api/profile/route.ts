// ============================================================================
// /api/profile — self-service profile persistence (AP-PROFILE-SAVE)
// ============================================================================
// Replaces the browser-direct `supabase.from('profiles').update(form)` that the
// profile page used. That call submitted the whole form object — including
// `location`, which is NOT a column on `profiles` — so PostgREST rejected the
// entire statement (42703 / PGRST204) and NOTHING persisted, not even the
// valid fields. The page surfaced that only through a blocking `alert()`.
//
// ── SECURITY MODEL (audited, not assumed) ───────────────────────────────────
// SEC.P0 (Vault 20260721143000_sec_p0_profiles_escalation.sql) is the authority
// here. It deliberately KEPT self-service editing available to `authenticated`
// and made it safe two ways:
//
//   1. Column-level UPDATE allowlist — table-wide UPDATE was revoked and
//      re-granted per column. Any column not listed (and any column added
//      later) is unwritable by `authenticated`. It fails closed.
//   2. `profiles_update_own` — FOR UPDATE TO authenticated,
//      USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND role unchanged
//      AND tenant_id unchanged).
//
// So this route uses `userClient` — the caller's own JWT — exactly like
// /api/my-card. RLS and the column grants remain the real security boundary.
// We do NOT use the service role here: doing so would bypass the very controls
// SEC.P0 installed, and would move the security decision from the database
// into this file. Nothing about the browser's UPDATE policy is widened.
//
// The allowlist below is a SUBSET of SEC.P0's granted columns, narrowed again
// to the fields this page actually exposes. Defence in depth, not a substitute
// for it: role, tenant_id, is_active, deleted_at, permissions and certification
// state are unreachable through this endpoint AND unreachable at the database.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Fields an agent may change about themselves from the profile page.
 *
 * Every entry is verified present in SEC.P0's `GRANT UPDATE (...)` list, so a
 * value here can never exceed what the database already permits. `location` is
 * deliberately ABSENT — no such column exists, and including it is what broke
 * the original save.
 */
const SELF_EDITABLE_FIELDS = ['full_name', 'phone', 'bio', 'license_number'] as const
type SelfEditableField = (typeof SELF_EDITABLE_FIELDS)[number]

/** Trim strings; treat blank as an explicit clear (NULL). */
function normalize(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

const MAX_LENGTHS: Record<SelfEditableField, number> = {
  full_name: 120,
  phone: 40,
  bio: 2000,
  license_number: 60,
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  const user = auth.user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.', code: 'invalid_body' },
      { status: 400 },
    )
  }
  const input = (body ?? {}) as Record<string, unknown>

  // Build the update from the allowlist ONLY. Keys the client sends that are
  // not listed are dropped silently — they are not errors, they are noise, and
  // echoing them back would tell a prober which columns exist.
  const updates: Record<string, string | null> = {}
  for (const field of SELF_EDITABLE_FIELDS) {
    if (!(field in input)) continue
    const value = normalize(input[field])
    if (value === undefined) {
      return NextResponse.json(
        { error: `"${field}" must be a string.`, code: 'validation_failed', field },
        { status: 400 },
      )
    }
    if (value !== null && value.length > MAX_LENGTHS[field]) {
      return NextResponse.json(
        {
          error: `"${field}" is too long (max ${MAX_LENGTHS[field]}).`,
          code: 'validation_failed',
          field,
        },
        { status: 400 },
      )
    }
    updates[field] = value
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No editable fields supplied.', code: 'no_editable_fields' },
      { status: 400 },
    )
  }

  updates.updated_at = new Date().toISOString()

  const supabase = userClient(request)

  // ── The persistence check that the old code lacked ───────────────────────
  // `.select()` asks PostgREST to return the updated representation. A filtered
  // UPDATE that matches no rows is NOT an error — it returns an empty array —
  // which is exactly how a failure could be reported as success. We require a
  // row back, and require it to be the caller's own.
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, full_name, phone, bio, license_number, updated_at')

  if (error) {
    console.error('[api/profile] update failed', {
      userId: user.id,
      code: error.code,
      message: error.message,
    })
    return NextResponse.json(
      { error: 'Could not save your profile.', code: 'database_error' },
      { status: 500 },
    )
  }

  const rows = data ?? []
  if (rows.length === 0) {
    // Permitted by grants but matched nothing: the row is missing, or RLS
    // filtered it. Either way NOTHING WAS WRITTEN — say so.
    return NextResponse.json(
      { error: 'Profile not found or not updatable.', code: 'not_persisted' },
      { status: 404 },
    )
  }
  if (rows.length !== 1 || rows[0].id !== user.id) {
    console.error('[api/profile] unexpected update scope', {
      userId: user.id,
      returned: rows.length,
    })
    return NextResponse.json(
      { error: 'Could not save your profile.', code: 'unexpected_scope' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, profile: rows[0] })
}
