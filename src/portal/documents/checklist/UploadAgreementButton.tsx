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

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    setNotes(null)
    try {
      const body = new FormData()
      body.set('file', file)
      const res = await authFetch(
        `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/documents/${formInstanceId}/upload-agreement`,
        { method: 'POST', body },
      )
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        completeness?: Completeness
      }
      if (!res.ok) {
        // Vault's refusals name the thing to fix — surface them verbatim
        // rather than replacing them with "Upload failed".
        setError(json.error ?? `Upload failed (${res.status})`)
        return
      }
      // Never silent: the broker has to read this document, and the agent
      // should see that Vault could not vouch for its contents.
      if (json.completeness && !json.completeness.confident) {
        setNotes(json.completeness.notes ?? [])
      }
      onUploaded?.()
    } catch {
      setError('Upload failed')
    } finally {
      setBusy(false)
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
        {busy ? 'Uploading…' : 'Upload completed'}
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
