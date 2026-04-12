'use client';

import React, { useState, useEffect } from 'react';
import { Agent } from '@/lib/types';
import AddAgentForm from '@/components/admin/AddAgentForm';
import AgentsTable from '@/components/admin/AgentsTable';
import ActionModal from '@/components/admin/ActionModal';
import EditAgentModal from '@/components/admin/EditAgentModal';

type ActionType = 'approve' | 'reject' | 'deactivate' | null;
type EditMode = 'edit' | 'delete' | null;

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/agents');
      const result = await response.json();
      if (result.success) {
        setAgents(result.data || []);
      } else {
        setError(result.error || 'Failed to load agents');
      }
    } catch (err) {
      setError('Failed to load agents: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async (formData: any) => {
    try {
      setIsProcessing(true);
      setError(null);
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage('Agent created successfully!');
        setShowAddForm(false);
        await loadAgents();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to create agent');
      }
    } catch (err) {
      setError('Failed to create agent: ' + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = (agent: Agent, action: ActionType) => {
    setSelectedAgent(agent);
    setActionType(action);
    if (action !== 'reject') setRejectionReason('');
  };

  const confirmAction = async () => {
    if (!selectedAgent || !actionType) return;
    try {
      setIsProcessing(true);
      setError(null);
      const body: any = { action: actionType };
      if (actionType === 'reject') body.reason = rejectionReason;
      const response = await fetch(`/api/admin/agents/${selectedAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        const actionLabel = actionType === 'approve' ? 'Approved' : actionType === 'reject' ? 'Rejected' : 'Deactivated';
        setSuccessMessage(`Agent ${actionLabel} successfully!`);
        await loadAgents();
        setSelectedAgent(null);
        setActionType(null);
        setRejectionReason('');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || `Failed to ${actionType} agent`);
      }
    } catch (err) {
      setError(`Failed to ${actionType} agent: ` + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelAction = () => {
    setSelectedAgent(null);
    setActionType(null);
    setRejectionReason('');
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditMode('edit');
  };

  const handleEditSubmit = async (updates: any) => {
    if (!editingAgent) return;
    try {
      setIsProcessing(true);
      setError(null);
      const response = await fetch(`/api/admin/agents/${editingAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage('Agent updated successfully!');
        await loadAgents();
        setEditingAgent(null);
        setEditMode(null);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to update agent');
      }
    } catch (err) {
      setError('Failed to update agent: ' + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (agent: Agent) => {
    setEditingAgent(agent);
    setEditMode('delete');
  };

  const confirmDelete = async () => {
    if (!editingAgent) return;
    try {
      setIsProcessing(true);
      setError(null);
      const response = await fetch(`/api/admin/agents/${editingAgent.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage('Agent deleted successfully!');
        await loadAgents();
        setEditingAgent(null);
        setEditMode(null);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to delete agent');
      }
    } catch (err) {
      setError('Failed to delete agent: ' + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelEdit = () => {
    setEditingAgent(null);
    setEditMode(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Agent Management</h1>
          <p className="text-gray-600">Create, approve, and manage HartFelt real estate agents</p>
        </div>
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}
        {showAddForm ? (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Add New Agent</h2>
              </div>
              <div className="p-6">
                <AddAgentForm onSubmit={handleAddAgent} onCancel={() => setShowAddForm(false)} isLoading={isProcessing} />
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddForm(true)} className="mb-8 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
            + Add New Agent
          </button>
        )}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">All Agents ({agents.length})</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No agents yet. Create one to get started!</div>
          ) : (
            <AgentsTable
              agents={agents}
              onApprove={(agent) => handleAction(agent, 'approve')}
              onReject={(agent) => handleAction(agent, 'reject')}
              onDeactivate={(agent) => handleAction(agent, 'deactivate')}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
        {selectedAgent && actionType && (
          <ActionModal agent={selectedAgent} action={actionType} rejectionReason={rejectionReason} onReasonChange={setRejectionReason} onConfirm={confirmAction} onCancel={cancelAction} isProcessing={isProcessing} />
        )}

        {editingAgent && editMode === 'edit' && (
          <EditAgentModal agent={editingAgent} onConfirm={handleEditSubmit} onCancel={cancelEdit} isProcessing={isProcessing} />
        )}

        {editingAgent && editMode === 'delete' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Delete Agent</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{editingAgent.first_name} {editingAgent.last_name}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={cancelEdit}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {isProcessing ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
