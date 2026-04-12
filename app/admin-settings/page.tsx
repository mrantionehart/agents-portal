'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { Settings, Lock, Eye, EyeOff, Copy, AlertCircle, CheckCircle } from 'lucide-react'
import { useState } from 'react'

interface PasswordConfig {
  name: string
  description: string
  category: string
  current: string
  usage: string[]
}

export default function AdminSettingsPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [visiblePasswords, setVisiblePasswords] = useState<string[]>([])
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null)

  const passwordConfigs: PasswordConfig[] = [
    {
      name: 'Volume 2 Training',
      description: 'Password for HartFelt Ready Volume 2 training access',
      category: 'Training',
      current: 'HartFelt2024',
      usage: ['app/training-interactive/page.tsx (line 25)']
    },
    {
      name: 'Volume 3 Training',
      description: 'Password for HartFelt Ready Volume 3 training access',
      category: 'Training',
      current: 'HartFelt2024',
      usage: ['app/training-interactive/page.tsx (line 46)']
    },
    {
      name: 'Private Opportunities',
      description: 'Password for accessing Private Opportunities page',
      category: 'Opportunities',
      current: 'HartFelt2024',
      usage: ['app/opportunities/page.tsx (line 13)']
    }
  ]

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const togglePasswordVisibility = (passwordName: string) => {
    setVisiblePasswords(prev =>
      prev.includes(passwordName)
        ? prev.filter(p => p !== passwordName)
        : [...prev, passwordName]
    )
  }

  const copyToClipboard = (password: string, passwordName: string) => {
    navigator.clipboard.writeText(password)
    setCopiedPassword(passwordName)
    setTimeout(() => setCopiedPassword(null), 2000)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    router.push('/login')
    return null
  }

  // Only allow brokers/admins
  if (role !== 'broker' && role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">Only administrators and brokers can access this page.</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const groupedByCategory = passwordConfigs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = []
    }
    acc[config.category].push(config)
    return acc
  }, {} as Record<string, PasswordConfig[]>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-gray-700" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Warning Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-900 font-semibold">Confidential Information</p>
              <p className="text-yellow-800 text-sm mt-1">
                This page contains sensitive configuration passwords. Keep these secure and only share with authorized team members. All access is logged.
              </p>
            </div>
          </div>
        </div>

        {/* Password Configurations */}
        <div className="space-y-8">
          {Object.entries(groupedByCategory).map(([category, configs]) => (
            <div key={category}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Lock className="w-6 h-6 text-blue-600" />
                {category} Passwords
              </h2>

              <div className="grid gap-6">
                {configs.map(config => (
                  <div key={config.name} className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Card Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-gray-900">{config.name}</h3>
                      <p className="text-gray-600 text-sm mt-1">{config.description}</p>
                    </div>

                    {/* Card Content */}
                    <div className="p-6 space-y-6">
                      {/* Password Display */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Password
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input
                              type={visiblePasswords.includes(config.name) ? 'text' : 'password'}
                              value={config.current}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                            />
                          </div>
                          <button
                            onClick={() => togglePasswordVisibility(config.name)}
                            className="px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition flex items-center gap-2"
                            title="Toggle visibility"
                          >
                            {visiblePasswords.includes(config.name) ? (
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(config.current, config.name)}
                            className="px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition flex items-center gap-2"
                            title="Copy to clipboard"
                          >
                            {copiedPassword === config.name ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-xs text-green-600 font-medium">Copied!</span>
                              </>
                            ) : (
                              <Copy className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Usage Information */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Used In
                        </label>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <ul className="space-y-1">
                            {config.usage.map((usage, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="text-gray-400 mt-1">•</span>
                                <code className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200">
                                  {usage}
                                </code>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Change Password Button */}
                      <div className="pt-4 border-t border-gray-200">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                          Change Password
                        </button>
                        <p className="text-xs text-gray-500 mt-2">
                          Note: Changing passwords requires updating code in multiple locations. Contact development team.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Configuration Reference */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">📋 Configuration Reference</h3>
          <div className="space-y-3 text-sm text-blue-900">
            <p>
              <strong>Current Password:</strong> HartFelt2024
            </p>
            <p>
              <strong>Recommendation:</strong> Change this password before launching to production. Update in the code locations listed above.
            </p>
            <p>
              <strong>To Change Password:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Edit the password constant in each file</li>
              <li>Test the new password in dev environment</li>
              <li>Deploy to production</li>
              <li>Update this admin settings page with new password</li>
              <li>Share new password with authorized staff</li>
            </ol>
          </div>
        </div>

        {/* Portal Configuration Summary */}
        <div className="mt-12 grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="font-bold text-gray-900 mb-4">Training Settings</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Volume 1: Unlocked (no password)</li>
              <li>✓ Volume 2: Locked (password required)</li>
              <li>✓ Volume 3: Locked (password required)</li>
              <li>✓ Module tests: 5 questions each</li>
              <li>✓ Final exam: 50 questions</li>
              <li>✓ Pass requirement: 80%</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="font-bold text-gray-900 mb-4">Security Features</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Policy acceptance on first login</li>
              <li>✓ Role-based access control</li>
              <li>✓ Supabase authentication</li>
              <li>✓ Password-protected sections</li>
              <li>✓ AI document analysis</li>
              <li>✓ Vault API integration</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
