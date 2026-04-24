'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../providers'
import { TrendingUp } from 'lucide-react'
import { vaultAPI } from '@/lib/vault-client'

export const dynamic = 'force-dynamic'

export default function AdminCommissionsPage() {
  const { user, role } = useAuth()
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && (role === 'admin' || role === 'broker')) {
      fetchCommissions()
    }
  }, [user, role])

  const fetchCommissions = async () => {
    try {
      setLoading(true)
      const result = await vaultAPI.commissions.list(user!.id, role)
      const commsArray = result.commissions || result.data || []
      setCommissions(Array.isArray(commsArray) ? commsArray : [])
    } catch (error) {
      console.error('Error fetching commissions:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <TrendingUp className="w-8 h-8 text-orange-600" />
        <h1 className="text-3xl font-bold text-white">Commission Approvals</h1>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading commissions...</div>
      ) : (
        <div className="bg-[#0a0a0f] rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#050507] border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Agent</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Deal ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Gross Commission</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Agent Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {commissions.slice(0, 20).map((comm) => (
                <tr key={comm.id} className="border-b hover:bg-[#0a0a0f]">
                  <td className="px-6 py-3 font-medium text-white">{comm.agent_name || 'Unknown'}</td>
                  <td className="px-6 py-3 text-gray-400">{comm.deal_id}</td>
                  <td className="px-6 py-3 font-medium">${(comm.gross_commission || 0).toLocaleString()}</td>
                  <td className="px-6 py-3 font-medium">${(comm.agent_amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      comm.status === 'approved' ? 'bg-green-500/15 text-green-400' :
                      comm.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-[#0a0a0f] text-white'
                    }`}>
                      {comm.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {comm.status === 'pending' && (
                      <button className="text-blue-600 hover:text-blue-400 text-sm font-medium">Approve</button>
                    )}
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
