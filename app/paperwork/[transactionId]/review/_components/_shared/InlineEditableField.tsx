'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'

interface InlineEditableFieldProps {
  label: string
  value: unknown
  /** Set false to render display-only (lock icon, no pencil). */
  editable: boolean
  /** Lock icon copy when editable=false. */
  readOnlyHint?: string
  /** When editable=false, hides the lock icon. */
  hideLockIcon?: boolean
  /** Input variant — defaults to 'text'. */
  inputType?: 'text' | 'number' | 'boolean' | 'date'
  /** Disables the field while another patch is in flight (caller-managed). */
  disabled?: boolean
  /** Called on Save. Caller awaits PATCH; throws on failure (we revert). Required when editable=true. */
  onSave?: (newValue: unknown) => Promise<void>
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

export default function InlineEditableField({
  label,
  value,
  editable,
  readOnlyHint,
  hideLockIcon,
  inputType = 'text',
  disabled,
  onSave,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<string>(formatValue(value))
  const [boolDraft, setBoolDraft] = useState<boolean>(value === true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) {
      setDraft(formatValue(value))
      setBoolDraft(value === true)
      setError(null)
    } else {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isEditing, value])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    let next: unknown = draft
    if (inputType === 'number') {
      const n = Number(draft)
      if (!Number.isFinite(n)) {
        setError('Must be a number')
        setSaving(false)
        return
      }
      next = n
    } else if (inputType === 'boolean') {
      next = boolDraft
    } else if (inputType === 'date') {
      next = draft
    }
    try {
      if (onSave) await onSave(next)
      setIsEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError(null)
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[#1a1a2e] last:border-b-0">
      <div className="text-zinc-400 text-sm w-1/3 break-words">{label}</div>
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        {isEditing ? (
          <>
            {inputType === 'boolean' ? (
              <select
                ref={inputRef as unknown as React.RefObject<HTMLSelectElement>}
                value={boolDraft ? 'true' : 'false'}
                onChange={(e) => setBoolDraft(e.target.value === 'true')}
                disabled={saving}
                className="bg-[#1a1a2e] border border-[#2a2a3e] rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-[#C9A84C]"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            ) : (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                type={inputType === 'date' ? 'date' : inputType === 'number' ? 'number' : 'text'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSave()
                  else if (e.key === 'Escape') handleCancel()
                }}
                className={`bg-[#1a1a2e] border ${error ? 'border-red-500' : 'border-[#2a2a3e]'} rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-[#C9A84C] w-48`}
                title={error ?? undefined}
              />
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 rounded text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
              aria-label="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-1 rounded text-zinc-400 hover:bg-zinc-700/50 disabled:opacity-50"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="text-zinc-100 text-sm text-right break-words">{formatValue(value)}</div>
            {editable ? (
              <button
                onClick={() => setIsEditing(true)}
                disabled={disabled}
                className="p-1 rounded text-zinc-500 hover:text-[#C9A84C] hover:bg-[#1a1a2e] disabled:opacity-30"
                aria-label={`Edit ${label}`}
              >
                <Pencil size={14} />
              </button>
            ) : (
              !hideLockIcon && readOnlyHint && (
                <span className="text-xs text-zinc-500 italic" title={readOnlyHint}>🔒</span>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
