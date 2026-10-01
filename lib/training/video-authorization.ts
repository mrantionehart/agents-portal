// ---------------------------------------------------------------------------
// AP-TRAINING-SIGN-1 — server-side authorization for training videos
//
// `training_modules.required_role` is a text[] allowlist:
//   • NULL or empty → unrestricted, any authenticated learner
//   • non-empty     → only the listed roles
//
// The vocabulary is `profiles.role`. That is not an assumption carried over
// from Vault: the portal, EASE and Vault all point at the SAME Supabase
// project (qqkvooljievqfupgfhix), so `profiles` and `training_modules` are
// literally the same rows for all three. Reading `profiles.role` for the
// caller is also the portal's own established idiom (see
// app/api/broker/client-intelligence/route.ts).
//
// EASE's `AGENT_TRAINING_ROLES` (src/screens/courseAccess.ts) is a UI routing
// rule that decides which SCREEN a role sees, and it is strictly narrower than
// required_role — it can only withhold the Training Academy, never grant
// access. Enforcing required_role here can therefore only deny more, never
// less, so the two contracts cannot conflict.
//
// Every training_videos row carries a module_id, with zero orphans and zero
// broken FKs (verified on prod), so the owning module is a COMPLETE
// authorization key for a video. A key that resolves to no video is refused.
// ---------------------------------------------------------------------------
import type { SupabaseClient } from '@supabase/supabase-js';

export type RequiredRole = string[] | null | undefined;

/** The single authorization predicate. */
export function roleMayAccessModule(
  requiredRole: RequiredRole,
  role: string | null
): boolean {
  if (!requiredRole || requiredRole.length === 0) return true;
  if (!role) return false;
  return requiredRole.includes(role);
}

/** Reads the caller's role from `profiles`. Never from the request. */
export async function resolveCallerRole(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return (data.role as string) ?? null;
}

export interface VideoAuthorization {
  videoId: string;
  moduleId: string | null;
  requiredRole: RequiredRole;
}

/**
 * Resolve an R2 object key to its video and that video's module restriction.
 * BOTH language columns are checked — r2_key_en AND r2_key_es — because the
 * Spanish track is a separate key on the same row and must carry the same
 * restriction as the English one.
 *
 * Returns null when the key belongs to no known video. Callers MUST treat
 * null as unauthorized rather than signing an unrecognised key.
 */
export async function resolveVideoByKey(
  admin: SupabaseClient,
  key: string
): Promise<VideoAuthorization | null> {
  const { data, error } = await admin
    .from('training_videos')
    .select('id, module_id, r2_key_en, r2_key_es, training_modules(required_role)')
    .or(`r2_key_en.eq.${key},r2_key_es.eq.${key}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // PostgREST returns an embedded one-to-one as an object, but some join
  // shapes yield a single-element array. Accept both — reading `undefined`
  // here would silently treat a restricted module as unrestricted.
  const embedded = (data as Record<string, unknown>).training_modules;
  const moduleRow = Array.isArray(embedded) ? embedded[0] : embedded;
  const requiredRole =
    (moduleRow as { required_role?: string[] } | undefined)?.required_role ?? null;

  return {
    videoId: data.id as string,
    moduleId: (data.module_id as string) ?? null,
    requiredRole,
  };
}
