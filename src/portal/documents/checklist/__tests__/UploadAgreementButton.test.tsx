// ============================================================================
// P4H-13 · workflow B in the Agent Portal — mounted
// ============================================================================
// The action has to exist BESIDE Generate, not instead of it, and it has to
// tell the agent that uploading is not approving — otherwise she waits for a
// signature request that was never sent.
// ============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import UploadAgreementButton from '@/src/portal/documents/checklist/UploadAgreementButton'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const TXN = 'txn-1'
const FI = 'fi-1'

const pdf = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'ERL-14 executed.pdf', {
    type: 'application/pdf',
  })

function mount() {
  const onUploaded = jest.fn()
  render(
    <UploadAgreementButton
      transactionId={TXN}
      formInstanceId={FI}
      formId="ERL-14"
      onUploaded={onUploaded}
    />,
  )
  return { onUploaded }
}

const fileInput = () => screen.getByLabelText(/Upload a completed ERL-14 PDF/i)

beforeEach(() => jest.clearAllMocks())

describe('UploadAgreementButton', () => {
  it('[UPB-1] offers the action and accepts only PDFs', () => {
    mount()
    expect(
      screen.getByRole('button', { name: /Upload completed/i }),
    ).toBeInTheDocument()
    expect(fileInput()).toHaveAttribute('accept', 'application/pdf')
  })

  it('[UPB-2] posts the file to the agent upload route', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, status: 'pending_approval', completeness: { confident: true, flags: [], notes: [] } }),
    })
    const { onUploaded } = mount()
    fireEvent.change(fileInput(), { target: { files: [pdf()] } })

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const [url, init] = mockFetch.mock.calls[0]
    expect(String(url)).toMatch(
      new RegExp(`/paperwork/agents/transactions/${TXN}/documents/${FI}/upload-agreement$`),
    )
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBeInstanceOf(File)
    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
  })

  it('[UPB-3] shows what Vault could NOT determine, and that the broker must review', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        status: 'pending_approval',
        completeness: {
          confident: false,
          flags: ['field_values_undetermined'],
          notes: ['Vault did not fill this document and cannot confirm its terms.'],
        },
      }),
    })
    mount()
    fireEvent.change(fileInput(), { target: { files: [pdf()] } })

    expect(await screen.findByText(/Sent to your broker for review/i)).toBeInTheDocument()
    expect(
      screen.getByText(/cannot confirm its terms/i),
    ).toBeInTheDocument()
  })

  it("[UPB-4] a refusal is shown VERBATIM — Vault's message names the fix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error:
          'This listing has 2 signing owners. ERL-14’s pilot is restricted to a single owner.',
        step: 'pilot_restricted',
      }),
    })
    mount()
    fireEvent.change(fileInput(), { target: { files: [pdf()] } })

    expect(await screen.findByText(/2 signing owners/i)).toBeInTheDocument()
    // Not replaced by a generic failure string.
    expect(screen.queryByText(/^Upload failed$/)).not.toBeInTheDocument()
  })

  it('[UPB-5] a confident report shows no review banner', async () => {
    // The control for [UPB-3]: the banner is driven by the report, not always on.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, completeness: { confident: true, flags: [], notes: [] } }),
    })
    mount()
    fireEvent.change(fileInput(), { target: { files: [pdf()] } })
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.queryByText(/Sent to your broker for review/i)).not.toBeInTheDocument()
  })

  it('[UPB-6] nothing is posted until a file is chosen', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: /Upload completed/i }))
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
