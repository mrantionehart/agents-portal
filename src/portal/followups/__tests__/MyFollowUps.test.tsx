// ============================================================================
// AP-FOLLOWUPS-1 — the Portal must never be the authorization boundary
// ============================================================================
// Ownership and tenancy are decided by Vault (`resolveCrmOwnerScope` /
// `authorizeCrmRecordAccess`). What these tests pin is that the Portal cannot
// weaken that: no crm_* table is read through the Portal's own client, no
// request carries an agent or tenant parameter the server would have to trust,
// and the buckets shown are the ones the SERVER supplied.
//
// Jest, not vitest — AP runs `jest` (package.json `test`), and there is no
// vitest config in this repo. A vitest-style suite here fails to parse rather
// than failing to pass, which looks like a broken component.
// ============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

import MyFollowUps, {
  BUCKETS,
  BUCKET_LABEL,
  groupByBucket,
  formatDue,
  type FollowupRow,
} from '@/src/portal/followups/MyFollowUps'

const row = (over: Partial<FollowupRow> = {}): FollowupRow => ({
  id: 't1',
  title: 'Call back',
  description: null,
  due_at: '2026-11-01T18:00:00Z',
  status: 'pending',
  bucket: 'overdue',
  client_profile_id: 'lead-1',
  ...over,
})

const okRes = (tasks: FollowupRow[]) => ({ ok: true, status: 200, json: async () => ({ tasks }) })

beforeEach(() => {
  jest.clearAllMocks()
})

describe('groupByBucket — the SERVER bucket, never a local guess', () => {
  it('files each row under the bucket the API returned', () => {
    const g = groupByBucket([
      row({ id: 'a', bucket: 'overdue' }),
      row({ id: 'b', bucket: 'today' }),
      row({ id: 'c', bucket: 'upcoming' }),
      row({ id: 'd', bucket: 'completed' }),
    ])
    expect(Object.fromEntries(BUCKETS.map((b) => [b, g[b].map((r) => r.id)]))).toEqual({
      overdue: ['a'], today: ['b'], upcoming: ['c'], completed: ['d'],
    })
  })

  it.each([null, undefined, 'cancelled', 'wat', ''])(
    'leaves a row with bucket %p out of every tab rather than guessing',
    (bucket) => {
      // crm_followup_bucket returns NULL for cancelled, for an unknown status
      // and for a missing due date. Guessing a tab here would invent work, or
      // hide an overdue follow-up under Upcoming.
      const g = groupByBucket([row({ bucket: bucket as never })])
      expect(BUCKETS.flatMap((b) => g[b])).toEqual([])
    },
  )

  it('orders each bucket by due date', () => {
    const g = groupByBucket([
      row({ id: 'late', due_at: '2026-11-09T18:00:00Z' }),
      row({ id: 'early', due_at: '2026-11-01T18:00:00Z' }),
    ])
    expect(g.overdue.map((r) => r.id)).toEqual(['early', 'late'])
  })

  it('an empty list yields four empty buckets, not an error', () => {
    expect(groupByBucket([])).toEqual({ overdue: [], today: [], upcoming: [], completed: [] })
  })
})

describe('formatDue', () => {
  it('renders in Eastern, matching the bucket definition', () => {
    // 01:00 UTC on the 2nd is 21:00 Eastern on the 1st. Rendered in UTC a row
    // would read as a different day than the tab it sits under.
    expect(formatDue('2026-11-02T01:00:00Z')).toContain('Nov 1')
  })

  it.each(['', 'not a date'])('an unusable date (%p) renders as a dash, not Invalid Date', (v) => {
    expect(formatDue(v)).toBe('—')
  })
})

describe('reads and writes go to Vault, carrying no scope of their own', () => {
  it('loads from Vault follow-ups and shows the row', async () => {
    mockFetch.mockResolvedValueOnce(okRes([row({ title: 'Call the Newark seller' })]))
    render(<MyFollowUps />)
    await waitFor(() => expect(screen.getByText('Call the Newark seller')).toBeInTheDocument())
    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('/crm/followups')
    // 🔒 No agent or tenant parameter: Vault derives both from the profiles
    // row, and a parameter here would invite widening from the client.
    expect(url).not.toMatch(/agent_id|tenant/i)
  })

  it('Complete sends a status PATCH for that task and nothing else', async () => {
    mockFetch.mockResolvedValueOnce(okRes([row()]))
    render(<MyFollowUps />)
    await waitFor(() => expect(screen.getByText('Call back')).toBeInTheDocument())
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce(okRes([]))
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
    await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(1))
    const [, init] = mockFetch.mock.calls[1]
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({ taskId: 't1', status: 'completed' })
  })

  it('an empty reschedule date is omitted rather than sent as an invalid date', async () => {
    mockFetch.mockResolvedValueOnce(okRes([row()]))
    render(<MyFollowUps />)
    await waitFor(() => expect(screen.getByText('Call back')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule / notes' }))
    // Both inputs start empty, so getByDisplayValue('') is ambiguous. Target
    // the notes field by its label.
    fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: 'left a voicemail' } })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce(okRes([]))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(1))
    const body = JSON.parse(String(mockFetch.mock.calls[1][1].body))
    expect(body.dueDate).toBeUndefined()
    expect(body.notes).toBe('left a voicemail')
  })

  it('a refused load is reported, not shown as an empty list', async () => {
    // "No follow-ups" and "I could not load them" must not look the same.
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) })
    render(<MyFollowUps />)
    await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument())
  })
})

describe('the Portal is not the authorization boundary', () => {
  const src = readFileSync(join(process.cwd(), 'src/portal/followups/MyFollowUps.tsx'), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('never reads a crm_* table through the Portal own client', () => {
    expect(code).not.toMatch(/\.from\(\s*["'`]crm_/)
    expect(code).not.toMatch(/createServerClient|createBrowserClient|createClient\(/)
  })

  it('sends no tenant identifier of its own', () => {
    expect(code).not.toMatch(/tenant_id|tenantId/)
  })

  it('talks only to Vault follow-ups endpoint, through authFetch', () => {
    expect(code).toMatch(/\/crm\/followups/)
    expect(code).toMatch(/authFetch\(/)
  })

  it('the page shell constructs no Supabase client either', () => {
    const page = readFileSync(join(process.cwd(), 'app/(portal)/follow-ups/page.tsx'), 'utf8')
    expect(page).not.toMatch(/createServerClient|createClient\(/)
  })

  it('the comment stripper keeps code and drops prose', () => {
    // Without this the assertions above could pass on a comment.
    const strip = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(strip('a(); // .from("crm_x")')).not.toMatch(/crm_x/)
    expect(strip('x.from("crm_x"); // note')).toMatch(/crm_x/)
    expect(code.length).toBeGreaterThan(500)
  })
})

describe('labels', () => {
  it('names the four buckets Vault names', () => {
    expect([...BUCKETS]).toEqual(['overdue', 'today', 'upcoming', 'completed'])
    expect(BUCKET_LABEL.overdue).toBe('Overdue')
  })
})
