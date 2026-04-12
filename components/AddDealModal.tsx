'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface AddDealModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (deal: any) => Promise<void>
  userRole?: string
  currentUserId?: string
  agents?: Array<{ id: string; email: string; name?: string }>
  loading?: boolean
}

export default function AddDealModal({
  isOpen,
  onClose,
  onAdd,
  userRole = 'agent',
  currentUserId = '',
  agents = [],
  loading = false
}: AddDealModalProps) {
  const [formData, setFormData] = useState({
    property_address: '',
    client_name: '',
    contract_price: '',
    stage: 'new',
    notes: '',
    closing_date: '',
    agent_id: currentUserId
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      // Validation
      if (!formData.property_address.trim()) {
        throw new Error('Property address is required')
      }
      if (!formData.client_name.trim()) {
        throw new Error('Client name is required')
      }
      if (!formData.contract_price || isNaN(parseFloat(formData.contract_price))) {
        throw new Error('Valid contract price is required')
      }
      if (!formData.agent_id) {
        throw new Error('Agent must be selected')
      }

      await onAdd({
        ...formData,
        contract_price: parseFloat(formData.contract_price)
      })

      // Reset form
      setFormData({
        property_address: '',
        client_name: '',
        contract_price: '',
        stage: 'new',
        notes: '',
        closing_date: '',
        agent_id: currentUserId
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add deal')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Add New Deal</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Agent Selection (for admins/brokers) */}
          {userRole !== 'agent' && agents.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agent <span className="text-red-500">*</span>
              </label>
              <select
                name="agent_id"
                value={formData.agent_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an agent...</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Property Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="property_address"
              value={formData.property_address}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 123 Main St, Newark, NJ"
            />
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="client_name"
              value={formData.client_name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., John Smith"
            />
          </div>

          {/* Contract Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="contract_price"
              value={formData.contract_price}
              onChange={handleChange}
              required
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 450000"
            />
          </div>

          {/* Pipeline Stage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pipeline Stage
            </label>
            <select
              name="stage"
              value={formData.stage}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="new">New Lead</option>
              <option value="contacted">Contacted</option>
              <option value="showing">Showing</option>
              <option value="offer">Offer Sent</option>
              <option value="contract">Under Contract</option>
              <option value="inspection">Inspection</option>
              <option value="clear">Clear to Close</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Closing Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Closing Date
            </label>
            <input
              type="date"
              name="closing_date"
              value={formData.closing_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any additional details..."
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
