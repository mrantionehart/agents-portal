'use client'

import { useState } from 'react'
import { Users, Building2 } from 'lucide-react'

interface BrokerViewToggleProps {
  role?: string
  onViewChange: (view: 'agent' | 'broker') => void
  currentView?: 'agent' | 'broker'
}

export default function BrokerViewToggle({ role, onViewChange, currentView = 'agent' }: BrokerViewToggleProps) {
  // Only show for brokers/admins
  if (role !== 'broker' && role !== 'admin') {
    return null
  }

  return (
    <div className="flex items-center gap-2 bg-[#0a0a0f] rounded-lg p-1">
      <button
        onClick={() => onViewChange('agent')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium text-sm ${
          currentView === 'agent'
            ? 'bg-[#0a0a0f] text-white shadow-sm shadow-black/10'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <Users className="w-4 h-4" />
        My View
      </button>
      <button
        onClick={() => onViewChange('broker')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium text-sm ${
          currentView === 'broker'
            ? 'bg-[#0a0a0f] text-white shadow-sm shadow-black/10'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <Building2 className="w-4 h-4" />
        Team View
      </button>
    </div>
  )
}
