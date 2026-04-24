'use client';

import React from 'react';
import { AgentStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: AgentStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<AgentStatus, { bg: string; text: string; label: string }> = {
    pending_onboarding: { bg: 'bg-[#0a0a0f]', text: 'text-white', label: 'Pending' },
    awaiting_signature: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Awaiting Signature' },
    approved: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Approved' },
    rejected: { bg: 'bg-red-500/15', text: 'text-red-800', label: 'Rejected' },
    active: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Active' },
    inactive: { bg: 'bg-orange-500/15', text: 'text-orange-800', label: 'Inactive' },
  };

  const config = statusConfig[status] || statusConfig.pending_onboarding;

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
