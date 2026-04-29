'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="bg-[#0a0a0f] border border-[#1a1a2e] p-8 rounded-lg shadow-md shadow-black/20 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Reset Your Password</h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          Enter your email and we'll send you a link to reset your password.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {sent ? (
          <div className="text-center">
            <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] px-4 py-4 rounded mb-6">
              Check your email for a password reset link. It may take a minute to arrive.
            </div>
            <Link
              href="/login"
              className="text-[#C9A84C] hover:text-[#d4b65c] text-sm font-medium"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hartfeltrealestate.com"
                  className="w-full px-4 py-2 bg-[#111] border border-[#222] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C9A84C] text-black py-2 rounded-lg font-medium hover:bg-[#d4b65c] disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-4 text-sm text-gray-400 text-center">
              <Link href="/login" className="text-[#C9A84C] hover:text-[#d4b65c]">
                Back to Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
