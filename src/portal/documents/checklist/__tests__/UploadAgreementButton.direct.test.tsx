// ============================================================================
// P4H · the Agent Portal's direct-to-storage upload path
// ============================================================================
// A scanned agreement cannot go through a Vault serverless function: Vercel
// refuses a request body over ~4.5 MB before it runs. So a large file is
// presigned, PUT straight to the private bucket, and then registered.
//
// Mallory had to shrink a real client agreement to file it. These pin that she
// no longer has to, and that the small-file path is untouched.
// ============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import UploadAgreementButton from '@/src/portal/documents/checklist/UploadAgreementButton'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const TXN = 'txn-1'
const FI = 'fi-1'
const STAGED = `${TXN}/${FI}/staged/${'n'.repeat(32)}.pdf`

/** A File of a given size without allocating it twice. */
const pdfOf = (bytes: number, name = 'executed.pdf') => {
  const f = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: 'application/pdf',
  })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}
const SMALL = () => pdfOf(1024)
const LARGE = () => pdfOf(10 * 1024 * 1024)

/** Captures the PUT without a real XMLHttpRequest. */
let puts: Array<{ url: string; progressed: number[] }>
class FakeXHR {
  static status = 200
  upload = { onprogress: null as null | ((e: ProgressEvent) => void) }
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  onabort: null | (() => void) = null
  status = 0
  private url = ''
  open(_m: string, url: string) { this.url = url }
  setRequestHeader() {}
  send() {
    const rec = { url: this.url, progressed: [] as number[] }
    puts.push(rec)
    const fire = (loaded: number, total: number) => {
      rec.progressed.push(Math.round((loaded / total) * 100))
      this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent)
    }
    fire(5, 10)
    fire(10, 10)
    this.status = FakeXHR.status
    this.onload?.()
  }
}

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

beforeEach(() => {
  jest.clearAllMocks()
  puts = []
  FakeXHR.status = 200
  ;(global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR
})

const presignOk = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    upload_url: 'https://storage.test/signed',
    storage_path: STAGED,
    max_bytes: 25 * 1024 * 1024,
  }),
})
const registerOk = () => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, status: 'pending_approval', completeness: { confident: true, flags: [], notes: [] } }),
})

describe('UploadAgreementButton — direct to storage', () => {
  it('[UPD-1] a LARGE file goes presign → PUT → register, never through the function', async () => {
    mockFetch.mockResolvedValueOnce(presignOk()).mockResolvedValueOnce(registerOk())
    const { onUploaded } = mount()
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    const urls = mockFetch.mock.calls.map((c) => String(c[0]))
    expect(urls[0]).toMatch(/\/upload-agreement\/presign$/)
    expect(urls[1]).toMatch(/\/upload-agreement$/)
    // The bytes went to storage, not to Vault.
    expect(puts).toHaveLength(1)
    expect(puts[0].url).toBe('https://storage.test/signed')
    // And the register call names the path Vault issued, not one we invented.
    expect(JSON.parse(String(mockFetch.mock.calls[1][1].body)).storage_path).toBe(STAGED)
  })

  it('[UPD-2] a SMALL file still uses the single multipart request', async () => {
    mockFetch.mockResolvedValueOnce(registerOk())
    mount()
    fireEvent.change(fileInput(), { target: { files: [SMALL()] } })

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/upload-agreement$/)
    expect(mockFetch.mock.calls[0][1].body).toBeInstanceOf(FormData)
    expect(puts).toHaveLength(0)
  })

  it('[UPD-3] upload progress is shown while a large file is in flight', async () => {
    mockFetch.mockResolvedValueOnce(presignOk()).mockResolvedValueOnce(registerOk())
    mount()
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })

    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].progressed).toEqual([50, 100])
  })

  it('[UPD-4] a refused presign stops before any upload, and says why', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 403,
      json: async () => ({ error: 'ERL-14 is restricted to the pilot agent.' }),
    })
    const { onUploaded } = mount()
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })

    expect(await screen.findByText(/restricted to the pilot agent/i)).toBeInTheDocument()
    expect(puts).toHaveLength(0)
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('[UPD-5] a failed PUT is reported and nothing is registered', async () => {
    FakeXHR.status = 500
    mockFetch.mockResolvedValueOnce(presignOk())
    const { onUploaded } = mount()
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })

    expect(await screen.findByText(/did not complete/i)).toBeInTheDocument()
    // Only the presign happened — no register for bytes that never landed.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it("[UPD-6] a refused REGISTER surfaces Vault's reason verbatim", async () => {
    mockFetch.mockResolvedValueOnce(presignOk()).mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: 'That upload does not belong to this document.' }),
    })
    const { onUploaded } = mount()
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })

    expect(await screen.findByText(/does not belong to this document/i)).toBeInTheDocument()
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('[UPD-7] the review banner still appears when Vault could not vouch for it', async () => {
    mockFetch.mockResolvedValueOnce(presignOk()).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        ok: true,
        completeness: { confident: false, flags: ['revision_not_identified'], notes: ['10 pages; ERL-14 marker not found.'] },
      }),
    })
    mount()
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })

    expect(await screen.findByText(/ERL-14 marker not found/i)).toBeInTheDocument()
    expect(screen.getByText(/Sent to your broker for review/i)).toBeInTheDocument()
  })

  it('[UPD-8] a retry after a failed PUT presigns AGAIN — tokens are not reused', async () => {
    FakeXHR.status = 500
    mockFetch.mockResolvedValueOnce(presignOk())
    mount()
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })
    expect(await screen.findByText(/did not complete/i)).toBeInTheDocument()

    FakeXHR.status = 200
    mockFetch.mockResolvedValueOnce(presignOk()).mockResolvedValueOnce(registerOk())
    fireEvent.change(fileInput(), { target: { files: [LARGE()] } })

    await waitFor(() => expect(puts).toHaveLength(1))
    const presigns = mockFetch.mock.calls.filter((c) => String(c[0]).endsWith('/presign'))
    expect(presigns).toHaveLength(2)
  })
})
