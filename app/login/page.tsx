'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('Starting login with:', email)

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      console.log('Login successful, redirecting to:', data.redirectPath)
      setLoading(false)

      // Full page reload so AuthProvider re-initializes with fresh cookies
      window.location.href = data.redirectPath
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="bg-[#0a0a0f] border border-[#1a1a2e] p-8 rounded-lg shadow-md shadow-black/20 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-center">HartFelt Agents Portal</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-[#111] border border-[#222] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[#111] border border-[#222] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C9A84C] text-black py-2 rounded-lg font-medium hover:bg-[#d4b65c] disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          <a href="/forgot-password" className="text-[#C9A84C] hover:text-[#d4b65c]">
            Forgot your password?
          </a>
        </p>
      </div>
    </div>
  )
}
