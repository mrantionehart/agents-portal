// ============================================================================
// P4H · the checklist ROW for a broker-approved agreement — MOUNTED
// ============================================================================
// The logic tests prove the mapping; this proves the row. An approved
// agreement used to render "Required" at the top of the Documents tab and
// offer no send, because `mapVaultStatusToLabel` hit its default and the send
// guard was written against the OLD label for `signed`.
//
// [CTA-3] is the one the logic tests could not reach: the send button's
// visibility is decided in the component, not in checklist-logic, and a
// mutation hiding it on an approved row survived every logic test.
// ============================================================================

import { render, screen, waitFor, within } from '@testing-library/react'
import ChecklistTable from '@/src/portal/documents/checklist/ChecklistTable'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const TXN = '3fbb0fac-796f-4e93-ba87-e399b55a3abf'
const FI = '35ffc269-4240-400f-9a94-efdde2063094'

/**
 * Mallory's ERL-14, in the shapes buildChecklistRows actually requires —
 * read off VaultRequirementCard / VaultDocumentCard rather than invented,
 * because a fixture that does not match the real contract renders no row and
 * the whole suite then proves nothing.
 */
const doc = (status: string) => ({
  form_instance_id: FI,
  form_id: 'ERL-14',
  form_name: 'Exclusive Right to Lease',
  category: 'listing',
  status,
  form_revision: 'Rev 1/2026',
  manual_only: false,
  accepts_upload: true,
  generatable: true,
  e_sign: true,
  has_upload: true,
})

const requirement = {
  form_id: 'ERL-14',
  form_name: 'Exclusive Right to Lease',
  category: 'listing',
  form_revision: 'Rev 1/2026',
  required: true,
  reason: 'A rental listing requires an exclusive right to lease.',
  requirement_basis: 'always' as const,
}

/**
 * 🔑 TWO FETCHERS. The checklist payload comes from GLOBAL fetch
 * (`/api/paperwork/checklist`, cache:'no-store'); only the DocuSign status
 * goes through `authFetch`. Mocking just one leaves the table empty and every
 * assertion below fails on a missing row rather than on what it claims to
 * test.
 */
function route(status: string) {
  mockFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ connected: true, status: 'connected', needs_reconnect: false }),
  }))
  global.fetch = jest.fn(async (url: unknown) => {
    if (String(url).includes('/esign/status')) {
      return { ok: true, json: async () => ({ connected: true, status: 'connected', needs_reconnect: false }) } as unknown as Response
    }
    return {
      ok: true,
      json: async () => ({ requirements: [requirement], documents: [doc(status)], supported: true }),
    } as unknown as Response
  }) as unknown as typeof fetch
}

const erlRow = async () => {
  const cell = await screen.findByText('Exclusive Right to Lease')
  return cell.closest('tr') ?? cell.closest('li') ?? cell.parentElement!
}

beforeEach(() => jest.clearAllMocks())

describe('[CTA] the checklist row for an approved agreement', () => {
  it('[CTA-1] the reported defect: the row does NOT read Required', async () => {
    route('approved')
    render(<ChecklistTable transactionId={TXN} />)
    const row = await erlRow()
    await waitFor(() =>
      expect(within(row).getByText('Approved — Awaiting Signature')).toBeInTheDocument(),
    )
    // 🔑 The row legitimately still carries a "Required" badge — that is the
    // REQUIREMENT column, and this form IS required. The defect was the
    // STATUS column reading Required, so assert on the status badge rather
    // than on the absence of the word anywhere in the row. Conflating the two
    // columns is how this assertion first failed against correct output.
    // 🔑 And it must be VISIBLE. `Hidden` is a real label in this vocabulary
    // (voided rows are dropped with it), so a badge styled `hidden` would
    // render nothing while jsdom still resolves the text — a regression no
    // getByText can see.
    const statusBadge = within(row).getByText('Approved — Awaiting Signature')
    expect(statusBadge.className).not.toMatch(/\bhidden\b/)
    expect(statusBadge.className).toMatch(/emerald/)

    const required = within(row).getAllByText('Required')
    expect(required).toHaveLength(1)
    expect(required[0].className).toMatch(/rose/) // the requirement badge
    expect(row.textContent).not.toMatch(/draft/i)
    expect(row.textContent).not.toMatch(/Not ready yet/)
  })

  it('[CTA-2] the two broker-decision states name themselves on the row', async () => {
    route('pending_approval')
    const { unmount } = render(<ChecklistTable transactionId={TXN} />)
    let row = await erlRow()
    await waitFor(() =>
      expect(within(row).getByText('Pending Broker Approval')).toBeInTheDocument(),
    )
    unmount()

    route('changes_requested')
    render(<ChecklistTable transactionId={TXN} />)
    row = await erlRow()
    await waitFor(() => expect(within(row).getByText('Changes Requested')).toBeInTheDocument())
  })

  it('[CTA-3] an APPROVED row still offers the send — the guard was wrong', async () => {
    // The send guard read `!== 'Approved'`, which was the OLD label for
    // `signed`. With the labels corrected, approved-awaiting-signature is
    // exactly when a send belongs, and no logic test can see this.
    route('approved')
    render(<ChecklistTable transactionId={TXN} />)
    const row = await erlRow()
    await waitFor(() =>
      expect(within(row).getByText('Approved — Awaiting Signature')).toBeInTheDocument(),
    )
    expect(within(row).getByRole('button', { name: /DocuSign/i })).toBeInTheDocument()
  })

  it('[CTA-4] a SIGNED row offers no send — the control', async () => {
    route('signed')
    render(<ChecklistTable transactionId={TXN} />)
    const row = await erlRow()
    await waitFor(() => expect(within(row).getByText('Signed')).toBeInTheDocument())
    // Distinct from broker approval, and nothing left to send.
    expect(within(row).queryByText('Approved — Awaiting Signature')).toBeNull()
    expect(within(row).queryByRole('button', { name: /DocuSign/i })).toBeNull()
  })

  it('[CTA-5] a SENT row offers no send either — the other control', async () => {
    route('sent')
    render(<ChecklistTable transactionId={TXN} />)
    const row = await erlRow()
    await waitFor(() => expect(within(row).getByText('Sent')).toBeInTheDocument())
    expect(within(row).queryByRole('button', { name: /DocuSign/i })).toBeNull()
  })
})
