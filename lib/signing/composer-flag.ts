// ============================================================================
// Slice 2 Phase 3B-4 · AP_SIGNING_COMPOSER_ENABLED feature flag
// ============================================================================
// Gates the ENTIRE Agent Portal composer workflow: the transaction CTA, the
// composer route, the compose-preview call, the V2 submit call, and the
// package-status "Revise package" link.
//
// Read path only — no writes gated. Rendering of already-created packages
// via the 3B-3.5 status page continues to work regardless of this flag.
//
// Enabled ONLY when env.AP_SIGNING_COMPOSER_ENABLED === "true" (strict
// equality). Any other value (undefined, empty, "1", "yes") reads as OFF.
//
// The flag defaults OFF in every environment. Do not flip it on in
// production until the operator explicitly authorizes activation.
// ============================================================================

type EnvLike = Record<string, string | undefined>

/** True iff AP_SIGNING_COMPOSER_ENABLED === "true". Undefined/anything-else → false. */
export function isSigningComposerEnabled(env: EnvLike = process.env): boolean {
  return env.AP_SIGNING_COMPOSER_ENABLED === 'true'
}
