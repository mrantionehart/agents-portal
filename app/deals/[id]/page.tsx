'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers'
import { vaultAPI } from '@/lib/vault-api'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoadingSpinner from '@/components/LoadingSpinner'
import ComplianceCheckCard from '@/components/ComplianceCheckCard'
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react'

interface Deal {
  id: string
  title: string
  address: string
  status: string
  price: number
  description?: string
  agent_id: string
  agent_name?: string
  created_at: string
  updated_at: string
}

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, role } = useAuth()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDeal = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await vaultAPI.getDeal(dealId)
        setDeal(data)
      } catch (err) {
        console.error('Error fetching deal:', err)
        setError('Failed to load deal details')
      } finally {
        setLoading(false)
      }
    }

    if (dealId) {
      fetchDeal()
    }
  }, [dealId])

  const isAdmin = role === 'admin' || role === 'broker'
  const isOwner = deal?.agent_id === user?.id

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this deal?')) {
      try {
        await vaultAPI.deleteDeal(dealId)
        router.push('/deals')
      } catch (err) {
        setError('Failed to delete deal')
      }
    }
  }

  return (
    <ProtectedRoute>
      <div className="container py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : deal ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{deal.title}</h1>
                    <p className="text-gray-600 mt-2">{deal.address}</p>
                  </div>
                  {(isAdmin || isOwner) && (
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        <Edit2 size={20} className="text-blue-600" />
                      </button>
                      <button
                        onClick={handleDelete}
                        className="p-2 hover:bg-red-100 rounded-lg transition"
                      >
                        <Trash2 size={20} className="text-red-600" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600">Price</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          ${deal.price.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">
                          {deal.status}
                        </p>
                      </div>
                      {deal.agent_name && (
                        <div>
                          <p className="text-sm text-gray-600">Agent</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            {deal.agent_name}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-600">Created</p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {new Date(deal.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {deal.description && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
                      <p className="text-gray-700 leading-relaxed">{deal.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Compliance Check */}
              <ComplianceCheckCard transactionId={dealId} dealAddress={deal.address} />
            </div>

            <div>
              <div className="bg-white rounded-lg shadow p-6 sticky top-24">
                <h3 className="font-semibold text-gray-900 mb-4">Deal Information</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-gray-600">Deal ID</p>
                    <p className="font-mono text-gray-900 text-xs break-all">{deal.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Last Updated</p>
                    <p className="text-gray-900">
                      {new Date(deal.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 text-lg">Deal not found</p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
