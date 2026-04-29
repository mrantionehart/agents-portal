'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase will auto-detect the recovery token from the URL hash
    // and set up the session. We listen for the PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setReady(true)
        }
      }
    )

    // Also check if we already have a session (in case event fired before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="bg-[#0a0a0f] border border-[#1a1a2e] p-8 rounded-lg shadow-md shadow-black/20 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Set New Password</h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          Enter your new password below.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center">
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-4 rounded mb-4">
              Password updated successfully! Redirecting to sign in...
            </div>
          </div>
        ) : !ready ? (
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              Verifying your reset link...
            </p>
            <p className="text-gray-500 text-xs mt-2">
              If this takes too long, your link may have expired.{' '}
              <a href="/forgot-password" className="text-[#C9A84C] hover:text-[#d4b65c]">
                Request a new one
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2 bg-[#111] border border-[#222] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className="w-full px-4 py-2 bg-[#111] border border-[#222] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C9A84C] text-black py-2 rounded-lg font-medium hover:bg-[#d4b65c] disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
