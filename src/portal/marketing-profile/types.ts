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

// ── Card requests ──────────────────────────────────────────────────────────
// Mirrors GET/POST /api/agent/card-request. Product concepts only.

/** Why an agent is asking. Mirrors the DB CHECK constraint. */
export type CardRequestReason = 'first_card' | 'new_headshot' | 'details_changed' | 'reprint'

/** The three states an agent is shown, plus the two ways a request can end.
 *  SERVER-owned: the browser renders this, it never derives it. */
export type CardRequestAgentState = 'none' | 'requested' | 'being_made' | 'ready' | 'declined'

export interface CardRequestState {
  state: CardRequestAgentState
  /** False while a request of theirs is live — the server decides, not the UI. */
  canRequest: boolean
  suggestedReason: CardRequestReason
  hasApprovedCard: boolean
  request: {
    id: string
    status: string
    reason: string
    note: string | null
    requestedAt: string
    resolvedAt: string | null
    resolutionNote: string | null
  } | null
}
