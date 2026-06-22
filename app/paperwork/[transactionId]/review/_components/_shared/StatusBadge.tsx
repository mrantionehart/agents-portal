'use client'

import React from 'react'
import type { BrokerReviewStatus, FormInstanceStatus } from '@/lib/paperworkTypes'

type BadgeVariant = BrokerReviewStatus | FormInstanceStatus | 'info' | 'neutral'

const PALETTE: Record<BadgeVariant, string> = {
  // Broker-review lifecycle
  draft: 'bg-zinc-700/50 text-zinc-200 border-zinc-600',
  submitted: 'bg-blue-500/10 text-blue-300 border-blue-500/40',
  approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  revisions_required: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  // Form lifecycle
  recommended: 'bg-zinc-700/50 text-zinc-200 border-zinc-600',
  required: 'bg-blue-500/10 text-blue-300 border-blue-500/40',
  blocked: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  in_progress: 'bg-blue-500/10 text-blue-300 border-blue-500/40',
  ready: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  sent: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/40',
  signed: 'bg-emerald-600/15 text-emerald-300 border-emerald-500/50',
  voided: 'bg-zinc-800/60 text-zinc-500 border-zinc-700 line-through',
  // Generic
  info: 'bg-zinc-700/40 text-zinc-300 border-zinc-600',
  neutral: 'bg-zinc-700/40 text-zinc-300 border-zinc-600',
}

const LABEL_OVERRIDES: Partial<Record<BadgeVariant, string>> = {
  in_progress: 'In progress',
  revisions_required: 'Revisions required',
  recommended: 'Suggested',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  label?: string
  className?: string
}

export default function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const palette = PALETTE[variant] ?? PALETTE.neutral
  const text = label ?? LABEL_OVERRIDES[variant] ?? variant
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${palette} ${className ?? ''}`}
    >
      {text}
    </span>
  )
}
