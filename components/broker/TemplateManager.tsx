/**
 * TemplateManager Component
 * Admin/Broker template management for task templates
 */

'use client';

import { useState, useEffect } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed

interface Template {
  id: string;
  name: string;
  description: string;
  deal_type: string;
  is_active: boolean;
  task_template_items: Array<{
    id: string;
    title: string;
    order_index: number;
  }>;
}

interface TemplateManagerProps {
  dealTypeFilter?: string;
}

export default function TemplateManager({
  dealTypeFilter,
}: TemplateManagerProps) {
  // const { data: session } = useSession(); // DISABLED: next-auth not installed
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deal_type: 'residential_purchase',
    template_items: [] as Array<{ title: string; description?: string; order_index: number }>,
  });

  useEffect(() => {
    loadTemplates();
  }, [dealTypeFilter]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await vaultAPI.taskTemplates.list(
        dealTypeFilter,
        undefined,
        undefined
      );
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.deal_type) {
      alert('Please fill in required fields');
      return;
    }

    try {
      await vaultAPI.taskTemplates.create(
        {
          name: formData.name,
          description: formData.description,
          deal_type: formData.deal_type,
          template_items: formData.template_items,
        },
        undefined,
        undefined
      );

      resetForm();
      setShowCreateModal(false);
      await loadTemplates();
      alert('Template created successfully!');
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('Error creating template');
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTemplate) return;

    try {
      await vaultAPI.taskTemplates.update(
        editingTemplate.id,
        {
          name: formData.name,
          description: formData.description,
          deal_type: formData.deal_type,
          template_items: formData.template_items,
        },
        undefined,
        undefined
      );

      resetForm();
      setEditingTemplate(null);
      await loadTemplates();
      alert('Template updated successfully!');
    } catch (error) {
      console.error('Failed to update template:', error);
      alert('Error updating template');
    }
  };

  const handleAddTemplateItem = () => {
    setFormData({
      ...formData,
      template_items: [
        ...formData.template_items,
        { title: '', description: '', order_index: formData.template_items.length },
      ],
    });
  };

  const handleRemoveTemplateItem = (index: number) => {
    setFormData({
      ...formData,
      template_items: formData.template_items.filter((_, i) => i !== index),
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      deal_type: 'residential_purchase',
      template_items: [],
    });
  };

  const dealTypes = [
    { value: 'residential_purchase', label: 'Residential Purchase' },
    { value: 'residential_sale', label: 'Residential Sale' },
    { value: 'commercial_lease', label: 'Commercial Lease' },
    { value: 'refinance', label: 'Refinance' },
  ];

  if (selectedTemplate) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedTemplate(null)}
          className="text-blue-600 hover:text-blue-400 flex items-center gap-2"
        >
          ← Back to Templates
        </button>

        <div className="bg-[#0a0a0f] rounded-lg border border-[#1a1a2e] p-6">
          <h2 className="text-2xl font-bold mb-4">{selectedTemplate.name}</h2>
          <p className="text-gray-400 mb-4">{selectedTemplate.description}</p>

          <div className="mb-6">
            <span className="inline-block px-3 py-1 bg-blue-500/15 text-blue-400 rounded-full text-sm font-medium">
              {selectedTemplate.deal_type}
            </span>
          </div>

          <h3 className="text-lg font-bold mb-3">Checklist Items</h3>
          <div className="space-y-2">
            {selectedTemplate.task_template_items.map((item) => (
              <div key={item.id} className="flex items-center p-2 bg-[#050507] rounded">
                <span className="text-gray-400 mr-3">☐</span>
                <span className="text-white">{item.title}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                setEditingTemplate(selectedTemplate);
                setFormData({
                  name: selectedTemplate.name,
                  description: selectedTemplate.description,
                  deal_type: selectedTemplate.deal_type,
                  template_items: selectedTemplate.task_template_items.map((item) => ({
                    title: item.title,
                    description: '',
                    order_index: item.order_index,
                  })),
                });
                setSelectedTemplate(null);
              }}
              className="px-4 py-2 bg-blue-500/100 text-white rounded-lg hover:bg-blue-600"
            >
              Edit
            </button>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="px-4 py-2 border border-[#1a1a2e] text-gray-200 rounded-lg hover:bg-[#0a0a0f]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Task Templates</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingTemplate(null);
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-green-500/100 text-white rounded-lg hover:bg-green-600"
        >
          + Create Template
        </button>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No templates found. Create one to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="bg-[#0a0a0f] rounded-lg border border-[#1a1a2e] p-4 hover:border-blue-400 cursor-pointer transition-colors"
            >
              <h3 className="text-lg font-bold mb-2">{template.name}</h3>
              <p className="text-gray-400 text-sm mb-3">{template.description}</p>

              <div className="flex items-center justify-between">
                <span className="inline-block px-3 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs font-medium">
                  {template.deal_type}
                </span>
                <span className="text-sm text-gray-400">
                  {template.task_template_items.length} items
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTemplate) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
              className="p-6 space-y-6"
            >
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Template Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Residential Purchase Checklist"
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this template"
                  rows={2}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>

              {/* Deal Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Deal Type</label>
                <select
                  value={formData.deal_type}
                  onChange={(e) => setFormData({ ...formData, deal_type: e.target.value })}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  required
                >
                  {dealTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium">Checklist Items</label>
                  <button
                    type="button"
                    onClick={handleAddTemplateItem}
                    className="text-sm text-blue-600 hover:text-blue-400"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.template_items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const newItems = [...formData.template_items];
                          newItems[index].title = e.target.value;
                          setFormData({ ...formData, template_items: newItems });
                        }}
                        placeholder="Checklist item"
                        className="flex-1 px-3 py-2 border border-[#1a1a2e] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTemplateItem(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-[#1a1a2e] rounded-lg text-gray-200 hover:bg-[#0a0a0f] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500/100 text-white rounded-lg hover:bg-blue-600 font-medium"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
