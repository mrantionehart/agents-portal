'use client'

// AGENT.SIGN.1C — per-row Generate action. Calls the agent-tier Vault generate
// route (reuses the broker generateFormPdf service behind the assignment gate),
// then asks the parent to refresh the checklist.

import { useState } from 'react'
import { FileCog } from 'lucide-react'
import { authFetch } from '@/lib/supabase'
import { VAULT_API_URL } from '@/lib/vault-client'

export interface GenerateFormButtonProps {
  transactionId: string
  formInstanceId: string
  formId: string
  onGenerated?: () => void
}

export default function GenerateFormButton({
  transactionId,
  formInstanceId,
  formId,
  onGenerated,
}: GenerateFormButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch(
        `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/documents/${formInstanceId}/generate`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 422) setError('Missing required info')
        else setError(body?.step ? `Could not generate (${body.step})` : 'Generate failed')
        return
      }
      onGenerated?.()
    } catch {
      setError('Generate failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        title={`Generate ${formId}`}
        className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#11111a] px-2 py-1 text-[11px] text-[#C9A84C] hover:border-[#C9A84C] disabled:opacity-50"
      >
        <FileCog className="h-3 w-3" />
        {busy ? 'Generating…' : 'Generate'}
      </button>
      {error && <span className="mt-0.5 text-[10px] text-[#ef4444]">{error}</span>}
    </div>
  )
}
