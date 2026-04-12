'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'

export default function CommissionsPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [commissions, setCommissions] = useState<any[]>([])
  const [commsLoading, setCommsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchCommissions()
    }
  }, [user])

  const fetchCommissions = async () => {
    try {
      setCommsLoading(true)
      const res = await fetch('/api/vault/commissions', {
        headers: {
          'Authorization': `Bearer ${user?.id}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setCommissions(data.commissions || [])
      }
    } catch (error) {
      console.error('Error fetching commissions:', error)
    } finally {
      setCommsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'broker_approved':
        return 'bg-blue-100 text-blue-800'
      case 'pending_calculation':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  const totalGross = commissions.reduce((sum, c) => sum + (c.gross_commission || 0), 0)
  const totalEarned = commissions.reduce((sum, c) => sum + (c.agent_amount || 0), 0)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
              ← Dashboard
            </Link>
            <h1 className="text-3xl font-bold">Commissions</h1>
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
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Total Gross Commissions</h3>
            <p className="text-3xl font-bold">${totalGross.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Your Earned Amount</h3>
            <p className="text-3xl font-bold">${totalEarned.toLocaleString()}</p>
          </div>
        </div>

        {/* Commissions Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">Commission Details</h2>
          </div>
          {commsLoading ? (
            <div className="p-6">Loading...</div>
          ) : commissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Property</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Client</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Gross Commission</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Your Amount</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Paid Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {commissions.map((comm) => (
                    <tr key={comm.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">{comm.transactions?.property_address || 'N/A'}</td>
                      <td className="px-6 py-3">{comm.transactions?.client_name || 'N/A'}</td>
                      <td className="px-6 py-3">${(comm.gross_commission || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 font-semibold">${(comm.agent_amount || 0).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(comm.commission_status)}`}>
                          {comm.commission_status}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {comm.paid_at ? new Date(comm.paid_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-gray-500">No commissions found</div>
          )}
        </div>
      </main>
    </div>
  )
}
