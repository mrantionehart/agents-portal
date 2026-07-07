// ============================================================================
// AGENT.SIGN.1B.5 — Agent Portal → Vault transaction-type mapping (pure)
// ============================================================================
// The Agent Portal and the Vault rule engine use different transaction-type
// vocabularies. This single helper maps the portal's type onto the Vault
// dispatch input that produces the CORRECT rule set, so agent-created
// transactions materialize the right required-document checklist.
//
// Portal vocabulary → Vault dispatch input:
//   buyer       → buyer_rep   (portal "buyer" = buyer REPRESENTATION)
//   seller      → listing     (portal "seller" = listing / seller representation)
//   lease       → lease
//   buyer_rep   → buyer_rep    (already Vault vocabulary)
//   listing     → listing      (already Vault vocabulary)
//   purchase    → buyer        (purchase CONTRACT forms; Vault keys PURCHASE_RULES
//                               on the buyer/seller-side inputs, NOT a standalone
//                               'purchase' token — buyer-side is the default)
//   referral | wholesale | double_close | <unknown>
//               → UNSUPPORTED (vaultType=null). Callers must NOT send these to
//                 Vault ensure-forms; they fall back to the legacy checklist.
//                 They are explicitly NOT mapped to purchase.
// ============================================================================

/** Vault dispatch inputs that produce a non-empty rule set. */
export type VaultTransactionType =
  | 'lease'
  | 'buyer'
  | 'seller'
  | 'listing'
  | 'buyer_rep'

export interface MappedTransactionType {
  portalType: string
  vaultType: VaultTransactionType | null
  /** true when Vault System A covers this type; false = legacy fallback. */
  supported: boolean
}

/**
 * TRANSACTION OS 3.3B.3D — enum-safe stored type.
 *
 * `transactions.type` is a Postgres ENUM whose live members are:
 *   buyer · seller · lease · referral · wholesale · double_close · listing · buyer_rep
 * (verified against production). The wizard's canonical vocabulary adds
 * `purchase` and `commercial`, which are NOT enum members. This maps a canonical
 * (or already-legacy) type onto a value the enum accepts, WITHOUT a migration.
 *
 * NOTE (tech debt): `purchase` and `commercial` both fold to `buyer` because the
 * enum can't represent them yet. The correct FAR-BAR rule set is still derived at
 * create time via `mapPortalTransactionTypeToVaultType(canonical)` (purchase →
 * buyer). But the checklist READ-path re-derives from the stored `buyer`, which
 * the mapper resolves to `buyer_rep` (BRA) — so FAR-BAR is not persistently
 * re-derived. Fully fixing this needs a future `ALTER TYPE transaction_type
 * ADD VALUE 'purchase'` (+ 'commercial') migration and mapper update.
 */
const CANONICAL_TO_ENUM_TYPE: Record<string, string> = {
  purchase: 'buyer', // enum has no 'purchase' → buyer-side (FAR-BAR via mapper)
  commercial: 'buyer', // enum has no 'commercial' → buyer-side fallback
  listing: 'listing',
  buyer_rep: 'buyer_rep',
  lease: 'lease',
  wholesale: 'wholesale',
  referral: 'referral',
}

/** Live enum members of `transactions.type` (no migration path from the portal). */
export const TRANSACTION_TYPE_ENUM_VALUES = [
  'buyer',
  'seller',
  'lease',
  'referral',
  'wholesale',
  'double_close',
  'listing',
  'buyer_rep',
] as const

/**
 * Resolve a canonical (or legacy) transaction type to a value the
 * `transactions.type` enum accepts. Legacy values that are already enum members
 * pass through unchanged; canonical `purchase`/`commercial` fold to `buyer`.
 */
export function toEnumTransactionType(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if ((TRANSACTION_TYPE_ENUM_VALUES as readonly string[]).includes(t)) return t
  return CANONICAL_TO_ENUM_TYPE[t] ?? 'buyer'
}

export function mapPortalTransactionTypeToVaultType(
  portalType: string | null | undefined
): MappedTransactionType {
  const portal = (portalType ?? '').trim()
  switch (portal) {
    case 'buyer':
      return { portalType: portal, vaultType: 'buyer_rep', supported: true }
    case 'seller':
      return { portalType: portal, vaultType: 'listing', supported: true }
    case 'lease':
      return { portalType: portal, vaultType: 'lease', supported: true }
    case 'buyer_rep':
      return { portalType: portal, vaultType: 'buyer_rep', supported: true }
    case 'listing':
      return { portalType: portal, vaultType: 'listing', supported: true }
    case 'purchase':
      // Purchase-contract transaction → Vault produces FAR-BAR/SPDR via the
      // buyer/seller-side inputs; buyer-side is the sensible default.
      return { portalType: portal, vaultType: 'buyer', supported: true }
    default:
      // referral / wholesale / double_close / unknown — NOT mapped to purchase.
      return { portalType: portal, vaultType: null, supported: false }
  }
}
