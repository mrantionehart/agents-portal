'use client'

import React, { useState, useEffect } from 'react'
import { ExternalServiceRequest } from '@/types/integrations'

interface TransactionExternalServicesProps {
  transactionId: string
  onSubmitRequest?: (serviceType: string, requestType: string) => void
}

export const TransactionExternalServices: React.FC<TransactionExternalServicesProps> = ({
  transactionId,
  onSubmitRequest,
}) => {
  const [requests, setRequests] = useState<ExternalServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [selectedService, setSelectedService] = useState<string | null>(null)

  const serviceTypes = ['title_company', 'lender', 'inspector', 'appraisal', 'docusign'] as const

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/broker/transactions/${transactionId}/service-request`
        )
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()
        setRequests(data.data)
      } catch (error) {
        console.error('Fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
    const interval = setInterval(fetchRequests, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [transactionId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'submitted':
        return 'bg-purple-100 text-purple-800'
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'title_company':
        return '📋'
      case 'lender':
        return '💰'
      case 'inspector':
        return '🔍'
      case 'appraisal':
        return '📊'
      case 'docusign':
        return '✍️'
      default:
        return '📌'
    }
  }

  const groupedRequests = new Map<string, ExternalServiceRequest[]>()
  requests.forEach(req => {
    const key = req.service_type
    if (!groupedRequests.has(key)) {
      groupedRequests.set(key, [])
    }
    groupedRequests.get(key)!.push(req)
  })

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading service requests...</div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Service Request Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {serviceTypes.map(serviceType => {
          const serviceRequests = groupedRequests.get(serviceType as string) || []
          const latest = serviceRequests[0]

          return (
            <div
              key={serviceType}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getServiceIcon(serviceType)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {serviceType.replace('_', ' ')}
                    </h3>
                    {latest && (
                      <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(latest.status)}`}>
                        {latest.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {latest ? (
                <div className="text-sm text-gray-700 space-y-1 mb-3">
                  <p>
                    <span className="font-medium">Type:</span> {latest.request_type}
                  </p>
                  <p>
                    <span className="font-medium">Submitted:</span>{' '}
                    {latest.submitted_date
                      ? new Date(latest.submitted_date).toLocaleDateString()
                      : 'Not submitted'}
                  </p>
                  {latest.due_date && (
                    <p>
                      <span className="font-medium">Due:</span> {new Date(latest.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-3">No requests submitted yet</p>
              )}

              <button
                onClick={() => {
                  setSelectedService(serviceType)
                  setShowSubmitForm(true)
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md transition-colors text-sm"
              >
                {latest ? 'View Details' : 'Submit Request'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Request Timeline */}
      {requests.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Request Timeline</h3>

          <div className="space-y-4">
            {requests.map((req, idx) => (
              <div key={req.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    {idx + 1}
                  </div>
                  {idx < requests.length - 1 && (
                    <div className="w-1 h-12 bg-gray-200 mt-2"></div>
                  )}
                </div>

                <div className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 capitalize">
                      {req.service_type.replace('_', ' ')} - {req.request_type}
                    </p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Submitted: {req.submitted_date ? new Date(req.submitted_date).toLocaleString() : 'Pending'}
                  </p>
                  {req.completed_date && (
                    <p className="text-sm text-gray-600">
                      Completed: {new Date(req.completed_date).toLocaleString()}
                    </p>
                  )}
                  {req.external_id && (
                    <p className="text-sm text-gray-600">
                      External ID: <span className="font-mono">{req.external_id}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Requests */}
      {requests.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-900">
            No external service requests have been submitted yet. Start by selecting a service type above.
          </p>
        </div>
      )}
    </div>
  )
}

export default TransactionExternalServices
