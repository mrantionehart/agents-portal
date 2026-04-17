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
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onViewChange('agent')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium text-sm ${
          currentView === 'agent'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Users className="w-4 h-4" />
        My View
      </button>
      <button
        onClick={() => onViewChange('broker')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium text-sm ${
          currentView === 'broker'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Building2 className="w-4 h-4" />
        Team View
      </button>
    </div>
  )
}
