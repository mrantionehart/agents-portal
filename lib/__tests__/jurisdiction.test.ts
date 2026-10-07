// ---------------------------------------------------------------------------
// PAPERWORK-JURISDICTION-2 — AP's copy of the jurisdiction allow-list
//
// AP has exactly one generation path of its own (/api/closeiq/contract). These
// tests pin the allow-list and the refusal shape; the Vault repo holds the
// equivalents for every other path.
// ---------------------------------------------------------------------------

import {
  AUTOMATED_JURISDICTIONS,
  SUPPORTED_JURISDICTIONS,
  normalizeStateCode,
  refuseIfNotAutomated,
} from '../jurisdiction'

describe('normalizeStateCode', () => {
  it('accepts the code, any casing, padding, or full name', () => {
    for (const raw of ['FL', 'fl', ' FL ', 'Florida', 'florida']) {
      expect(normalizeStateCode(raw)).toBe('FL')
    }
    for (const raw of ['NJ', 'nj', 'New Jersey', 'N.J.', 'N. J.']) {
      expect(normalizeStateCode(raw)).toBe('NJ')
    }
  })

  it('rejects blanks, near-misses and non-strings', () => {
    for (const raw of ['', '   ', 'FLA', 'GA', 'New York', null, undefined, 42, {}]) {
      expect(normalizeStateCode(raw)).toBeNull()
    }
  })
})

describe('the allow-list matches Vault', () => {
  it('supports FL + NJ, automates FL only', () => {
    expect([...SUPPORTED_JURISDICTIONS]).toEqual(['FL', 'NJ'])
    // Adding NJ here requires licensed NJ templates in contract_templates.
    expect([...AUTOMATED_JURISDICTIONS]).toEqual(['FL'])
  })
})

describe('refuseIfNotAutomated', () => {
  it('lets a Florida offer through, however it was typed', () => {
    for (const raw of ['FL', 'fl', ' Florida ']) {
      expect(refuseIfNotAutomated(raw)).toBeNull()
    }
  })

  it('refuses New Jersey with the pending-approval wording', () => {
    const r = refuseIfNotAutomated('NJ')
    expect(r).not.toBeNull()
    expect(r!.code).toBe('JURISDICTION_BLOCKED')
    expect(r!.jurisdiction).toBe('NJ')
    expect(r!.error).toContain('NJ paperwork templates pending approval')
  })

  it('refuses a blank state — the old code assumed Florida here', () => {
    for (const raw of ['', '   ', null, undefined]) {
      const r = refuseIfNotAutomated(raw)
      expect(r).not.toBeNull()
      expect(r!.jurisdiction).toBeNull()
      expect(r!.error).toContain('not set')
    }
  })

  it('refuses an unsupported state and names what is supported', () => {
    const r = refuseIfNotAutomated('GA')
    expect(r).not.toBeNull()
    expect(r!.error).toContain('GA')
    expect(r!.error).toContain('FL')
  })
})

describe('the CloseIQ generator route', () => {
  const src = require('fs').readFileSync(
    require('path').join(process.cwd(), 'app/api/closeiq/contract/route.ts'),
    'utf8'
  ) as string

  it('refuses before loading, downloading or filling a template', () => {
    const gateAt = src.indexOf('refuseIfNotAutomated')
    expect(gateAt).toBeGreaterThan(-1)
    // Everything that touches a template or storage must come AFTER the gate.
    for (const marker of ["from('contract_templates')", '.storage', 'buildFieldValues(']) {
      expect(src.indexOf(marker)).toBeGreaterThan(gateAt)
    }
  })

  it('no longer defaults a missing state to Florida or a county to Miami-Dade', () => {
    expect(src).not.toContain("offer.property_state || 'FL'")
    expect(src).not.toContain("offer.property_county || 'Miami-Dade'")
  })

  it('leaves GET ungated so already-generated contracts stay readable', () => {
    const getAt = src.indexOf('export async function GET')
    expect(getAt).toBeGreaterThan(-1)
    expect(src.slice(getAt)).not.toContain('refuseIfNotAutomated')
  })
})
