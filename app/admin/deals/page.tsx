'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../providers'
import { Briefcase } from 'lucide-react'
import { vaultAPI } from '@/lib/vault-client'

export const dynamic = 'force-dynamic'

export default function AdminDealsPage() {
  const { user, role } = useAuth()
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && (role === 'admin' || role === 'broker')) {
      fetchDeals()
    }
  }, [user, role])

  const fetchDeals = async () => {
    try {
      setLoading(true)
      const result = await vaultAPI.deals.list(user!.id, role)
      const dealsArray = result.deals || result.data || []
      setDeals(Array.isArray(dealsArray) ? dealsArray : [])
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Briefcase className="w-8 h-8 text-green-600" />
        <h1 className="text-3xl font-bold text-gray-900">All Deals</h1>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading deals...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Agent</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Property Address</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Price</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Commission</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{deal.agent_name || 'Unknown'}</td>
                  <td className="px-6 py-3 text-gray-600">{deal.property_address}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                      {deal.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">${(deal.contract_price || 0).toLocaleString()}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    ${((deal.contract_price || 0) * 0.05).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
