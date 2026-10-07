// ---------------------------------------------------------------------------
// PAPERWORK-JURISDICTION-2 — where automated contract generation is allowed
//
// HartFelt transacts in FLORIDA and NEW JERSEY. Only Florida has a form
// catalogue: every template in `contract_templates`, and every field map in
// the CloseIQ contract generator, is a Florida Realtors / FAR-BAR artifact.
//
// Vault (`src/lib/paperwork/jurisdiction.ts`) is the source of truth for this
// allow-list and gates its own generation paths. This file exists because AP
// has one generation path of its own — /api/closeiq/contract — that does not
// go through Vault. Keep the two allow-lists identical; adding NJ here without
// licensed NJ templates re-opens the defect both are closing.
//
// Note what this replaces: the generator defaulted `property_state` to 'FL'
// and `property_county` to 'Miami-Dade', so an offer with no state, or a New
// Jersey one, was silently stamped as Florida and handed a FAR-BAR contract.
// ---------------------------------------------------------------------------

export const SUPPORTED_JURISDICTIONS = ['FL', 'NJ'] as const
export const AUTOMATED_JURISDICTIONS = ['FL'] as const

export type Jurisdiction = (typeof SUPPORTED_JURISDICTIONS)[number]

const STATE_NAMES: Record<string, Jurisdiction> = {
  FLORIDA: 'FL',
  'NEW JERSEY': 'NJ',
}

/** "fl" / " FL " / "Florida" / "N.J." → code; anything else → null. */
export function normalizeStateCode(raw: unknown): Jurisdiction | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/[.\s]+/g, ' ').trim().toUpperCase()
  if (cleaned === '') return null
  const collapsed = cleaned.replace(/\s+/g, '')
  if ((SUPPORTED_JURISDICTIONS as readonly string[]).includes(collapsed)) {
    return collapsed as Jurisdiction
  }
  return STATE_NAMES[cleaned] ?? null
}

export interface JurisdictionRefusal {
  error: string
  code: 'JURISDICTION_BLOCKED'
  state_raw: string | null
  jurisdiction: Jurisdiction | null
  supported_states: readonly string[]
}

/**
 * Null when generation may proceed; otherwise the refusal body to return.
 * Blank is refused as loudly as an unsupported state — "we don't know where
 * this property is" is not a reason to assume Florida.
 */
export function refuseIfNotAutomated(raw: unknown): JurisdictionRefusal | null {
  const jurisdiction = normalizeStateCode(raw)
  if (jurisdiction && (AUTOMATED_JURISDICTIONS as readonly string[]).includes(jurisdiction)) {
    return null
  }
  const state_raw = typeof raw === 'string' ? raw : null
  const error = jurisdiction
    ? `${jurisdiction} paperwork templates pending approval — contract generation is unavailable for ${jurisdiction} properties. Prepare this contract manually.`
    : `Property state ${state_raw && state_raw.trim() ? `'${state_raw.trim()}'` : 'is not set'}${
        state_raw && state_raw.trim() ? ' is not supported' : ''
      }. Contract generation requires a supported jurisdiction (${AUTOMATED_JURISDICTIONS.join(', ')}).`
  return {
    error,
    code: 'JURISDICTION_BLOCKED',
    state_raw,
    jurisdiction,
    supported_states: SUPPORTED_JURISDICTIONS,
  }
}
