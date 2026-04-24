'use client'

import { useAuth } from '../../providers'
import { Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function AdminSettingsPage() {
  const { user, role } = useAuth()

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-8 h-8 text-purple-600" />
        <h1 className="text-3xl font-bold text-white">Broker Settings</h1>
      </div>

      {/* Commission Settings */}
      <div className="bg-[#0a0a0f] rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-bold text-white mb-4">Commission Rules</h3>
        <p className="text-gray-400 mb-4">Configure default commission structures and splits for your brokerage.</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          Configure Commission Rules
        </button>
      </div>

      {/* Agent Management */}
      <div className="bg-[#0a0a0f] rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-bold text-white mb-4">Agent Management</h3>
        <p className="text-gray-400 mb-4">Add, remove, and manage agent accounts and roles.</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          Manage Agents
        </button>
      </div>

      {/* Compliance Settings */}
      <div className="bg-[#0a0a0f] rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-bold text-white mb-4">Compliance Requirements</h3>
        <p className="text-gray-400 mb-4">Define required documents and compliance workflows for your team.</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          Configure Compliance
        </button>
      </div>

      {/* API Settings */}
      <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-white mb-4">API Configuration</h3>
        <p className="text-gray-400 mb-4">
          Vault API URL: <code className="bg-[#0a0a0f] px-2 py-1 rounded">{process.env.NEXT_PUBLIC_VAULT_API_URL || 'Not configured'}</code>
        </p>
        <p className="text-sm text-gray-400">Current role: <span className="font-medium capitalize">{role}</span></p>
      </div>
    </div>
  )
}
