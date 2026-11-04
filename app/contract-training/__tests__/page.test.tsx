// ============================================================================
// HARTFELT READY — the Contract Training library, MOUNTED
// ============================================================================
// Reported 2026-11-03: an agent could not find the Matrix MLS training. All
// seven documents were deployed, in her tenant, correctly scoped — five
// agent-visible, two broker/admin-only — and the five WERE in the default
// list. What was broken was the filter she would naturally use to find them:
// the page read `cat.category` / `cat.count` from a payload that carries
// `name` / `slug` / `document_count`, so the chips were unlabelled and
// clicking one sent `?category=undefined` and got an empty list back.
//
// The fixtures below are the REAL shapes, taken from the production rows and
// from what the Vault routes select. A UI contract invented in a test is not
// a contract. Jest, not vitest.
// ============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const push = jest.fn()
// The page renders the real SidebarNav, which calls usePathname(). Leaving it
// out fails inside the NAV, which reads like a broken page.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/contract-training',
}))
// A STABLE object: a fresh one per render changes `user`'s identity and the
// page's load effect never settles.
const AUTH = { user: { id: 'agent-1' }, role: 'agent', loading: false, signOut: jest.fn() }
jest.mock('../../providers', () => ({ useAuth: () => AUTH }))

import ContractTrainingPage from '../page'

// public.contract_training_categories, verbatim columns.
const MATRIX_CAT = {
  id: 'f025fa25-710f-45ae-a97c-d25ec34463af',
  name: 'Matrix MLS Training',
  slug: 'matrix-mls-training',
  icon: null,
  sort_order: 1,
  document_count: 5,
}
const OTHER_CAT = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  name: 'Florida Contracts',
  slug: 'florida-contracts',
  icon: null,
  sort_order: 2,
  document_count: 12,
}

// A document as the list route projects it: `*` plus the EMBEDDED category.
const doc = (over: Record<string, unknown> = {}) => ({
  id: '231216ca-431a-445b-ab8d-6a30fb27040b',
  title: 'Matrix MLS — Complete Training Manual · DRAFT — PENDING CURRENT MATRIX VERIFICATION',
  description: 'End-to-end Matrix MLS walkthrough.',
  contract_training_categories: {
    id: MATRIX_CAT.id, name: MATRIX_CAT.name, slug: MATRIX_CAT.slug, icon: null,
  },
  form_number: null,
  file_url: 'https://example.test/signed/manual.pdf',
  file_name: 'matrix-manual.pdf',
  status: 'draft',
  version: '1.0',
  tags: ['matrix', 'mls'],
  author: null,
  revision_date: null,
  created_at: '2026-10-28T20:30:30.537Z',
  updated_at: '2026-10-28T20:30:30.537Z',
  ...over,
})

const urlsFor = (sub: string) =>
  mockFetch.mock.calls.map((c) => String(c[0])).filter((u) => u.includes(sub))

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockImplementation(async (url: unknown) => {
    const u = String(url)
    if (u.includes('/categories')) {
      return { ok: true, status: 200, json: async () => ({ categories: [MATRIX_CAT, OTHER_CAT] }) }
    }
    // Honour the filter the way Vault does: resolve `category` as a SLUG.
    const q = u.includes('?') ? new URLSearchParams(u.split('?')[1]) : new URLSearchParams()
    const slug = q.get('category')
    if (slug && slug !== MATRIX_CAT.slug) {
      return { ok: true, status: 200, json: async () => ({ documents: [], count: 0 }) }
    }
    return { ok: true, status: 200, json: async () => ({ documents: [doc()], count: 1 }) }
  })
})

describe('[CTL] the Contract Training document library', () => {
  it('[CTL-1] the category chips are LABELLED — not "undefined (undefined)"', async () => {
    render(<ContractTrainingPage />)
    const chip = await waitFor(() => screen.getByTestId(`category-${MATRIX_CAT.slug}`))
    expect(chip).toHaveTextContent('Matrix MLS Training (5)')
    expect(chip.textContent).not.toMatch(/undefined/)
  })

  it('[CTL-2] the All count is a NUMBER — the old reduce produced NaN', async () => {
    render(<ContractTrainingPage />)
    // 5 + 12. Summing an absent field gave NaN, which rendered as "All (NaN)".
    await waitFor(() => expect(screen.getByText('All (17)')).toBeInTheDocument())
    expect(screen.queryByText(/All \(NaN\)/)).toBeNull()
  })

  it('[CTL-3] choosing Matrix MLS sends its SLUG and the documents come back', async () => {
    render(<ContractTrainingPage />)
    const chip = await waitFor(() => screen.getByTestId(`category-${MATRIX_CAT.slug}`))
    fireEvent.click(chip)

    await waitFor(() =>
      expect(urlsFor(`category=${MATRIX_CAT.slug}`).length).toBeGreaterThan(0),
    )
    // The defect in one assertion: `undefined` reached Vault as a slug and
    // matched nothing, so the list emptied.
    expect(urlsFor('category=undefined')).toHaveLength(0)
    await waitFor(() =>
      expect(screen.getByText(/Matrix MLS — Complete Training Manual/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/No training documents available in this category/)).toBeNull()
  })

  it('[CTL-4] a DRAFT document is listed — only archived is withheld', async () => {
    // All seven Matrix documents are status='draft', and `scopeToReader`
    // withholds only `archived`. If draft were filtered the agent would see
    // an empty library and the documents would look missing.
    render(<ContractTrainingPage />)
    await waitFor(() =>
      expect(screen.getByText(/Matrix MLS — Complete Training Manual/)).toBeInTheDocument(),
    )
  })

  it('[CTL-5] an archived document is withheld — the control', async () => {
    mockFetch.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/categories')) {
        return { ok: true, status: 200, json: async () => ({ categories: [MATRIX_CAT] }) }
      }
      return {
        ok: true, status: 200,
        json: async () => ({ documents: [doc({ status: 'archived' })], count: 1 }),
      }
    })
    render(<ContractTrainingPage />)
    await waitFor(() =>
      expect(screen.getByText(/No training documents available/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Matrix MLS — Complete Training Manual/)).toBeNull()
  })

  it("[CTL-6] the card names its category from the EMBEDDED resource", async () => {
    render(<ContractTrainingPage />)
    await waitFor(() =>
      expect(screen.getByText(/Matrix MLS — Complete Training Manual/)).toBeInTheDocument(),
    )
    // `doc.category` does not exist on the row; the name is in the embed.
    expect(screen.getByText('Matrix MLS Training')).toBeInTheDocument()
  })
})
