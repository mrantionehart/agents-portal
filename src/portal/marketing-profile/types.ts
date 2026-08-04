// ============================================================================
// Marketing-profile — typed mirror of the Vault companion contract.
// ============================================================================
// The Agent Portal NEVER computes readiness or capability itself — these types
// mirror exactly what GET /api/agent/marketing-profile (and the PATCH/upload
// responses) return. Product concepts ONLY: no bucket / path / hash / tenant /
// profile id / raw flags ever appear here.

/** Canonical readiness values (server-owned; the browser only renders them). */
export type ReadinessState =
  | 'ready_to_generate'
  | 'generated_awaiting_approval'
  | 'approved'
  | 'needs_regeneration'
  | 'awaiting_headshot'
  | 'awaiting_preferred_phone'
  | 'awaiting_provisioned_email'
  | 'awaiting_license'
  | 'license_not_eligible'
  | 'not_ready'

/** Product-facing missing-requirement keys (bounded; from the server). */
export type MissingRequirement =
  | 'headshot'
  | 'preferred_public_phone'
  | 'brokerage_email'
  | 'license_number'
  | 'name'
  | 'onboarding'

export interface MarketingProfileState {
  avatar: {
    hasPhoto: boolean
    /** Transient internal delivery URL (or null). Rendered directly; NEVER persisted. */
    displayUrl: string | null
    updatedAt: string | null
    uploadAvailable: boolean
  }
  marketingCard: {
    readiness: ReadinessState
    missingRequirements: string[]
    phoneUpdateAvailable: boolean
  }
  profile: {
    fullName: string | null
    /** Fixed V1 title — read-only, never editable in the UI. */
    cardTitle: string
    preferredPublicPhone: string | null
    brokerageEmail: string | null
    licenseNumber: string | null
  }
}
