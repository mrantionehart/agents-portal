'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// ============================================================================
// ConfirmForm — Client confirm / request_changes (Phase 1)
// ============================================================================
// Posts to /api/client/deal/[token], which proxies to Vault's shared
// /api/deal-copilot/sessions/:id/client-confirm endpoint.

export default function ConfirmForm({ token }: { token: string }) {
  const [mode, setMode] = useState<'idle' | 'changes'>('idle')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<'confirm' | 'request_changes' | null>(null)
  const [done, setDone] = useState<'confirmed' | 'requested' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (action: 'confirm' | 'request_changes') => {
    setBusy(action)
    setErr(null)
    try {
      const res = await fetch(`/api/client/deal/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setDone(action === 'confirm' ? 'confirmed' : 'requested')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (done === 'confirmed') {
    return (
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-300">
        Confirmed — thanks. Your agent will take it from here.
      </div>
    )
  }
  if (done === 'requested') {
    return (
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-300">
        Sent. Your agent will follow up shortly with an updated summary.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {mode === 'changes' && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What needs to change? (e.g. closing date, financing terms…)"
          className="w-full min-h-[110px] rounded-lg bg-[#0a0a0f] border border-[#1a1a2e] text-white text-sm p-3 focus:outline-none focus:border-[#D4AF37]"
        />
      )}
      {err && (
        <div className="text-sm text-red-400">{err}</div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        {mode === 'idle' ? (
          <>
            <Button
              variant="gold"
              className="flex-1"
              disabled={busy !== null}
              onClick={() => submit('confirm')}
            >
              {busy === 'confirm' ? 'Confirming…' : 'Confirm'}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy !== null}
              onClick={() => setMode('changes')}
            >
              Request Changes
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="gold"
              className="flex-1"
              disabled={busy !== null || !notes.trim()}
              onClick={() => submit('request_changes')}
            >
              {busy === 'request_changes' ? 'Sending…' : 'Send Request'}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy !== null}
              onClick={() => { setMode('idle'); setNotes('') }}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
