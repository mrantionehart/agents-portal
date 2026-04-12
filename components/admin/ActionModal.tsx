'use client';

import React from 'react';
import { Agent } from '@/lib/types';

type ActionType = 'approve' | 'reject' | 'deactivate';

interface ActionModalProps {
  agent: Agent;
  action: ActionType;
  rejectionReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
}

export default function ActionModal({
  agent,
  action,
  rejectionReason,
  onReasonChange,
  onConfirm,
  onCancel,
  isProcessing,
}: ActionModalProps) {
  const getContent = () => {
    switch (action) {
      case 'approve':
        return {
          title: 'Approve Agent',
          message: `Are you sure you want to approve ${agent.first_name} ${agent.last_name}? They will be granted full access to the platform.`,
          buttonColor: 'bg-green-600 hover:bg-green-700',
          showReason: false,
        };
      case 'reject':
        return {
          title: 'Reject Application',
          message: `Are you sure you want to reject ${agent.first_name} ${agent.last_name}'s application?`,
          buttonColor: 'bg-red-600 hover:bg-red-700',
          showReason: true,
        };
      case 'deactivate':
        return {
          title: 'Deactivate Agent',
          message: `Are you sure you want to deactivate ${agent.first_name} ${agent.last_name}? Their access will be suspended.`,
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
          showReason: false,
        };
    }
  };

  const content = getContent();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">{content.title}</h3>
          <p className="text-gray-600 mb-6">{content.message}</p>

          {content.showReason && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Explain why this agent is being rejected..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={4}
                required
              />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={
                isProcessing ||
                (content.showReason && !rejectionReason.trim())
              }
              className={`px-6 py-2 ${content.buttonColor} text-white font-semibold rounded-lg transition disabled:opacity-50`}
            >
              {isProcessing ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
