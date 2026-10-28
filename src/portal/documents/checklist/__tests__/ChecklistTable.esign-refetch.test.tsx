// ============================================================================
// P4H-13 · the reported "Connect DocuSign in Settings first." after reconnecting
// ============================================================================
// Her account WAS connected and fresh — connected_at and expires_at both
// current, 7.7h of validity left. The row still told her to connect, because
// the status was read once on mount with `useEffect(..., [])` and the OAuth
// round trip happens on a DIFFERENT page, so this component never had to
// unmount and the stale `false` survived the whole visit.
//
// Mounted rather than asserted from source: "the row says Connect" is a
// rendering claim, and a grep for an event listener would not prove the row
// changes.
// ============================================================================

import { render, waitFor, act } from '@testing-library/react'
import ChecklistTable from '@/src/portal/documents/checklist/ChecklistTable'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const TXN = 'txn-1'

const CHECKLIST = {
  documents: [],
  requirements: [],
  rows: [],
}

/** Status payloads: before the reconnect, and after. */
const NOT_CONNECTED = { connected: false, status: 'disconnected', needs_reconnect: true }
const CONNECTED = { connected: true, status: 'connected', needs_reconnect: false }

function route(status: unknown) {
  mockFetch.mockImplementation(async (url: string) => {
    if (String(url).includes('/esign/status')) {
      return { ok: true, json: async () => status }
    }
    return { ok: true, json: async () => CHECKLIST }
  })
}

const esignCalls = () =>
  mockFetch.mock.calls.filter((c) => String(c[0]).includes('/esign/status')).length

beforeEach(() => jest.clearAllMocks())

describe('ChecklistTable — DocuSign status is refetched, not cached for the visit', () => {
  it('[CT-1] reads the status on mount', async () => {
    route(NOT_CONNECTED)
    render(<ChecklistTable transactionId={TXN} />)
    await waitFor(() => expect(esignCalls()).toBe(1))
  })

  it('[CT-2] reads it AGAIN when the window regains focus', async () => {
    // Coming back from the OAuth round trip on /settings is exactly when the
    // answer has changed. Without this the stale value survives the visit.
    route(NOT_CONNECTED)
    render(<ChecklistTable transactionId={TXN} />)
    await waitFor(() => expect(esignCalls()).toBe(1))

    route(CONNECTED)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(esignCalls()).toBe(2))
  })

  it('[CT-3] and again when the tab becomes visible', async () => {
    route(NOT_CONNECTED)
    render(<ChecklistTable transactionId={TXN} />)
    await waitFor(() => expect(esignCalls()).toBe(1))

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(esignCalls()).toBe(2))
  })

  it('[CT-4] a HIDDEN tab does not refetch', async () => {
    // The control: the listener is conditioned on visibility, not firing on
    // every event.
    route(NOT_CONNECTED)
    render(<ChecklistTable transactionId={TXN} />)
    await waitFor(() => expect(esignCalls()).toBe(1))

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(esignCalls()).toBe(1)
  })

  it('[CT-6] the listeners are removed on unmount', async () => {
    route(CONNECTED)
    const { unmount } = render(<ChecklistTable transactionId={TXN} />)
    await waitFor(() => expect(esignCalls()).toBe(1))
    unmount()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    // No further read, and no state update on an unmounted component.
    expect(esignCalls()).toBe(1)
  })
})
