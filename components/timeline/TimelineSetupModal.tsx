/**
 * TimelineSetupModal Component
 * Setup timeline after dates are extracted
 */

'use client';

import { useState } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed

interface TimelineSetupModalProps {
  isOpen: boolean;
  transactionId: string;
  extractedDates: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TimelineSetupModal({
  isOpen,
  transactionId,
  extractedDates,
  onClose,
  onSuccess,
}: TimelineSetupModalProps) {
  // const { data: session } = useSession(); // DISABLED: next-auth not installed
  const [loading, setLoading] = useState(false);
  const [closingDate, setClosingDate] = useState(
    extractedDates?.closing_date || ''
  );
  const [dealType, setDealType] = useState('residential_purchase');
  const [customLeadTimes, setCustomLeadTimes] = useState(false);
  const [leadTimes, setLeadTimes] = useState<Record<string, number>>({});

  const handleGenerateTimeline = async () => {
    if (!closingDate) {
      alert('Please select a closing date');
      return;
    }

    setLoading(true);
    try {
      await vaultAPI.timeline.generateTimeline(
        transactionId,
        closingDate,
        dealType,
        customLeadTimes ? leadTimes : undefined,
        undefined,
        undefined
      );

      onSuccess();
    } catch (error) {
      console.error('Failed to generate timeline:', error);
      alert('Error generating timeline. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const dealTypes = [
    { value: 'residential_purchase', label: 'Residential Purchase' },
    { value: 'residential_sale', label: 'Residential Sale' },
    { value: 'commercial_lease', label: 'Commercial Lease' },
    { value: 'refinance', label: 'Refinance' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-blue-50">
          <h2 className="text-2xl font-bold text-gray-900">Setup Deal Timeline</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Extracted Information */}
          {Object.keys(extractedDates).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-bold text-green-900 mb-2">✓ Dates Extracted</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-800">
                {Object.entries(extractedDates).map(([type, date]) => (
                  date && (
                    <div key={type} className="flex justify-between">
                      <span className="capitalize">{type.replace(/_/g, ' ')}:</span>
                      <span className="font-medium">
                        {new Date(date).toLocaleDateString()}
                      </span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Closing Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Closing Date *
            </label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              This date will be used to calculate all intermediate deadlines
            </p>
          </div>

          {/* Deal Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deal Type
            </label>
            <select
              value={dealType}
              onChange={(e) => setDealType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {dealTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">
              Standard deadlines for this deal type will be used
            </p>
          </div>

          {/* Custom Lead Times */}
          <div>
            <label className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                checked={customLeadTimes}
                onChange={(e) => setCustomLeadTimes(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Use custom lead times
              </span>
            </label>

            {customLeadTimes && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-xs text-gray-600 mb-3">
                  Days before closing date for key milestones
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {['inspection', 'appraisal', 'financing', 'title'].map((type) => (
                    <div key={type}>
                      <label className="block text-xs text-gray-700 mb-1">
                        {type.charAt(0).toUpperCase() + type.slice(1)} Deadline
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={leadTimes[type] || ''}
                        onChange={(e) =>
                          setLeadTimes({
                            ...leadTimes,
                            [type]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">days before</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* What Will Happen */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 mb-2">What Happens Next</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Timeline will be generated working backwards from closing date</li>
              <li>✓ Tasks will be created automatically for each deadline</li>
              <li>✓ Broker will receive warnings for critical dates</li>
              <li>✓ All dates and tasks will be visible in the deal timeline</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateTimeline}
              disabled={loading || !closingDate}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Timeline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
