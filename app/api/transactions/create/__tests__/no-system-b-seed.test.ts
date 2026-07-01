/**
 * @jest-environment node
 */
// ============================================================================
// AGENT.SIGN.1B (Phase 0) — create route no longer seeds System B
// ============================================================================
// Guard: the transaction-create path must NOT insert transaction_doc_requirements
// rows and must NOT call the deprecated getDocRequirements() rule set. It must
// call Vault ensure-forms (System A) instead. Source-level assertions avoid
// mocking the full Supabase + Vault stack while still locking the contract.

import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8')

describe('transactions/create — System A only', () => {
  it('does NOT write to (from) transaction_doc_requirements', () => {
    // Prose mentions of the table (deprecation notes) are fine; a DB access is not.
    expect(src).not.toMatch(/from\(\s*['"]transaction_doc_requirements['"]\s*\)/)
  })

  it('does NOT call getDocRequirements() in any create path', () => {
    // The function definition may remain (deprecated), but there must be no
    // invocation like `= getDocRequirements(` or `docRequirements`.
    expect(src).not.toMatch(/=\s*getDocRequirements\(/)
    expect(src).not.toContain('docRequirements')
  })

  it('marks getDocRequirements @deprecated', () => {
    expect(src).toContain('@deprecated')
  })

  it('calls Vault ensureVaultForms to materialize System A form_instances', () => {
    expect(src).toContain('ensureVaultForms(request, transaction.id')
  })

  it('maps the portal type to the Vault type before calling ensure-forms', () => {
    expect(src).toContain('mapPortalTransactionTypeToVaultType(type)')
    // Unsupported types are skipped, not sent to Vault.
    expect(src).toMatch(/mapped\.supported/)
  })
})
