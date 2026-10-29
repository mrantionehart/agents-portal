/**
 * @jest-environment jsdom
 */
// ============================================================================
// P8-A — the legacy Agent Portal deals surface is retired
// ============================================================================
//
// Vault retired POST/GET `/api/deals` and PUT/DELETE `/api/deals/:id` in P7.4C
// (#1338). What stayed behind in this repo was a page that still called them:
//
//   app/deals/page.tsx            list  — `/deals` is redirect-folded into
//                                 `/workspace`, and its data came from the
//                                 proxy below, i.e. a 404.
//   app/deals/[id]/page.tsx       detail — reachable BY URL, because the
//                                 redirect source is exact-match. Its Delete
//                                 button called a route answering 405.
//   app/api/vault/deals/route.ts  proxy  — forwarded to Vault `/api/deals`: 404.
//   components/ComplianceCheckCard.tsx   — rendered only by the detail page.
//
// Three traps this suite is built around, all paid for before:
//
//  1. `existsSync` passes just as happily when the path STRING is wrong, so a
//     deletion is proven by making `import()` REJECT — and [P8A-C2] imports a
//     module that DOES exist through the same helper, so a green run cannot
//     come from a mechanism that rejects everything.
//  2. A dynamic `import()` of a deleted module with a LITERAL specifier is a
//     `tsc` error on the very test that proves the deletion ⇒ the specifier is
//     a variable.
//  3. A source assertion can be satisfied by the file's own PROSE — in P7.4C a
//     delete-gate scan matched this repo's explanatory comment. [P8A-R6] strips
//     comments before asserting, and the behavioural checks below are the
//     primary evidence either way.

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Same axios + @supabase/ssr mocks PORTAL.1A uses: importing vault-api
// instantiates the client and registers its request interceptor.
jest.mock('axios', () => {
  const instance = {
    interceptors: { request: { use: () => {} } },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  }
  return { __esModule: true, default: { create: () => instance } }
})

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      refreshSession: jest.fn(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }),
}))

const ROOT = join(__dirname, '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// Variable specifier — see trap 2.
const load = (specifier: string) => import(specifier)

const DELETED = [
  ['the legacy deals LIST page', '../../app/deals/page'],
  ['the legacy deal DETAIL page (and its Delete button)', '../../app/deals/[id]/page'],
  ['the /api/vault/deals proxy', '../../app/api/vault/deals/route'],
  ['the per-deal ComplianceCheckCard', '../../components/ComplianceCheckCard'],
] as const

describe('P8-A — retired AP deals surface', () => {
  it.each(DELETED)('[P8A-R1] %s no longer resolves', async (_label, specifier) => {
    await expect(load(specifier)).rejects.toBeDefined()
  })

  // ---- the control that makes the four above mean something -------------
  it('[P8A-C2] the same helper RESOLVES a module that still exists', async () => {
    await expect(load('../../components/LoadingSpinner')).resolves.toBeDefined()
    await expect(load('../../components/ProtectedRoute')).resolves.toBeDefined()
  })

  it('[P8A-R5] the Vault client exposes no deal method', async () => {
    const mod = await import('../vault-api')
    const client = (mod as { vaultAPI: Record<string, unknown> }).vaultAPI
    for (const m of ['getDeals', 'getDeal', 'createDeal', 'updateDeal', 'deleteDeal']) {
      expect(typeof client[m]).toBe('undefined')
    }
  })

  // ---- the control that makes R5 mean something -------------------------
  it('[P8A-C1] the Vault client still exists, with its non-deal methods', async () => {
    const mod = await import('../vault-api')
    const client = (mod as { vaultAPI: Record<string, unknown> }).vaultAPI
    expect(client).toBeDefined()
    for (const m of ['getCommissions', 'getDocuments', 'getAgents', 'runComplianceCheck']) {
      expect(typeof client[m]).toBe('function')
    }
  })

  it('[P8A-R6] the client source carries no /deals request path', () => {
    const src = stripComments(read('lib/vault-api.ts'))
    expect(src).not.toMatch(/['"`]\/deals/)
  })

  // ---- the path still resolves for a user; it did not become a 404 ------
  it('[P8A-C3] /deals is still redirect-folded into /workspace', () => {
    const cfg = stripComments(read('next.config.js'))
    expect(cfg).toMatch(/source:\s*'\/deals'/)
    expect(cfg).toMatch(/destination:\s*'\/workspace'/)
  })

  // ---- compliance keeps an entry point of its own ------------------------
  it('[P8A-C4] /compliance survives the card deletion and is still in the nav', () => {
    expect(existsSync(join(ROOT, 'app/compliance/page.tsx'))).toBe(true)
    const nav = stripComments(read('app/components/SidebarNav.tsx'))
    expect(nav).toMatch(/href:\s*'\/compliance'/)
  })
})
