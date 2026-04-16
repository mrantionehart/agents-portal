'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ServiceAccount, ServiceType, CreateServiceAccountRequest } from '@/types/integrations'

interface ExternalServiceIntegrationProps {
  brokerId?: string
}

export const ExternalServiceIntegration: React.FC<ExternalServiceIntegrationProps> = ({
  brokerId,
}) => {
  const [accounts, setAccounts] = useState<ServiceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState<CreateServiceAccountRequest>({
    service_type: 'title_company',
    service_name: '',
    account_id: '',
  })
  const [logs, setLogs] = useState<any[]>([])

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/broker/services/accounts')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setAccounts(data.data)
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/logs?limit=10')
      if (!response.ok) throw new Error('Failed to fetch logs')
      const data = await response.json()
      setLogs(data.data)
    } catch (error) {
      console.error('Fetch logs error:', error)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
    fetchLogs()
  }, [fetchAccounts, fetchLogs])

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/broker/services/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create account')

      setFormData({
        service_type: 'title_company',
        service_name: '',
        account_id: '',
      })
      setShowAddForm(false)
      await fetchAccounts()
    } catch (error) {
      console.error('Create account error:', error)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service account?')) return

    try {
      const response = await fetch(`/api/broker/services/accounts/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')
      await fetchAccounts()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'testing':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Service Accounts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">External Service Integrations</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {showAddForm ? 'Cancel' : 'Add Service Account'}
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAddAccount} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value as ServiceType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="title_company">Title Company</option>
                  <option value="lender">Lender</option>
                  <option value="inspector">Inspector</option>
                  <option value="appraisal">Appraisal</option>
                  <option value="docusign">DocuSign</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g., Chicago Title"
                  value={formData.service_name}
                  onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account ID</label>
                <input
                  type="text"
                  placeholder="Your account ID"
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  placeholder="API key (will be encrypted)"
                  value={formData.api_key || ''}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.endpoint_url || ''}
                  onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="contact@service.com"
                  value={formData.contact_email || ''}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Create Service Account
            </button>
          </form>
        )}

        {/* Service Accounts List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading service accounts...</div>
        ) : accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <div key={account.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{account.service_name}</h3>
                    <p className="text-xs text-gray-600 mt-1">{account.service_type}</p>
                  </div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(account.status)}`}>
                    {account.status}
                  </span>
                </div>

                <div className="text-sm text-gray-700 space-y-1 mb-3">
                  <p><span className="font-medium">ID:</span> {account.account_id}</p>
                  {account.contact_person && <p><span className="font-medium">Contact:</span> {account.contact_person}</p>}
                  {account.contact_email && <p><span className="font-medium">Email:</span> {account.contact_email}</p>}
                  {account.last_test_at && (
                    <p><span className="font-medium">Last Test:</span> {new Date(account.last_test_at).toLocaleDateString()}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className="text-sm text-blue-600 hover:text-blue-900 font-medium">Edit</button>
                  <button className="text-sm text-amber-600 hover:text-amber-900 font-medium">Test</button>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="text-sm text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No service accounts configured. Add one to get started.</p>
          </div>
        )}
      </div>

      {/* Integration Logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Integration Activity</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Service</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Action</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{log.service_type}</td>
                    <td className="px-4 py-2">{log.action}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        log.status === 'success' ? 'bg-green-100 text-green-800' :
                        log.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{new Date(log.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExternalServiceIntegration
