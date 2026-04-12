'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'

export default function DealsPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [deals, setDeals] = useState<any[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)

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
      const res = await fetch('/api/vault/deals', {
        headers: {
          'Authorization': `Bearer ${user?.id}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setDeals(data.deals || [])
      }
    } catch (error) {
      console.error('Error fetching deals:', error)
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
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
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">Your Deals</h2>
          </div>
          {dealsLoading ? (
            <div className="p-6">Loading...</div>
          ) : deals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
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
                    <tr key={deal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">{deal.property_address}</td>
                      <td className="px-6 py-3">{deal.city}</td>
                      <td className="px-6 py-3">{deal.client_name}</td>
                      <td className="px-6 py-3 capitalize">{deal.type}</td>
                      <td className="px-6 py-3">
                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
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
            <div className="p-6 text-gray-500">No deals found</div>
          )}
        </div>
      </main>
    </div>
  )
}
