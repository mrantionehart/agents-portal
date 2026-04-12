'use client';

import React from 'react';
import { AgentStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: AgentStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<AgentStatus, { bg: string; text: string; label: string }> = {
    pending_onboarding: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Pending' },
    awaiting_signature: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Awaiting Signature' },
    approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
    active: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Active' },
    inactive: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Inactive' },
  };

  const config = statusConfig[status] || statusConfig.pending_onboarding;

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
