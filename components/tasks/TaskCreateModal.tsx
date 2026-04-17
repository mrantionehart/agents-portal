/**
 * TaskCreateModal Component
 * Allows agents to create tasks from templates or custom
 */

'use client';

import { useState, useEffect } from 'react';
import { vaultAPI } from '@/lib/vault-client';
// import { useSession } from 'next-auth/react'; // TODO: Install next-auth if needed

interface TaskCreateModalProps {
  isOpen: boolean;
  transactionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Template {
  id: string;
  name: string;
  deal_type: string;
  description: string;
  task_template_items: Array<{
    id: string;
    title: string;
    order_index: number;
  }>;
}

interface User {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
  };
}

export default function TaskCreateModal({
  isOpen,
  transactionId,
  onClose,
  onSuccess,
}: TaskCreateModalProps) {
  // const { data: session } = useSession(); // DISABLED: next-auth not installed
  const [templates, setTemplates] = useState<Template[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [useTemplate, setUseTemplate] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to_id: '',
    priority: 'medium' as const,
    due_date: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadTeamMembers();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const data = await vaultAPI.taskTemplates.list(
        undefined,
        undefined,
        undefined
      );
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      // Fetch team members from your auth/user endpoint
      // This is a placeholder - adjust based on your actual API
      setTeamMembers([]);
    } catch (error) {
      console.error('Failed to load team members:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const taskData: any = {
        transaction_id: transactionId,
        title: formData.title,
        description: formData.description,
        assigned_to_id: formData.assigned_to_id,
        priority: formData.priority,
      };

      if (formData.due_date) {
        taskData.due_date = new Date(formData.due_date).toISOString();
      }

      if (useTemplate && selectedTemplate) {
        taskData.task_template_id = selectedTemplate;
      }

      await vaultAPI.tasks.create(
        taskData,
        undefined,
        undefined
      );

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Error creating task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      assigned_to_id: '',
      priority: 'medium',
      due_date: '',
    });
    setSelectedTemplate('');
    setUseTemplate(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">Create Task</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Template Selection */}
          <div>
            <label className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                checked={useTemplate}
                onChange={(e) => setUseTemplate(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-medium">Use template</span>
            </label>

            {useTemplate && templates.length > 0 && (
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.deal_type})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Task Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Obtain title commitment"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details about this task..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium mb-2">Assign To</label>
            <select
              value={formData.assigned_to_id}
              onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select team member...</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.user_metadata?.name || member.email}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Due Date</label>
            <input
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Selected Template Preview */}
          {useTemplate && selectedTemplate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Checklist items will be created:
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                {templates
                  .find((t) => t.id === selectedTemplate)
                  ?.task_template_items.map((item) => (
                    <li key={item.id} className="flex items-center">
                      <span className="mr-2">☐</span>
                      {item.title}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
