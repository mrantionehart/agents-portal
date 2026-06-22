'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void | Promise<void>
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/40 text-red-200 rounded-md px-3 py-2 text-sm flex items-start gap-2">
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button
          onClick={() => { void onRetry() }}
          className="text-xs text-red-100 hover:text-white inline-flex items-center gap-1 underline"
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  )
}
