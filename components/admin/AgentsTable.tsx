'use client';

import React from 'react';
import { Agent } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface AgentsTableProps {
  agents: Agent[];
  onApprove: (agent: Agent) => void;
  onReject: (agent: Agent) => void;
  onDeactivate: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}

export default function AgentsTable({
  agents,
  onApprove,
  onReject,
  onDeactivate,
  onEdit,
  onDelete,
}: AgentsTableProps) {
  const getActionButtons = (agent: Agent) => {
    const statusButtons = [];

    if (agent.status === 'awaiting_signature') {
      statusButtons.push(
        <button
          key="approve"
          onClick={() => onApprove(agent)}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
        >
          Approve
        </button>,
        <button
          key="reject"
          onClick={() => onReject(agent)}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
        >
          Reject
        </button>
      );
    }

    if (agent.status === 'approved' || agent.status === 'active') {
      statusButtons.push(
        <button
          key="deactivate"
          onClick={() => onDeactivate(agent)}
          className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition"
        >
          Deactivate
        </button>
      );
    }

    return (
      <div className="flex gap-2 justify-end">
        {statusButtons}
        <button
          onClick={() => onEdit(agent)}
          className="px-3 py-1 bg-blue-500/100 text-white text-sm rounded hover:bg-blue-600 transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(agent)}
          className="px-3 py-1 bg-[#1a1a2e] text-white text-sm rounded hover:bg-[#1a1a2e] transition"
        >
          Delete
        </button>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#1a1a2e] bg-[#050507]">
            <th className="px-6 py-4 text-left text-sm font-semibold text-white">
              Name
            </th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-white">
              Email
            </th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-white">
              Workspace Email
            </th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-white">
              Status
            </th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-white">
              Created
            </th>
            <th className="px-6 py-4 text-right text-sm font-semibold text-white">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr
              key={agent.id}
              className="border-b border-[#1a1a2e] hover:bg-[#0a0a0f] transition"
            >
              <td className="px-6 py-4">
                <div className="font-medium text-white">
                  {agent.first_name} {agent.last_name}
                </div>
                {agent.phone && (
                  <div className="text-sm text-gray-400">{agent.phone}</div>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-400">
                {agent.email}
              </td>
              <td className="px-6 py-4 text-sm text-gray-400">
                {agent.workspace_email || '—'}
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={agent.status} />
              </td>
              <td className="px-6 py-4 text-sm text-gray-400">
                {new Date(agent.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 text-right">
                {getActionButtons(agent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
