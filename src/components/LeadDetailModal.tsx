'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, MessageSquare } from 'lucide-react';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  property_type: string;
  status: string;
  lead_score: number;
  temperature: string;
  source: string;
  estimated_timeline: string;
  budget_price_range: { min: number | null; max: number | null };
  notes: string;
  created_at: string;
}

interface Interaction {
  id: string;
  interaction_type: string;
  interaction_date: string;
  duration_minutes: number;
  notes: string;
  outcome: string;
  next_followup_date: string;
  created_by: string;
}

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
}

export default function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(true);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [formData, setFormData] = useState({
    interaction_type: 'call',
    duration_minutes: 15,
    notes: '',
    outcome: 'neutral',
    next_followup_date: ''
  });

  useEffect(() => {
    fetchInteractions();
  }, [lead.id]);

  const fetchInteractions = async () => {
    try {
      setLoadingInteractions(true);
      const response = await fetch(`/api/broker/leads/${lead.id}/interactions`);
      const data = await response.json();
      setInteractions(data);
    } catch (error) {
      console.error('Error fetching interactions:', error);
    } finally {
      setLoadingInteractions(false);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/broker/leads/${lead.id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          interaction_date: new Date().toISOString()
        })
      });

      if (response.ok) {
        setFormData({
          interaction_type: 'call',
          duration_minutes: 15,
          notes: '',
          outcome: 'neutral',
          next_followup_date: ''
        });
        setShowInteractionForm(false);
        await fetchInteractions();
      }
    } catch (error) {
      console.error('Error creating interaction:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {lead.first_name} {lead.last_name}
            </h2>
            <p className="text-gray-500 mt-1">Lead ID: {lead.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Lead Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Contact Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{lead.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium text-gray-900">{lead.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Source</p>
                  <p className="font-medium text-gray-900">{lead.source}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Lead Details
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${lead.lead_score}%` }}
                      ></div>
                    </div>
                    <span className="font-medium text-gray-900">
                      {lead.lead_score}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium text-gray-900">
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Temperature</p>
                  <p className="font-medium text-gray-900">
                    {lead.temperature.charAt(0).toUpperCase() + lead.temperature.slice(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interaction History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Interaction History
              </h3>
              <button
                onClick={() => setShowInteractionForm(!showInteractionForm)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-900"
              >
                <Plus className="w-4 h-4" />
                Log Interaction
              </button>
            </div>

            {showInteractionForm && (
              <form onSubmit={handleAddInteraction} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.interaction_type}
                      onChange={(e) =>
                        setFormData({ ...formData, interaction_type: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option>call</option>
                      <option>email</option>
                      <option>meeting</option>
                      <option>text</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_minutes: parseInt(e.target.value)
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInteractionForm(false)}
                    className="bg-gray-300 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loadingInteractions ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : interactions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No interactions yet</p>
            ) : (
              <div className="space-y-3">
                {interactions.map((interaction) => (
                  <div
                    key={interaction.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {interaction.interaction_type.charAt(0).toUpperCase() +
                            interaction.interaction_type.slice(1)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(interaction.interaction_date).toLocaleDateString()}
                      </span>
                    </div>
                    {interaction.notes && (
                      <p className="text-gray-600 text-sm">{interaction.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
