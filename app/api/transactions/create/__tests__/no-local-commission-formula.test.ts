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

describe('transactions/create — no local commission formula', () => {
  it('does not derive an agent or brokerage amount', () => {
    expect(src).not.toMatch(/const\s+agentAmt\s*=/)
    expect(src).not.toMatch(/const\s+brokerageAmt\s*=/)
    // and no split multiply survives anywhere in the file
    expect(src).not.toMatch(/grossComm\s*\*\s*\(\s*agentSplit/)
  })

  // C1 (2026-11-04) — the create path writes NO commission row at all. The
  // insert it used to make ran on the caller's token; production grants
  // `authenticated` SELECT only on `commissions`, so it was refused on every
  // call and silently ignored. Vault's /api/transactions/close creates the
  // commission with the service role.
  it('never writes the commissions table (with any client)', () => {
    const code = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    expect(code).not.toMatch(/from\(\s*['"]commissions['"]\s*\)/)
    expect(code).not.toMatch(/net_commission/)
  })
})
