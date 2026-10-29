'use client'
// ============================================================================
// P4H-13 · workflow B — file an ERL-14 completed outside Vault
// ============================================================================
// Sits beside Generate, not instead of it. Both actions exist on the same row
// because a form may be generatable AND uploadable; `accepts_upload` is served
// from Vault so this component does not keep its own copy of the form list.
//
// Uploading does NOT approve. Vault puts the document into pending_approval
// and clears any prior approval, because that approval was pinned to different
// bytes. The copy here says so, because an agent who thinks an upload is
// self-approving will wait for a signature that is never sent.
// ============================================================================
import { useRef, useState } from 'react'
import { AlertTriangle, Loader2, Upload } from 'lucide-react'
import { authFetch } from '@/lib/supabase'
import { VAULT_API_URL } from '@/lib/vault-client'

export interface UploadAgreementButtonProps {
  transactionId: string
  formInstanceId: string
  formId: string
  onUploaded?: () => void
}

interface Completeness {
  confident: boolean
  flags: string[]
  notes: string[]
}

// Vercel rejects a serverless-function request body over ~4.5 MB BEFORE the
// Vault function runs. That is why anything larger goes STRAIGHT to private
// storage with a presigned URL instead of through the function — see upload().
const MULTIPART_MAX_BYTES = 4 * 1024 * 1024

// What the direct path accepts. Vault enforces it again on the bytes it
// downloads; this is only so an agent is told in a second rather than after a
// long upload.
const DIRECT_MAX_BYTES = 25 * 1024 * 1024

// The upload is a multipart body that commonly exceeds `authFetch`'s 8 s
// default. SendViaDocuSignButton already lifts its ceiling to 60 s for the
// same reason.
const UPLOAD_TIMEOUT_MS = 60_000

function formatMiB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}

export default function UploadAgreementButton({
  transactionId,
  formInstanceId,
  formId,
  onUploaded,
}: UploadAgreementButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[] | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  type UploadOutcome =
    | { completeness?: Completeness }
    | { error: string }

  /** The original single-request path, unchanged, for small files. */
  async function uploadViaMultipart(file: File): Promise<UploadOutcome> {
    const body = new FormData()
    body.set('file', file)
    const res = await authFetch(
      `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/documents/${formInstanceId}/upload-agreement`,
      { method: 'POST', body },
      UPLOAD_TIMEOUT_MS,
    )
    // Vercel's 413 arrives as plain text, so res.json() throws.
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      completeness?: Completeness
    }
    if (!res.ok) {
      if (res.status === 413) {
        return {
          error:
            `That file is over the ${MULTIPART_MAX_BYTES / 1024 / 1024} MB ` +
            'single-request ceiling. Reload the page and try again — larger ' +
            'files upload directly to storage.',
        }
      }
      return { error: json.error ?? `Upload failed (${res.status})` }
    }
    return { completeness: json.completeness }
  }

  /**
   * presign → PUT straight to private storage → register.
   *
   * The bytes never pass through a Vault serverless function, which is the
   * only way past Vercel's ~4.5 MB request-body limit. Vault names the
   * storage path, re-downloads what was stored, and checksums it there, so
   * nothing this function says about the file is trusted.
   */
  async function uploadViaStorage(file: File): Promise<UploadOutcome> {
    const base = `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/documents/${formInstanceId}/upload-agreement`

    const presignRes = await authFetch(
      `${base}/presign`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bytes: file.size, content_type: 'application/pdf' }),
      },
      UPLOAD_TIMEOUT_MS,
    )
    const presign = (await presignRes.json().catch(() => ({}))) as {
      upload_url?: string
      storage_path?: string
      error?: string
    }
    if (!presignRes.ok || !presign.upload_url || !presign.storage_path) {
      return { error: presign.error ?? `Could not start the upload (${presignRes.status})` }
    }

    // XHR rather than fetch: it reports upload progress, and a 20 MB scan
    // over a domestic connection is a long silence otherwise.
    const put = await new Promise<{ status: number }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', presign.upload_url!)
      xhr.setRequestHeader('content-type', 'application/pdf')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => resolve({ status: xhr.status })
      xhr.onerror = () => reject(new Error('network'))
      xhr.onabort = () => reject(new Error('aborted'))
      xhr.send(file)
    })
    if (put.status < 200 || put.status >= 300) {
      return { error: `The upload did not complete (${put.status}). Try again.` }
    }
    setProgress(100)

    // Registering is what makes it the listing's agreement. Until this
    // returns, the bytes are staged and belong to nothing.
    const regRes = await authFetch(
      base,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storage_path: presign.storage_path, filename: file.name }),
      },
      UPLOAD_TIMEOUT_MS,
    )
    const reg = (await regRes.json().catch(() => ({}))) as {
      error?: string
      completeness?: Completeness
    }
    if (!regRes.ok) {
      return { error: reg.error ?? `Vault could not file the upload (${regRes.status})` }
    }
    return { completeness: reg.completeness }
  }

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    setNotes(null)
    setProgress(null)

    if (file.size > DIRECT_MAX_BYTES) {
      setError(
        `That file is ${formatMiB(file.size)} MB. The limit is ${
          DIRECT_MAX_BYTES / 1024 / 1024
        } MB — re-scan it in grayscale at 200–300 DPI, which keeps signatures legible at a fraction of the size.`,
      )
      setBusy(false)
      return
    }

    try {
      // Small files keep the original single-request path: one round trip,
      // nothing staged, nothing to clean up if it fails.
      const json =
        file.size <= MULTIPART_MAX_BYTES
          ? await uploadViaMultipart(file)
          : await uploadViaStorage(file)
      if ("error" in json) {
        setError(json.error)
        return
      }
      // Never silent: the broker has to read this document, and the agent
      // should see that Vault could not vouch for its contents.
      if (json.completeness && !json.completeness.confident) {
        setNotes(json.completeness.notes ?? [])
      }
      onUploaded?.()
    } catch (err) {
      // authFetch's timeout aborts via AbortController. A bare "Upload
      // failed" leaves the agent guessing whether the document was rejected;
      // name the timeout so she knows to check her connection.
      const isAbort =
        err instanceof DOMException && err.name === 'AbortError'
      setError(
        isAbort
          ? `Upload timed out after ${
              UPLOAD_TIMEOUT_MS / 1000
            } s. Check your connection and try again.`
          : 'Upload failed',
      )
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        aria-label={`Upload a completed ${formId} PDF`}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void upload(f)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={`Upload a ${formId} you completed outside Vault`}
        className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#11111a] px-2 py-1 text-[11px] text-[#A1A1AA] hover:border-[#C9A84C] hover:text-[#E8D5A3] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Upload className="h-3 w-3" />
        )}
        {busy
          ? progress !== null
            ? `Uploading… ${progress}%`
            : 'Uploading…'
          : 'Upload completed'}
      </button>
      {error && <span className="mt-0.5 text-[10px] text-[#ef4444]">{error}</span>}
      {notes && notes.length > 0 && (
        <div className="mt-1 max-w-[22rem] rounded-md border border-amber-700/40 bg-amber-900/10 px-2 py-1.5">
          <p className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-200">
            <AlertTriangle className="h-3 w-3" /> Sent to your broker for review
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] leading-relaxed text-amber-200/90">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
