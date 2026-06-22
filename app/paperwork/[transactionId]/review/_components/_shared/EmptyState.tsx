'use client'

import React from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  message: string
  hint?: string
  icon?: React.ReactNode
}

export default function EmptyState({ message, hint, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
      <div className="mb-2">{icon ?? <Inbox size={28} className="opacity-50" />}</div>
      <div className="text-sm text-zinc-300">{message}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1 max-w-md text-center">{hint}</div>}
    </div>
  )
}
