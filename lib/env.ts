// ============================================================================
// Env validation — Deal Copilot (Portal)
// ============================================================================
// Call validateDealCopilotEnv() at module load time. Throws a descriptive
// error if any required value is missing or malformed. No silent failures.

interface RequiredVar {
  name: string
  minLen?: number
  format?: 'url' | 'hex' | 'string'
}

const PORTAL_REQUIRED: RequiredVar[] = [
  { name: 'DEAL_INTAKE_SIGNING_SECRET', minLen: 32, format: 'hex' },
  { name: 'VAULT_BASE_URL', format: 'url' },
]

function check(rv: RequiredVar): string | null {
  const v = process.env[rv.name]
  if (!v || v.trim() === '') return `${rv.name} missing`
  if (v.startsWith('YOUR_') || v.includes('replace-with-') || v.includes('your-vault-api-url')) {
    return `${rv.name} still contains a placeholder value`
  }
  if (rv.minLen && v.length < rv.minLen) {
    return `${rv.name} is too short (need at least ${rv.minLen} chars, got ${v.length})`
  }
  if (rv.format === 'url' && !/^https?:\/\//.test(v)) {
    return `${rv.name} must be a URL starting with http:// or https://`
  }
  if (rv.format === 'hex' && !/^[0-9a-f]+$/i.test(v)) {
    return `${rv.name} must be hex-encoded (must match Vault's DEAL_INTAKE_SIGNING_SECRET)`
  }
  return null
}

let validated = false

export function validateDealCopilotEnv(): void {
  if (validated) return
  const errors = PORTAL_REQUIRED.map(check).filter((e): e is string => e !== null)
  if (errors.length > 0) {
    throw new Error(
      `[Deal Copilot env] ${errors.length} validation error${
        errors.length === 1 ? '' : 's'
      }:\n  - ${errors.join('\n  - ')}\n` +
        `Fix agents-portal/.env.local and restart. ` +
        `DEAL_INTAKE_SIGNING_SECRET MUST equal Vault's value.`
    )
  }
  validated = true
}
