'use client'

import { useState } from 'react'
import Link from 'next/link'
import CMAGeneratorScreen from '@/src/components/CMAGeneratorScreen'
import ManualCMAForm from './ManualCMAForm'

// ============================================================================
// CMA Generator — Tabbed view: AI CMA (default) + Manual CMA
// ============================================================================

export default function CMAPage() {
  const [tab, setTab] = useState<'ai' | 'manual'>('ai')

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-amber-600 hover:text-amber-400 mb-2 inline-block">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-white">CMA Generator</h1>
        <p className="text-sm text-gray-400 mt-1">Create a branded Comparative Market Analysis</p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('ai')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'ai'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              : 'bg-[#0a0a0f] text-gray-400 border border-[#1a1a2e] hover:text-white'
          }`}
        >
          AI-Powered CMA
          <span className="ml-2 text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Recommended</span>
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'manual'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              : 'bg-[#0a0a0f] text-gray-400 border border-[#1a1a2e] hover:text-white'
          }`}
        >
          Manual CMA
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'ai' ? (
        <CMAGeneratorScreen />
      ) : (
        <ManualCMAForm />
      )}
    </div>
  )
}
