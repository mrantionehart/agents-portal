/**
 * @jest-environment node
 */
// ============================================================================
// COMMISSION-CANONICAL-FORMULA-1 — the create path computes no money
// ============================================================================
// This route used to derive the commission split itself:
//
//     const agentAmt    = grossComm * (agentSplit / 100)
//     const brokerageAmt = grossComm - agentAmt
//
// — a third formula, with no transaction fee at all. On a 400,000 deal at 3%
// and a 70% split it wrote agent_amount 8,400.00 where Vault's calculator
// produces 8,193.50 and where /api/commissions/pay moves 8,193.50.
//
// The split depends on the agent's profile (split tier, per-deal fee, annual
// cap) — none of which this request body carries, and none of which a caller
// should be able to supply. So the money is computed in exactly one place:
// Vault's /api/commissions/calculate. This route records only the inputs.
//
// Source-level assertions, matching the sibling guard in
// no-system-b-seed.test.ts: they lock the contract without standing up the
// whole Supabase + Vault stack.

import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8')

// The commission insert, isolated — so a match elsewhere in the file (a
// comment, another table) cannot satisfy or break these assertions.
const commissionInsert = (() => {
  const i = src.indexOf(".from('commissions')")
  expect(i).toBeGreaterThan(-1)
  const end = src.indexOf('})', src.indexOf('.insert({', i))
  return src.slice(i, end + 2)
})()

describe('transactions/create — no local commission formula', () => {
  it('does not derive an agent or brokerage amount', () => {
    expect(src).not.toMatch(/const\s+agentAmt\s*=/)
    expect(src).not.toMatch(/const\s+brokerageAmt\s*=/)
    // and no split multiply survives anywhere in the file
    expect(src).not.toMatch(/grossComm\s*\*\s*\(\s*agentSplit/)
  })

  it('writes agent_amount and brokerage_amount as a literal 0 (both are NOT NULL)', () => {
    expect(commissionInsert).toMatch(/agent_amount:\s*0\s*,/)
    expect(commissionInsert).toMatch(/brokerage_amount:\s*0\s*,/)
  })

  it('declares pending_calculation rather than inheriting a column default', () => {
    // The zero above is the absence of a figure, and this is what says so.
    expect(commissionInsert).toMatch(
      /commission_status:\s*'pending_calculation'/
    )
  })

  it('never writes net_commission — only Vault’s calculator may', () => {
    expect(commissionInsert).not.toContain('net_commission')
  })

  it('never writes transaction_fee — it comes from the agent profile', () => {
    expect(commissionInsert).not.toContain('transaction_fee')
  })

  it('still records the INPUTS the Vault calculator needs', () => {
    for (const field of [
      'transaction_id',
      'agent_id',
      'gross_commission',
      'commission_rate_pct',
      'agent_split_pct',
    ]) {
      expect(commissionInsert).toContain(field)
    }
  })

  it('still skips the commission row entirely when there is no contract price', () => {
    expect(src).toMatch(/if\s*\(\s*price\s*>\s*0\s*\)/)
  })
})

// ── COMMISSION-REFERRAL-CANONICAL-1 ──────────────────────────────────
//
// This route also computed the referral AMOUNT (`grossComm × pct`, unclamped)
// and wrote it. Vault now treats a stored `referral_fee_amount` as
// AUTHORITATIVE — it is the only way a flat-dollar referral is expressed — so
// that multiply was quietly becoming the money, bypassing both the calculator
// and its clamp. And `referral_fee_pct` went to the shared `transactions`
// table with no range check, while both of Vault's own write paths reject
// anything outside 0-100.

describe('transactions/create — the referral is an input, not a computation', () => {
  it('does not derive a referral amount', () => {
    expect(src).not.toMatch(/const\s+referralAmt\s*=/)
    expect(src).not.toMatch(/grossComm\s*\*\s*\(\s*parseFloat\(\s*referral_fee_pct/)
  })

  it('never writes referral_fee_amount — only Vault’s calculator may', () => {
    expect(commissionInsert).not.toContain('referral_fee_amount')
  })

  it('still records the referral PERCENTAGE on the transaction', () => {
    // the input Vault's calculator reads
    expect(src).toMatch(/referral_fee_pct:\s*referralPct/)
    expect(src).toMatch(/referral_party:\s*referral_party\?\.trim\(\)/)
  })

  it('rejects a percentage outside 0-100, with Vault’s own message', () => {
    expect(src).toMatch(/pct\s*<\s*0\s*\|\|\s*pct\s*>\s*100/)
    expect(src).toContain('Referral fee percentage must be between 0 and 100')
  })

  it('validates BEFORE any insert, so a bad percentage writes nothing', () => {
    const guard = src.indexOf('Referral fee percentage must be between')
    const insert = src.indexOf(".from('transactions')")
    expect(guard).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(insert)
  })

  it('treats an absent percentage as null, not as zero', () => {
    // a stored 0 would read as "a referral was considered and set to nothing"
    expect(src).toMatch(/let referralPct: number \| null = null/)
  })
})
