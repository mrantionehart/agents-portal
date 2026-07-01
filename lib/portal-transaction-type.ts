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
