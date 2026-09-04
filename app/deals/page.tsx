'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
// AP-VISIBILITY.1 — use the canonical Vault-fetch helper. Previous code sent
// `Bearer <profile UUID>`, which Vault rejects (401), and the page then
// swallowed the 401 into an empty deals array (silent "No deals found").
// authFetch attaches the CACHED Supabase access-token from onAuthStateChange
// (never getSession() — LockManager hazard) and self-heals a single 401.
import { authFetch } from '@/lib/supabase'

export default function DealsPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [deals, setDeals] = useState<any[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  // AP-VISIBILITY.1 — distinguish "auth/network/server failure" from
  // "successful 200 with zero records". The old code conflated both into
  // an empty state; agents saw "No deals found" even when their JWT was bad.
  const [dealsError, setDealsError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchDeals()
    }
  }, [user])

  const fetchDeals = async () => {
    try {
      setDealsLoading(true)
      setDealsError(null)
      const res = await authFetch('/api/vault/deals')
      if (!res.ok) {
        const msg =
          res.status === 401
            ? "We couldn't load your deals — your session may have expired. Please refresh."
            : `We couldn't load your deals (Vault returned ${res.status}). Please retry.`
        setDealsError(msg)
        setDeals([])
        return
      }
      const data = await res.json()
      setDeals(Array.isArray(data?.deals) ? data.deals : [])
    } catch (error) {
      console.error('Error fetching deals:', error)
      setDealsError("We couldn't load your deals — network error. Please retry.")
      setDeals([])
    } finally {
      setDealsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#0a0a0f] shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-400">
              ← Dashboard
            </Link>
            <h1 className="text-3xl font-bold">Deals</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-[#0a0a0f] rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">Your Deals</h2>
          </div>
          {dealsLoading ? (
            <div className="p-6">Loading...</div>
          ) : dealsError ? (
            <div className="p-6" role="alert">
              <p className="text-red-400">{dealsError}</p>
              <button
                onClick={fetchDeals}
                className="mt-3 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : deals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#050507]">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Property</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">City</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Client</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Price</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Closing</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-[#0a0a0f]">
                      <td className="px-6 py-3">{deal.property_address}</td>
                      <td className="px-6 py-3">{deal.city}</td>
                      <td className="px-6 py-3">{deal.client_name}</td>
                      <td className="px-6 py-3 capitalize">{deal.type}</td>
                      <td className="px-6 py-3">
                        <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 text-sm">
                          {deal.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">${(deal.contract_price || 0).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        {new Date(deal.closing_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-gray-400">No deals found</div>
          )}
        </div>
      </main>
    </div>
  )
}
