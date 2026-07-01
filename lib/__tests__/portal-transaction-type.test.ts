/**
 * @jest-environment node
 */
// ============================================================================
// AGENT.SIGN.1B.5 — portal→Vault transaction-type mapping tests
// ============================================================================

import { mapPortalTransactionTypeToVaultType } from '../portal-transaction-type'

describe('mapPortalTransactionTypeToVaultType — supported types', () => {
  it('buyer → buyer_rep (buyer representation, NOT purchase)', () => {
    const m = mapPortalTransactionTypeToVaultType('buyer')
    expect(m.vaultType).toBe('buyer_rep')
    expect(m.supported).toBe(true)
  })

  it('seller → listing (the risk case — NOT purchase seller-side)', () => {
    const m = mapPortalTransactionTypeToVaultType('seller')
    expect(m.vaultType).toBe('listing')
    expect(m.supported).toBe(true)
  })

  it('lease → lease', () => {
    expect(mapPortalTransactionTypeToVaultType('lease').vaultType).toBe('lease')
  })

  it('already-Vault vocab passes through (buyer_rep, listing)', () => {
    expect(mapPortalTransactionTypeToVaultType('buyer_rep').vaultType).toBe('buyer_rep')
    expect(mapPortalTransactionTypeToVaultType('listing').vaultType).toBe('listing')
  })

  it('purchase → buyer (purchase-contract forms; Vault keys these on buyer/seller)', () => {
    const m = mapPortalTransactionTypeToVaultType('purchase')
    expect(m.vaultType).toBe('buyer')
    expect(m.supported).toBe(true)
  })
})

describe('mapPortalTransactionTypeToVaultType — unsupported legacy types', () => {
  it.each(['referral', 'wholesale', 'double_close'])(
    '%s → unsupported (null), and is NOT silently mapped to purchase',
    (t) => {
      const m = mapPortalTransactionTypeToVaultType(t)
      expect(m.vaultType).toBeNull()
      expect(m.supported).toBe(false)
    }
  )

  it('unknown / empty / null → unsupported (null)', () => {
    for (const t of ['', '   ', 'nonsense', null, undefined]) {
      const m = mapPortalTransactionTypeToVaultType(t as string)
      expect(m.vaultType).toBeNull()
      expect(m.supported).toBe(false)
    }
  })

  it('never maps any input to a raw "purchase" Vault token', () => {
    for (const t of ['buyer', 'seller', 'lease', 'purchase', 'referral', 'wholesale', 'x']) {
      expect(mapPortalTransactionTypeToVaultType(t).vaultType).not.toBe('purchase')
    }
  })
})
